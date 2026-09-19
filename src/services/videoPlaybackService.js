/**
 * videoPlaybackService — obtém uma URL temporária de leitura do vídeo já
 * enviado ao R2, para a tela de revisão poder tocar o vídeo e pular
 * para o timestamp de cada evento.
 */

import { headersComToken } from "../lib/apiToken";

// Cache em memória por videoKey (dura enquanto o app estiver aberto).
// Sem isso, cada vez que a pessoa saía e voltava numa tela de vídeo, o app
// pedia uma URL assinada NOVA — como a assinatura muda a cada pedido, o
// cache do navegador nunca reconhecia como "o mesmo arquivo" e baixava
// tudo de novo. Reaproveitando a mesma URL enquanto ela for válida, a
// segunda vez que o vídeo abre vem direto do cache do navegador.
const cacheUrls = new Map(); // videoKey -> { url, expiraEm }
const MARGEM_SEGURANCA_MS = 5 * 60 * 1000; // renova 5min antes de expirar de verdade

export async function obterUrlReproducao({ partidaId, videoKey }) {
  const emCache = cacheUrls.get(videoKey);
  if (emCache && emCache.expiraEm - MARGEM_SEGURANCA_MS > Date.now()) {
    return { url: emCache.url, expiraEm: emCache.expiraEm };
  }

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
  const dados = await res.json();
  cacheUrls.set(videoKey, dados);
  return dados;
}
