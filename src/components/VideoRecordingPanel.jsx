import React, { useEffect, useRef, useState } from "react";
import { Video, Circle, Square, RotateCcw, Info, Upload, FolderOpen, CloudUpload, CheckCircle2, AlertTriangle, Scissors } from "lucide-react";
import { useVideoRecorder } from "../hooks/useVideoRecorder";
import * as uploadService from "../services/videoUploadService";

// A cada esse tempo, a gravação é cortada automaticamente em um novo
// segmento (sem o treinador perceber — a tela continua mostrando
// "GRAVANDO" o tempo todo). Cada segmento sobe e é analisado sozinho
// assim que fica pronto, ao invés de esperar o vídeo inteiro terminar.
const SEGMENTO_DURACAO_SEG = 150; // 2m30s

function formatMMSS(totalSeg) {
  const s = Math.max(0, Math.floor(totalSeg || 0));
  const m = Math.floor(s / 60), ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function AguardandoPermissao({ C }) {
  const [tempoPreso, setTempoPreso] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTempoPreso((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-center text-xs" style={{ color: C.textMuted }}>Aguardando permissão de câmera/microfone…</p>
      {tempoPreso >= 10 && (
        <div className="flex flex-col items-center gap-2 mt-1">
          <p className="text-center text-xs" style={{ color: C.orange }}>
            Demorando muito? Confira se o Chrome não bloqueou a câmera pra este site (toque no ícone de cadeado/informações ao lado do endereço → Permissões → Câmera e Microfone → Permitir).
          </p>
          <button onClick={() => window.location.reload()} className="text-xs underline" style={{ color: C.textMuted }}>
            Recarregar o app
          </button>
        </div>
      )}
    </div>
  );
}

export function VideoRecordingPanel({ C, partidaId, periodoLabel, indiceInicial = 0, onSegmentoEnviado }) {
  const rec = useVideoRecorder();
  const [mostrarDicas, setMostrarDicas] = useState(false);
  const [segmentos, setSegmentos] = useState([]); // [{ indice, status, progresso, erro }]
  const fileInputRef = useRef(null);
  const modoRef = useRef("parado"); // "gravando" | "rotacionando" | "finalizando" | "parado"
  // Começa do número de trechos que JÁ existem pra este período (persistido
  // no scout) — nunca reinicia em 0 ao regravar, senão um novo trecho
  // "trecho 1" colide com um trecho 1 anterior e a análise se confunde
  // entre os dois vídeos diferentes.
  const proximoIndiceRef = useRef(indiceInicial);
  const cronometroTotalRef = useRef(0); // soma dos segmentos já concluídos, pro relógio não voltar a 00:00

  const enviarSegmento = (blob, indice) => {
    setSegmentos((prev) => [...prev, { indice, status: "enviando", progresso: 0, erro: null }]);
    const atualizar = (patch) => setSegmentos((prev) => prev.map((s) => (s.indice === indice ? { ...s, ...patch } : s)));
    uploadService.enviarNovoVideo(
      { partidaId: `${partidaId}_s${indice}`, blob, contentType: blob.type },
      {
        onStatus: (status) => atualizar({ status }),
        onProgresso: (progresso) => atualizar({ progresso }),
        onErro: (erro) => atualizar({ status: "erro", erro }),
        onConcluido: ({ key }) => {
          atualizar({ status: "concluido", progresso: 100 });
          onSegmentoEnviado?.({ indice, key });
        },
      }
    ).catch((e) => atualizar({ status: "erro", erro: e?.message || "Falha no envio." }));
  };

  // Corta a gravação em um novo segmento sem parar de gravar de verdade.
  const cortarSegmento = () => {
    if (rec.status !== "gravando") return;
    modoRef.current = "rotacionando";
    rec.parar();
  };

  // Timer que dispara o corte automático a cada SEGMENTO_DURACAO_SEG.
  useEffect(() => {
    if (rec.status !== "gravando") return undefined;
    const restanteSeg = SEGMENTO_DURACAO_SEG - (rec.segundos % SEGMENTO_DURACAO_SEG || SEGMENTO_DURACAO_SEG);
    const id = setTimeout(cortarSegmento, Math.max(200, restanteSeg * 1000));
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.status, Math.floor((rec.segundos || 0) / SEGMENTO_DURACAO_SEG)]);

  // Quando um segmento termina de gravar (blob pronto), sobe ele e decide
  // se retoma a gravação (corte automático) ou realmente parou (o
  // treinador apertou "Finalizar gravação").
  useEffect(() => {
    if (rec.status !== "finalizado" || !rec.videoBlob) return;
    const blob = rec.videoBlob;
    const indice = proximoIndiceRef.current;
    proximoIndiceRef.current += 1;
    cronometroTotalRef.current += rec.segundos;
    enviarSegmento(blob, indice);

    if (modoRef.current === "rotacionando") {
      rec.reiniciar();
      rec.iniciar();
      modoRef.current = "gravando";
    } else {
      modoRef.current = "parado";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.status, rec.videoBlob]);

  const iniciarGravacao = () => {
    cronometroTotalRef.current = 0;
    setSegmentos([]);
    modoRef.current = "gravando";
    rec.iniciar();
  };

  const finalizarGravacao = () => {
    modoRef.current = "finalizando";
    rec.parar();
  };

  const importarDaGaleria = (file) => {
    cronometroTotalRef.current = 0;
    setSegmentos([]);
    modoRef.current = "finalizando";
    rec.importarArquivo(file);
  };

  const regravar = () => {
    cronometroTotalRef.current = 0;
    setSegmentos([]);
    modoRef.current = "parado";
    rec.reiniciar();
  };

  const usarFallback = !rec.suportado || (rec.status === "erro" && rec.erro?.includes("suportada"));
  const cronometroExibido = cronometroTotalRef.current + (rec.status === "gravando" ? rec.segundos : 0);
  const gravacaoFinalizada = modoRef.current === "parado" && segmentos.length > 0 && rec.status !== "gravando";
  const todosEnviados = segmentos.length > 0 && segmentos.every((s) => s.status === "concluido");
  const algumEnviando = segmentos.some((s) => s.status === "enviando" || s.status === "preparando");
  const algumErro = segmentos.some((s) => s.status === "erro");

  const inputGaleria = (
    <input
      ref={fileInputRef}
      type="file"
      accept="video/*"
      className="hidden"
      onChange={(e) => importarDaGaleria(e.target.files?.[0])}
    />
  );

  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: C.surface2, border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Video size={16} color={C.textMuted} />
          <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Gravação {periodoLabel ? `— ${periodoLabel}` : "da partida"}</span>
        </div>
        <button onClick={() => setMostrarDicas((v) => !v)} className="flex items-center gap-1" style={{ color: C.textFaint, fontSize: 11 }}>
          <Info size={13} /> dicas
        </button>
      </div>

      {mostrarDicas && (
        <div className="rounded-lg p-3 mb-3 text-xs" style={{ background: C.surface, color: C.textMuted, lineHeight: 1.6 }}>
          Para obter melhores resultados: coloque o celular em posição fixa, mantenha a quadra
          inteira visível, evite movimentar a câmera, garanta boa iluminação e, quando possível,
          deixe a câmera elevada. A análise por IA acontece sozinha, em segundo plano, enquanto
          você grava — os lances já vão entrando nas estatísticas conforme forem identificados.
        </div>
      )}

      {inputGaleria}

      {rec.status === "parado" && segmentos.length === 0 && !usarFallback && (
        <div className="flex flex-col gap-2">
          <button
            onClick={iniciarGravacao}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: C.limeDim, color: C.lime, border: `1px solid ${C.lime}` }}
          >
            <Circle size={14} fill={C.lime} /> Iniciar gravação
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs"
            style={{ background: "transparent", color: C.textMuted, border: `1px solid ${C.line}` }}
          >
            <FolderOpen size={13} /> Já tenho um vídeo gravado — importar da galeria
          </button>
        </div>
      )}

      {rec.status === "pedindo_permissao" && <AguardandoPermissao C={C} />}

      {(rec.status === "gravando" || (rec.status === "finalizado" && modoRef.current === "rotacionando")) && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="animate-pulse" style={{ width: 8, height: 8, borderRadius: 999, background: C.red, display: "inline-block" }} />
            <span style={{ color: C.red, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>GRAVANDO</span>
          </div>
          <span style={{ fontFamily: "'Bebas Neue', 'Oswald', sans-serif", fontSize: 34, color: C.text, lineHeight: 1 }}>{formatMMSS(cronometroExibido)}</span>
          <button
            onClick={finalizarGravacao}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: C.redDim, color: C.red, border: `1px solid ${C.red}` }}
          >
            <Square size={14} fill={C.red} /> Finalizar gravação
          </button>
          {segmentos.length > 0 && (
            <span className="flex items-center gap-1" style={{ color: C.textFaint, fontSize: 10 }}>
              <Scissors size={11} /> {segmentos.length} trecho{segmentos.length === 1 ? "" : "s"} já enviado{segmentos.length === 1 ? "" : "s"} pra análise
            </span>
          )}
        </div>
      )}

      {gravacaoFinalizada && (
        <div className="flex flex-col items-center gap-2">
          <span style={{ color: C.textMuted, fontSize: 12 }}>
            Gravação finalizada — {formatMMSS(cronometroTotalRef.current)} em {segmentos.length} trecho{segmentos.length === 1 ? "" : "s"}
          </span>

          {algumEnviando && (
            <div className="flex items-center gap-1.5" style={{ color: C.lime, fontSize: 12 }}>
              <CloudUpload size={14} /> Enviando último(s) trecho(s)…
            </div>
          )}

          {todosEnviados && !algumEnviando && (
            <div className="flex items-center gap-1.5" style={{ color: C.lime, fontSize: 12 }}>
              <CheckCircle2 size={14} /> Todos os trechos enviados — análise em andamento
            </div>
          )}

          {algumErro && (
            <div className="flex items-center gap-1.5" style={{ color: C.red, fontSize: 12, textAlign: "center" }}>
              <AlertTriangle size={14} /> Um ou mais trechos falharam ao enviar. Tente regravar essa parte.
            </div>
          )}

          <button onClick={regravar} className="flex items-center gap-1.5 text-xs mt-1" style={{ color: C.textMuted }}>
            <RotateCcw size={12} /> Gravar ou importar outro vídeo
          </button>
        </div>
      )}

      {rec.status === "erro" && !usarFallback && (
        <div className="flex flex-col items-center gap-2">
          <span style={{ color: C.red, fontSize: 12, textAlign: "center" }}>{rec.erro}</span>
          <button onClick={iniciarGravacao} className="text-xs" style={{ color: C.textMuted }}>Tentar novamente</button>
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-xs" style={{ color: C.textMuted }}>
            <FolderOpen size={13} /> Ou importar vídeo da galeria
          </button>
        </div>
      )}

      {usarFallback && !gravacaoFinalizada && (
        <div className="flex flex-col items-center gap-2">
          <p style={{ color: C.textMuted, fontSize: 11, textAlign: "center" }}>
            Este navegador não grava vídeo direto pelo VPScouts. Grave a partida com o app de câmera do celular e importe o arquivo aqui ao terminar.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: C.surface3, color: C.text, border: `1px solid ${C.line}` }}
          >
            <Upload size={14} /> Importar vídeo gravado
          </button>
        </div>
      )}
    </div>
  );
}
