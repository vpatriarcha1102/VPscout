// netlify/functions/_r2Client.js
//
// Cliente S3 compartilhado, apontando para o Cloudflare R2 (compatível
// com a API S3). Usado só dentro das Netlify Functions — a chave de
// acesso nunca é enviada ao frontend. O frontend só recebe URLs
// pré-assinadas de curta duração para cada parte do upload.

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

export class ConfigError extends Error {}

let clienteCache = null;

export function getR2Client() {
  if (clienteCache) return clienteCache;

  const accountId = process.env.VIDEO_STORAGE_ACCOUNT_ID;
  const accessKeyId = process.env.VIDEO_STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.VIDEO_STORAGE_SECRET_ACCESS_KEY;

  const faltando = [
    !accountId && "VIDEO_STORAGE_ACCOUNT_ID",
    !accessKeyId && "VIDEO_STORAGE_ACCESS_KEY_ID",
    !secretAccessKey && "VIDEO_STORAGE_SECRET_ACCESS_KEY",
  ].filter(Boolean);

  if (faltando.length) {
    throw new ConfigError(
      `Variável(is) de ambiente ausente(s) na Netlify: ${faltando.join(", ")}. ` +
      `Configure em Site configuration > Environment variables e faça um novo deploy.`
    );
  }

  clienteCache = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    // O R2 não suporta os headers de checksum (x-amz-checksum-*) que
    // versões recentes do AWS SDK v3 passaram a enviar por padrão em
    // toda requisição (inclusive multipart upload). Sem isso desligado,
    // chamadas como CreateMultipartUploadCommand falham com um erro
    // genérico do R2, mesmo com credenciais e bucket corretos.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return clienteCache;
}

export function getBucket() {
  const bucket = process.env.VIDEO_STORAGE_BUCKET;
  if (!bucket) {
    throw new ConfigError(
      "Variável de ambiente ausente na Netlify: VIDEO_STORAGE_BUCKET. " +
      "Configure em Site configuration > Environment variables e faça um novo deploy."
    );
  }
  return bucket;
}

export function jsonResponse(statusCode, body) {
  const origem = process.env.ALLOWED_ORIGIN || "*";
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origem,
      "Access-Control-Allow-Headers": "Content-Type, X-VPScouts-Token",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

export function erroSeguro(e, contexto) {
  if (e instanceof ConfigError) {
    console.error(`[${contexto}] erro de configuração:`, e.message);
    return jsonResponse(500, { erro: e.message });
  }
  console.error(`[${contexto}]`, e);
  const detalhe = e?.Code || e?.name || e?.message;
  return jsonResponse(500, {
    erro: detalhe ? `Falha em ${contexto}: ${detalhe}` : `Falha em ${contexto}.`,
  });
}

export function verificarToken(event) {
  const esperado = process.env.APP_SHARED_TOKEN;
  if (!esperado) return null;
  const recebido = event.headers?.["x-vpscouts-token"] || event.headers?.["X-VPScouts-Token"];
  if (recebido !== esperado) {
    console.warn("[verificarToken] token de app ausente ou inválido.");
    return jsonResponse(401, { erro: "Não autorizado — o token de app (APP_SHARED_TOKEN no servidor) não bate com o do site (VITE_APP_SHARED_TOKEN). Confira se os dois têm exatamente o mesmo valor nas variáveis de ambiente do Netlify." });
  }
  return null;
}

export function sanitizarPartidaId(partidaId) {
  const limpo = String(partidaId ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!limpo) throw new Error("partidaId inválido.");
  return limpo;
}

export async function salvarJSON(key, obj) {
  const client = getR2Client();
  const bucket = getBucket();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(obj),
    ContentType: "application/json",
  }));
}

export async function lerJSON(key) {
  const client = getR2Client();
  const bucket = getBucket();
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const texto = await res.Body.transformToString();
    return JSON.parse(texto);
  } catch (e) {
    if (e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
}
