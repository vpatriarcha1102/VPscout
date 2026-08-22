import { useCallback, useEffect, useRef, useState } from "react";
import * as videoStore from "../lib/videoStore";
import * as uploadService from "../services/videoUploadService";

/**
 * useVideoUpload — envolve o videoUploadService numa API de hook. Ao
 * montar, verifica se já existe um upload pendente desta partida e
 * retoma automaticamente.
 */
export function useVideoUpload(partidaId) {
  const [status, setStatus] = useState("idle");
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState(null);
  const [videoKey, setVideoKey] = useState(null);
  const emAndamentoRef = useRef(false);

  const callbacksRef = useRef(null);
  callbacksRef.current = {
    onStatus: setStatus,
    onProgresso: setProgresso,
    onErro: (msg) => { setErro(msg); setStatus("erro"); },
    onConcluido: ({ key }) => { setVideoKey(key); setStatus("concluido"); setProgresso(100); },
  };

  useEffect(() => {
    let cancelado = false;
    if (!partidaId) return undefined;
    (async () => {
      const registro = await videoStore.lerRegistro(partidaId).catch(() => null);
      if (cancelado || !registro) return;
      if (registro.status === "concluido" && registro.key) {
        setVideoKey(registro.key);
        setStatus("concluido");
        setProgresso(100);
        return;
      }
      if (registro.blob && registro.status !== "erro") {
        emAndamentoRef.current = true;
        uploadService
          .retomarUploadPendente(partidaId, callbacksRef.current)
          .finally(() => { emAndamentoRef.current = false; });
      } else if (registro.status === "erro") {
        setStatus("erro");
        setErro(registro.erro);
      }
    })();
    return () => { cancelado = true; };
  }, [partidaId]);

  const enviar = useCallback(async (blob, contentType) => {
    if (!partidaId || emAndamentoRef.current) return;
    emAndamentoRef.current = true;
    setErro(null);
    setStatus("preparando");
    setProgresso(0);
    try {
      await uploadService.enviarNovoVideo({ partidaId, blob, contentType }, callbacksRef.current);
    } finally {
      emAndamentoRef.current = false;
    }
  }, [partidaId]);

  const tentarNovamente = useCallback(async () => {
    if (!partidaId || emAndamentoRef.current) return;
    emAndamentoRef.current = true;
    setErro(null);
    try {
      await uploadService.retomarUploadPendente(partidaId, callbacksRef.current);
    } finally {
      emAndamentoRef.current = false;
    }
  }, [partidaId]);

  const cancelar = useCallback(async () => {
    if (!partidaId) return;
    await uploadService.cancelarUpload(partidaId);
    setStatus("idle");
    setProgresso(0);
    setErro(null);
    setVideoKey(null);
  }, [partidaId]);

  return { status, progresso, erro, videoKey, enviar, tentarNovamente, cancelar };
}
