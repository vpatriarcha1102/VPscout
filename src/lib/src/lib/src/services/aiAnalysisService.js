/**
 * AIAnalysisService
 * Camada abstrata entre o VPScouts e o provedor de IA de análise de
 * vídeo (Gemini). Modelo assíncrono: iniciarAnalise() dispara e retorna
 * na hora; consultarStatus() é chamado em polling até terminar.
 */

import { headersComToken } from "../lib/apiToken";

async function postJSON(path, body) {
  const res = await fetch(path, { method: "POST", headers: headersComToken(), body: JSON.stringify(body) });
  if (!res.ok) {
    let detalhe = "";
    try { detalhe = (await res.json()).erro || ""; } catch { /* ignore */ }
    throw new Error(detalhe || `Falha na requisição (${res.status}).`);
  }
  return res.json();
}

export class AIAnalysisService {
  async iniciarAnalise({ partidaId, videoKey, jogadoresCadastrados }) {
    if (!partidaId || !videoKey) throw new Error("partidaId e videoKey são obrigatórios.");
    const res = await fetch("/.netlify/functions/analyze-video-background", {
      method: "POST",
      headers: headersComToken(),
      body: JSON.stringify({ partidaId, videoKey, jogadoresCadastrados }),
    });
    if (!res.ok && res.status !== 202) {
      let detalhe = "";
      try { detalhe = (await res.json()).erro || ""; } catch { /* ignore */ }
      throw new Error(detalhe || `Falha ao iniciar a análise (${res.status}).`);
    }
    return { status: "processando" };
  }

  async consultarStatus(partidaId) {
    if (!partidaId) throw new Error("partidaId é obrigatório.");
    return postJSON("/.netlify/functions/analyze-status", { partidaId });
  }
}

let instancia = null;

export function getAIAnalysisService() {
  if (!instancia) instancia = new AIAnalysisService();
  return instancia;
}
