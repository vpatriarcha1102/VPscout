import { AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getR2Client, getBucket, jsonResponse, erroSeguro, verificarToken } from "./_r2Client.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return jsonResponse(200, {});
  if (event.httpMethod !== "POST") return jsonResponse(405, { erro: "Method Not Allowed" });

  const erroToken = verificarToken(event);
  if (erroToken) return erroToken;

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { erro: "JSON inválido." });
  }

  const { key, uploadId } = body;
  if (!key || !uploadId) return jsonResponse(400, { erro: "key e uploadId são obrigatórios." });

  try {
    const client = getR2Client();
    const bucket = getBucket();
    await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }));
    return jsonResponse(200, { ok: true });
  } catch (e) {
    return erroSeguro(e, "upload-abort");
  }
}
