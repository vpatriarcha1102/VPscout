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
      lado: {
        type: SchemaType.STRING,
        enum: ["pro", "contra"],
        nullable: true,
        description: "Para passe E finalizacao: 'pro' se foi a equipe do elenco cadastrado (cor do uniforme 'a favor') quem executou; 'contra' se foi o time adversário (cor do uniforme 'contra'). SEMPRE preencher, para os dois tipos — passes do adversário também devem ser reportados, contam para as estatísticas da equipe dele.",
      },
      atletaNumero: { type: SchemaType.NUMBER, nullable: true, description: "Número da camisa; use null se não identificado, ou se lado=contra (não sabemos os números do adversário)" },
      atletaDestinoNumero: { type: SchemaType.NUMBER, nullable: true, description: "Só para passe com lado=pro: número de quem recebeu" },
      resultado: {
        type: SchemaType.STRING,
        nullable: true,
        description: "Para passe: certo|errado. Para finalizacao (OBRIGATÓRIO, sempre preencher): gol|defendida|trave|nova_jogada|fora",
      },
      comemoracaoClara: {
        type: SchemaType.BOOLEAN,
        nullable: true,
        description: "Só para finalizacao com resultado=gol: true SOMENTE se, logo após a bola entrar, você vir claramente sinais inequívocos de comemoração (jogadores levantando os braços, correndo para comemorar, se abraçando, saindo da posição para celebrar) do time que marcou, OU o goleiro/adversário claramente lamentando e pegando a bola de dentro do gol. Se não houver esse sinal visível (câmera cortou, não deu tempo de mostrar reação, dúvida), deixe false.",
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

function montarPrompt(jogadoresCadastrados, coresUniforme) {
  const elenco = (jogadoresCadastrados || [])
    .map((j) => `#${j.numero} ${j.nome}${j.posicao ? ` (${j.posicao})` : ""}`)
    .join(", ");
  const infoCores = coresUniforme?.favor && coresUniforme?.contra
    ? `\nUniformes desta partida — MUITO IMPORTANTE para o campo "lado":\n- Cor DOMINANTE do uniforme "a favor" = a equipe do elenco cadastrado acima (lado "pro"). Cor de referência: ${coresUniforme.favor.label} (aproximadamente ${coresUniforme.favor.hex}).\n- Cor DOMINANTE do uniforme "contra" = o time adversário (lado "contra"). Cor de referência: ${coresUniforme.contra.label} (aproximadamente ${coresUniforme.contra.hex}).\nUse a cor que cobre a MAIOR PARTE da camisa de quem finalizou (ignore detalhes, números, mangas de cor diferente) para preencher "lado" em CADA finalização — inclusive as do adversário, que também devem ser reportadas (com atletaNumero null, já que não fazem parte do elenco cadastrado). Se a cor não bater exatamente com nenhuma das duas referências, escolha a mais parecida e reduza a confiança do evento.`
    : "";
  return `
Você é um analista de vídeo de futsal extremamente rigoroso e cético. Assista
ao vídeo e identifique eventos de jogo, usando o NÚMERO DA CAMISA para
reconhecer os jogadores do elenco cadastrado e a COR DOMINANTE DO UNIFORME
para diferenciar as duas equipes.

Elenco cadastrado: ${elenco || "(não informado)"}.
${infoCores}

Regras obrigatórias:
- Devolva SOMENTE eventos que você tem razoável certeza visual de ter visto.
- NUNCA invente jogador, passe ou finalização. Se não tiver certeza do
  número da camisa, use atletaNumero: null e reduza a confiança.
- Priorize, nesta ordem: finalizações (incluindo as que resultam em gol, de
  QUALQUER um dos dois times), passes (de QUALQUER um dos dois times).

Sobre os DOIS times — isso vale tanto para passe quanto para finalizacao:
- Sempre preencha "lado" ("pro" ou "contra") usando a cor dominante do
  uniforme de quem executou a jogada, conforme explicado acima.
- Time "pro" (elenco cadastrado): identifique o jogador pelo número da
  camisa sempre que possível (atletaNumero, e atletaDestinoNumero no caso
  de passe).
- Time "contra" (adversário): NÃO sabemos os nomes/números dele, então
  SEMPRE deixe atletaNumero e atletaDestinoNumero como null nesses casos —
  reporte só o evento (passe certo/errado, ou finalização com resultado),
  isso já é o suficiente para contar nas estatísticas do time adversário.

Sobre finalizações — ATENÇÃO, isso é a parte mais crítica e onde mais se
erra:
- Cada chute a gol é UM ÚNICO evento do tipo "finalizacao". NUNCA crie um
  evento separado só porque a bola entrou — "gol" não é um tipo de evento,
  é um VALOR do campo "resultado" dentro do mesmo evento de finalização.
- O campo "resultado" é obrigatório. Antes de escolher, você DEVE assistir
  a trajetória inteira da bola até ela parar de se mover, ser tocada por
  alguém, ou sair de quadra — nunca decida pelo movimento inicial do chute.
  Use exatamente uma destas 5 categorias:
  - "gol": só use se você vir COM CLAREZA a bola cruzar inteiramente a
    linha do gol, por dentro da trave e do travessão, sem nenhum defensor
    tocá-la depois disso. Se a câmera cortar, desviar ou não mostrar o
    instante final, NÃO marque "gol" — marque o resultado mais provável
    pela trajetória visível e reduza a confiança.
  - "defendida": o goleiro (ou um defensor na pequena área) intercepta ou
    espalma a bola antes da linha.
  - "trave": a bola bate na trave ou no travessão e NÃO entra.
  - "nova_jogada": um defensor de linha bloqueia/desvia a bola antes do
    gol, e a bola continua em jogo (rebote, escanteio, nova jogada) — sem
    ser o goleiro e sem sair pela linha de fundo.
  - "fora": a bola passa ao lado do gol, por cima do travessão, ou sai
    pela linha de fundo sem tocar em ninguém — qualquer caso que não se
    encaixe claramente nas 4 categorias acima.
  Regra de desempate: se você tiver qualquer dúvida real entre "gol" e
  outra categoria, escolha a outra categoria e reduza a confiança — é
  preferível classificar errado uma finalização não-gol do que inventar
  um gol que não aconteceu.
- Se o final da trajetória não estiver visível no vídeo, reduza bastante a
  confiança em vez de assumir "gol" por padrão.
- Exceção que aumenta a confiança de um "gol": se, logo depois da bola
  entrar, você vir claramente jogadores do time que marcou comemorando
  (comemoração inequívoca — braços erguidos, correndo, abraços, saindo da
  posição), marque comemoracaoClara: true e pode usar confiança alta. Sem
  esse sinal visível, deixe comemoracaoClara: false mesmo achando que foi
  gol — a comemoração clara é o que permite pular a revisão manual desse
  gol, então só marque true quando for realmente óbvio.
- confianca reflete sua certeza real (0 a 1) — use valores baixos (abaixo
  de 0.6) sempre que houver ambiguidade real, para que esses casos sejam
  revisados manualmente por um humano depois.
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

  const { videoKey, jogadoresCadastrados, coresUniforme } = body;
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
      { text: montarPrompt(jogadoresCadastrados, coresUniforme) },
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
