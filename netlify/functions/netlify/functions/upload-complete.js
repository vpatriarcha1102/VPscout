import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
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

  const { key, uploadId, parts } = body;
  if (!key || !uploadId || !Array.isArray(parts) || parts.length === 0) {
    return jsonResponse(400, { erro: "key, uploadId e parts[] são obrigatórios." });
  }

  try {
    const client = getR2Client();
    const bucket = getBucket();
    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts
            .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag }))
            .sort((a, b) => a.PartNumber - b.PartNumber),
        },
      })
    );
    return jsonResponse(200, { ok: true, key });
  } catch (e) {
    return erroSeguro(e, "upload-complete");
  }
}
