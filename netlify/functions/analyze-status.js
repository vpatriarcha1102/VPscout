import { jsonResponse, erroSeguro, verificarToken, lerJSON, sanitizarPartidaId } from "./_r2Client.js";

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

  let partidaId;
  try {
    partidaId = sanitizarPartidaId(body.partidaId);
  } catch (e) {
    return jsonResponse(400, { erro: e.message });
  }

  try {
    const status = await lerJSON(`analises/${partidaId}/status.json`);
    if (!status) return jsonResponse(200, { status: "inexistente" });
    return jsonResponse(200, status);
  } catch (e) {
    return erroSeguro(e, "analyze-status");
  }
}
