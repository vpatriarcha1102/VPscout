import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, getBucket, jsonResponse, erroSeguro, verificarToken, sanitizarPartidaId } from "./_r2Client.js";

const EXPIRA_EM_SEGUNDOS = 2 * 60 * 60; // 2h

// Content-Type correto pelo tipo do arquivo, independente do que ficou
// gravado no objeto no momento do upload. Sem isso, se o Content-Type
// salvo no R2 vier errado/genérico (ex: application/octet-stream), o
// Chrome não reconhece como vídeo pra tocar inline dentro do <video> —
// e some para uma aba de download separada, dando a impressão de que
// "abriu fora do app".
function contentTypePorExtensao(videoKey) {
  const ext = (videoKey.split(".").pop() || "").toLowerCase();
  if (ext === "mp4") return "video/mp4";
  if (ext === "mov") return "video/quicktime";
  return "video/webm";
}

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
      new GetObjectCommand({
        Bucket: bucket,
        Key: videoKey,
        // Força o navegador a reconhecer como vídeo e tocar embutido na
        // página (inline), em vez de baixar/abrir numa aba separada.
        ResponseContentType: contentTypePorExtensao(videoKey),
        ResponseContentDisposition: "inline",
        // Deixa o navegador guardar o vídeo em cache local depois da
        // primeira vez que abre — reassistir fica instantâneo (não baixa
        // de novo do R2), enquanto a URL assinada ainda for válida.
        ResponseCacheControl: "private, max-age=7200, immutable",
      }),
      { expiresIn: EXPIRA_EM_SEGUNDOS }
    );
    return jsonResponse(200, { url, expiraEm: Date.now() + EXPIRA_EM_SEGUNDOS * 1000 });
  } catch (e) {
    return erroSeguro(e, "video-playback-url");
  }
}
