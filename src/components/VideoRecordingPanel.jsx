import React, { useRef, useState } from "react";
import { Video, Circle, Square, RotateCcw, Info, Upload, FolderOpen, CloudUpload, CloudOff, CheckCircle2, AlertTriangle } from "lucide-react";
import { useVideoRecorder } from "../hooks/useVideoRecorder";
import { useVideoUpload } from "../hooks/useVideoUpload";

function formatMMSS(totalSeg) {
  const s = Math.max(0, Math.floor(totalSeg || 0));
  const m = Math.floor(s / 60), ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function VideoRecordingPanel({ C, partidaId, onVideoEnviado }) {
  const rec = useVideoRecorder();
  const upload = useVideoUpload(partidaId);
  const [mostrarDicas, setMostrarDicas] = useState(false);
  const fileInputRef = useRef(null);
  const enviouRef = useRef(false);

  React.useEffect(() => {
    if (rec.status === "finalizado" && rec.videoBlob && !enviouRef.current) {
      enviouRef.current = true;
      upload.enviar(rec.videoBlob, rec.videoBlob.type);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.status, rec.videoBlob]);

  React.useEffect(() => {
    if (upload.status === "concluido" && upload.videoKey && onVideoEnviado) {
      onVideoEnviado({ key: upload.videoKey });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upload.status, upload.videoKey]);

  const usarFallback = !rec.suportado || (rec.status === "erro" && rec.erro?.includes("suportada"));

  const regravar = () => {
    upload.cancelar();
    enviouRef.current = false;
    rec.reiniciar();
  };

  const inputGaleria = (
    <input
      ref={fileInputRef}
      type="file"
      accept="video/*"
      className="hidden"
      onChange={(e) => rec.importarArquivo(e.target.files?.[0])}
    />
  );

  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: C.surface2, border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Video size={16} color={C.textMuted} />
          <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Gravação da partida</span>
        </div>
        <button onClick={() => setMostrarDicas((v) => !v)} className="flex items-center gap-1" style={{ color: C.textFaint, fontSize: 11 }}>
          <Info size={13} /> dicas
        </button>
      </div>

      {mostrarDicas && (
        <div className="rounded-lg p-3 mb-3 text-xs" style={{ background: C.surface, color: C.textMuted, lineHeight: 1.6 }}>
          Para obter melhores resultados: coloque o celular em posição fixa, mantenha a quadra
          inteira visível, evite movimentar a câmera, garanta boa iluminação e, quando possível,
          deixe a câmera elevada.
        </div>
      )}

      {inputGaleria}

      {rec.status === "parado" && !usarFallback && (
        <div className="flex flex-col gap-2">
          <button
            onClick={rec.iniciar}
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

      {rec.status === "pedindo_permissao" && (
        <p className="text-center text-xs" style={{ color: C.textMuted }}>Aguardando permissão de câmera/microfone…</p>
      )}

      {rec.status === "gravando" && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="animate-pulse" style={{ width: 8, height: 8, borderRadius: 999, background: C.red, display: "inline-block" }} />
            <span style={{ color: C.red, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>GRAVANDO</span>
          </div>
          <span style={{ fontFamily: "'Bebas Neue', 'Oswald', sans-serif", fontSize: 34, color: C.text, lineHeight: 1 }}>{formatMMSS(rec.segundos)}</span>
          <button
            onClick={rec.parar}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: C.redDim, color: C.red, border: `1px solid ${C.red}` }}
          >
            <Square size={14} fill={C.red} /> Finalizar gravação
          </button>
        </div>
      )}

      {rec.status === "finalizado" && rec.videoBlob && (
        <div className="flex flex-col items-center gap-2">
          <span style={{ color: C.textMuted, fontSize: 12 }}>
            Vídeo pronto — {formatMMSS(rec.segundos)} · {(rec.videoBlob.size / (1024 * 1024)).toFixed(1)} MB
          </span>

          {(upload.status === "preparando" || upload.status === "enviando") && (
            <div className="w-full flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-1.5" style={{ color: C.lime, fontSize: 12 }}>
                <CloudUpload size={14} /> Enviando vídeo… {upload.progresso}%
              </div>
              <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: C.surface }}>
                <div className="h-full rounded-full" style={{ width: `${upload.progresso}%`, background: C.lime, transition: "width 300ms" }} />
              </div>
              <span style={{ color: C.textFaint, fontSize: 10, textAlign: "center" }}>
                Não feche o app enquanto o envio inicial estiver em andamento.
              </span>
            </div>
          )}

          {upload.status === "aguardando_conexao" && (
            <div className="flex flex-col items-center gap-1" style={{ color: C.textMuted }}>
              <div className="flex items-center gap-1.5" style={{ fontSize: 12 }}>
                <CloudOff size={14} /> Sem conexão — envio continuará automaticamente ({upload.progresso}%)
              </div>
            </div>
          )}

          {upload.status === "concluido" && (
            <div className="flex items-center gap-1.5" style={{ color: C.lime, fontSize: 12 }}>
              <CheckCircle2 size={14} /> Vídeo enviado — pronto para análise
            </div>
          )}

          {upload.status === "erro" && (
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-1.5" style={{ color: C.red, fontSize: 12, textAlign: "center" }}>
                <AlertTriangle size={14} /> {upload.erro || "Falha no envio."}
              </div>
              <button onClick={upload.tentarNovamente} className="text-xs" style={{ color: C.textMuted }}>Tentar enviar novamente</button>
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
          <button onClick={rec.iniciar} className="text-xs" style={{ color: C.textMuted }}>Tentar novamente</button>
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-xs" style={{ color: C.textMuted }}>
            <FolderOpen size={13} /> Ou importar vídeo da galeria
          </button>
        </div>
      )}

      {usarFallback && rec.status !== "finalizado" && (
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
