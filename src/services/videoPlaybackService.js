/**
 * videoPlaybackService — obtém uma URL temporária de leitura do vídeo já
 * enviado ao R2, para a tela de revisão poder tocar o vídeo e pular
 * para o timestamp de cada evento.
 */

import { headersComToken } from "../lib/apiToken";

export async function obterUrlReproducao({ partidaId, videoKey }) {
  const res = await fetch("/.netlify/functions/video-playback-url", {
    method: "POST",
    headers: headersComToken(),
    body: JSON.stringify({ partidaId, videoKey }),
  });
  if (!res.ok) {
    let detalhe = "";
    try { detalhe = (await res.json()).erro || ""; } catch { /* ignore */ }
    throw new Error(detalhe || `Não foi possível carregar o vídeo (${res.status}).`);
  }
  return res.json();
}
