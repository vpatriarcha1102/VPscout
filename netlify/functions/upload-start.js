import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getR2Client, getBucket, jsonResponse, erroSeguro, verificarToken, sanitizarPartidaId } from "./_r2Client.js";

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

  const { contentType } = body;
  let partidaId;
  try {
    partidaId = sanitizarPartidaId(body.partidaId);
  } catch (e) {
    return jsonResponse(400, { erro: e.message });
  }

  const key = `videos/${partidaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webm`;

  try {
    const client = getR2Client();
    const bucket = getBucket();
    const res = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType || "video/webm",
        Metadata: { partidaid: String(partidaId), criadoem: String(Date.now()) },
      })
    );
    return jsonResponse(200, { uploadId: res.UploadId, key });
  } catch (e) {
    return erroSeguro(e, "upload-start");
  }
}
