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
  async iniciarAnalise({ partidaId, videoKey, jogadoresCadastrados, coresUniforme }) {
    if (!partidaId || !videoKey) throw new Error("partidaId e videoKey são obrigatórios.");
    const workerUrl = import.meta.env.VITE_AI_WORKER_URL;
    if (!workerUrl) {
      throw new Error(
        "VITE_AI_WORKER_URL não configurada — a análise por IA não sabe pra onde mandar o vídeo. " +
        "Configure essa variável de ambiente (URL do Cloudflare Worker, veja cloudflare-worker/README.md) e faça um novo deploy."
      );
    }
    // Diferente da chamada antiga (Netlify), essa aqui só retorna quando a
    // análise termina de verdade — pode levar de segundos a alguns
    // minutos, dependendo do tamanho do trecho. Isso é esperado e não
    // trava a tela: quem chama iniciarAnalise (useAnaliseAoVivo) já trata
    // como "dispara e esquece" — o "Analisando..." que aparece pro
    // treinador vem do polling em consultarStatus (esse sim continua
    // rápido, na Netlify, sem mudança nenhuma).
    const res = await fetch(workerUrl, {
      method: "POST",
      headers: headersComToken(),
      body: JSON.stringify({ partidaId, videoKey, jogadoresCadastrados, coresUniforme }),
    });
    if (!res.ok) {
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
