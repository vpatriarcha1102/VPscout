import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, getBucket, jsonResponse, erroSeguro, verificarToken, sanitizarPartidaId } from "./_r2Client.js";

const EXPIRA_EM_SEGUNDOS = 2 * 60 * 60; // 2h

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

  const { videoKey } = body;
  let partidaId;
  try {
    partidaId = sanitizarPartidaId(body.partidaId);
  } catch (e) {
    return jsonResponse(400, { erro: e.message });
  }

  if (!videoKey || !videoKey.startsWith(`videos/${partidaId}/`)) {
    return jsonResponse(400, { erro: "videoKey não corresponde à partida informada." });
  }

  try {
    const client = getR2Client();
    const bucket = getBucket();
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: videoKey }),
      { expiresIn: EXPIRA_EM_SEGUNDOS }
    );
    return jsonResponse(200, { url, expiraEm: Date.now() + EXPIRA_EM_SEGUNDOS * 1000 });
  } catch (e) {
    return erroSeguro(e, "video-playback-url");
  }
}
