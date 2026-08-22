import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, getBucket, jsonResponse, erroSeguro, verificarToken } from "./_r2Client.js";

const MAX_PART_NUMBER = 2000;

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

  const { key, uploadId, partNumber } = body;
  if (!key || !uploadId || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > MAX_PART_NUMBER) {
    return jsonResponse(400, { erro: "key, uploadId e partNumber (1–2000) são obrigatórios." });
  }
  if (!key.startsWith("videos/")) {
    return jsonResponse(400, { erro: "key inválida." });
  }

  try {
    const client = getR2Client();
    const bucket = getBucket();
    const url = await getSignedUrl(
      client,
      new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }),
      { expiresIn: 3600 }
    );
    return jsonResponse(200, { url });
  } catch (e) {
    return erroSeguro(e, "upload-sign-part");
  }
}
