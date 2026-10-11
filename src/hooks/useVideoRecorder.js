import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useVideoRecorder — gravação de vídeo via getUserMedia + MediaRecorder.
 * Quando não suportado, a tela oferece importar vídeo já gravado.
 */

function detectarSuporte() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") return false;
  return true;
}

function escolherMimeType() {
  const candidatos = [
    "video/mp4;codecs=h264",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const tipo of candidatos) {
    if (window.MediaRecorder?.isTypeSupported?.(tipo)) return tipo;
  }
  return "";
}

export function useVideoRecorder() {
  const [suportado] = useState(detectarSuporte);
  const [status, setStatus] = useState("parado");
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState(null);
  const [videoBlob, setVideoBlob] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  // Stream ao vivo da câmera enquanto ela está aberta — usado só pra
  // preview (o <video> na tela), não pra gravação em si (isso o
  // MediaRecorder já cuida sozinho, guardado em streamRef).
  const [stream, setStream] = useState(null);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);
  const inicioRef = useRef(null);

  const pararTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const abrirPreview = useCallback(async () => {
    setErro(null);
    if (!suportado) {
      setErro("Gravação nativa não é suportada neste navegador/dispositivo.");
      setStatus("erro");
      return;
    }
    if (streamRef.current) return; // já tem câmera aberta (preview ou gravação)
    setStatus("pedindo_permissao");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });
      streamRef.current = stream;
      setStream(stream);
      setStatus("pre_visualizando");
    } catch (e) {
      const negado = e && (e.name === "NotAllowedError" || e.name === "PermissionDeniedError");
      setErro(negado ? "Permissão de câmera/microfone negada." : "Não foi possível acessar a câmera.");
      setStatus("erro");
    }
  }, [suportado]);

  // Fecha a câmera aberta só pra pré-visualização, sem ter gravado nada.
  const fecharPreview = useCallback(() => {
    if (streamRef.current && recorderRef.current == null) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
      setStatus("parado");
    }
  }, []);

  const iniciar = useCallback(async () => {
    setErro(null);
    if (!suportado) {
      setErro("Gravação nativa não é suportada neste navegador/dispositivo.");
      setStatus("erro");
      return;
    }
    // Se a câmera já está aberta (por causa da pré-visualização), reaproveita
    // o mesmo stream em vez de pedir permissão de novo — evita um segundo
    // pedido de permissão e mantém o ângulo já ajustado sem reiniciar a câmera.
    let stream = streamRef.current;
    if (!stream) {
      setStatus("pedindo_permissao");
      try {
        // Pedimos Full HD (1920x1080) com o celular na horizontal — o
        // "ideal" faz o navegador usar a melhor resolução disponível na
        // câmera até esse teto, sem travar em aparelhos mais fracos (que
        // caem pra um valor menor automaticamente).
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            frameRate: { ideal: 30 },
          },
          audio: true,
        });
        streamRef.current = stream;
        setStream(stream);
      } catch (e) {
        const negado = e && (e.name === "NotAllowedError" || e.name === "PermissionDeniedError");
        setErro(negado ? "Permissão de câmera/microfone negada." : "Não foi possível acessar a câmera.");
        setStatus("erro");
        return;
      }
    }
    try {
      chunksRef.current = [];
      const mimeType = escolherMimeType();
      const recorder = new window.MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        // Bitrate mais alto pra manter nitidez nos lances rápidos
        // (sem isso o navegador comprime demais e a bola vira um borrão).
        videoBitsPerSecond: 8_000_000,
      });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
        setVideoBlob(blob);
        setVideoUrl(URL.createObjectURL(blob));
        setStatus("finalizado");
        pararTimer();
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setStream(null);
      };
      recorder.onerror = () => {
        setErro("A gravação foi interrompida por um erro do navegador.");
        setStatus("erro");
        pararTimer();
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setStream(null);
      };
      recorderRef.current = recorder;
      recorder.start(5000);
      inicioRef.current = Date.now();
      setSegundos(0);
      intervalRef.current = setInterval(() => {
        setSegundos(Math.floor((Date.now() - inicioRef.current) / 1000));
      }, 1000);
      setStatus("gravando");
    } catch (e) {
      const negado = e && (e.name === "NotAllowedError" || e.name === "PermissionDeniedError");
      setErro(negado ? "Permissão de câmera/microfone negada." : "Não foi possível acessar a câmera.");
      setStatus("erro");
    }
  }, [suportado]);

  const parar = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  const reiniciar = useCallback(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    recorderRef.current = null;
    setVideoBlob(null);
    setVideoUrl(null);
    setSegundos(0);
    setErro(null);
    setStatus("parado");
  }, [videoUrl]);

  const importarArquivo = useCallback((file) => {
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoBlob(file);
    setVideoUrl(URL.createObjectURL(file));
    setSegundos(0);
    setErro(null);
    setStatus("finalizado");
  }, [videoUrl]);

  useEffect(() => () => {
    pararTimer();
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    suportado,
    status,
    segundos,
    erro,
    videoBlob,
    videoUrl,
    stream,
    abrirPreview,
    fecharPreview,
    iniciar,
    parar,
    reiniciar,
    importarArquivo,
  };
}
