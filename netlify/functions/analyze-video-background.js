// netlify/functions/analyze-video-background.js
//
// Esta é uma Background Function da Netlify (sufixo "-background" no
// nome do arquivo ativa esse modo: roda em segundo plano por mais tempo
// que uma function normal, o que é necessário pra baixar o vídeo do R2,
// mandar pra Gemini, esperar processar e pedir a análise).

import { HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { getR2Client, getBucket, verificarToken, salvarJSON, sanitizarPartidaId } from "./_r2Client.js";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function extensaoPara(contentType) {
  if (contentType?.includes("mp4")) return "mp4";
  if (contentType?.includes("quicktime")) return "mov";
  return "webm";
}

const LIMITE_SEGURO_BYTES = 500 * 1024 * 1024; // 500MB

const EVENTOS_SCHEMA = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      timestampSeg: { type: SchemaType.NUMBER, description: "Segundos desde o início do vídeo" },
      tipo: { type: SchemaType.STRING, enum: ["passe", "finalizacao"] },
      atletaNumero: { type: SchemaType.NUMBER, nullable: true, description: "Número da camisa; null se não identificado" },
      atletaDestinoNumero: { type: SchemaType.NUMBER, nullable: true, description: "Só para passe: número de quem recebeu" },
      resultado: {
        type: SchemaType.STRING,
        nullable: true,
        description: "Para passe: certo|errado. Para finalizacao (OBRIGATÓRIO, sempre preencher): gol|no_alvo|bloqueada|fora",
      },
      confianca: { type: SchemaType.NUMBER, description: "0 a 1" },
    },
    required: ["timestampSeg", "tipo", "confianca"],
  },
};

async function streamParaBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function montarPrompt(jogadoresCadastrados) {
  const elenco = (jogadoresCadastrados || [])
    .map((j) => `#${j.numero} ${j.nome}${j.posicao ? ` (${j.posicao})` : ""}`)
    .join(", ");
  return `
Você é um analista de vídeo de futsal. Assista ao vídeo e identifique eventos
de jogo do time cujo elenco está listado abaixo, usando o NÚMERO DA CAMISA
para reconhecer os jogadores.

Elenco cadastrado: ${elenco || "(não informado)"}.

Regras obrigatórias:
- Devolva SOMENTE eventos que você tem razoável certeza visual de ter visto.
- NUNCA invente jogador, passe ou finalização. Se não tiver certeza do
  número da camisa, use atletaNumero: null e reduza a confiança.
- Priorize, nesta ordem: finalizações (incluindo as que resultam em gol), passes.

Sobre finalizações — ATENÇÃO, isso é crítico:
- Cada chute a gol é UM ÚNICO evento do tipo "finalizacao". NUNCA crie um
  evento separado só porque a bola entrou — "gol" não é um tipo de evento,
  é um VALOR do campo "resultado" dentro do mesmo evento de finalização.
- O campo "resultado" da finalização é obrigatório e deve refletir o que
  REALMENTE aconteceu com a bola, observando a trajetória inteira até ela
  parar, ser defendida ou sair — não assuma "gol" só porque o chute foi na
  direção do gol:
  - "gol": a bola cruza inteiramente a linha, dentro da trave.
  - "defendida": o goleiro (ou outro defensor) intercepta a bola antes da
    linha.
  - "bloqueada": a bola é bloqueada antes de chegar ao gol (ex.: por um
    zagueiro).
  - "fora": a bola passa ao lado, por cima do travessão, ou não entra por
    qualquer outro motivo.
- Se o final da trajetória não estiver visível no vídeo, reduza a
  confiança em vez de assumir "gol" por padrão.
- confianca reflete sua certeza real (0 a 1), não um valor fixo.
`.trim();
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return;

  const erroToken = verificarToken(event);
  if (erroToken) {
    console.warn("[analyze-video-background] chamada rejeitada: token inválido.");
    return;
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    console.error("[analyze-video-background] JSON inválido no corpo da requisição.");
    return;
  }

  const { videoKey, jogadoresCadastrados } = body;
  let partidaId;
  try {
    partidaId = sanitizarPartidaId(body.partidaId);
  } catch (e) {
    console.error("[analyze-video-background]", e.message);
    return;
  }
  if (!videoKey) {
    console.error("[analyze-video-background] videoKey ausente.");
    return;
  }

  const statusKey = `analises/${partidaId}/status.json`;
  const iniciadoEm = Date.now();

  try {
    await salvarJSON(statusKey, { status: "processando", videoKey, iniciadoEm, atualizadoEm: iniciadoEm });

    const client = getR2Client();
    const bucket = getBucket();

    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: videoKey }));
    const tamanhoBytes = head.ContentLength || 0;
    const contentType = head.ContentType || "video/webm";

    if (tamanhoBytes > LIMITE_SEGURO_BYTES) {
      throw new Error(
        `Vídeo de ${(tamanhoBytes / 1024 / 1024).toFixed(0)}MB excede o limite atual de ` +
        `processamento (${LIMITE_SEGURO_BYTES / 1024 / 1024}MB). A segmentação de vídeos ` +
        `longos está prevista para a Etapa 11.`
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada nas variáveis de ambiente da Netlify.");

    const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: videoKey }));
    const bufferVideo = await streamParaBuffer(obj.Body);

    // A biblioteca do Gemini (uploadFile) exige um CAMINHO de arquivo em
    // disco, não aceita o conteúdo binário direto — por isso gravamos o
    // vídeo num arquivo temporário antes de enviar, e apagamos depois.
    const caminhoTemp = join(tmpdir(), `vpscouts-${partidaId}-${Date.now()}.${extensaoPara(contentType)}`);
    await writeFile(caminhoTemp, bufferVideo);

    const fileManager = new GoogleAIFileManager(apiKey);
    let uploadResult;
    try {
      uploadResult = await fileManager.uploadFile(caminhoTemp, {
        mimeType: contentType,
        displayName: `vpscouts-${partidaId}`,
      });
    } finally {
      await unlink(caminhoTemp).catch(() => {});
    }

    let arquivo = uploadResult.file;
    while (arquivo.state === FileState.PROCESSING) {
      await new Promise((r) => setTimeout(r, 5000));
      arquivo = await fileManager.getFile(arquivo.name);
    }
    if (arquivo.state === FileState.FAILED) {
      throw new Error("A Gemini não conseguiu processar o vídeo enviado.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: EVENTOS_SCHEMA,
        // temperature 0 = sempre a leitura mais criteriosa/provável da cena,
        // sem variar a resposta entre execuções do mesmo vídeo.
        temperature: 0,
        topP: 0.1,
        topK: 1,
      },
    });

    const resultado = await model.generateContent([
      { fileData: { fileUri: arquivo.uri, mimeType: arquivo.mimeType } },
      { text: montarPrompt(jogadoresCadastrados) },
    ]);

    const eventosIA = JSON.parse(resultado.response.text());

    await salvarJSON(statusKey, {
      status: "concluido",
      videoKey,
      iniciadoEm,
      atualizadoEm: Date.now(),
      eventos: eventosIA,
    });

    try { await fileManager.deleteFile(arquivo.name); } catch { /* best-effort */ }
  } catch (e) {
    console.error("[analyze-video-background]", e);
    await salvarJSON(statusKey, {
      status: "erro",
      videoKey,
      iniciadoEm,
      atualizadoEm: Date.now(),
      erro: e?.message || "Falha desconhecida na análise.",
    }).catch((e2) => console.error("[analyze-video-background] falha ao gravar status de erro", e2));
  }
}
