// netlify/functions/check-config.js
//
// Diagnóstico de configuração — NUNCA retorna o valor de nenhuma variável,
// só se ela está presente ou não. Existe pra responder rápido "por que a
// IA não analisa" ou "por que não sincroniza entre aparelhos" sem precisar
// caçar isso no console do navegador ou nos logs da Netlify.
import { jsonResponse, erroSeguro, verificarToken } from "./_r2Client.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return jsonResponse(200, {});
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return jsonResponse(405, { erro: "Method Not Allowed" });
  }

  const erroToken = verificarToken(event);
  if (erroToken) return erroToken;

  try {
    const presente = (v) => Boolean(v && String(v).trim());
    return jsonResponse(200, {
      video: {
        VIDEO_STORAGE_ACCOUNT_ID: presente(process.env.VIDEO_STORAGE_ACCOUNT_ID),
        VIDEO_STORAGE_ACCESS_KEY_ID: presente(process.env.VIDEO_STORAGE_ACCESS_KEY_ID),
        VIDEO_STORAGE_SECRET_ACCESS_KEY: presente(process.env.VIDEO_STORAGE_SECRET_ACCESS_KEY),
        VIDEO_STORAGE_BUCKET: presente(process.env.VIDEO_STORAGE_BUCKET),
      },
      ia: {
        GEMINI_API_KEY: presente(process.env.GEMINI_API_KEY),
      },
      seguranca: {
        APP_SHARED_TOKEN: presente(process.env.APP_SHARED_TOKEN),
      },
    });
  } catch (e) {
    return erroSeguro(e, "check-config");
  }
}
