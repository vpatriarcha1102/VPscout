/**
 * videoUploadService — Etapa 3
 * ------------------------------------------------------------
 * Envia o vídeo gravado (Blob) para o Cloudflare R2 em partes, direto do
 * navegador para o storage (as functions da Netlify só assinam URLs —
 * o vídeo nunca passa pelo servidor da Netlify).
 *
 * Características:
 *  - retoma upload interrompido (reload da página, app fechado no meio):
 *    o Blob e as partes já confirmadas ficam salvos no IndexedDB
 *    (videoStore) e a próxima chamada continua de onde parou;
 *  - fica "aguardando conexão" quando offline, e retoma sozinho quando a
 *    internet volta;
 *  - nunca inventa progresso: se uma parte falha, tenta de novo (com
 *    backoff) antes de reportar erro.
 */

import * as videoStore from "../lib/videoStore";
import { headersComToken } from "../lib/apiToken";

const PART_SIZE = 8 * 1024 * 1024; // 8MB — acima do mínimo de 5MB exigido pelo R2/S3 multipart
const MAX_TENTATIVAS_POR_PARTE = 4;

async function postJSON(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: headersComToken(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detalhe = "";
    try { detalhe = (await res.json()).erro || ""; } catch { /* ignore */ }
    throw new Error(detalhe || `Falha na requisição (${res.status}).`);
  }
  return res.json();
}

function calcularPartes(tamanhoBytes, partSize) {
  const total = Math.max(1, Math.ceil(tamanhoBytes / partSize));
  const partes = [];
  for (let i = 0; i < total; i++) {
    partes.push({
      partNumber: i + 1,
      inicio: i * partSize,
      fim: Math.min(tamanhoBytes, (i + 1) * partSize),
    });
  }
  return partes;
}

function offline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function espera(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enviarParte({ registro, parteInfo, blob }) {
  const fatia = blob.slice(parteInfo.inicio, parteInfo.fim);
  let ultimoErro = null;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_POR_PARTE; tentativa++) {
    if (offline()) throw Object.assign(new Error("offline"), { offline: true });
    try {
      const { url } = await postJSON("/.netlify/functions/upload-sign-part", {
        key: registro.key,
        uploadId: registro.uploadId,
        partNumber: parteInfo.partNumber,
      });
      const res = await fetch(url, { method: "PUT", body: fatia });
      if (!res.ok) throw new Error(`Falha ao enviar parte ${parteInfo.partNumber} (${res.status}).`);
      const etag = res.headers.get("ETag");
      if (!etag) {
        throw new Error(
          "O storage não devolveu ETag da parte — verifique a configuração de CORS " +
          "do bucket R2 (ExposeHeaders precisa incluir ETag)."
        );
      }
      return etag;
    } catch (e) {
      if (e.offline) throw e;
      ultimoErro = e;
      await espera(500 * tentativa);
    }
  }
  throw ultimoErro || new Error(`Não foi possível enviar a parte ${parteInfo.partNumber}.`);
}

async function processar(registro, callbacks = {}) {
  const { onStatus, onProgresso, onErro, onConcluido } = callbacks;
  const blob = registro.blob;

  try {
    if (offline()) {
      registro.status = "aguardando_conexao";
      await videoStore.salvarRegistro(registro);
      onStatus?.("aguardando_conexao");
      aguardarConexaoERetomar(registro.partidaId, callbacks);
      return;
    }

    onStatus?.(registro.status === "preparando" ? "preparando" : "enviando");

    if (!registro.uploadId || !registro.key) {
      const { uploadId, key } = await postJSON("/.netlify/functions/upload-start", {
        partidaId: registro.partidaId,
        contentType: registro.contentType,
      });
      registro.uploadId = uploadId;
      registro.key = key;
      await videoStore.salvarRegistro(registro);
    }

    onStatus?.("enviando");
    const todasPartes = calcularPartes(registro.tamanhoBytes, registro.partSize || PART_SIZE);
    const jaEnviadas = new Set((registro.partesEnviadas || []).map((p) => p.partNumber));
    const restantes = todasPartes.filter((p) => !jaEnviadas.has(p.partNumber));

    for (const parteInfo of restantes) {
      if (offline()) {
        registro.status = "aguardando_conexao";
        await videoStore.salvarRegistro(registro);
        onStatus?.("aguardando_conexao");
        aguardarConexaoERetomar(registro.partidaId, callbacks);
        return;
      }
      const etag = await enviarParte({ registro, parteInfo, blob });
      registro.partesEnviadas = [...(registro.partesEnviadas || []), { partNumber: parteInfo.partNumber, etag }];
      await videoStore.salvarRegistro(registro);
      const percent = Math.round((registro.partesEnviadas.length / todasPartes.length) * 100);
      onProgresso?.(percent);
    }

    await postJSON("/.netlify/functions/upload-complete", {
      key: registro.key,
      uploadId: registro.uploadId,
      parts: registro.partesEnviadas,
    });

    registro.blob = null;
    registro.status = "concluido";
    await videoStore.salvarRegistro(registro);
    onProgresso?.(100);
    onStatus?.("concluido");
    onConcluido?.({ key: registro.key });
  } catch (e) {
    if (e?.offline) {
      registro.status = "aguardando_conexao";
      await videoStore.salvarRegistro(registro);
      onStatus?.("aguardando_conexao");
      aguardarConexaoERetomar(registro.partidaId, callbacks);
      return;
    }
    registro.status = "erro";
    registro.erro = e?.message || "Falha desconhecida no upload.";
    await videoStore.salvarRegistro(registro);
    onErro?.(registro.erro);
  }
}

const listenersOnlineAtivos = new Set();

function aguardarConexaoERetomar(partidaId, callbacks) {
  if (typeof window === "undefined" || listenersOnlineAtivos.has(partidaId)) return;
  listenersOnlineAtivos.add(partidaId);
  const handler = async () => {
    window.removeEventListener("online", handler);
    listenersOnlineAtivos.delete(partidaId);
    const registro = await videoStore.lerRegistro(partidaId).catch(() => null);
    if (registro && registro.blob && registro.status !== "concluido") {
      processar(registro, callbacks);
    }
  };
  window.addEventListener("online", handler);
}

export async function enviarNovoVideo({ partidaId, blob, contentType }, callbacks) {
  const registro = {
    partidaId,
    blob,
    contentType: contentType || blob.type || "video/webm",
    tamanhoBytes: blob.size,
    uploadId: null,
    key: null,
    partSize: PART_SIZE,
    partesEnviadas: [],
    status: "preparando",
    erro: null,
    criadoEm: Date.now(),
    atualizadoEm: Date.now(),
  };
  await videoStore.salvarRegistro(registro);
  await processar(registro, callbacks);
}

export async function retomarUploadPendente(partidaId, callbacks) {
  const registro = await videoStore.lerRegistro(partidaId);
  if (!registro || !registro.blob || registro.status === "concluido") return;
  await processar(registro, callbacks);
}

export async function cancelarUpload(partidaId) {
  const registro = await videoStore.lerRegistro(partidaId).catch(() => null);
  if (registro?.uploadId && registro?.key) {
    try {
      await postJSON("/.netlify/functions/upload-abort", { key: registro.key, uploadId: registro.uploadId });
    } catch {
      // best-effort
    }
  }
  await videoStore.removerRegistro(partidaId).catch(() => {});
}
