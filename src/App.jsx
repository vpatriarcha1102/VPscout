import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Home, Building2, Users, Calendar as CalendarIcon, Plus, X, ChevronRight,
  Play, Check, Undo2, Trash2, Pencil, SquarePen, Clock, MapPin,
  Shield, Trophy, Dumbbell, ArrowLeft, Circle, CheckCircle2, XCircle,
  AlertCircle, FileText, Target, Footprints, Star, Repeat, Award, SlidersHorizontal, BarChart3,
  CircleDot, Zap, Hand, CreditCard, AlertTriangle, ThumbsUp, User, ChevronLeft, LogOut, Lock, GraduationCap,
  Sparkles, Loader2, RotateCcw, HardDriveDownload, FolderOpen
} from "lucide-react";
import { installStorageShim } from "./lib/storage";
import { VideoRecordingPanel } from "./components/VideoRecordingPanel";
import { getAIAnalysisService } from "./services/aiAnalysisService";
import { useAnaliseAoVivo } from "./hooks/useAnaliseAoVivo";
import { obterUrlReproducao } from "./services/videoPlaybackService";
import { gerarEventosRevisaveis, aplicarEventosConfirmados } from "./lib/iaEventConverter";

installStorageShim();


/* ============================================================
   THEME — "sob as luzes da quadra": grafite noturno + duas cores
   de linha de quadra (azul do gol / laranja do treino) + o verde-
   lima da bola como acento de ação ao vivo.
   ============================================================ */
const C = {
  bg: "#000000",
  surface: "#0B0E11",
  surface2: "#12161A",
  surface3: "#1A2024",
  line: "#22292E",
  text: "#EAF6F8",
  textMuted: "#7C9095",
  textFaint: "#4C5C60",
  blue: "#2F86FF",
  orange: "#FF8A3D",
  lime: "#2DE0F0",
  red: "#FF5C5C",
  redDim: "#432525",
  limeDim: "#0F343A",
  yellow: "#FFD23D",
};
const GREEN = "#34D399";
const PALETA_CORES = ["#2F86FF", "#34D399", "#FBBF24", "#FF5C5C", "#A78BFA", "#FF8A3D", "#2DE0F0", "#F472B6", "#84CC16", "#94A3B8"];

const FONT_DISPLAY = "'Bebas Neue', 'Oswald', sans-serif";
const FONT_BODY = "'Inter', -apple-system, sans-serif";

const POSICOES = ["Goleiro", "Fixo", "Ala Direito", "Ala Esquerdo", "Pivô"];
const TIPOS_TREINO = ["Técnico", "Tático", "Físico", "Técnico-tático", "Finalização", "Defesa", "Ataque", "Bola parada", "Goleiros", "Transição", "Jogo reduzido", "Coletivo", "Outro"];

/* Ações de jogo — divididas por linha/goleiro para o modo rápido */
const GOL_TIPOS = ["Gol", "Jogada Ensaiada", "Falha", "Gol Contra"];
const ACOES_LINHA = [
  { key: "passe", label: "PASSE", icon: Footprints, color: C.text, variants: ["Certo", "Errado"] },
  { key: "positivo", label: "POSITIVO", icon: ThumbsUp, color: C.lime, variants: ["Passe importante", "Jogada individual"] },
  { key: "erro", label: "ERRO", icon: X, color: C.red, variants: ["Simples", "Gerou gol adversário", "Gerou chance perigosa"] },
  { key: "falta", label: "FALTA", icon: AlertCircle, color: C.yellow, variants: ["Cometida", "Sofrida"] },
  { key: "cartao", label: "CARTÃO", emoji: "🟨", color: C.yellow, variants: ["Amarelo", "Vermelho"] },
];
const ACOES_GOLEIRO = [
  { key: "defesa", label: "DEFESA", icon: Hand, color: C.blue },
  { key: "gol", label: "GOL", icon: Target, color: C.lime },
  { key: "assistencia", label: "ASSISTÊNCIA", icon: Zap, color: C.lime },
  { key: "erro", label: "ERRO", icon: X, color: C.red, variants: ["Simples", "Gerou gol adversário", "Gerou chance perigosa"] },
  { key: "falta", label: "FALTA", icon: AlertCircle, color: C.yellow, variants: ["Cometida", "Sofrida"] },
  { key: "cartao", label: "CARTÃO", emoji: "🟨", color: C.yellow, variants: ["Amarelo", "Vermelho"] },
];

const FINALIZACOES_TIME = [
  { key: "Gol", color: C.lime },
  { key: "Nova jogada", color: C.blue },
  { key: "Defesa do goleiro", color: C.orange },
  { key: "Trave", color: C.yellow },
  { key: "Pra fora", color: C.red },
];

const BOLAS_PARADAS = [
  { key: "saida_goleiro", label: "Saída de Goleiro", jogadas: ["Jogada 1", "Jogada 2", "Jogada 3", "Jogada 4"], outcomes: ["Certa", "Gerou gol a favor", "Errada", "Gerou gol adversário"] },
  { key: "saida_meio", label: "Saída de Meio", jogadas: ["Aérea", "Corrida", "Roda"], outcomes: ["Certa", "Gerou gol a favor", "Errada", "Gerou gol adversário"] },
  { key: "escanteio", label: "Escanteio / Lateral Ofensivo", jogadas: ["Cadeado 1", "Cadeado 2", "Jogada X", "Quadrado"], outcomes: ["Chance perigosa", "Gerou gol a favor", "Erro de jogada", "Gerou chance adversária"] },
  { key: "falta", label: "Falta", jogadas: null, outcomes: ["Chance perigosa", "Gerou gol a favor", "Erro de jogada", "Gerou chance adversária"] },
  { key: "penalti", label: "Pênalti", jogadas: null, outcomes: ["Gol", "Errou"] },
];
/* Categorias cuja atribuição de "quem fez o gol / quem deu assistência" é solicitada quando o resultado é gol/gerou gol a favor */
const BOLA_PARADA_PEDE_ATRIBUICAO = ["saida_meio", "escanteio", "falta", "penalti"];

const FORMATOS_PARTIDA = [
  { id: "custom", label: "Personalizado", n: null, dur: null },
  { id: "3x10", label: "3 tempos de 10 min", n: 3, dur: 10 },
  { id: "2x20", label: "2 tempos de 20 min", n: 2, dur: 20 },
];
function gerarPeriodos(n, dur) {
  const total = Math.max(1, Number(n) || 1);
  const duracao = Number(dur) || 20;
  return Array.from({ length: total }, (_, i) => ({
    numero: i + 1,
    duracaoMin: duracao,
    label: total === 1 ? "Tempo único" : total === 2 ? (i === 0 ? "1º Tempo" : "2º Tempo") : `${i + 1}º Quarto`,
  }));
}

const uid = () => Math.random().toString(36).slice(2, 10);

function resizeImageToDataURL(file, maxDim = 240) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Falha ao carregar imagem"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function getSaudacao(nome) {
  const h = new Date().getHours();
  if (h < 12) return `Bom dia, ${nome} ☀️`;
  if (h < 18) return `Boa tarde, ${nome} 🌤`;
  return `Boa noite, ${nome} 🌙`;
}
const STORAGE_KEY = "futsal-data-v1";

const emptyState = () => ({
  escolas: [],
  equipes: [],
  categorias: [],
  atletas: [],
  eventos: [],
  scouts: {},
  premiacoes: [],
});

function novoScoutJogo(evento) {
  const periodos = evento.periodos && evento.periodos.length ? evento.periodos : gerarPeriodos(2, 20);
  return {
    placarCasa: 0,
    placarVisitante: 0,
    periodoAtual: periodos[0].numero,
    eventosScout: [],
    destaques: {},
    pontosDestaque: "",
    pontosMelhorar: "",
    cronometro: { rodando: false, inicioEpoch: null, acumuladoPeriodoSeg: 0, acumuladoTotalSeg: 0 },
    minutagem: {},
    titularesDefinidos: false,
    // Cor do uniforme de cada lado nesta partida — escolhida antes da
    // escalação, usada pela IA para saber de quem é cada lance no vídeo.
    coresUniforme: null, // { favor: {label, hex}, contra: {label, hex} }
    // Vídeo por tempo de jogo, dividido em segmentos curtos (a gravação é
    // cortada automaticamente a cada ~2m30s) — cada segmento sobe e é
    // analisado sozinho assim que fica pronto, sem esperar o fim do jogo.
    // Chave é o número do período; cada valor: { segmentos: [{ indice,
    // key, enviadoEm, analiseStatus, analiseErro, analiseAtualizadaEm }] }
    videosPorPeriodo: {},
    // Lances que a IA encontrou mas ficaram com confiança baixa/média (ou
    // um "gol" sem comemoração clara) — esperam revisão manual, mostrados
    // na tela de revisão quando a partida é finalizada.
    itensRevisaoPendentes: [],
  };
}

const CORES_UNIFORME = [
  { label: "Branco", hex: "#F2F5F3" },
  { label: "Preto", hex: "#15181A" },
  { label: "Vermelho", hex: "#E14848" },
  { label: "Azul", hex: "#3B7DE8" },
  { label: "Verde", hex: "#3FA654" },
  { label: "Amarelo", hex: "#EAC736" },
  { label: "Laranja", hex: "#E38A3B" },
  { label: "Roxo", hex: "#8C5CE0" },
];

function tempoTotalAtual(cronometro) {
  if (!cronometro) return 0;
  return cronometro.acumuladoTotalSeg + (cronometro.rodando ? (Date.now() - cronometro.inicioEpoch) / 1000 : 0);
}
function tempoPeriodoAtual(cronometro) {
  if (!cronometro) return 0;
  return cronometro.acumuladoPeriodoSeg + (cronometro.rodando ? (Date.now() - cronometro.inicioEpoch) / 1000 : 0);
}
function formatMMSS(totalSeg) {
  const s = Math.max(0, Math.floor(totalSeg || 0));
  const m = Math.floor(s / 60), ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
function minutagemAtleta(scout, atletaId) {
  const m = scout.minutagem?.[atletaId];
  if (!m) return 0;
  const totalAgora = tempoTotalAtual(scout.cronometro);
  return m.segundosTotais + (m.entradaEmSeg != null ? totalAgora - m.entradaEmSeg : 0);
}
function calcularNotaSugerida(scout, atletaId) {
  const evs = scout.eventosScout.filter((e) => e.atletaId === atletaId);
  let nota = 6;
  evs.forEach((e) => {
    if (e.acao === "gol") nota += 0.6;
    if (e.acao === "assistencia") nota += 0.4;
    if (e.acao === "defesa") nota += 0.2;
    if (e.acao === "positivo") nota += 0.15;
    if (e.acao === "passe") nota += e.variante === "Errado" ? -0.1 : 0.05;
    if (e.acao === "falta") nota += e.variante === "Cometida" ? -0.15 : 0.05;
    if (e.acao === "erro") {
      if (e.variante === "Gerou gol adversário") nota += -0.6;
      else if (e.variante === "Gerou chance perigosa") nota += -0.4;
      else nota += -0.25;
    }
    if (e.acao === "cartao") nota += e.variante === "Vermelho" ? -0.6 : -0.25;
  });
  // Sem piso artificial em 6 — quem só cometeu erros e não produziu nada
  // positivo deve ter isso refletido na nota. Piso mínimo de 2 evita notas
  // absurdas em jogos com poucos eventos registrados.
  nota = Math.max(2, Math.min(10, nota));
  return Math.round(nota * 2) / 2;
}

/* ============================================================
   SMALL UI PRIMITIVES
   ============================================================ */
function CourtLine({ label }) {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px" style={{ background: C.line }} />
      {label && <span className="text-xs tracking-widest uppercase" style={{ color: C.textFaint, fontFamily: FONT_BODY }}>{label}</span>}
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: C.line }} />
      <div className="flex-1 h-px" style={{ background: C.line }} />
    </div>
  );
}

function Btn({ children, onClick, variant = "default", className = "", style = {}, disabled }) {
  const base = "px-4 py-2.5 rounded-lg font-semibold text-sm transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40 disabled:active:scale-100";
  const variants = {
    default: { background: C.surface3, color: C.text },
    primary: { background: C.lime, color: "#12150F" },
    outline: { background: "transparent", color: C.text, border: `1px solid ${C.line}` },
    danger: { background: C.redDim, color: C.red },
  };
  return (
    <button disabled={disabled} onClick={onClick} className={`${base} ${className}`} style={{ ...variants[variant], fontFamily: FONT_BODY, ...style }}>
      {children}
    </button>
  );
}

function Card({ children, onClick, style = {}, className = "", accent }) {
  return (
    <div onClick={onClick} className={`rounded-xl p-4 ${onClick ? "cursor-pointer active:scale-[0.99]" : ""} transition-transform ${className}`} style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: accent ? `3px solid ${accent}` : `1px solid ${C.line}`, ...style }}>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs uppercase tracking-wide mb-1.5" style={{ color: C.textMuted, fontFamily: FONT_BODY }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = { background: C.surface2, color: C.text, border: `1px solid ${C.line}`, fontFamily: FONT_BODY };
function Input(props) { return <input {...props} className={`w-full px-3 py-2.5 rounded-lg text-sm outline-none focus:ring-1 ${props.className || ""}`} style={{ ...inputStyle, ...(props.style || {}) }} />; }
function Select(props) { return <select {...props} className={`w-full px-3 py-2.5 rounded-lg text-sm outline-none ${props.className || ""}`} style={{ ...inputStyle, ...(props.style || {}) }} />; }
function TextArea(props) { return <textarea {...props} className={`w-full px-3 py-2.5 rounded-lg text-sm outline-none ${props.className || ""}`} style={{ ...inputStyle, ...(props.style || {}) }} />; }

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(10,12,15,0.75)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`w-full ${wide ? "sm:max-w-lg" : "sm:max-w-sm"} max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5`} style={{ background: C.surface, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: C.text, fontFamily: FONT_BODY }}>{title}</h3>
          <button onClick={onClose} style={{ color: C.textMuted }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusDot({ status }) {
  const map = {
    agendado: { c: GREEN, bg: "#0F2A20", l: "Agendado" },
    andamento: { c: C.lime, bg: C.limeDim, l: "Ao vivo" },
    finalizado: { c: C.red, bg: C.redDim, l: "Finalizado" },
  };
  const s = map[status] || map.agendado;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: s.c, background: s.bg, fontFamily: FONT_BODY }}>
      <Circle size={7} fill={s.c} stroke="none" style={status === "andamento" ? { animation: "pulse-live 1.2s ease-in-out infinite" } : undefined} /> {s.l}
    </span>
  );
}

function formatData(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function EmptyHint({ text }) {
  return <div className="rounded-xl p-4 text-center" style={{ border: `1px dashed ${C.line}` }}><span style={{ color: C.textFaint, fontSize: 13 }}>{text}</span></div>;
}

function ScreenHeader({ title, subtitle, onBack, right }) {
  return (
    <div className="px-5 pt-6 pb-2 flex items-start justify-between sticky top-0 z-10" style={{ background: C.bg }}>
      <div className="flex items-start gap-3">
        {onBack && <button onClick={onBack} className="mt-1" style={{ color: C.textMuted }}><ArrowLeft size={20} /></button>}
        <div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, letterSpacing: 0.5, color: C.text, lineHeight: 1 }}>{title}</h1>
          {subtitle && <p style={{ color: C.textMuted, fontSize: 13 }} className="mt-1">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function categoriaLabel(data, categoriaId) {
  const cat = data.categorias.find((c) => c.id === categoriaId);
  if (!cat) return "—";
  const eq = data.equipes.find((e) => e.id === cat.equipeId);
  const esc = data.escolas.find((s) => s.id === eq?.escolaId);
  return `${esc?.nome || "?"} · ${eq?.nome || "?"} · ${cat.nome}`;
}

/* Um atleta pode pertencer a mais de uma categoria — mesma pessoa, sem duplicar cadastro */
function categoriasDoAtleta(data, atleta) {
  const ids = atleta?.categoriaIds || [];
  return ids.map((id) => categoriaLabel(data, id)).filter((l) => l !== "—");
}
function nomesCurtoCategorias(data, atleta) {
  const ids = atleta?.categoriaIds || [];
  return ids.map((id) => data.categorias.find((c) => c.id === id)?.nome).filter(Boolean).join(", ") || "—";
}

function Avatar({ atleta, size = 36 }) {
  if (atleta?.foto) {
    return <img src={atleta.foto} alt={atleta.nome} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: size, height: size, background: C.surface2, color: C.lime }}>
      {atleta?.numero ? <span style={{ fontFamily: FONT_DISPLAY, fontSize: size * 0.42 }}>{atleta.numero}</span> : <User size={size * 0.5} color={C.textMuted} />}
    </div>
  );
}

/* Estatísticas gerais e por categoria — usadas no Resumo da Temporada */
function calcularResumoGeral(data) {
  const porCategoria = {};
  data.categorias.forEach((c) => { porCategoria[c.id] = { nome: categoriaLabel(data, c.id), jogos: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }; });
  data.eventos.filter((ev) => ev.tipo === "jogo" && ev.status === "finalizado").forEach((ev) => {
    const s = data.scouts[ev.id];
    if (!s || !porCategoria[ev.categoriaId]) return;
    const pc = porCategoria[ev.categoriaId];
    pc.jogos++;
    pc.gp += s.placarCasa || 0;
    pc.gc += s.placarVisitante || 0;
    if (s.placarCasa > s.placarVisitante) pc.v++;
    else if (s.placarCasa === s.placarVisitante) pc.e++;
    else pc.d++;
  });
  const totais = Object.values(porCategoria).reduce((t, pc) => ({
    jogos: t.jogos + pc.jogos, v: t.v + pc.v, e: t.e + pc.e, d: t.d + pc.d, gp: t.gp + pc.gp, gc: t.gc + pc.gc,
  }), { jogos: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 });
  return { porCategoria, totais };
}

/* Card padrão de V/E/D + gols por categoria — usado no Resumo da Temporada e em Estatísticas */
function CategoriaStatsCard({ nome, pc }) {
  const pct = (n) => (pc.jogos ? Math.round((n / pc.jogos) * 100) : 0);
  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <p style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{nome}</p>
        <span style={{ color: C.textFaint, fontSize: 11 }}>{pc.jogos} jogo{pc.jogos !== 1 ? "s" : ""}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center mb-2">
        <div><p style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: GREEN }}>{pc.v}</p><p style={{ fontSize: 9, color: C.textMuted }}>Vitórias · {pct(pc.v)}%</p></div>
        <div><p style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: C.yellow }}>{pc.e}</p><p style={{ fontSize: 9, color: C.textMuted }}>Empates · {pct(pc.e)}%</p></div>
        <div><p style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: C.red }}>{pc.d}</p><p style={{ fontSize: 9, color: C.textMuted }}>Derrotas · {pct(pc.d)}%</p></div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center pt-2" style={{ borderTop: `1px solid ${C.line}` }}>
        <div><p style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: C.text }}>{pc.gp}</p><p style={{ fontSize: 9, color: C.textMuted }}>Gols pró</p></div>
        <div><p style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: C.text }}>{pc.gc}</p><p style={{ fontSize: 9, color: C.textMuted }}>Gols contra</p></div>
        <div><p style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: C.text }}>{pc.gp - pc.gc > 0 ? "+" : ""}{pc.gp - pc.gc}</p><p style={{ fontSize: 9, color: C.textMuted }}>Saldo</p></div>
      </div>
    </Card>
  );
}


/* ============================================================
   APP
   ============================================================ */
/* ============================================================
   LOGIN — Área do Treinador (edição completa) x Área do Aluno (somente leitura)
   Observação: como este app roda localmente no dispositivo (sem servidor),
   o PIN é um código de acesso simples salvo junto aos dados — não é uma
   autenticação segura de verdade, mas já separa quem pode editar de quem só visualiza.
   ============================================================ */
function LoginGate({ data, update, onEntrarTreinador, onEntrarAluno }) {
  const [modo, setModo] = useState(null); // null | "treinador" | "aluno"
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [atletaId, setAtletaId] = useState(null);
  const alunosComPin = data.atletas.filter((a) => a.pin);

  const Brand = () => (
    <div className="flex flex-col items-center mb-8 mt-10">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ background: C.limeDim, border: `1.5px solid ${C.lime}` }}>
        <span style={{ fontSize: 28 }}>⚽</span>
      </div>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: C.lime, letterSpacing: 3 }}>VPSCOUTS</p>
      <p style={{ fontSize: 10, color: C.textFaint, letterSpacing: 1 }} className="uppercase">Plataforma de Scout de Futsal</p>
    </div>
  );

  if (modo === null) {
    return (
      <div className="px-6" style={{ minHeight: 700 }}>
        <Brand />
        <button onClick={() => { setModo("treinador"); setErro(""); setPin(""); }} className="w-full rounded-xl p-4 flex items-center gap-3 mb-3" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: C.limeDim }}><Lock size={18} color={C.lime} /></div>
          <div className="text-left flex-1"><p style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>Área do Treinador</p><p style={{ color: C.textMuted, fontSize: 11 }}>Acesso completo, com edição</p></div>
          <ChevronRight size={18} color={C.textMuted} />
        </button>
        <button onClick={() => { setModo("aluno"); setErro(""); setPin(""); setAtletaId(null); }} className="w-full rounded-xl p-4 flex items-center gap-3" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#12233F" }}><GraduationCap size={18} color={C.blue} /></div>
          <div className="text-left flex-1"><p style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>Área do Aluno</p><p style={{ color: C.textMuted, fontSize: 11 }}>Somente visualização</p></div>
          <ChevronRight size={18} color={C.textMuted} />
        </button>
      </div>
    );
  }

  if (modo === "treinador") {
    const temPin = !!data.treinadorPin;
    const confirmar = () => {
      if (!temPin) {
        if (pin.length < 4) { setErro("Crie um PIN com pelo menos 4 dígitos."); return; }
        update((d) => { d.treinadorPin = pin; return d; });
        onEntrarTreinador();
      } else if (pin === data.treinadorPin) {
        onEntrarTreinador();
      } else {
        setErro("PIN incorreto.");
      }
    };
    return (
      <div className="px-6" style={{ minHeight: 700 }}>
        <Brand />
        <p style={{ color: C.text, fontWeight: 700, fontSize: 16 }} className="text-center mb-1">{temPin ? "Digite seu PIN" : "Crie um PIN de acesso"}</p>
        <p style={{ color: C.textMuted, fontSize: 12 }} className="text-center mb-4">{temPin ? "Acesso do treinador" : "Você vai usar esse PIN nos próximos acessos"}</p>
        <Input inputMode="numeric" maxLength={6} value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setErro(""); }} placeholder="••••" className="text-center mb-2" style={{ fontSize: 22, letterSpacing: 4 }} autoFocus />
        {erro && <p style={{ color: C.red, fontSize: 12 }} className="text-center mb-2">{erro}</p>}
        <Btn variant="primary" className="w-full mt-2" onClick={confirmar}>{temPin ? "Entrar" : "Criar PIN e entrar"}</Btn>
        <Btn className="w-full mt-2" onClick={() => setModo(null)}>Voltar</Btn>
      </div>
    );
  }

  // modo === "aluno"
  if (!atletaId) {
    return (
      <div className="px-6" style={{ minHeight: 700 }}>
        <Brand />
        <p style={{ color: C.text, fontWeight: 700, fontSize: 16 }} className="text-center mb-1">Quem é você?</p>
        <p style={{ color: C.textMuted, fontSize: 12 }} className="text-center mb-4">Selecione seu nome para continuar</p>
        {alunosComPin.length === 0 ? (
          <EmptyHint text="Nenhum aluno com acesso configurado ainda. Peça ao treinador para cadastrar um PIN no seu perfil, em Atletas." />
        ) : (
          <div className="flex flex-col gap-1.5">
            {alunosComPin.map((a) => (
              <button key={a.id} onClick={() => { setAtletaId(a.id); setErro(""); setPin(""); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                <Avatar atleta={a} size={36} />
                <span style={{ color: C.text, fontSize: 13 }}>{a.nome}</span>
              </button>
            ))}
          </div>
        )}
        <Btn className="w-full mt-4" onClick={() => setModo(null)}>Voltar</Btn>
      </div>
    );
  }
  const alunoSelecionado = data.atletas.find((a) => a.id === atletaId);
  const confirmarAluno = () => {
    if (pin === alunoSelecionado.pin) onEntrarAluno(atletaId);
    else setErro("PIN incorreto.");
  };
  return (
    <div className="px-6" style={{ minHeight: 700 }}>
      <Brand />
      <div className="flex flex-col items-center mb-4">
        <Avatar atleta={alunoSelecionado} size={56} />
        <p style={{ color: C.text, fontWeight: 700, fontSize: 15 }} className="mt-2">{alunoSelecionado.nome}</p>
      </div>
      <Input inputMode="numeric" maxLength={6} value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setErro(""); }} placeholder="Digite seu PIN" className="text-center mb-2" style={{ fontSize: 22, letterSpacing: 4 }} autoFocus />
      {erro && <p style={{ color: C.red, fontSize: 12 }} className="text-center mb-2">{erro}</p>}
      <Btn variant="primary" className="w-full mt-2" onClick={confirmarAluno}>Entrar</Btn>
      <Btn className="w-full mt-2" onClick={() => setAtletaId(null)}>Voltar</Btn>
    </div>
  );
}

function MeuPerfilScreen({ data, atletaId, onSair }) {
  const atleta = data.atletas.find((a) => a.id === atletaId);
  if (!atleta) return <div className="px-5 pt-6"><p style={{ color: C.textMuted }} className="mb-3">Perfil não encontrado.</p>{onSair && <Btn onClick={onSair}>Sair</Btn>}</div>;
  const stats = agregarEstatisticasAtleta(data, atleta.id);
  const isGoleiro = atleta.posicao === "Goleiro";
  const linhas = [
    ["Jogos", stats.jogos], ["Minutagem média", formatMMSS(stats.minutagemMedia)],
    ...(isGoleiro ? [["Defesas", stats.defesas]] : [["Gols", stats.gols], ["Assistências", stats.assistencias]]),
    ["Erros", stats.erros], ["Positivos", stats.positivos],
    ["Precisão de passes", stats.precisaoPasses != null ? `${stats.precisaoPasses}%` : "—"],
    ["Precisão de finalizações", stats.precisaoFinalizacoes != null ? `${stats.precisaoFinalizacoes}%` : "—"],
    ["Faltas cometidas", stats.faltasCometidas], ["Faltas sofridas", stats.faltasSofridas],
    ["Nota média", stats.mediaNota != null ? stats.mediaNota.toFixed(1) : "—"],
  ];
  return (
    <div>
      <ScreenHeader title="Meu Perfil" subtitle={nomesCurtoCategorias(data, atleta)} />
      <div className="px-5">
        <Card className="flex items-center gap-4">
          <Avatar atleta={atleta} size={64} />
          <div>
            <p style={{ color: C.text, fontWeight: 700 }}>{atleta.nome}</p>
            <p style={{ color: C.textMuted, fontSize: 12 }}>{atleta.posicao} {atleta.numero && `· #${atleta.numero}`} · Pé {atleta.pePreferido?.toLowerCase()}</p>
          </div>
        </Card>
        <CourtLine label="Minhas estatísticas" />
        <div className="grid grid-cols-2 gap-2">
          {linhas.map(([label, val]) => (
            <div key={label} className="rounded-lg p-3 flex items-center justify-between" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <span style={{ color: C.textMuted, fontSize: 12 }}>{label}</span>
              <span style={{ color: (label === "Gols" || label === "Defesas") ? C.lime : C.text, fontFamily: FONT_DISPLAY, fontSize: 20 }}>{val}</span>
            </div>
          ))}
        </div>
        {stats.jogos + stats.treinos === 0 && <div className="mt-3"><EmptyHint text="Sem dados registrados ainda." /></div>}
        <p style={{ color: C.textFaint, fontSize: 10 }} className="text-center mt-6 mb-4">Modo de visualização — apenas o treinador pode editar dados.</p>
      </div>
    </div>
  );
}

// A sessão (quem está logado) fica só neste aparelho — nunca deve ir para
// o Firestore/localStorage compartilhado, senão o login do treinador em um
// celular "vazaria" para o celular dos alunos. Por isso usa localStorage
// puro, direto, sem passar pelo window.storage (que é compartilhado).
const SESSAO_LOCAL_KEY = "vpscouts_sessao_local_v1";
function lerSessaoLocal() {
  try {
    const raw = window.localStorage.getItem(SESSAO_LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function gravarSessaoLocal(sessao) {
  try {
    if (sessao) window.localStorage.setItem(SESSAO_LOCAL_KEY, JSON.stringify(sessao));
    else window.localStorage.removeItem(SESSAO_LOCAL_KEY);
  } catch (e) { /* best-effort */ }
}

// Tela de saudação — abre o app com fade-in e uma bola de futsal rolando.
// Funciona 100% offline (só CSS/emoji, nada de rede) e não bloqueia o
// carregamento dos dados por trás — some sozinha ou ao toque.
function SplashScreen({ onFim }) {
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setSaindo(true), 1600);
    const t2 = setTimeout(() => onFim(), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pular = () => { setSaindo(true); setTimeout(onFim, 380); };

  return (
    <div
      onClick={pular}
      className="flex flex-col items-center justify-center"
      style={{
        background: C.bg,
        // 100dvh (altura "dinâmica" de viewport) preenche a tela inteira em
        // qualquer celular, inclusive quando a barra de endereço do
        // navegador esconde/aparece — 100vh sozinho fica curto em vários
        // Android. Fallback pra 100vh em navegadores muito antigos.
        height: "100vh",
        minHeight: "100dvh",
        width: "100%",
        fontFamily: FONT_BODY,
        opacity: saindo ? 0 : 1,
        transition: "opacity 380ms ease",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes vps-fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes vps-ball-roll { 0% { transform: translateX(-70px) rotate(0deg); } 100% { transform: translateX(70px) rotate(360deg); } }
        @keyframes vps-ball-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
      `}</style>
      <div style={{ animation: "vps-fade-up 700ms ease both" }} className="flex flex-col items-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: C.limeDim, border: `1.5px solid ${C.lime}` }}>
          <span style={{ fontSize: 34, display: "inline-block", animation: "vps-ball-bounce 1s ease-in-out infinite" }}>⚽</span>
        </div>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 30, color: C.lime, letterSpacing: 3 }}>VPSCOUTS</p>
        <p style={{ fontSize: 11, color: C.textFaint, letterSpacing: 1 }} className="uppercase mt-1">Plataforma de Scout de Futsal</p>
      </div>
      {/* Faixa de gramado com a bola rolando por cima — 240px de largura
          contra só 140px de curso (-70 a +70), com a bola centralizada
          pelo próprio marginLeft, sobra folga de sobra dos dois lados
          em qualquer ponto da animação: nunca deve cortar. */}
      <div className="mt-10 relative" style={{ width: 240, height: 34, animation: "vps-fade-up 700ms ease 150ms both" }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 4, height: 10, borderRadius: 5, background: "repeating-linear-gradient(90deg, #2E7D32, #2E7D32 11px, #388E3C 11px, #388E3C 22px)", boxShadow: `0 0 0 1px ${C.line}` }} />
        <span style={{ position: "absolute", left: "50%", bottom: 6, width: 26, marginLeft: -13, textAlign: "center", fontSize: 22, animation: "vps-ball-roll 1.6s linear infinite" }}>⚽</span>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(emptyState());
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState("dashboard");
  const [params, setParams] = useState({});
  // Carrega a sessão salva neste aparelho já na primeira renderização, para
  // não "piscar" a tela de login antes de cair na tela inicial de novo.
  const [sessao, setSessaoState] = useState(lerSessaoLocal); // null | { tipo: "treinador" } | { tipo: "aluno", atletaId }
  const setSessao = useCallback((nova) => {
    setSessaoState(nova);
    gravarSessaoLocal(nova);
  }, []);
  const [splashVisivel, setSplashVisivel] = useState(true);
  const [modalBackup, setModalBackup] = useState(false);
  const backupFileInputRef = useRef(null);
  const saveTimer = useRef(null);
  // Guarda o último valor que ESTE dispositivo escreveu, para o efeito de
  // sincronização abaixo não reagir ao próprio eco do Firestore.
  const ultimoValorEscritoRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) setData({ ...emptyState(), ...JSON.parse(res.value) });
      } catch (e) { setLoadError(true); }
      finally { setLoaded(true); }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const serializado = JSON.stringify(data);
      ultimoValorEscritoRef.current = serializado;
      try { await window.storage.set(STORAGE_KEY, serializado, false); } catch (e) { /* best-effort */ }
    }, 350);
    return () => clearTimeout(saveTimer.current);
  }, [data, loaded]);

  // Sincronização em tempo real entre dispositivos — inteiramente aditivo:
  // só faz algo se `window.storage.subscribe` existir (isto é, se o
  // Firebase estiver configurado, ver src/lib/storage.js). Sem Firebase,
  // este efeito não encontra `subscribe` e não faz nada — o app continua
  // funcionando só em localStorage, exatamente como antes.
  useEffect(() => {
    if (!loaded || typeof window.storage.subscribe !== "function") return undefined;
    const unsubscribe = window.storage.subscribe(STORAGE_KEY, (valorRemoto) => {
      // Ignora o próprio eco: se o valor que chegou é o mesmo que nós
      // acabamos de escrever, não há nada de novo vindo de outro dispositivo.
      if (!valorRemoto || valorRemoto === ultimoValorEscritoRef.current) return;
      try {
        setData({ ...emptyState(), ...JSON.parse(valorRemoto) });
      } catch (e) { /* ignora payload inválido */ }
    });
    return () => { if (typeof unsubscribe === "function") unsubscribe(); };
  }, [loaded]);

  // Botão/gesto de voltar do celular (seta física no Android, gesto de
  // borda no iPhone) navega DENTRO do app em vez de fechar — usamos o
  // histórico do próprio navegador pra isso, que é quem intercepta esse
  // gesto nos dois sistemas.
  const navEmCursoRef = useRef(false); // evita loop quando a mudança já veio do popstate
  const nav = (v, p = {}) => {
    setView(v);
    setParams(p);
    if (!navEmCursoRef.current) {
      try { window.history.pushState({ vpscoutsView: v, vpscoutsParams: p }, ""); } catch (e) { /* ambiente sem history */ }
    }
  };
  useEffect(() => {
    const aoVoltar = (event) => {
      const estado = event.state;
      if (estado && estado.vpscoutsView) {
        navEmCursoRef.current = true;
        setView(estado.vpscoutsView);
        setParams(estado.vpscoutsParams || {});
        navEmCursoRef.current = false;
      }
      // Sem estado = chegou no início do histórico do app — aí sim o
      // gesto de voltar sai do app normalmente, como esperado.
    };
    window.addEventListener("popstate", aoVoltar);
    try { window.history.replaceState({ vpscoutsView: view, vpscoutsParams: params }, ""); } catch (e) { /* ambiente sem history */ }
    return () => window.removeEventListener("popstate", aoVoltar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback((fn) => setData((prev) => fn(JSON.parse(JSON.stringify(prev)))), []);

  // Backup manual — baixa um arquivo .json com TODOS os dados do app
  // (escolas, equipes, atletas, jogos, scouts) pro treinador guardar onde
  // quiser (Drive, e-mail, etc.) e restaurar depois se precisar, mesmo que
  // algo dê errado no aparelho ou na sincronização.
  const baixarBackup = () => {
    try {
      const conteudo = JSON.stringify(data, null, 2);
      const blob = new Blob([conteudo], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const dataHora = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      const a = document.createElement("a");
      a.href = url;
      a.download = `vpscouts-backup-${dataHora}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { alert("Não foi possível gerar o backup."); }
  };

  const restaurarBackup = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const importado = JSON.parse(reader.result);
        if (!importado || typeof importado !== "object") throw new Error("Arquivo inválido.");
        if (!window.confirm("Isso vai SUBSTITUIR todos os dados atuais do app pelos dados desse arquivo de backup. Essa ação não pode ser desfeita. Continuar?")) return;
        setData({ ...emptyState(), ...importado });
        setModalBackup(false);
        alert("Backup restaurado com sucesso.");
      } catch (e) {
        alert("Esse arquivo não parece ser um backup válido do VPScouts.");
      }
    };
    reader.readAsText(file);
  };

  // Tela de saudação: aparece na abertura do app, mesmo offline, mesmo antes
  // de terminar de carregar os dados — e depois se desfaz com fade para a
  // tela de baixo (login ou, se já tinha sessão salva, direto para o início).
  if (splashVisivel) {
    return <SplashScreen onFim={() => setSplashVisivel(false)} />;
  }

  if (!loaded) {
    return <div className="w-full h-full flex items-center justify-center" style={{ background: C.bg, minHeight: 500 }}><span style={{ color: C.textMuted, fontFamily: FONT_BODY }}>Carregando...</span></div>;
  }

  if (!sessao) {
    return (
      <div className="w-full mx-auto" style={{ background: C.bg, minHeight: 700, maxWidth: 480, fontFamily: FONT_BODY }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&display=swap');`}</style>
        <LoginGate data={data} update={update} onEntrarTreinador={() => { setSessao({ tipo: "treinador" }); setView("dashboard"); }} onEntrarAluno={(atletaId) => { setSessao({ tipo: "aluno", atletaId }); setView("dashboard"); }} />
      </div>
    );
  }

  if (sessao.tipo === "aluno" && !data.atletas.find((a) => a.id === sessao.atletaId)) {
    return (
      <div className="w-full mx-auto px-6" style={{ background: C.bg, minHeight: 700, maxWidth: 480, fontFamily: FONT_BODY }}>
        <p style={{ color: C.textMuted }} className="mt-10 mb-3">Perfil não encontrado.</p>
        <Btn onClick={() => setSessao(null)}>Sair</Btn>
      </div>
    );
  }

  const readOnly = sessao.tipo === "aluno";
  const meuAtletaId = sessao.atletaId || null;
  const tabs = readOnly
    ? [
        { k: "dashboard", label: "Início", icon: Home },
        { k: "meu-perfil", label: "Atleta", icon: User },
        { k: "calendario", label: "Calendário", icon: CalendarIcon },
        { k: "rankings", label: "Rankings", icon: Award },
        { k: "estatisticas", label: "Estatísticas", icon: BarChart3 },
      ]
    : [
        { k: "dashboard", label: "Início", icon: Home },
        { k: "estrutura", label: "Equipes", icon: Building2 },
        { k: "atletas", label: "Atletas", icon: Users },
        { k: "calendario", label: "Calendário", icon: CalendarIcon },
        { k: "rankings", label: "Rankings", icon: Award },
        { k: "estatisticas", label: "Estatísticas", icon: BarChart3 },
      ];
  const showTabs = tabs.some((t) => t.k === view);

  return (
    <div className="w-full mx-auto" style={{ background: C.bg, minHeight: 700, maxWidth: 480, fontFamily: FONT_BODY }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&display=swap'); @keyframes pulse-live { 0%,100%{opacity:1} 50%{opacity:0.25} } @keyframes marquee-up { from{transform:translateY(0)} to{transform:translateY(-50%)} }`}</style>
      <div className="pb-24">
        {loadError && <div className="text-xs px-4 py-2" style={{ background: C.redDim, color: C.red }}>Não foi possível carregar dados salvos — começando do zero.</div>}
        {showTabs && (
          <div className="px-5 pt-5 pb-3 flex items-center gap-3" style={{ borderBottom: `1px solid ${C.line}`, marginBottom: 4 }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: C.limeDim, border: `1.5px solid ${C.lime}` }}>
              <span style={{ fontSize: 17, lineHeight: 1 }}>⚽</span>
            </div>
            <div className="flex-1">
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 21, color: C.lime, letterSpacing: 2.5, lineHeight: 1 }}>VPSCOUTS</p>
              <p style={{ fontSize: 9, color: C.textFaint, letterSpacing: 1, textTransform: "uppercase" }} className="mt-0.5">{readOnly ? "Área do Aluno" : "Plataforma de Scout de Futsal"}</p>
            </div>
            <div className="flex items-center gap-3">
              {!readOnly && (
                <button onClick={() => setModalBackup(true)} style={{ color: C.textMuted }} aria-label="Backup"><HardDriveDownload size={18} /></button>
              )}
              <button onClick={() => { setSessao(null); setView("dashboard"); }} style={{ color: C.textMuted }} aria-label="Sair"><LogOut size={18} /></button>
            </div>
          </div>
        )}
        {modalBackup && (
          <Modal title="Backup dos dados" onClose={() => setModalBackup(false)}>
            <div className="flex flex-col gap-3">
              <p style={{ color: C.textMuted, fontSize: 12 }}>
                Baixe um arquivo com tudo que está salvo no app (atletas, jogos, scouts) e guarde onde quiser — Drive, e-mail, etc. Se algo der errado no aparelho, você consegue restaurar a partir desse arquivo.
              </p>
              <Btn variant="primary" className="w-full" onClick={baixarBackup}><HardDriveDownload size={15} /> Baixar backup agora</Btn>
              <input
                ref={backupFileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => restaurarBackup(e.target.files?.[0])}
              />
              <button onClick={() => backupFileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs" style={{ background: "transparent", color: C.textMuted, border: `1px solid ${C.line}` }}>
                <FolderOpen size={13} /> Restaurar a partir de um backup
              </button>
              <p style={{ color: C.textFaint, fontSize: 10 }}>Restaurar substitui todos os dados atuais pelos do arquivo escolhido.</p>
            </div>
          </Modal>
        )}
        {view === "dashboard" && <Dashboard data={data} nav={nav} meuAtletaId={meuAtletaId} />}
        {!readOnly && view === "estrutura" && <Estrutura data={data} update={update} />}
        {!readOnly && view === "atletas" && <Atletas data={data} update={update} nav={nav} />}
        {readOnly && view === "meu-perfil" && <MeuPerfilScreen data={data} atletaId={meuAtletaId} />}
        {view === "atleta-perfil" && <AtletaPerfil data={data} update={update} params={params} nav={nav} readOnly={readOnly} />}
        {view === "calendario" && <CalendarioView data={data} update={update} nav={nav} readOnly={readOnly} />}
        {view === "evento-detalhe" && <EventoDetalhe data={data} update={update} params={params} nav={nav} readOnly={readOnly} />}
        {!readOnly && view === "scout-jogo" && <ScoutJogo data={data} update={update} params={params} nav={nav} />}
        {!readOnly && view === "revisao-ia" && <RevisaoIA data={data} update={update} params={params} nav={nav} />}
        {!readOnly && view === "scout-treino" && <ScoutTreino data={data} update={update} params={params} nav={nav} />}
        {view === "relatorio-jogo" && <RelatorioJogo data={data} update={update} params={params} nav={nav} readOnly={readOnly} />}
        {view === "relatorio-treino" && <RelatorioTreino data={data} params={params} nav={nav} />}
        {view === "rankings" && <RankingsScreen data={data} />}
        {view === "estatisticas" && <EstatisticasScreen data={data} update={update} nav={nav} readOnly={readOnly} />}
        {view === "resumo-temporada" && <ResumoTemporadaScreen data={data} nav={nav} />}
      </div>

      {showTabs && (
        <div className="fixed bottom-0 left-0 right-0 flex justify-center">
          <div className="w-full flex" style={{ maxWidth: 480, background: C.surface, borderTop: `1px solid ${C.line}` }}>
            {tabs.map((t) => (
              <button key={t.k} onClick={() => nav(t.k)} className="flex-1 flex flex-col items-center gap-1 py-2">
                <div className="px-3.5 py-1 rounded-full flex items-center justify-center" style={{ background: view === t.k ? C.limeDim : "transparent" }}>
                  <t.icon size={17} color={view === t.k ? C.lime : C.textMuted} />
                </div>
                <span style={{ fontSize: 8.5, color: view === t.k ? C.lime : C.textMuted, fontFamily: FONT_BODY, textAlign: "center", fontWeight: view === t.k ? 700 : 400 }}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function Dashboard({ data, nav, meuAtletaId }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((t) => t + 1), 60000); return () => clearInterval(id); }, []);

  const proximos = data.eventos.filter((e) => e.tipo === "jogo" && e.status !== "finalizado").sort((a, b) => new Date(a.data + "T" + (a.horario || "00:00")) - new Date(b.data + "T" + (b.horario || "00:00")));
  const ultimos = data.eventos.filter((e) => e.tipo === "jogo" && e.status === "finalizado").sort((a, b) => new Date(b.data + "T" + (b.horario || "00:00")) - new Date(a.data + "T" + (a.horario || "00:00")));
  const ultimo = ultimos[0];
  const proximo = proximos[0];
  const ultimos5 = ultimos.slice(0, 5);
  const resumo5 = ultimos5.reduce((acc, ev) => {
    const s = data.scouts[ev.id];
    if (!s) return acc;
    if (s.placarCasa > s.placarVisitante) acc.v++;
    else if (s.placarCasa === s.placarVisitante) acc.e++;
    else acc.d++;
    return acc;
  }, { v: 0, e: 0, d: 0 });
  const scoutUltimo = ultimo ? data.scouts[ultimo.id] : null;
  const meuAtleta = meuAtletaId ? data.atletas.find((a) => a.id === meuAtletaId) : null;

  return (
    <div>
      <ScreenHeader title={getSaudacao(meuAtleta ? meuAtleta.nome : "Victor")} subtitle="Visão geral da temporada" />
      <div className="px-5">
        <div className="grid grid-cols-3 gap-2 mt-2">
          {meuAtletaId ? (
            <button onClick={() => nav("meu-perfil")} className="rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 text-center" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.limeDim }}><User size={15} color={C.lime} /></div>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 15, color: C.text }}>Ver</span>
              <span style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Meu relatório</span>
            </button>
          ) : (
            <button onClick={() => ultimo && nav("relatorio-jogo", { id: ultimo.id })} disabled={!ultimo} className="rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 text-center" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.limeDim }}><CircleDot size={15} color={C.lime} /></div>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: C.text }}>{scoutUltimo ? `${scoutUltimo.placarCasa}-${scoutUltimo.placarVisitante}` : "—"}</span>
              <span style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Último jogo</span>
            </button>
          )}
          <button onClick={() => proximo && nav("evento-detalhe", { id: proximo.id })} disabled={!proximo} className="rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 text-center" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.limeDim }}><CalendarIcon size={15} color={C.lime} /></div>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: C.text }}>{proximo ? formatData(proximo.data).slice(0, 5) : "—"}</span>
            <span style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Próximo jogo</span>
          </button>
          <button onClick={() => nav("calendario")} className="rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 text-center" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.limeDim }}><BarChart3 size={15} color={C.lime} /></div>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 15 }}>
              <span style={{ color: GREEN }}>{resumo5.v}V</span>{" "}
              <span style={{ color: C.yellow }}>{resumo5.e}E</span>{" "}
              <span style={{ color: C.red }}>{resumo5.d}D</span>
            </span>
            <span style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Últimos 5 jogos</span>
          </button>
        </div>

        <div className="flex items-center justify-between mt-5 mb-2">
          <span className="text-xs tracking-widest uppercase" style={{ color: C.textFaint, fontFamily: FONT_BODY }}>Próximos jogos</span>
          {proximos.length > 0 && <button onClick={() => nav("calendario")} className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.lime }}>Ver todos <ChevronRight size={13} /></button>}
        </div>
        {proximos.length > 0 ? <ProximosJogosCarousel eventos={proximos.slice(0, 3)} data={data} nav={nav} /> : <EmptyHint text="Nenhum jogo agendado." />}

        {(() => {
          const { totais } = calcularResumoGeral(data);
          const pontos = totais.v * 3 + totais.e;
          const aproveitamento = totais.jogos ? Math.round((pontos / (totais.jogos * 3)) * 100) : 0;
          return (
            <button onClick={() => nav("resumo-temporada")} className="w-full mt-5 rounded-xl p-4 text-left" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <div className="flex items-center justify-between mb-3">
                <span style={{ color: C.lime, fontSize: 11, letterSpacing: 1.5, fontWeight: 700 }} className="uppercase">Resumo da Temporada</span>
                <ChevronRight size={16} color={C.textMuted} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 32, color: C.text, lineHeight: 1 }}>{totais.jogos}</p>
                  <p style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Jogos</p>
                </div>
                <div className="flex gap-4">
                  <div className="text-center"><p style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: GREEN }}>{totais.v}</p><p style={{ fontSize: 8.5, color: C.textMuted }}>Vitórias</p></div>
                  <div className="text-center"><p style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: C.yellow }}>{totais.e}</p><p style={{ fontSize: 8.5, color: C.textMuted }}>Empates</p></div>
                  <div className="text-center"><p style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: C.red }}>{totais.d}</p><p style={{ fontSize: 8.5, color: C.textMuted }}>Derrotas</p></div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
                <span style={{ color: C.textMuted, fontSize: 11 }}>Aproveitamento</span>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: C.lime }}>{aproveitamento}%</span>
              </div>
            </button>
          );
        })()}

        <div className="flex items-center justify-between mt-5 mb-2">
          <span className="text-xs tracking-widest uppercase" style={{ color: C.textFaint, fontFamily: FONT_BODY }}>Últimos jogos</span>
          {ultimos.length > 0 && <button onClick={() => nav("calendario")} className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.lime }}>Ver todos <ChevronRight size={13} /></button>}
        </div>
        {ultimos5.length > 0 ? <UltimosJogosCarousel eventos={ultimos5} data={data} nav={nav} /> : <EmptyHint text="Nenhum jogo finalizado ainda." />}

        {data.escolas.length === 0 && (
          <>
            <CourtLine label="Começar" />
            <Card>
              <p style={{ color: C.textMuted, fontSize: 13 }} className="mb-3">Crie sua primeira escola para começar a estruturar equipes, categorias e atletas.</p>
              <Btn variant="primary" onClick={() => nav("estrutura")} className="w-full"><Plus size={16} /> Ir para Equipes</Btn>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function ProximosJogosCarousel({ eventos, data, nav }) {
  const [idx, setIdx] = useState(0);
  const touchX = useRef(null);
  const total = eventos.length;

  useEffect(() => {
    if (total <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % total), 6000);
    return () => clearInterval(id);
  }, [total]);

  useEffect(() => { if (idx >= total) setIdx(0); }, [total, idx]);

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (dx > 40) setIdx((i) => (i - 1 + total) % total);
    else if (dx < -40) setIdx((i) => (i + 1) % total);
    touchX.current = null;
  };

  return (
    <div>
      <div className="overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${idx * 100}%)` }}>
          {eventos.map((ev) => (
            <div key={ev.id} className="w-full shrink-0">
              <ProximoJogoCard evento={ev} data={data} nav={nav} />
            </div>
          ))}
        </div>
      </div>
      {total > 1 && (
        <div className="flex items-center justify-center gap-3 mt-3">
          <button onClick={() => setIdx((i) => (i - 1 + total) % total)}><ChevronLeft size={16} color={C.textMuted} /></button>
          <div className="flex items-center gap-1.5">
            {eventos.map((_, i) => <span key={i} className="rounded-full" style={{ width: i === idx ? 14 : 6, height: 6, background: i === idx ? C.lime : C.surface3, transition: "all 0.3s" }} />)}
          </div>
          <button onClick={() => setIdx((i) => (i + 1) % total)}><ChevronRight size={16} color={C.textMuted} /></button>
        </div>
      )}
    </div>
  );
}

function ProximoJogoCard({ evento, data, nav }) {
  const equipe = data.equipes.find((e) => e.id === evento.equipeId);
  const escola = data.escolas.find((s) => s.id === equipe?.escolaId);
  const categoria = data.categorias.find((c) => c.id === evento.categoriaId);
  const cor = categoria?.cor || C.blue;
  return (
    <Card accent={cor}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: C.surface2, color: cor }}>{categoria?.nome || "—"}</span>
        <StatusDot status={evento.status} />
      </div>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: 24, color: C.text }}>{escola?.nome || equipe?.nome || "—"} <span style={{ color: C.textFaint }}>×</span> {evento.adversario || "?"}</p>
      <div className="flex flex-col gap-1.5 mt-2" style={{ color: C.textMuted, fontSize: 12 }}>
        {evento.local && <span className="flex items-center gap-2"><MapPin size={13} /> {evento.local}</span>}
        <span className="flex items-center gap-2"><CalendarIcon size={13} /> {formatData(evento.data)}</span>
        {evento.horario && <span className="flex items-center gap-2"><Clock size={13} /> {evento.horario}</span>}
      </div>
      <Btn variant="primary" className="w-full mt-3" onClick={() => nav("evento-detalhe", { id: evento.id })}>Ver jogo <ChevronRight size={15} /></Btn>
    </Card>
  );
}

function UltimoJogoItem({ evento, data, nav }) {
  const equipe = data.equipes.find((e) => e.id === evento.equipeId);
  const categoria = data.categorias.find((c) => c.id === evento.categoriaId);
  const scout = data.scouts[evento.id];
  const golsCasa = scout?.placarCasa ?? 0, golsFora = scout?.placarVisitante ?? 0;
  const resultado = golsCasa > golsFora ? { l: "Vitória", c: GREEN, bg: "#0F2A20" } : golsCasa === golsFora ? { l: "Empate", c: C.yellow, bg: "#332B10" } : { l: "Derrota", c: C.red, bg: C.redDim };
  return (
    <Card onClick={() => nav("relatorio-jogo", { id: evento.id })} accent={resultado.c} className="mb-2">
      <div className="flex items-center justify-between">
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: C.surface2, color: C.textMuted }}>{categoria?.nome || "—"}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: resultado.bg, color: resultado.c }}>{resultado.l.toUpperCase()}</span>
      </div>
      <p style={{ color: C.text, fontWeight: 700, fontSize: 14 }} className="mt-2">{equipe?.nome || "—"} <span style={{ fontFamily: FONT_DISPLAY, color: C.lime, fontSize: 17 }}>{golsCasa} × {golsFora}</span> {evento.adversario || "?"}</p>
      <p style={{ color: C.textMuted, fontSize: 11 }} className="mt-1">{formatData(evento.data)}</p>
    </Card>
  );
}

function UltimosEventosCarousel({ C, periodosComEventos, ultimosPorPeriodo, pendentes, data, vazio, onEditar }) {
  const scrollRef = useRef(null);
  const [pausado, setPausado] = useState(false);
  const resumeTimer = useRef(null);

  const linhas = [];
  periodosComEventos.forEach((p) => {
    if (periodosComEventos.length > 1) linhas.push({ tipo: "separador", periodo: p, key: `sep-${p}` });
    ultimosPorPeriodo[p].forEach((ev) => linhas.push({ tipo: "evento", ev, key: ev.id }));
  });
  pendentes.forEach((it) => linhas.push({ tipo: "pendente", it, key: it.idTemp }));

  const total = linhas.length;
  const itens = total > 3 ? [...linhas, ...linhas] : linhas;
  const altura = Math.min(4, Math.max(1, total)) * 40 + 8;

  // Auto-scroll contínuo, igual ao carrossel de "Últimos jogos" — some pra
  // cima devagar sozinho e pausa quando o dedo toca a lista.
  useEffect(() => {
    if (total <= 4) return;
    const id = setInterval(() => {
      const el = scrollRef.current;
      if (!el || pausado) return;
      el.scrollTop += 0.5;
      const metade = el.scrollHeight / 2;
      if (el.scrollTop >= metade) el.scrollTop -= metade;
    }, 30);
    return () => clearInterval(id);
  }, [pausado, total]);

  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

  const pausar = () => {
    setPausado(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  };
  const retomarEmBreve = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPausado(false), 2500);
  };

  if (vazio) return <EmptyHint text="Nenhum evento registrado ainda." />;

  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto relative flex flex-col gap-1.5"
      style={{ maxHeight: altura, scrollbarWidth: "none" }}
      onTouchStart={pausar}
      onTouchEnd={retomarEmBreve}
      onMouseDown={pausar}
      onMouseUp={retomarEmBreve}
    >
      {itens.map((linha, i) => {
        if (linha.tipo === "separador") {
          return (
            <div key={linha.key + "-" + i} className="flex items-center gap-2 my-1">
              <div className="flex-1 h-px" style={{ background: C.line }} />
              <span className="text-[10px] tracking-widest uppercase" style={{ color: C.textFaint }}>{linha.periodo}º Tempo</span>
              <div className="flex-1 h-px" style={{ background: C.line }} />
            </div>
          );
        }
        if (linha.tipo === "pendente") {
          const it = linha.it;
          const at = it.atletaId ? data.atletas.find((x) => x.id === it.atletaId) : null;
          const rotulo = { passe: "Passe", finalizacao: "Finalização", bola_parada: "Bola parada", drible: "Drible", falta: "Falta" }[it.tipo] || it.tipo;
          return (
            <div key={linha.key + "-" + i} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs shrink-0" style={{ background: C.surface, border: `1px dashed ${C.orange}` }}>
              <span style={{ color: C.orange }}>⚠️ {at ? `${at.numero} · ${at.nome} — ` : ""}{rotulo} — requer revisão manual</span>
              <span style={{ color: C.textFaint }}>P{it.periodoNumero}</span>
            </div>
          );
        }
        const ev = linha.ev;
        const at = data.atletas.find((x) => x.id === ev.atletaId);
        return (
          <button
            key={linha.key + "-" + i}
            onClick={() => { pausar(); onEditar(ev); }}
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs shrink-0 text-left"
            style={{ background: C.surface }}
          >
            <span style={{ color: C.text }}>{at ? `${at.numero} · ${at.nome} — ` : ""}{acaoLabel(data, ev)}</span>
            <span className="flex items-center gap-1.5">
              {ev.periodoNumero && <span style={{ color: C.textFaint }}>P{ev.periodoNumero}</span>}
              <SquarePen size={11} color={C.textFaint} />
            </span>
          </button>
        );
      })}
      <div className="pointer-events-none sticky bottom-0 h-4" style={{ background: `linear-gradient(180deg, transparent, ${C.bg})`, marginTop: -16 }} />
    </div>
  );
}

function UltimosJogosCarousel({ eventos, data, nav }) {
  const scrollRef = useRef(null);
  const [pausado, setPausado] = useState(false);
  const resumeTimer = useRef(null);
  const total = eventos.length;
  const altura = Math.min(3, total) * 92 + 8;
  const itens = total > 1 ? [...eventos, ...eventos] : eventos;

  useEffect(() => {
    if (total <= 1) return;
    const id = setInterval(() => {
      const el = scrollRef.current;
      if (!el || pausado) return;
      el.scrollTop += 0.6;
      const metade = el.scrollHeight / 2;
      if (el.scrollTop >= metade) el.scrollTop -= metade;
    }, 30);
    return () => clearInterval(id);
  }, [pausado, total]);

  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

  const pausar = () => {
    setPausado(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  };
  const retomarEmBreve = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPausado(false), 2500);
  };

  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto relative"
      style={{ height: altura, scrollbarWidth: "none" }}
      onTouchStart={pausar}
      onTouchEnd={retomarEmBreve}
      onMouseDown={pausar}
      onMouseUp={retomarEmBreve}
    >
      {itens.map((ev, i) => <UltimoJogoItem key={i + "-" + ev.id} evento={ev} data={data} nav={nav} />)}
      <div className="pointer-events-none sticky bottom-0 h-6" style={{ background: `linear-gradient(180deg, transparent, ${C.bg})`, marginTop: -24 }} />
    </div>
  );
}

function EventoMiniCard({ evento, data, nav }) {
  const equipe = data.equipes.find((e) => e.id === evento.equipeId);
  const escola = data.escolas.find((s) => s.id === equipe?.escolaId);
  const categoria = data.categorias.find((c) => c.id === evento.categoriaId);
  const isJogo = evento.tipo === "jogo";
  const scout = data.scouts[evento.id];
  const catCor = categoria?.cor || (isJogo ? C.blue : C.orange);
  let cor = catCor;
  if (isJogo && evento.status === "finalizado" && scout) {
    cor = scout.placarCasa > scout.placarVisitante ? GREEN : scout.placarCasa === scout.placarVisitante ? C.yellow : C.red;
  }
  return (
    <Card onClick={() => nav("evento-detalhe", { id: evento.id })} accent={cor}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: C.surface2, color: catCor }}>{categoria?.nome || (isJogo ? "Jogo" : "Treino")}</span>
        </div>
        <StatusDot status={evento.status} />
      </div>
      <p style={{ color: C.text, fontWeight: 700, marginTop: 6 }}>{isJogo ? `${escola?.nome || equipe?.nome || "—"} × ${evento.adversario || "?"}` : `Treino — ${escola?.nome || equipe?.nome || "—"}`}</p>
      <p style={{ color: C.textMuted, fontSize: 12 }}>{formatData(evento.data)} {evento.horario && `· ${evento.horario}`}</p>
      {isJogo && scout && evento.status !== "agendado" && <p style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: cor }} className="mt-1">{scout.placarCasa} — {scout.placarVisitante}</p>}
      <Btn variant="primary" className="w-full mt-3" onClick={(ev) => { ev.stopPropagation(); nav("evento-detalhe", { id: evento.id }); }}>{isJogo ? "Abrir Scout" : "Abrir Treino"} <ChevronRight size={15} /></Btn>
    </Card>
  );
}

function ResumoTemporadaScreen({ data, nav }) {
  const { porCategoria, totais } = calcularResumoGeral(data);
  const linhas = [
    ["Jogos", totais.jogos], ["Vitórias", totais.v], ["Empates", totais.e], ["Derrotas", totais.d],
    ["Gols marcados", totais.gp], ["Gols sofridos", totais.gc],
  ];
  return (
    <div>
      <ScreenHeader title="Resumo da Temporada" onBack={() => nav("dashboard")} subtitle="Números gerais e por categoria" />
      <div className="px-5">
        <div className="grid grid-cols-2 gap-2">
          {linhas.map(([label, val]) => (
            <div key={label} className="rounded-lg p-3 flex items-center justify-between" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <span style={{ color: C.textMuted, fontSize: 12 }}>{label}</span>
              <span style={{ color: C.lime, fontFamily: FONT_DISPLAY, fontSize: 20 }}>{val}</span>
            </div>
          ))}
        </div>

        <CourtLine label="Por categoria" />
        {Object.keys(porCategoria).length === 0 && <EmptyHint text="Nenhuma categoria cadastrada ainda." />}
        <div className="flex flex-col gap-2">
          {Object.entries(porCategoria).map(([id, pc]) => <CategoriaStatsCard key={id} nome={pc.nome} pc={pc} />)}
        </div>

        <Btn className="w-full mt-4" onClick={() => nav("rankings")}>Ver ranking <ChevronRight size={15} /></Btn>
      </div>
    </div>
  );
}

/* ============================================================
   ESTRUTURA
   ============================================================ */
function Estrutura({ data, update }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ nome: "", cor: "#2F86FF" });
  const [expanded, setExpanded] = useState({});

  const openModal = (type, parentId, editing) => { setForm(editing ? { ...editing } : { nome: "", cor: type === "categoria" ? PALETA_CORES[0] : "#2F86FF" }); setModal({ type, parentId, editing }); };

  const save = () => {
    if (!form.nome?.trim()) return;
    update((d) => {
      const key = modal.type === "escola" ? "escolas" : modal.type === "equipe" ? "equipes" : "categorias";
      if (modal.editing) { Object.assign(d[key].find((i) => i.id === modal.editing.id), form); }
      else {
        const novo = { id: uid(), nome: form.nome.trim(), ...(modal.type === "escola" || modal.type === "categoria" ? { cor: form.cor } : {}), ...(modal.type === "equipe" ? { escolaId: modal.parentId } : {}), ...(modal.type === "categoria" ? { equipeId: modal.parentId } : {}) };
        d[key].push(novo);
      }
      return d;
    });
    setModal(null);
  };

  const remove = (type, id) => {
    update((d) => {
      if (type === "escola") {
        const equipeIds = d.equipes.filter((e) => e.escolaId === id).map((e) => e.id);
        const catIds = d.categorias.filter((c) => equipeIds.includes(c.equipeId)).map((c) => c.id);
        d.escolas = d.escolas.filter((e) => e.id !== id);
        d.equipes = d.equipes.filter((e) => e.escolaId !== id);
        d.categorias = d.categorias.filter((c) => !equipeIds.includes(c.equipeId));
        d.atletas.forEach((a) => { a.categoriaIds = (a.categoriaIds || []).filter((cid) => !catIds.includes(cid)); });
        d.atletas = d.atletas.filter((a) => a.categoriaIds.length > 0);
      } else if (type === "equipe") {
        const catIds = d.categorias.filter((c) => c.equipeId === id).map((c) => c.id);
        d.equipes = d.equipes.filter((e) => e.id !== id);
        d.categorias = d.categorias.filter((c) => c.equipeId !== id);
        d.atletas.forEach((a) => { a.categoriaIds = (a.categoriaIds || []).filter((cid) => !catIds.includes(cid)); });
        d.atletas = d.atletas.filter((a) => a.categoriaIds.length > 0);
      } else if (type === "categoria") {
        d.categorias = d.categorias.filter((c) => c.id !== id);
        d.atletas.forEach((a) => { a.categoriaIds = (a.categoriaIds || []).filter((cid) => cid !== id); });
        d.atletas = d.atletas.filter((a) => a.categoriaIds.length > 0);
      }
      return d;
    });
  };

  return (
    <div>
      <ScreenHeader title="Equipes" subtitle="Escolas, equipes e categorias" right={<Btn variant="primary" onClick={() => openModal("escola")}><Plus size={16} /></Btn>} />
      <div className="px-5 mt-2">
        {data.escolas.length === 0 && <EmptyHint text="Nenhuma escola cadastrada ainda." />}
        {data.escolas.map((escola) => {
          const equipes = data.equipes.filter((e) => e.escolaId === escola.id);
          const isOpen = expanded[escola.id];
          return (
            <div key={escola.id} className="mb-3 rounded-xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
              <div className="flex items-center justify-between p-3" style={{ background: C.surface }} onClick={() => setExpanded((s) => ({ ...s, [escola.id]: !s[escola.id] }))}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: escola.cor || C.blue }} />
                  <span style={{ color: C.text, fontWeight: 700 }}>{escola.nome}</span>
                  <span style={{ color: C.textFaint, fontSize: 11 }}>({equipes.length} equipes)</span>
                </div>
                <div className="flex items-center gap-3">
                  <Pencil size={14} color={C.textMuted} onClick={(e) => { e.stopPropagation(); openModal("escola", null, escola); }} />
                  <Trash2 size={14} color={C.red} onClick={(e) => { e.stopPropagation(); remove("escola", escola.id); }} />
                  <ChevronRight size={16} color={C.textMuted} style={{ transform: isOpen ? "rotate(90deg)" : "none" }} />
                </div>
              </div>
              {isOpen && (
                <div className="p-3" style={{ background: C.bg }}>
                  {equipes.map((equipe) => {
                    const categorias = data.categorias.filter((c) => c.equipeId === equipe.id);
                    return (
                      <div key={equipe.id} className="mb-2 pl-2" style={{ borderLeft: `2px solid ${C.line}` }}>
                        <div className="flex items-center justify-between py-1.5">
                          <span style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{equipe.nome}</span>
                          <div className="flex items-center gap-3">
                            <Pencil size={13} color={C.textMuted} onClick={() => openModal("equipe", escola.id, equipe)} />
                            <Trash2 size={13} color={C.red} onClick={() => remove("equipe", equipe.id)} />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {categorias.map((cat) => (
                            <span key={cat.id} className="text-xs px-2 py-1 rounded-full flex items-center gap-1.5" style={{ background: C.surface2, color: cat.cor || C.textMuted, border: `1px solid ${cat.cor || C.line}` }}>
                              <span className="w-2 h-2 rounded-full" style={{ background: cat.cor || C.textMuted }} />{cat.nome}
                              <Pencil size={10} color={C.textMuted} onClick={() => openModal("categoria", equipe.id, cat)} />
                              <Trash2 size={10} color={C.red} onClick={() => remove("categoria", cat.id)} />
                            </span>
                          ))}
                          <button className="text-xs px-2 py-1 rounded-full" style={{ background: C.surface2, color: C.lime }} onClick={() => openModal("categoria", equipe.id)}>+ categoria</button>
                        </div>
                      </div>
                    );
                  })}
                  <Btn className="w-full mt-1" onClick={() => openModal("equipe", escola.id)}><Plus size={14} /> Nova equipe</Btn>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {modal && (
        <Modal title={modal.editing ? "Editar" : modal.type === "escola" ? "Nova escola" : modal.type === "equipe" ? "Nova equipe" : "Nova categoria"} onClose={() => setModal(null)}>
          <Field label="Nome"><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Sub-14, Futsal Masculino..." autoFocus /></Field>
          {modal.type === "escola" && <Field label="Cor de identificação"><input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="w-full h-10 rounded-lg" /></Field>}
          {modal.type === "categoria" && (
            <Field label="Cor de identificação">
              <div className="flex flex-wrap gap-2">
                {PALETA_CORES.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, cor: c })} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: c, border: form.cor === c ? `2px solid ${C.text}` : "2px solid transparent" }}>
                    {form.cor === c && <Check size={14} color="#12150F" />}
                  </button>
                ))}
              </div>
            </Field>
          )}
          <Btn variant="primary" className="w-full mt-2" onClick={save}>Salvar</Btn>
        </Modal>
      )}
    </div>
  );
}

/* ============================================================
   ATLETAS
   ============================================================ */
function Atletas({ data, update, nav }) {
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ nome: "", numero: "", posicao: POSICOES[0], categoriaIds: [], pePreferido: "Destro", nascimento: "", foto: null });
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [carregandoFoto, setCarregandoFoto] = useState(false);

  const openNew = () => { setEditingId(null); setForm({ nome: "", numero: "", posicao: POSICOES[0], categoriaIds: data.categorias[0] ? [data.categorias[0].id] : [], pePreferido: "Destro", nascimento: "", foto: null, pin: "" }); setModal(true); };
  const openEdit = (a) => { setEditingId(a.id); setForm({ nome: a.nome, numero: a.numero, posicao: a.posicao, categoriaIds: a.categoriaIds || [], pePreferido: a.pePreferido, nascimento: a.nascimento, foto: a.foto || null, pin: a.pin || "" }); setModal(true); };
  const save = () => {
    if (!form.nome?.trim() || form.categoriaIds.length === 0) return;
    update((d) => {
      if (editingId) { Object.assign(d.atletas.find((a) => a.id === editingId), form, { nome: form.nome.trim() }); }
      else { d.atletas.push({ id: uid(), ...form, nome: form.nome.trim() }); }
      return d;
    });
    setModal(false);
  };
  const remove = (id) => update((d) => { d.atletas = d.atletas.filter((a) => a.id !== id); return d; });
  const toggleCategoria = (id) => setForm((f) => ({ ...f, categoriaIds: f.categoriaIds.includes(id) ? f.categoriaIds.filter((c) => c !== id) : [...f.categoriaIds, id] }));
  const lista = data.atletas.filter((a) => !filtroCategoria || (a.categoriaIds || []).includes(filtroCategoria));

  const onFotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCarregandoFoto(true);
    try { const dataUrl = await resizeImageToDataURL(file, 240); setForm((f) => ({ ...f, foto: dataUrl })); }
    catch (err) { /* ignora falha de leitura */ }
    setCarregandoFoto(false);
  };

  return (
    <div>
      <ScreenHeader title="Atletas" subtitle={`${data.atletas.length} cadastrados`} right={<Btn variant="primary" onClick={openNew} disabled={data.categorias.length === 0}><Plus size={16} /></Btn>} />
      <div className="px-5 mt-2">
        {data.categorias.length === 0 && <EmptyHint text="Crie uma escola, equipe e categoria antes de cadastrar atletas." />}
        {data.categorias.length > 0 && (
          <Select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="mb-3">
            <option value="">Todas as categorias</option>
            {data.categorias.map((c) => <option key={c.id} value={c.id}>{categoriaLabel(data, c.id)}</option>)}
          </Select>
        )}
        {lista.length === 0 && data.categorias.length > 0 && <EmptyHint text="Nenhum atleta nessa categoria ainda." />}
        <div className="flex flex-col gap-2">
          {lista.map((a) => (
            <Card key={a.id} onClick={() => nav("atleta-perfil", { id: a.id })}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar atleta={a} size={40} />
                  <div>
                    <p style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{a.nome}</p>
                    <p style={{ color: C.textMuted, fontSize: 12 }}>{a.posicao} · {nomesCurtoCategorias(data, a)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Pencil size={14} color={C.textMuted} onClick={(e) => { e.stopPropagation(); openEdit(a); }} />
                  <Trash2 size={15} color={C.red} onClick={(e) => { e.stopPropagation(); remove(a.id); }} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
      {modal && (
        <Modal title={editingId ? "Editar atleta" : "Novo atleta"} onClose={() => setModal(false)}>
          <div className="flex justify-center mb-3">
            <label className="relative cursor-pointer">
              <Avatar atleta={{ foto: form.foto, numero: form.numero }} size={72} />
              <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: C.lime }}>
                <Pencil size={12} color="#12150F" />
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={onFotoChange} />
            </label>
          </div>
          {carregandoFoto && <p style={{ color: C.textFaint, fontSize: 11 }} className="text-center mb-2">Carregando foto...</p>}
          <Field label="Nome"><Input autoFocus value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Número"><Input type="number" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></Field>
            <Field label="Posição"><Select value={form.posicao} onChange={(e) => setForm({ ...form, posicao: e.target.value })}>{POSICOES.map((p) => <option key={p}>{p}</option>)}</Select></Field>
          </div>
          <Field label="Categorias (pode marcar mais de uma — mesmo atleta em times diferentes)">
            <div className="flex flex-col gap-1.5">
              {data.categorias.map((c) => {
                const on = form.categoriaIds.includes(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => toggleCategoria(c.id)} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: on ? C.limeDim : C.surface2, border: `1px solid ${on ? C.lime : C.line}` }}>
                    <span style={{ color: C.text, fontSize: 13 }}>{categoriaLabel(data, c.id)}</span>
                    {on && <Check size={14} color={C.lime} />}
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pé dominante"><Select value={form.pePreferido} onChange={(e) => setForm({ ...form, pePreferido: e.target.value })}><option>Destro</option><option>Canhoto</option><option>Ambidestro</option></Select></Field>
            <Field label="Nascimento"><Input type="date" value={form.nascimento} onChange={(e) => setForm({ ...form, nascimento: e.target.value })} /></Field>
          </div>
          <Field label="PIN de acesso do aluno (opcional)">
            <Input inputMode="numeric" maxLength={6} value={form.pin || ""} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })} placeholder="Ex: 1234" />
          </Field>
          <p style={{ color: C.textFaint, fontSize: 10 }} className="-mt-2 mb-2">Com um PIN, o atleta pode entrar na Área do Aluno (somente visualização).</p>
          <Btn variant="primary" className="w-full mt-2" onClick={save} disabled={form.categoriaIds.length === 0}>Salvar atleta</Btn>
        </Modal>
      )}
    </div>
  );
}

/* ============================================================
   PERFIL DO ATLETA
   ============================================================ */
function agregarEstatisticasAtleta(data, atletaId) {
  const stats = { jogos: new Set(), treinos: new Set(), gols: 0, assistencias: 0, erros: 0, positivos: 0, faltasCometidas: 0, faltasSofridas: 0, defesas: 0, notas: [], minutagemTotal: 0, jogosComMinutagem: 0, passesCertos: 0, passesErrados: 0, finalizacoesTotais: 0, finalizacoesGol: 0 };
  Object.entries(data.scouts).forEach(([eventoId, scout]) => {
    const evento = data.eventos.find((e) => e.id === eventoId);
    if (!evento) return;
    const evs = (scout.eventosScout || []).filter((ev) => ev.atletaId === atletaId);
    const minutagemAtletaObj = scout.minutagem && scout.minutagem[atletaId];
    if (evento.tipo === "jogo") {
      if (evs.length > 0 || minutagemAtletaObj) stats.jogos.add(eventoId);
      evs.forEach((ev) => {
        if (ev.acao === "gol") stats.gols++;
        if (ev.acao === "assistencia") stats.assistencias++;
        if (ev.acao === "erro") stats.erros++;
        if (ev.acao === "positivo") stats.positivos++;
        if (ev.acao === "falta") ev.variante === "Cometida" ? stats.faltasCometidas++ : stats.faltasSofridas++;
        if (ev.acao === "defesa") stats.defesas++;
        if (ev.acao === "passe" && ev.variante === "Certo") stats.passesCertos++;
        if (ev.acao === "passe" && ev.variante === "Errado") stats.passesErrados++;
        if (ev.acao === "finalizacao_jogador") { stats.finalizacoesTotais++; if (ev.variante === "Gol") stats.finalizacoesGol++; }
      });
      if (minutagemAtletaObj && minutagemAtletaObj.segundosTotais > 0) {
        stats.minutagemTotal += minutagemAtletaObj.segundosTotais;
        stats.jogosComMinutagem++;
      }
      if (evs.length > 0 || minutagemAtletaObj) stats.notas.push(calcularNotaSugerida(scout, atletaId));
    } else {
      if (evs.length > 0) stats.treinos.add(eventoId);
    }
  });
  const mediaNota = stats.notas.length ? stats.notas.reduce((a, b) => a + b, 0) / stats.notas.length : null;
  const minutagemMedia = stats.jogosComMinutagem ? stats.minutagemTotal / stats.jogosComMinutagem : 0;
  const totalPasses = stats.passesCertos + stats.passesErrados;
  const precisaoPasses = totalPasses > 0 ? Math.round((stats.passesCertos / totalPasses) * 100) : null;
  const precisaoFinalizacoes = stats.finalizacoesTotais > 0 ? Math.round((stats.finalizacoesGol / stats.finalizacoesTotais) * 100) : null;
  return { ...stats, jogos: stats.jogos.size, treinos: stats.treinos.size, mediaNota, minutagemMedia, precisaoPasses, precisaoFinalizacoes };
}

function AtletaPerfil({ data, update, params, nav, readOnly }) {
  const atleta = data.atletas.find((a) => a.id === params.id);
  if (!atleta) return <div className="px-5 pt-6"><Btn onClick={() => nav("atletas")}>Voltar</Btn></div>;
  const stats = agregarEstatisticasAtleta(data, atleta.id);
  const isGoleiro = atleta.posicao === "Goleiro";
  const [carregandoFoto, setCarregandoFoto] = useState(false);
  const onFotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCarregandoFoto(true);
    try {
      const dataUrl = await resizeImageToDataURL(file, 240);
      update((d) => { const a = d.atletas.find((x) => x.id === atleta.id); if (a) a.foto = dataUrl; return d; });
    } catch (err) { /* ignora falha de leitura */ }
    setCarregandoFoto(false);
  };
  const linhas = [
    ["Jogos", stats.jogos], ["Minutagem média", formatMMSS(stats.minutagemMedia)],
    ...(isGoleiro ? [["Defesas", stats.defesas]] : [["Gols", stats.gols], ["Assistências", stats.assistencias]]),
    ["Erros", stats.erros], ["Positivos", stats.positivos],
    ["Precisão de passes", stats.precisaoPasses != null ? `${stats.precisaoPasses}%` : "—"],
    ["Precisão de finalizações", stats.precisaoFinalizacoes != null ? `${stats.precisaoFinalizacoes}%` : "—"],
    ["Faltas cometidas", stats.faltasCometidas], ["Faltas sofridas", stats.faltasSofridas],
    ["Nota média", stats.mediaNota != null ? stats.mediaNota.toFixed(1) : "—"],
  ];
  return (
    <div>
      <ScreenHeader title={atleta.nome} subtitle={nomesCurtoCategorias(data, atleta)} onBack={() => nav(readOnly ? "dashboard" : "atletas")} />
      <div className="px-5">
        <Card className="flex items-center gap-4">
          {readOnly ? <Avatar atleta={atleta} size={64} /> : (
            <label className="relative cursor-pointer shrink-0">
              <Avatar atleta={atleta} size={64} />
              <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: C.lime }}>
                <Pencil size={11} color="#12150F" />
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={onFotoChange} />
            </label>
          )}
          <div>
            <p style={{ color: C.text, fontWeight: 700 }}>{atleta.posicao}</p>
            <p style={{ color: C.textMuted, fontSize: 12 }}>Pé {atleta.pePreferido?.toLowerCase()} {atleta.nascimento && `· nasc. ${formatData(atleta.nascimento)}`}</p>
            {carregandoFoto && <p style={{ color: C.textFaint, fontSize: 10 }} className="mt-0.5">Carregando foto...</p>}
          </div>
        </Card>
        <CourtLine label="Temporada" />
        <div className="grid grid-cols-2 gap-2">
          {linhas.map(([label, val]) => (
            <div key={label} className="rounded-lg p-3 flex items-center justify-between" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <span style={{ color: C.textMuted, fontSize: 12 }}>{label}</span>
              <span style={{ color: (label === "Gols" || label === "Defesas") ? C.lime : C.text, fontFamily: FONT_DISPLAY, fontSize: 20 }}>{val}</span>
            </div>
          ))}
        </div>
        {stats.jogos + stats.treinos === 0 && <div className="mt-3"><EmptyHint text="Sem dados registrados ainda — finalize um jogo ou treino com scout para ver a evolução aqui." /></div>}
      </div>
    </div>
  );
}

/* ============================================================
   CALENDÁRIO
   ============================================================ */
function CalendarioView({ data, update, nav, readOnly }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const categoriasDe = (equipeId) => data.categorias.filter((c) => c.equipeId === equipeId);

  const openNovo = (tipo) => {
    const equipeId = data.equipes[0]?.id || "";
    setForm({
      tipo, equipeId, categoriaId: categoriasDe(equipeId)[0]?.id || "",
      data: new Date().toISOString().slice(0, 10), horario: "19:00", local: "",
      adversario: "", campeonato: "", fase: "", rodada: "", tipoTreino: TIPOS_TREINO[0], objetivo: "",
      status: "agendado", formatoId: "2x20", numPeriodos: 2, duracaoPeriodo: 20,
    });
    setModal(tipo);
  };

  const save = () => {
    if (!form.equipeId || !form.categoriaId || !form.data) return;
    update((d) => {
      const novo = { id: uid(), ...form };
      if (form.tipo === "jogo") {
        const preset = FORMATOS_PARTIDA.find((f) => f.id === form.formatoId);
        novo.periodos = form.formatoId === "custom" ? gerarPeriodos(form.numPeriodos, form.duracaoPeriodo) : gerarPeriodos(preset.n, preset.dur);
      }
      d.eventos.push(novo);
      return d;
    });
    setModal(null);
  };

  const ordenados = [...data.eventos].sort((a, b) => new Date(a.data + "T" + (a.horario || "00:00")) - new Date(b.data + "T" + (b.horario || "00:00")));

  return (
    <div>
      <ScreenHeader title="Calendário" subtitle="Jogos" right={
        !readOnly && <Btn variant="primary" onClick={() => openNovo("jogo")} disabled={data.equipes.length === 0}><Plus size={14} /> Jogo</Btn>
      } />
      <div className="px-5 mt-2">
        {data.equipes.length === 0 && <EmptyHint text="Crie uma equipe antes de agendar jogos." />}
        {ordenados.length === 0 && data.equipes.length > 0 && <EmptyHint text="Nenhum jogo agendado ainda." />}
        <div className="flex flex-col gap-2">{ordenados.map((ev) => <EventoMiniCard key={ev.id} evento={ev} data={data} nav={nav} />)}</div>
      </div>
      {modal && (
        <Modal title={modal === "jogo" ? "Agendar jogo" : "Agendar treino"} onClose={() => setModal(null)} wide>
          <Field label="Equipe">
            <Select value={form.equipeId} onChange={(e) => setForm({ ...form, equipeId: e.target.value, categoriaId: categoriasDe(e.target.value)[0]?.id || "" })}>
              {data.equipes.map((eq) => { const esc = data.escolas.find((s) => s.id === eq.escolaId); return <option key={eq.id} value={eq.id}>{esc?.nome} · {eq.nome}</option>; })}
            </Select>
          </Field>
          <Field label="Categoria"><Select value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}>{categoriasDe(form.equipeId).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data"><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></Field>
            <Field label="Horário"><Input type="time" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} /></Field>
          </div>
          <Field label="Local"><Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} placeholder="Ginásio, quadra..." /></Field>
          {modal === "jogo" ? (
            <>
              <Field label="Adversário"><Input value={form.adversario} onChange={(e) => setForm({ ...form, adversario: e.target.value })} /></Field>
              <Field label="Campeonato"><Input value={form.campeonato} onChange={(e) => setForm({ ...form, campeonato: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fase (opcional)"><Input value={form.fase} onChange={(e) => setForm({ ...form, fase: e.target.value })} placeholder="Ex: Semifinal" /></Field>
                <Field label="Rodada (opcional)"><Input value={form.rodada} onChange={(e) => setForm({ ...form, rodada: e.target.value })} placeholder="Ex: 3ª rodada" /></Field>
              </div>
              <Field label="Formato da partida">
                <Select value={form.formatoId} onChange={(e) => setForm({ ...form, formatoId: e.target.value })}>
                  {FORMATOS_PARTIDA.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </Select>
              </Field>
              {form.formatoId === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nº de tempos"><Input type="number" min={1} value={form.numPeriodos} onChange={(e) => setForm({ ...form, numPeriodos: e.target.value })} /></Field>
                  <Field label="Duração (min)"><Input type="number" min={1} value={form.duracaoPeriodo} onChange={(e) => setForm({ ...form, duracaoPeriodo: e.target.value })} /></Field>
                </div>
              )}
            </>
          ) : (
            <>
              <Field label="Tipo de treino"><Select value={form.tipoTreino} onChange={(e) => setForm({ ...form, tipoTreino: e.target.value })}>{TIPOS_TREINO.map((t) => <option key={t}>{t}</option>)}</Select></Field>
              <Field label="Objetivo"><Input value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} /></Field>
            </>
          )}
          <Btn variant="primary" className="w-full mt-2" onClick={save}>Salvar</Btn>
        </Modal>
      )}
    </div>
  );
}

/* ============================================================
   DETALHE DO EVENTO
   ============================================================ */
function EventoDetalhe({ data, update, params, nav, readOnly }) {
  const evento = data.eventos.find((e) => e.id === params.id);
  if (!evento) return <div className="px-5 pt-6"><Btn onClick={() => nav("calendario")}>Voltar</Btn></div>;
  const equipe = data.equipes.find((e) => e.id === evento.equipeId);
  const categoria = data.categorias.find((c) => c.id === evento.categoriaId);
  const isJogo = evento.tipo === "jogo";
  const scout = data.scouts[evento.id];

  const remover = () => { update((d) => { d.eventos = d.eventos.filter((e) => e.id !== evento.id); return d; }); nav("calendario"); };
  const iniciar = () => {
    update((d) => {
      const ev = d.eventos.find((e) => e.id === evento.id);
      ev.status = "andamento";
      if (!d.scouts[evento.id]) d.scouts[evento.id] = isJogo ? novoScoutJogo(ev) : { presencas: {}, eventosScout: [], avaliacoes: {} };
      return d;
    });
    nav(isJogo ? "scout-jogo" : "scout-treino", { id: evento.id });
  };

  let label = isJogo ? "Iniciar Scout" : "Iniciar Treino";
  if (evento.status === "andamento") label = isJogo ? "Continuar Scout" : "Continuar Treino";
  if (evento.status === "finalizado") label = isJogo ? "Ver Scout" : "Ver Treino";

  return (
    <div>
      <ScreenHeader title={isJogo ? "Jogo" : "Treino"} onBack={() => nav("calendario")} />
      <div className="px-5">
        <Card>
          <div className="flex items-center justify-between mb-2">
            {isJogo ? <Target size={18} color={C.blue} /> : <Dumbbell size={18} color={C.orange} />}
            <StatusDot status={evento.status} />
          </div>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 26, color: C.text }}>{isJogo ? `${equipe?.nome} × ${evento.adversario || "?"}` : `Treino — ${equipe?.nome}`}</p>
          <div className="flex flex-col gap-1.5 mt-3" style={{ color: C.textMuted, fontSize: 13 }}>
            <span className="flex items-center gap-2"><Shield size={13} /> {categoria?.nome}</span>
            <span className="flex items-center gap-2"><CalendarIcon size={13} /> {formatData(evento.data)} {evento.horario && `· ${evento.horario}`}</span>
            {evento.local && <span className="flex items-center gap-2"><MapPin size={13} /> {evento.local}</span>}
            {isJogo && evento.campeonato && <span className="flex items-center gap-2"><Trophy size={13} /> {evento.campeonato}{evento.fase && ` · ${evento.fase}`}{evento.rodada && ` · ${evento.rodada}`}</span>}
            {isJogo && evento.periodos && <span className="flex items-center gap-2"><Clock size={13} /> {evento.periodos.length}× {evento.periodos[0].duracaoMin} min</span>}
            {!isJogo && evento.tipoTreino && <span className="flex items-center gap-2"><FileText size={13} /> {evento.tipoTreino}{evento.objetivo && ` · ${evento.objetivo}`}</span>}
          </div>
          {scout && isJogo && evento.status !== "agendado" && <p className="mt-3" style={{ fontFamily: FONT_DISPLAY, fontSize: 32, color: C.lime }}>{scout.placarCasa} — {scout.placarVisitante}</p>}
        </Card>

        {(() => {
          const atletasCategoria = data.atletas.filter((a) => (a.categoriaIds || []).includes(evento.categoriaId));
          if (atletasCategoria.length === 0) return null;
          return (
            <>
              <CourtLine label="Atletas relacionados" />
              <div className="flex gap-2 overflow-x-auto pb-1">
                {atletasCategoria.map((a) => (
                  <div key={a.id} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 56 }}>
                    <Avatar atleta={a} size={40} />
                    <span style={{ fontSize: 9, color: C.textMuted, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: 56 }}>{a.nome}</span>
                  </div>
                ))}
              </div>
            </>
          );
        })()}
        <div className="flex flex-col gap-2 mt-4">
          {evento.status === "finalizado" ? (
            <Btn variant="primary" className="w-full" onClick={() => nav(isJogo ? "relatorio-jogo" : "relatorio-treino", { id: evento.id })}><FileText size={16} /> Ver relatório</Btn>
          ) : readOnly ? (
            <div className="rounded-lg p-3 text-center" style={{ background: C.surface2, color: C.textMuted, fontSize: 13 }}>Aguardando o treinador {evento.status === "andamento" ? "finalizar" : "iniciar"} a partida</div>
          ) : (
            <Btn variant="primary" className="w-full" onClick={iniciar}><Play size={16} /> {label}</Btn>
          )}
          {!readOnly && <Btn variant="danger" className="w-full" onClick={remover}><Trash2 size={16} /> Excluir</Btn>}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SCOUT AO VIVO — JOGO
   ============================================================ */
function acaoLabel(data, ev) {
  switch (ev.acao) {
    case "gol": return `Gol${ev.variante ? ` (${ev.variante})` : ""}`;
    case "gol_adv": return `Gol sofrido${ev.variante ? ` (${ev.variante})` : ""}`;
    case "assistencia": return "Assistência";
    case "erro": return ev.variante && ev.variante !== "Simples" ? `Erro — ${ev.variante}` : "Erro";
    case "falta": return `Falta ${ev.variante}`;
    case "defesa": return "Defesa (GK)";
    case "cartao": return `Cartão ${ev.variante}`;
    case "positivo": return `Positivo — ${ev.variante}`;
    case "bola_parada": return `${ev.categoria} — ${ev.jogada} (${ev.resultado})`;
    case "finalizacao_time": return `Finalização ${ev.lado === "contra" ? "contra" : "a favor"} — ${ev.variante}`;
    case "finalizacao_jogador": return `Finalização — ${ev.variante}`;
    case "passe": return `Passe ${ev.variante}`;
    case "passe_time": return `Passe do adversário — ${ev.variante}`;
    case "substituicao": {
      const sai = data.atletas.find((a) => a.id === ev.saiId);
      const entra = data.atletas.find((a) => a.id === ev.entraId);
      return `Substituição: ${sai?.nome || "?"} ⇄ ${entra?.nome || "?"}`;
    }
    default: return ev.acao;
  }
}

function SubstituicaoModal({ emQuadra, foraDeQuadra, jaJogouAntes, mostrarAviso, multiplo, preSelecionado, onSave, onClose }) {
  const [saiId, setSaiId] = useState((preSelecionado && emQuadra.find((a) => a.id === preSelecionado)) ? preSelecionado : (emQuadra[0]?.id || ""));
  const [entraId, setEntraId] = useState(foraDeQuadra[0]?.id || "");
  useEffect(() => {
    if (!emQuadra.find((a) => a.id === saiId)) setSaiId(emQuadra[0]?.id || "");
    if (!foraDeQuadra.find((a) => a.id === entraId)) setEntraId(foraDeQuadra[0]?.id || "");
    // eslint-disable-next-line
  }, [emQuadra.length, foraDeQuadra.length]);

  return (
    <Modal title={multiplo ? "Substituições" : "Substituição"} onClose={onClose} wide>
      <Field label="Sai (em quadra)">
        {emQuadra.length === 0 ? <p style={{ color: C.textFaint, fontSize: 12 }}>Nenhum atleta em quadra.</p> : (
          <div className="flex flex-col gap-1.5">
            {emQuadra.map((a) => (
              <button key={a.id} onClick={() => setSaiId(a.id)} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: saiId === a.id ? C.limeDim : C.surface2, border: `1px solid ${saiId === a.id ? C.lime : C.line}` }}>
                <span style={{ color: C.text, fontSize: 13 }}>{a.numero} · {a.nome}</span>
                {saiId === a.id && <Check size={14} color={C.lime} />}
              </button>
            ))}
          </div>
        )}
      </Field>
      <Field label="Entra (no banco)">
        {foraDeQuadra.length === 0 ? <p style={{ color: C.textFaint, fontSize: 12 }}>Nenhum atleta no banco.</p> : (
          <div className="flex flex-col gap-1.5">
            {foraDeQuadra.map((a) => {
              const aviso = mostrarAviso && jaJogouAntes(a.id);
              return (
                <button key={a.id} onClick={() => setEntraId(a.id)} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: entraId === a.id ? C.limeDim : C.surface2, border: `1px solid ${entraId === a.id ? C.lime : C.line}` }}>
                  <span style={{ color: C.text, fontSize: 13 }}>{a.numero} · {a.nome}</span>
                  <div className="flex items-center gap-2">
                    {aviso && <AlertTriangle size={14} color={C.yellow} />}
                    {entraId === a.id && <Check size={14} color={C.lime} />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Field>
      {mostrarAviso && <p style={{ color: C.textFaint, fontSize: 10 }} className="mb-2">⚠️ indica que o atleta já jogou o 1º tempo.</p>}
      {multiplo ? (
        <>
          <Btn variant="primary" className="w-full" disabled={!saiId || !entraId} onClick={() => onSave(saiId, entraId, multiplo)}>Confirmar substituição</Btn>
          <Btn variant="primary" className="w-full mt-2" onClick={onClose}>Concluir e ir para o próximo tempo</Btn>
        </>
      ) : (
        <div className="flex gap-2">
          <Btn className="flex-1" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" className="flex-1" disabled={!saiId || !entraId} onClick={() => onSave(saiId, entraId, multiplo)}>Confirmar</Btn>
        </div>
      )}
    </Modal>
  );
}


function AssistirVideoInline({ C, evento, scout, periodos }) {
  const [aberto, setAberto] = useState(false);
  const [urls, setUrls] = useState({});
  const [ativa, setAtiva] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [minimizado, setMinimizado] = useState(false);

  const porPeriodo = periodos
    .map((p) => ({ periodo: p, segmentos: (scout.videosPorPeriodo?.[p.numero]?.segmentos || []).filter((s) => s.key) }))
    .filter((g) => g.segmentos.length > 0);

  if (porPeriodo.length === 0) return null;

  const abrirSegmento = async (periodoNumero, seg) => {
    const chave = `p${periodoNumero}-s${seg.indice}`;
    setAtiva(chave);
    setMinimizado(false);
    if (!urls[chave]) {
      setCarregando(true);
      try {
        const { url } = await obterUrlReproducao({ partidaId: `${evento.id}_p${periodoNumero}_s${seg.indice}`, videoKey: seg.key });
        setUrls((prev) => ({ ...prev, [chave]: url }));
      } catch (e) { /* ignora */ }
      setCarregando(false);
    }
  };

  const videoAberto = ativa && urls[ativa] && !minimizado;

  return (
    <div className="rounded-xl mb-4" style={{ background: C.surface2, border: `1px solid ${C.line}`, overflow: "hidden" }}>
      <button onClick={() => setAberto((v) => !v)} className="w-full flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2" style={{ color: C.text, fontSize: 13, fontWeight: 600 }}><Play size={14} fill={C.lime} /> Assistir vídeo (enquanto edita)</span>
        <ChevronRight size={16} color={C.textMuted} style={{ transform: aberto ? "rotate(90deg)" : "none" }} />
      </button>
      {aberto && (
        <div className="px-4 pb-4">
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {porPeriodo.flatMap(({ periodo, segmentos }) => segmentos.map((seg) => {
              const chave = `p${periodo.numero}-s${seg.indice}`;
              return (
                <button key={chave} onClick={() => abrirSegmento(periodo.numero, seg)} className="py-1.5 px-2 rounded-lg text-xs" style={{ background: ativa === chave ? C.limeDim : C.surface, border: `1px solid ${ativa === chave ? C.lime : C.line}`, color: ativa === chave ? C.lime : C.textMuted }}>
                  {periodo.label} · trecho {seg.indice + 1}
                </button>
              );
            }))}
          </div>
          {carregando && <p className="text-center text-xs py-4" style={{ color: C.textMuted }}>Carregando vídeo…</p>}
          {ativa && urls[ativa] && minimizado && (
            <button onClick={() => setMinimizado(false)} className="flex items-center gap-1.5 text-xs py-2" style={{ color: C.lime }}>
              <Play size={12} fill={C.lime} /> Reabrir vídeo flutuante
            </button>
          )}
        </div>
      )}

      {/* Flutuante de verdade (position: fixed) — continua visível na tela
          mesmo rolando a página pra marcar estatísticas mais abaixo,
          porque não faz parte do fluxo normal da página, fica "por cima". */}
      {videoAberto && (
        <div
          style={{
            position: "fixed",
            right: 12,
            bottom: 84,
            width: 168,
            zIndex: 60,
            background: "#000",
            borderRadius: 12,
            overflow: "hidden",
            border: `1px solid ${C.line}`,
            boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
          }}
        >
          <div className="flex items-center justify-between px-2 py-1" style={{ background: C.surface2 }}>
            <span style={{ color: C.textFaint, fontSize: 9 }}>vídeo</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setMinimizado(true)} style={{ color: C.textMuted, fontSize: 12, lineHeight: 1 }}>—</button>
              <button onClick={() => setAtiva(null)} style={{ color: C.textMuted, fontSize: 12, lineHeight: 1 }}>✕</button>
            </div>
          </div>
          <video src={urls[ativa]} controls playsInline className="w-full block" style={{ maxHeight: 220 }} />
        </div>
      )}
    </div>
  );
}

function ScoutJogo({ data, update, params, nav }) {
  const evento = data.eventos.find((e) => e.id === params.id);
  const scout = data.scouts[params.id];
  const [atletaAtivo, setAtletaAtivo] = useState(null);
  const [variantePendente, setVariantePendente] = useState(null);
  const [modalSub, setModalSub] = useState(false);
  const [modalSubMultiplo, setModalSubMultiplo] = useState(false);
  const [fluxoGol, setFluxoGol] = useState(null); // { lado:'pro'|'contra', etapa:'atleta'|'assistencia'|'tipo', atletaId?, assistenciaId?, origem? }
  const [finalizacaoAtletaPendente, setFinalizacaoAtletaPendente] = useState(null);
  const [bolaParadaExpandida, setBolaParadaExpandida] = useState(null);
  const [bolaParadaPendente, setBolaParadaPendente] = useState(null); // { categoriaKey, categoriaLabel, jogada, outcomes }
  const [eventoEditando, setEventoEditando] = useState(null);
  const [positivoPendente, setPositivoPendente] = useState(null); // { variante, etapa: 'golQuestion'|'atleta' }
  const [confirmProximoTempo, setConfirmProximoTempo] = useState(false);
  const [subAntesDeAvancar, setSubAntesDeAvancar] = useState(false);
  const [mvpSelecionado, setMvpSelecionado] = useState(null);
  const [etapa, setEtapa] = useState(() => {
    if (params.forcarEtapa) return params.forcarEtapa;
    if (!scout?.coresUniforme) return "cores";
    return scout?.titularesDefinidos ? "ao_vivo" : "titulares";
  });
  const [corFavorSel, setCorFavorSel] = useState(null);
  const [corContraSel, setCorContraSel] = useState(null);
  const [titularesSelecionados, setTitularesSelecionados] = useState([]);
  const [ladoFinalizacao, setLadoFinalizacao] = useState("pro");
  const [, forceTick] = useState(0);

  const periodoAtualMinPreGuard = evento?.periodos?.find((p) => p.numero === scout?.periodoAtual)?.duracaoMin ?? evento?.periodos?.[0]?.duracaoMin ?? 20;
  useEffect(() => {
    if (!scout?.cronometro?.rodando) return;
    const id = setInterval(() => {
      const atual = tempoPeriodoAtual(scout.cronometro);
      if (atual >= periodoAtualMinPreGuard * 60) {
        update((d) => {
          const s = d.scouts[evento.id];
          const c = s.cronometro;
          if (c.rodando) { const el = (Date.now() - c.inicioEpoch) / 1000; c.acumuladoPeriodoSeg += el; c.acumuladoTotalSeg += el; c.rodando = false; c.inicioEpoch = null; }
          return d;
        });
      } else {
        forceTick((t) => t + 1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [scout?.cronometro?.rodando, scout?.cronometro?.inicioEpoch, periodoAtualMinPreGuard]);

  // Hook precisa ficar antes do "return" condicional (regra dos hooks) —
  // ele mesmo não faz nada se evento/scout ainda não existirem.
  const atletasParaAnalise = evento ? data.atletas.filter((a) => (a.categoriaIds || []).includes(evento.categoriaId)) : [];
  useAnaliseAoVivo({ evento, scout, atletas: atletasParaAnalise, update, uid });

  if (!evento || !scout) return <div className="px-5 pt-6"><Btn onClick={() => nav("calendario")}>Voltar</Btn></div>;
  const periodos = evento.periodos && evento.periodos.length ? evento.periodos : gerarPeriodos(2, 20);
  const atletas = data.atletas.filter((a) => (a.categoriaIds || []).includes(evento.categoriaId));
  const equipe = data.equipes.find((e) => e.id === evento.equipeId);
  const atletaAtivoObj = atletas.find((a) => a.id === atletaAtivo);
  const isGoleiroAtivo = atletaAtivoObj?.posicao === "Goleiro";
  const acoesDisponiveis = isGoleiroAtivo ? ACOES_GOLEIRO : ACOES_LINHA;
  const emQuadra = atletas.filter((a) => scout.minutagem?.[a.id]?.entradaEmSeg != null);
  const foraDeQuadra = atletas.filter((a) => !(scout.minutagem?.[a.id]?.entradaEmSeg != null));

  const registrar = (acaoKey, variante = null, extra = {}) => {
    update((d) => {
      const s = d.scouts[evento.id];
      const atletaId = extra.atletaId !== undefined ? extra.atletaId : atletaAtivo;
      s.eventosScout.push({ id: uid(), acao: acaoKey, atletaId, variante, periodoNumero: s.periodoAtual, ts: Date.now(), ...extra });
      if (acaoKey === "gol") { s.placarCasa++; s.eventosScout.push({ id: uid(), acao: "finalizacao_time", atletaId: null, variante: "Gol", lado: "pro", periodoNumero: s.periodoAtual, ts: Date.now() }); }
      if (acaoKey === "gol_adv") { s.placarVisitante++; s.eventosScout.push({ id: uid(), acao: "finalizacao_time", atletaId: null, variante: "Gol", lado: "contra", periodoNumero: s.periodoAtual, ts: Date.now() }); }
      if (acaoKey === "erro" && variante === "Gerou gol adversário") { s.placarVisitante++; s.eventosScout.push({ id: uid(), acao: "gol_adv", atletaId: null, variante: "Erro provocado", periodoNumero: s.periodoAtual, ts: Date.now() }); s.eventosScout.push({ id: uid(), acao: "finalizacao_time", atletaId: null, variante: "Gol", lado: "contra", periodoNumero: s.periodoAtual, ts: Date.now() }); }
      return d;
    });
    setVariantePendente(null);
    setFluxoGol(null);
  };
  const onTapAcao = (acao) => acao.variants ? setVariantePendente(acao) : registrar(acao.key);
  const escolherVariantePositivo = (variante) => {
    setVariantePendente(null);
    setPositivoPendente({ variante, etapa: "golQuestion" });
  };
  const iniciarFluxoGol = (lado) => setFluxoGol(lado === "pro" ? { lado, etapa: "atleta" } : { lado, etapa: "tipo" });
  const escolherAtletaGol = (atletaId) => setFluxoGol((f) => ({ ...f, atletaId, etapa: "assistencia" }));
  const escolherAssistenciaGol = (assistenciaId) => {
    if (fluxoGol.origem) {
      registrar("gol", `${fluxoGol.origem.categoria} — ${fluxoGol.origem.jogada}`, { atletaId: fluxoGol.atletaId });
      if (assistenciaId) registrar("assistencia", null, { atletaId: assistenciaId });
      setFluxoGol(null);
    } else {
      setFluxoGol((f) => ({ ...f, assistenciaId, etapa: "tipo" }));
    }
  };
  const escolherTipoGol = (tipo) => {
    registrar(fluxoGol.lado === "pro" ? "gol" : "gol_adv", tipo, { atletaId: fluxoGol.lado === "pro" ? fluxoGol.atletaId : null });
    if (fluxoGol.lado === "pro" && fluxoGol.assistenciaId) registrar("assistencia", null, { atletaId: fluxoGol.assistenciaId });
  };
  const onTapResultadoBolaParada = (resultado) => {
    const { categoriaKey, categoriaLabel, jogada } = bolaParadaPendente;
    update((d) => {
      const s = d.scouts[evento.id];
      s.eventosScout.push({ id: uid(), acao: "bola_parada", atletaId: null, categoria: categoriaLabel, jogada, resultado, periodoNumero: s.periodoAtual, ts: Date.now() });
      return d;
    });
    if (resultado === "Gerou gol adversário") {
      registrar("gol_adv", `${categoriaLabel} — ${jogada}`, { atletaId: null });
    } else if (resultado === "Gerou gol a favor" || resultado === "Gol") {
      if (categoriaKey === "saida_goleiro") {
        registrar("gol", `${categoriaLabel} — ${jogada}`, { atletaId: null });
      } else {
        setFluxoGol({ lado: "pro", etapa: "atleta", origem: { categoria: categoriaLabel, jogada } });
      }
    }
    setBolaParadaPendente(null);
  };
  const registrarDefesaContraGK = () => {
    const gk = emQuadra.find((a) => a.posicao === "Goleiro");
    update((d) => {
      const s = d.scouts[evento.id];
      s.eventosScout.push({ id: uid(), acao: "finalizacao_time", atletaId: null, variante: "Defesa do goleiro", lado: "contra", periodoNumero: s.periodoAtual, ts: Date.now() });
      if (gk) s.eventosScout.push({ id: uid(), acao: "defesa", atletaId: gk.id, variante: null, periodoNumero: s.periodoAtual, ts: Date.now() });
      return d;
    });
  };
  const desfazer = () => update((d) => {
    const s = d.scouts[evento.id];
    const last = s.eventosScout.pop();
    if (!last) return d;
    if (last.acao === "finalizacao_time" && last.atletaId === null) {
      const prev = s.eventosScout[s.eventosScout.length - 1];
      if (prev && prev.acao === "gol_adv" && prev.variante === "Erro provocado") {
        s.eventosScout.pop();
        const prev2 = s.eventosScout[s.eventosScout.length - 1];
        if (prev2 && prev2.acao === "erro" && prev2.variante === "Gerou gol adversário") s.eventosScout.pop();
        s.placarVisitante = Math.max(0, s.placarVisitante - 1);
        return d;
      }
      if (prev && (prev.acao === "gol" || prev.acao === "gol_adv")) {
        s.eventosScout.pop();
        if (prev.acao === "gol") s.placarCasa = Math.max(0, s.placarCasa - 1);
        else s.placarVisitante = Math.max(0, s.placarVisitante - 1);
        return d;
      }
    }
    if (last.acao === "gol") s.placarCasa = Math.max(0, s.placarCasa - 1);
    if (last.acao === "gol_adv") s.placarVisitante = Math.max(0, s.placarVisitante - 1);
    return d;
  });

  const mudarPeriodo = (n) => update((d) => {
    const s = d.scouts[evento.id];
    const c = s.cronometro;
    if (c.rodando) { const el = (Date.now() - c.inicioEpoch) / 1000; c.acumuladoPeriodoSeg += el; c.acumuladoTotalSeg += el; c.rodando = false; c.inicioEpoch = null; }
    c.acumuladoPeriodoSeg = 0;
    s.periodoAtual = n;
    return d;
  });
  const iniciarCronometro = () => update((d) => { const s = d.scouts[evento.id]; s.cronometro.rodando = true; s.cronometro.inicioEpoch = Date.now(); return d; });
  const pausarCronometro = () => update((d) => {
    const s = d.scouts[evento.id]; const c = s.cronometro;
    if (c.rodando) { const el = (Date.now() - c.inicioEpoch) / 1000; c.acumuladoPeriodoSeg += el; c.acumuladoTotalSeg += el; c.rodando = false; c.inicioEpoch = null; }
    return d;
  });
  const confirmarTitulares = (ids) => {
    update((d) => {
      const s = d.scouts[evento.id];
      s.titularesDefinidos = true;
      ids.forEach((id) => { s.minutagem[id] = { segundosTotais: 0, entradaEmSeg: 0 }; });
      return d;
    });
    setEtapa("ao_vivo");
  };
  const confirmarSub = (saiId, entraId, manterAberto) => {
    update((d) => {
      const s = d.scouts[evento.id];
      const totalAgora = tempoTotalAtual(s.cronometro);
      if (s.minutagem[saiId] && s.minutagem[saiId].entradaEmSeg != null) {
        s.minutagem[saiId].segundosTotais += totalAgora - s.minutagem[saiId].entradaEmSeg;
        s.minutagem[saiId].entradaEmSeg = null;
      }
      s.minutagem[entraId] = s.minutagem[entraId] || { segundosTotais: 0, entradaEmSeg: null };
      s.minutagem[entraId].entradaEmSeg = totalAgora;
      s.eventosScout.push({ id: uid(), acao: "substituicao", atletaId: null, saiId, entraId, periodoNumero: s.periodoAtual, minutoJogo: formatMMSS(totalAgora), ts: Date.now() });
      return d;
    });
    if (atletaAtivo === saiId) setAtletaAtivo(null);
    if (!manterAberto) {
      setModalSub(false);
      if (subAntesDeAvancar) { setSubAntesDeAvancar(false); proximoTempo(); }
    }
  };
  const concluir = (mvpId) => {
    update((d) => {
      const s = d.scouts[evento.id];
      const c = s.cronometro;
      if (c.rodando) { const el = (Date.now() - c.inicioEpoch) / 1000; c.acumuladoPeriodoSeg += el; c.acumuladoTotalSeg += el; c.rodando = false; c.inicioEpoch = null; }
      const totalFinal = c.acumuladoTotalSeg;
      Object.keys(s.minutagem).forEach((id) => {
        if (s.minutagem[id].entradaEmSeg != null) { s.minutagem[id].segundosTotais += totalFinal - s.minutagem[id].entradaEmSeg; s.minutagem[id].entradaEmSeg = null; }
      });
      const idsComParticipacao = new Set([...Object.keys(s.minutagem), ...s.eventosScout.filter((e) => e.atletaId).map((e) => e.atletaId)]);
      idsComParticipacao.forEach((id) => { s.destaques[id] = calcularNotaSugerida(s, id); });
      s.mvpId = mvpId || null;
      d.eventos.find((e) => e.id === evento.id).status = "finalizado";
      return d;
    });
    nav("relatorio-jogo", { id: evento.id });
  };

  const finalizacoesCount = (key) => scout.eventosScout.filter((e) => e.acao === "finalizacao_time" && e.variante === key && (e.lado || "pro") === ladoFinalizacao && e.periodoNumero === scout.periodoAtual).length;
  const ultimos = [...scout.eventosScout].slice(-6).reverse();
  // Agrupa por tempo (1º/2º) pra mostrar com separador visual — mais fácil
  // de visualizar o que aconteceu em cada período sem misturar tudo numa
  // lista só corrida.
  const ultimosPorPeriodo = ultimos.reduce((acc, ev) => {
    const p = ev.periodoNumero || 1;
    (acc[p] = acc[p] || []).push(ev);
    return acc;
  }, {});
  const periodosComEventos = Object.keys(ultimosPorPeriodo).map(Number).sort((a, b) => b - a);
  const periodoAtualObj = periodos.find((p) => p.numero === scout.periodoAtual) || periodos[0];
  const placarPorPeriodo = periodos.map((p) => ({
    ...p,
    casa: scout.eventosScout.filter((e) => e.acao === "gol" && e.periodoNumero === p.numero).length,
    fora: scout.eventosScout.filter((e) => e.acao === "gol_adv" && e.periodoNumero === p.numero).length,
  }));
  const faltasNesteTempo = {
    cometidas: scout.eventosScout.filter((e) => e.acao === "falta" && e.variante === "Cometida" && e.periodoNumero === scout.periodoAtual).length,
    sofridas: scout.eventosScout.filter((e) => e.acao === "falta" && e.variante === "Sofrida" && e.periodoNumero === scout.periodoAtual).length,
  };
  const substituicoesNesteTempo = scout.eventosScout.filter((e) => e.acao === "substituicao" && e.periodoNumero === scout.periodoAtual).length;
  const segPeriodo = tempoPeriodoAtual(scout.cronometro);
  const segTotal = tempoTotalAtual(scout.cronometro);
  const tempoEsgotado = segPeriodo >= periodoAtualObj.duracaoMin * 60;
  const isUltimoPeriodo = scout.periodoAtual === periodos[periodos.length - 1].numero;
  const proximoTempo = () => {
    const idx = periodos.findIndex((p) => p.numero === scout.periodoAtual);
    const next = periodos[idx + 1];
    if (next) mudarPeriodo(next.numero);
  };
  const jaJogouAntes = (id) => {
    const foiTitular = scout.minutagem?.[id] != null && !scout.eventosScout.some((e) => e.acao === "substituicao" && e.entraId === id);
    const entrouAntes = scout.eventosScout.some((e) => e.acao === "substituicao" && e.entraId === id && e.periodoNumero < scout.periodoAtual);
    return foiTitular || entrouAntes;
  };
  const participantes = atletas.filter((a) => scout.minutagem?.[a.id] || scout.eventosScout.some((e) => e.atletaId === a.id));

  if (etapa === "cores") {
    const confirmarCores = () => {
      if (!corFavorSel || !corContraSel) return;
      update((d) => {
        d.scouts[evento.id].coresUniforme = { favor: corFavorSel, contra: corContraSel };
        return d;
      });
      setEtapa(scout?.titularesDefinidos ? "ao_vivo" : "titulares");
    };
    return (
      <div>
        <ScreenHeader title="Uniformes da partida" onBack={() => nav("evento-detalhe", { id: evento.id })} subtitle={`${equipe?.nome} × ${evento.adversario}`} />
        <div className="px-5">
          <p style={{ color: C.textMuted, fontSize: 12 }} className="mb-4">
            Escolha a cor de cada uniforme hoje. Isso ajuda a IA a diferenciar sua equipe do adversário nos vídeos.
          </p>
          <p style={{ color: C.textFaint, fontSize: 10, letterSpacing: 0.5 }} className="uppercase mb-1.5">{equipe?.nome} (a favor)</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {CORES_UNIFORME.map((c) => (
              <button key={"f" + c.hex} onClick={() => setCorFavorSel(c)} className="flex flex-col items-center gap-1 py-2 rounded-lg" style={{ background: corFavorSel?.hex === c.hex ? C.limeDim : C.surface, border: `1.5px solid ${corFavorSel?.hex === c.hex ? C.lime : C.line}` }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, background: c.hex, border: `1px solid ${C.line}` }} />
                <span style={{ color: C.textMuted, fontSize: 9 }}>{c.label}</span>
              </button>
            ))}
          </div>
          <p style={{ color: C.textFaint, fontSize: 10, letterSpacing: 0.5 }} className="uppercase mb-1.5">{evento.adversario} (adversário)</p>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {CORES_UNIFORME.map((c) => (
              <button key={"c" + c.hex} onClick={() => setCorContraSel(c)} disabled={corFavorSel?.hex === c.hex} className="flex flex-col items-center gap-1 py-2 rounded-lg" style={{ background: corContraSel?.hex === c.hex ? C.orangeDim || C.surface2 : C.surface, border: `1.5px solid ${corContraSel?.hex === c.hex ? C.orange : C.line}`, opacity: corFavorSel?.hex === c.hex ? 0.3 : 1 }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, background: c.hex, border: `1px solid ${C.line}` }} />
                <span style={{ color: C.textMuted, fontSize: 9 }}>{c.label}</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg mb-4" style={{ background: corContraSel?.label === "Outros" ? `${C.orange}18` : C.surface, border: `1.5px solid ${corContraSel?.label === "Outros" ? C.orange : C.line}` }}>
            <input
              type="color"
              value={corContraSel?.label === "Outros" ? corContraSel.hex : "#888888"}
              onChange={(e) => setCorContraSel({ label: "Outros", hex: e.target.value })}
              style={{ width: 26, height: 26, border: "none", background: "none", padding: 0 }}
            />
            <span style={{ color: C.text, fontSize: 12 }}>Outros — escolher outra cor</span>
          </label>
          <Btn variant="primary" className="w-full" disabled={!corFavorSel || !corContraSel} onClick={confirmarCores}>Confirmar cores <ChevronRight size={15} /></Btn>
        </div>
      </div>
    );
  }

  if (etapa === "titulares") {
    return (
      <div>
        <ScreenHeader title="Escalação inicial" onBack={() => nav("evento-detalhe", { id: evento.id })} subtitle={`${equipe?.nome} × ${evento.adversario}`} />
        <div className="px-5">
          <p style={{ color: C.textMuted, fontSize: 12 }} className="mb-3">Selecione os titulares. Na próxima tela você controla só o cronômetro, separadamente.</p>
          <div className="flex flex-col gap-1.5 mb-4">
            {atletas.map((a) => {
              const on = titularesSelecionados.includes(a.id);
              return (
                <button key={a.id} onClick={() => setTitularesSelecionados((s) => s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id])} className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: on ? C.limeDim : C.surface, border: `1px solid ${on ? C.lime : C.line}` }}>
                  <span style={{ color: C.text, fontSize: 13 }}>{a.numero} · {a.nome}{a.posicao === "Goleiro" ? " (GK)" : ""}</span>
                  {on && <Check size={16} color={C.lime} />}
                </button>
              );
            })}
            {atletas.length === 0 && <EmptyHint text="Nenhum atleta cadastrado nessa categoria." />}
          </div>
          <Btn variant="primary" className="w-full" disabled={titularesSelecionados.length === 0} onClick={() => confirmarTitulares(titularesSelecionados)}>Confirmar {titularesSelecionados.length} titular(es) <ChevronRight size={15} /></Btn>
        </div>
      </div>
    );
  }

  if (etapa === "mvp") {
    return (
      <div>
        <ScreenHeader title="MVP da partida" onBack={() => setEtapa("ao_vivo")} subtitle={`${equipe?.nome} × ${evento.adversario}`} />
        <div className="px-5">
          <p style={{ color: C.textMuted, fontSize: 12 }} className="mb-3">Selecione o destaque da partida entre os atletas que jogaram.</p>
          <div className="flex flex-col gap-1.5 mb-4">
            {participantes.map((a) => (
              <button key={a.id} onClick={() => setMvpSelecionado(a.id)} className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: mvpSelecionado === a.id ? C.limeDim : C.surface, border: `1px solid ${mvpSelecionado === a.id ? C.lime : C.line}` }}>
                <span style={{ color: C.text, fontSize: 13 }}>{a.numero} · {a.nome}</span>
                {mvpSelecionado === a.id && <Award size={16} color={C.lime} />}
              </button>
            ))}
            {participantes.length === 0 && <EmptyHint text="Nenhum atleta participou do jogo." />}
          </div>
          <Btn variant="primary" className="w-full" disabled={!mvpSelecionado} onClick={() => concluir(mvpSelecionado)}><Check size={15} /> Concluir e salvar relatório</Btn>
          <Btn className="w-full mt-2" onClick={() => concluir(null)}>Pular MVP</Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="Scout ao vivo" onBack={() => nav("evento-detalhe", { id: evento.id })} />
      <div className="px-5">
        <AssistirVideoInline C={C} evento={evento} scout={scout} periodos={periodos} />
        <VideoRecordingPanel
          key={scout.periodoAtual}
          C={C}
          partidaId={`${evento.id}_p${scout.periodoAtual}`}
          periodoLabel={periodoAtualObj.label}
          indiceInicial={(scout.videosPorPeriodo?.[scout.periodoAtual]?.segmentos || []).length}
          onSegmentoEnviado={({ indice, key }) => update((d) => {
            const s = d.scouts[evento.id];
            s.videosPorPeriodo = s.videosPorPeriodo || {};
            const atual = s.videosPorPeriodo[scout.periodoAtual] || { segmentos: [] };
            atual.segmentos = [...(atual.segmentos || []), { indice, key, enviadoEm: Date.now(), analiseStatus: "idle" }];
            s.videosPorPeriodo[scout.periodoAtual] = atual;
            return d;
          })}
        />
        {Object.keys(scout.videosPorPeriodo || {}).length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-4" style={{ marginTop: -8 }}>
            {periodos.map((p) => {
              const v = (scout.videosPorPeriodo || {})[p.numero];
              const n = (v?.segmentos || []).length;
              return (
                <span key={p.numero} className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: n > 0 ? C.limeDim : C.surface, border: `1px solid ${n > 0 ? C.lime : C.line}`, fontSize: 10, color: n > 0 ? C.lime : C.textFaint }}>
                  {n > 0 ? <CheckCircle2 size={11} /> : <Circle size={11} />} {p.label}{n > 0 ? ` (${n})` : ""}
                </span>
              );
            })}
          </div>
        )}
        <Card style={{ background: `linear-gradient(180deg, ${C.surface3}, ${C.surface2})` }}>
          <div className="flex items-center justify-between">
            <span style={{ color: C.textFaint, fontSize: 10, letterSpacing: 1 }}>{periodoAtualObj.label.toUpperCase()}</span>
            <span style={{ color: C.textFaint, fontSize: 10 }}>Total: {formatMMSS(segTotal)}</span>
          </div>
          <p className="text-center" style={{ fontFamily: FONT_DISPLAY, fontSize: 52, color: tempoEsgotado ? C.red : C.lime, lineHeight: 1 }}>{formatMMSS(segPeriodo)}<span style={{ fontSize: 18, color: C.textFaint }}> / {periodoAtualObj.duracaoMin}:00</span></p>
          {tempoEsgotado && <p className="text-center" style={{ color: C.red, fontSize: 10 }}>Tempo esgotado — cronômetro parado automaticamente</p>}
          <div className="flex gap-2 mt-2">
            {!scout.cronometro.rodando ? (
              <Btn variant="primary" className="flex-1" onClick={iniciarCronometro}><Play size={14} /> Iniciar</Btn>
            ) : (
              <Btn className="flex-1" onClick={pausarCronometro}><Circle size={14} /> Pausar</Btn>
            )}
          </div>
        </Card>

        <Card className="mt-2" style={{ background: `linear-gradient(180deg, ${C.surface2}, ${C.surface})` }}>
          <p className="text-center" style={{ color: C.lime, fontSize: 10, letterSpacing: 3, fontWeight: 700 }}>MATCH DAY</p>
          <p className="text-center mt-0.5" style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: C.text, letterSpacing: 0.5 }}>{equipe?.nome} <span style={{ color: C.textFaint }}>×</span> {evento.adversario}</p>
          <div className="flex items-center justify-around mt-2">
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 48, color: C.lime, lineHeight: 1 }}>{scout.placarCasa}</p>
            <div className="flex flex-col items-center gap-1">
              <span style={{ color: C.textFaint, fontSize: 10 }}>Tempo</span>
              <div className="flex gap-1 flex-wrap justify-center">
                {periodos.map((p) => (
                  <button key={p.numero} onClick={() => mudarPeriodo(p.numero)} className="px-2.5 py-1 rounded-md text-xs font-bold" style={{ background: scout.periodoAtual === p.numero ? C.lime : C.surface2, color: scout.periodoAtual === p.numero ? "#12150F" : C.textMuted }}>{p.label}</button>
                ))}
              </div>
            </div>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 48, color: C.text, lineHeight: 1 }}>{scout.placarVisitante}</p>
          </div>
          {periodos.length > 1 && (
            <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
              {placarPorPeriodo.map((p) => (
                <span key={p.numero} style={{ color: C.textMuted, fontSize: 11 }}>{p.label.replace("º Tempo", "T").replace("º Quarto", "Q")}: <span style={{ color: C.text, fontWeight: 700 }}>{p.casa}-{p.fora}</span></span>
              ))}
            </div>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <button onClick={() => iniciarFluxoGol("pro")} className="py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5" style={{ background: C.lime, color: "#12150F" }}><CircleDot size={14} /> GOL A FAVOR</button>
          <button onClick={() => iniciarFluxoGol("contra")} className="py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5" style={{ background: C.redDim, color: C.red }}><CircleDot size={14} /> GOL ADVERSÁRIO</button>
        </div>

        <div className="flex items-center justify-around mt-2 rounded-lg py-2" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <span style={{ color: C.textMuted, fontSize: 10 }}>Faltas neste tempo: <span style={{ color: C.text, fontWeight: 700 }}>{faltasNesteTempo.cometidas} contra</span> / <span style={{ color: C.text, fontWeight: 700 }}>{faltasNesteTempo.sofridas} a favor</span></span>
        </div>
        {substituicoesNesteTempo > 0 && <p style={{ color: C.textFaint, fontSize: 10 }} className="mt-1 text-center">{substituicoesNesteTempo} substituição(ões) neste tempo</p>}

        <CourtLine label="Atleta em ação" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {emQuadra.map((a) => (
            <button key={a.id} onClick={() => setAtletaAtivo(a.id)} className="flex flex-col items-center gap-1 shrink-0 px-3 py-2 rounded-lg" style={{ background: atletaAtivo === a.id ? C.lime : C.surface, border: `1px solid ${atletaAtivo === a.id ? C.lime : C.line}` }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: atletaAtivo === a.id ? "#12150F" : C.text }}>{a.numero || "-"}</span>
              <span style={{ fontSize: 9, color: atletaAtivo === a.id ? "#12150F" : C.textMuted, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}{a.posicao === "Goleiro" ? " (GK)" : ""}</span>
            </button>
          ))}
          {emQuadra.length === 0 && <p style={{ color: C.textFaint, fontSize: 11 }}>Ninguém em quadra ainda — confira a escalação ou faça uma substituição.</p>}
        </div>
        {!atletaAtivo && <p style={{ color: C.textFaint, fontSize: 11 }} className="mt-1">Selecione um atleta antes de registrar uma ação.</p>}
        {atletaAtivoObj && <p style={{ color: C.textFaint, fontSize: 11 }} className="mt-1">{atletaAtivoObj.nome}: {formatMMSS(minutagemAtleta(scout, atletaAtivo))} em quadra</p>}

        <Btn className="w-full mt-2" onClick={() => { setModalSubMultiplo(false); setModalSub(true); }} disabled={emQuadra.length === 0 || foraDeQuadra.length === 0}><Repeat size={14} /> Substituição</Btn>

        <CourtLine label={isGoleiroAtivo ? "Modo rápido — Goleiro" : "Modo rápido"} />
        <div className="grid grid-cols-3 gap-2">
          {acoesDisponiveis.map((a) => (
            <button key={a.key} disabled={!atletaAtivo} onClick={() => onTapAcao(a)} className="rounded-xl py-3 flex flex-col items-center gap-1 disabled:opacity-30 active:scale-95 transition-transform" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              {a.emoji ? <span style={{ fontSize: 18, lineHeight: 1 }}>{a.emoji}</span> : <a.icon size={18} color={a.color} />}<span style={{ fontSize: 10, color: C.text, fontWeight: 600 }}>{a.label}</span>
            </button>
          ))}
        </div>

        <CourtLine label="Finalizações da Equipe" />
        <p style={{ color: C.textFaint, fontSize: 10 }} className="-mt-3 mb-2">Contagem do {periodoAtualObj.label.toLowerCase()}</p>
        <div className="flex gap-1 mb-2">
          <button onClick={() => setLadoFinalizacao("pro")} className="flex-1 py-1.5 rounded-md text-xs font-bold" style={{ background: ladoFinalizacao === "pro" ? C.lime : C.surface2, color: ladoFinalizacao === "pro" ? "#12150F" : C.textMuted }}>A FAVOR</button>
          <button onClick={() => setLadoFinalizacao("contra")} className="flex-1 py-1.5 rounded-md text-xs font-bold" style={{ background: ladoFinalizacao === "contra" ? C.orange : C.surface2, color: ladoFinalizacao === "contra" ? "#12150F" : C.textMuted }}>CONTRA</button>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {FINALIZACOES_TIME.map((f) => (
            <button key={f.key} onClick={() => {
              if (f.key === "Gol") {
                iniciarFluxoGol(ladoFinalizacao);
              } else if (ladoFinalizacao === "pro") {
                setFinalizacaoAtletaPendente(f.key);
              } else if (f.key === "Defesa do goleiro") {
                registrarDefesaContraGK();
              } else {
                registrar("finalizacao_time", f.key, { atletaId: null, lado: "contra" });
              }
            }} className="rounded-lg py-2.5 flex flex-col items-center gap-1 active:scale-95 transition-transform" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: f.color }}>{finalizacoesCount(f.key)}</span>
              <span style={{ fontSize: 8, color: C.textMuted, textAlign: "center", lineHeight: 1.1 }}>{f.key}</span>
            </button>
          ))}
        </div>
        <p style={{ color: C.textFaint, fontSize: 10 }} className="mt-1">A favor: sempre pede o autor. Contra "Defesa do goleiro": credita automaticamente ao seu goleiro em quadra.</p>

        <CourtLine label="Bolas Paradas" />
        <div className="flex flex-col gap-1.5">
          {BOLAS_PARADAS.map((cat) => (
            <div key={cat.key}>
              <button
                onClick={() => cat.jogadas ? setBolaParadaExpandida((k) => k === cat.key ? null : cat.key) : setBolaParadaPendente({ categoriaKey: cat.key, categoriaLabel: cat.label, jogada: cat.label, outcomes: cat.outcomes })}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg"
                style={{ background: C.surface, border: `1px solid ${C.line}` }}
              >
                <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{cat.label}</span>
                {cat.jogadas && <ChevronRight size={15} color={C.textMuted} style={{ transform: bolaParadaExpandida === cat.key ? "rotate(90deg)" : "none" }} />}
              </button>
              {cat.jogadas && bolaParadaExpandida === cat.key && (
                <div className="grid grid-cols-2 gap-1.5 mt-1.5 mb-1">
                  {cat.jogadas.map((j) => (
                    <button key={j} onClick={() => { setBolaParadaPendente({ categoriaKey: cat.key, categoriaLabel: cat.label, jogada: j, outcomes: cat.outcomes }); setBolaParadaExpandida(null); }} className="py-2 rounded-lg text-xs font-semibold" style={{ background: C.surface2, color: C.text }}>{j}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-3">
          <Btn className="flex-1" onClick={desfazer}><Undo2 size={15} /> Desfazer</Btn>
          {isUltimoPeriodo ? (
            <Btn variant="primary" className="flex-1" onClick={() => {
              const temItensPendentes = (scout.itensRevisaoPendentes || []).length > 0;
              const temSegmentoProcessando = Object.values(scout.videosPorPeriodo || {}).some((v) => (v.segmentos || []).some((s) => s.analiseStatus === "processando" || s.analiseStatus === "idle"));
              if (temItensPendentes || temSegmentoProcessando) nav("revisao-ia", { id: evento.id });
              else setEtapa("mvp");
            }}><Check size={15} /> Finalizar jogo</Btn>
          ) : (
            <Btn variant="primary" className="flex-1" onClick={() => setConfirmProximoTempo(true)}><ChevronRight size={15} /> Próximo tempo</Btn>
          )}
        </div>

        <CourtLine label="Últimos eventos" />
        <UltimosEventosCarousel
          C={C}
          periodosComEventos={periodosComEventos}
          ultimosPorPeriodo={ultimosPorPeriodo}
          pendentes={(scout.itensRevisaoPendentes || []).filter((it) => !it.excluido).slice(-4).reverse()}
          data={data}
          vazio={ultimos.length === 0 && (scout.itensRevisaoPendentes || []).length === 0}
          onEditar={(ev) => setEventoEditando(ev)}
        />
      </div>

      {eventoEditando && (
        <Modal title="Editar evento" onClose={() => setEventoEditando(null)}>
          <p style={{ color: C.textMuted, fontSize: 12 }} className="mb-3">{acaoLabel(data, eventoEditando)}</p>
          {"atletaId" in eventoEditando && (
            <>
              <p style={{ color: C.textFaint, fontSize: 11 }} className="mb-1.5">Trocar atleta:</p>
              <div className="flex flex-col gap-1.5 mb-3" style={{ maxHeight: 200, overflowY: "auto" }}>
                {participantes.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      update((d) => {
                        const s = d.scouts[evento.id];
                        const alvo = s.eventosScout.find((e) => e.id === eventoEditando.id);
                        if (alvo) alvo.atletaId = a.id;
                        return d;
                      });
                      setEventoEditando(null);
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                    style={{ background: a.id === eventoEditando.atletaId ? C.limeDim : C.surface, border: `1px solid ${a.id === eventoEditando.atletaId ? C.lime : C.line}`, color: C.text }}
                  >
                    {a.numero} · {a.nome}
                  </button>
                ))}
              </div>
            </>
          )}
          <Btn
            className="w-full"
            style={{ color: C.red, borderColor: C.red }}
            onClick={() => {
              update((d) => {
                const s = d.scouts[evento.id];
                s.eventosScout = s.eventosScout.filter((e) => e.id !== eventoEditando.id);
                return d;
              });
              setEventoEditando(null);
            }}
          >
            <Trash2 size={14} /> Excluir evento
          </Btn>
        </Modal>
      )}

      {variantePendente && (
        <Modal title={variantePendente.label} onClose={() => setVariantePendente(null)}>
          <div className="flex flex-col gap-2">{variantePendente.variants.map((v) => <Btn key={v} variant="primary" onClick={() => variantePendente.key === "positivo" ? escolherVariantePositivo(v) : registrar(variantePendente.key, v)}>{v}</Btn>)}</div>
        </Modal>
      )}
      {positivoPendente?.etapa === "golQuestion" && (
        <Modal title="Foi gol?" onClose={() => setPositivoPendente(null)}>
          <div className="flex gap-2">
            <Btn className="flex-1" onClick={() => { registrar("positivo", positivoPendente.variante); setPositivoPendente(null); }}>Não</Btn>
            <Btn variant="primary" className="flex-1" onClick={() => setPositivoPendente((p) => ({ ...p, etapa: "atleta" }))}>Sim</Btn>
          </div>
        </Modal>
      )}
      {positivoPendente?.etapa === "atleta" && (
        <Modal title="Quem fez o gol?" onClose={() => setPositivoPendente(null)}>
          <div className="flex flex-col gap-2">
            {emQuadra.map((a) => <Btn key={a.id} variant="primary" onClick={() => {
              registrar("positivo", positivoPendente.variante);
              registrar("gol", `Positivo — ${positivoPendente.variante}`, { atletaId: a.id });
              setPositivoPendente(null);
            }}>{a.numero} · {a.nome}</Btn>)}
            {emQuadra.length === 0 && <p style={{ color: C.textFaint, fontSize: 12 }}>Nenhum atleta em quadra.</p>}
          </div>
        </Modal>
      )}
      {fluxoGol?.etapa === "atleta" && (
        <Modal title="Quem fez o gol?" onClose={() => setFluxoGol(null)}>
          <div className="flex flex-col gap-2">
            {emQuadra.map((a) => <Btn key={a.id} variant="primary" onClick={() => escolherAtletaGol(a.id)}>{a.numero} · {a.nome}</Btn>)}
            {emQuadra.length === 0 && <p style={{ color: C.textFaint, fontSize: 12 }}>Nenhum atleta em quadra.</p>}
          </div>
        </Modal>
      )}
      {fluxoGol?.etapa === "assistencia" && (
        <Modal title="Quem deu assistência?" onClose={() => setFluxoGol(null)}>
          <div className="flex flex-col gap-2">
            <Btn variant="outline" onClick={() => escolherAssistenciaGol(null)}>Sem assistência</Btn>
            {emQuadra.filter((a) => a.id !== fluxoGol.atletaId).map((a) => <Btn key={a.id} variant="primary" onClick={() => escolherAssistenciaGol(a.id)}>{a.numero} · {a.nome}</Btn>)}
          </div>
        </Modal>
      )}
      {fluxoGol?.etapa === "tipo" && (
        <Modal title={fluxoGol.lado === "pro" ? "Tipo do gol a favor" : "Tipo do gol adversário"} onClose={() => setFluxoGol(null)}>
          <div className="flex flex-col gap-2">{GOL_TIPOS.map((t) => <Btn key={t} variant="primary" onClick={() => escolherTipoGol(t)}>{t}</Btn>)}</div>
        </Modal>
      )}
      {bolaParadaPendente && (
        <Modal title={`${bolaParadaPendente.categoriaLabel}${bolaParadaPendente.jogada !== bolaParadaPendente.categoriaLabel ? ` — ${bolaParadaPendente.jogada}` : ""}`} onClose={() => setBolaParadaPendente(null)}>
          <div className="flex flex-col gap-2">{bolaParadaPendente.outcomes.map((r) => <Btn key={r} variant="primary" onClick={() => onTapResultadoBolaParada(r)}>{r}</Btn>)}</div>
        </Modal>
      )}
      {finalizacaoAtletaPendente && (
        <Modal title={`Quem finalizou? (${finalizacaoAtletaPendente})`} onClose={() => setFinalizacaoAtletaPendente(null)}>
          <div className="flex flex-col gap-2">
            {emQuadra.map((a) => <Btn key={a.id} variant="primary" onClick={() => { registrar("finalizacao_time", finalizacaoAtletaPendente, { atletaId: a.id, lado: "pro" }); setFinalizacaoAtletaPendente(null); }}>{a.numero} · {a.nome}</Btn>)}
            {emQuadra.length === 0 && <p style={{ color: C.textFaint, fontSize: 12 }}>Nenhum atleta em quadra.</p>}
          </div>
        </Modal>
      )}
      {confirmProximoTempo && (
        <Modal title="Deseja substituir algum atleta?" onClose={() => setConfirmProximoTempo(false)}>
          <div className="flex gap-2">
            <Btn className="flex-1" onClick={() => { setConfirmProximoTempo(false); proximoTempo(); }}>Não</Btn>
            <Btn variant="primary" className="flex-1" onClick={() => { setConfirmProximoTempo(false); setSubAntesDeAvancar(true); setModalSubMultiplo(true); setModalSub(true); }} disabled={emQuadra.length === 0 || foraDeQuadra.length === 0}>Sim</Btn>
          </div>
        </Modal>
      )}
      {modalSub && <SubstituicaoModal emQuadra={emQuadra} foraDeQuadra={foraDeQuadra} jaJogouAntes={jaJogouAntes} mostrarAviso={modalSubMultiplo ? scout.periodoAtual === 1 : scout.periodoAtual === 2} multiplo={modalSubMultiplo} preSelecionado={atletaAtivo} onClose={() => { setModalSub(false); if (subAntesDeAvancar) { setSubAntesDeAvancar(false); proximoTempo(); } }} onSave={confirmarSub} />}
    </div>
  );
}

/* ============================================================
   SCOUT AO VIVO — TREINO  (inalterado)
   ============================================================ */
const ACOES_TREINO = [
  { key: "finalizacao", label: "FINALIZAÇÃO", icon: Target, color: C.blue, variants: ["Gol", "No alvo", "Fora"] },
  { key: "passe", label: "PASSE", icon: Footprints, color: C.text, variants: ["Certo", "Errado"] },
  { key: "erro", label: "ERRO", icon: XCircle, color: C.red },
  { key: "recuperacao", label: "RECUPERAÇÃO", icon: CheckCircle2, color: C.lime },
  { key: "desarme", label: "DESARME", icon: Shield, color: C.orange },
  { key: "transicao", label: "TRANSIÇÃO", icon: ArrowLeft, color: C.blue, variants: ["Ofensiva", "Defensiva"] },
];

function ScoutTreino({ data, update, params, nav }) {
  const evento = data.eventos.find((e) => e.id === params.id);
  const scout = data.scouts[params.id];
  const [atletaAtivo, setAtletaAtivo] = useState(null);
  const [variantePendente, setVariantePendente] = useState(null);
  const [etapa, setEtapa] = useState(scout && Object.keys(scout.presencas || {}).length > 0 ? "acoes" : "presenca");

  if (!evento || !scout) return <div className="px-5 pt-6"><Btn onClick={() => nav("calendario")}>Voltar</Btn></div>;
  const atletas = data.atletas.filter((a) => (a.categoriaIds || []).includes(evento.categoriaId));
  const equipe = data.equipes.find((e) => e.id === evento.equipeId);
  const presentes = atletas.filter((a) => ["presente", "atrasado"].includes(scout.presencas?.[a.id]));

  const marcarPresenca = (atletaId, status) => update((d) => { d.scouts[evento.id].presencas[atletaId] = status; return d; });
  const registrar = (acao, variante = null) => { if (!atletaAtivo) return; update((d) => { d.scouts[evento.id].eventosScout.push({ id: uid(), atletaId: atletaAtivo, acao: acao.key, variante, ts: Date.now() }); return d; }); setVariantePendente(null); };
  const onTapAcao = (acao) => acao.variants ? setVariantePendente(acao) : registrar(acao);
  const desfazer = () => update((d) => { d.scouts[evento.id].eventosScout.pop(); return d; });
  const salvarAvaliacao = (atletaId, nota, obs) => update((d) => { d.scouts[evento.id].avaliacoes[atletaId] = { nota, obs }; return d; });
  const finalizar = () => { update((d) => { d.eventos.find((e) => e.id === evento.id).status = "finalizado"; return d; }); nav("relatorio-treino", { id: evento.id }); };

  if (etapa === "presenca") {
    return (
      <div>
        <ScreenHeader title="Presença" onBack={() => nav("evento-detalhe", { id: evento.id })} subtitle={equipe?.nome} />
        <div className="px-5 flex flex-col gap-2">
          {atletas.length === 0 && <EmptyHint text="Nenhum atleta nessa categoria." />}
          {atletas.map((a) => {
            const status = scout.presencas?.[a.id];
            const opts = [["presente", "P", C.lime], ["atrasado", "A", C.yellow], ["ausente", "F", C.red], ["liberado", "L", C.textMuted]];
            return (
              <Card key={a.id} className="flex items-center justify-between">
                <span style={{ color: C.text, fontSize: 14 }}>{a.numero} · {a.nome}</span>
                <div className="flex gap-1">{opts.map(([key, letra, cor]) => <button key={key} onClick={() => marcarPresenca(a.id, key)} className="w-8 h-8 rounded-md text-xs font-bold" style={{ background: status === key ? cor : C.surface2, color: status === key ? "#12150F" : C.textMuted }}>{letra}</button>)}</div>
              </Card>
            );
          })}
          <Btn variant="primary" className="w-full mt-2" onClick={() => setEtapa("acoes")}>Iniciar treino <ChevronRight size={15} /></Btn>
        </div>
      </div>
    );
  }
  if (etapa === "avaliacao") {
    return (
      <div>
        <ScreenHeader title="Avaliação" onBack={() => setEtapa("acoes")} subtitle="Nota de 1 a 10 por atleta" />
        <div className="px-5 flex flex-col gap-3">
          {presentes.map((a) => {
            const av = scout.avaliacoes?.[a.id] || { nota: 7, obs: "" };
            return (
              <Card key={a.id}>
                <div className="flex items-center justify-between mb-2"><span style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{a.numero} · {a.nome}</span><span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: C.lime }}>{av.nota}</span></div>
                <input type="range" min={1} max={10} value={av.nota} onChange={(e) => salvarAvaliacao(a.id, Number(e.target.value), av.obs)} className="w-full mb-2" />
                <TextArea rows={2} placeholder="Observação..." value={av.obs} onChange={(e) => salvarAvaliacao(a.id, av.nota, e.target.value)} />
              </Card>
            );
          })}
          <Btn variant="primary" className="w-full mt-1" onClick={finalizar}><Check size={15} /> Finalizar treino</Btn>
        </div>
      </div>
    );
  }
  return (
    <div>
      <ScreenHeader title="Scout do treino" onBack={() => nav("evento-detalhe", { id: evento.id })} subtitle={`${equipe?.nome} · ${evento.tipoTreino}`} />
      <div className="px-5">
        <CourtLine label="Atleta em ação" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {presentes.map((a) => (
            <button key={a.id} onClick={() => setAtletaAtivo(a.id)} className="flex flex-col items-center gap-1 shrink-0 px-3 py-2 rounded-lg" style={{ background: atletaAtivo === a.id ? C.lime : C.surface, border: `1px solid ${atletaAtivo === a.id ? C.lime : C.line}` }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: atletaAtivo === a.id ? "#12150F" : C.text }}>{a.numero || "-"}</span>
              <span style={{ fontSize: 9, color: atletaAtivo === a.id ? "#12150F" : C.textMuted, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}</span>
            </button>
          ))}
        </div>
        {!atletaAtivo && <p style={{ color: C.textFaint, fontSize: 11 }} className="mt-1">Selecione um atleta antes de registrar uma ação.</p>}
        <CourtLine label="Modo rápido" />
        <div className="grid grid-cols-3 gap-2">
          {ACOES_TREINO.map((a) => (
            <button key={a.key} disabled={!atletaAtivo} onClick={() => onTapAcao(a)} className="rounded-xl py-3 flex flex-col items-center gap-1 disabled:opacity-30 active:scale-95 transition-transform" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <a.icon size={18} color={a.color} /><span style={{ fontSize: 10, color: C.text, fontWeight: 600 }}>{a.label}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Btn className="flex-1" onClick={desfazer}><Undo2 size={15} /> Desfazer</Btn>
          <Btn variant="primary" className="flex-1" onClick={() => setEtapa("avaliacao")}>Avaliar e finalizar</Btn>
        </div>
        <CourtLine label={`Eventos registrados (${scout.eventosScout.length})`} />
        <div className="flex flex-col gap-1.5">
          {[...scout.eventosScout].slice(-6).reverse().map((ev) => { const at = data.atletas.find((x) => x.id === ev.atletaId); return <div key={ev.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs" style={{ background: C.surface }}><span style={{ color: C.text }}>{at?.numero} · {at?.nome} — {ev.acao}{ev.variante ? ` (${ev.variante})` : ""}</span></div>; })}
        </div>
      </div>
      {variantePendente && <Modal title={variantePendente.label} onClose={() => setVariantePendente(null)}><div className="flex flex-col gap-2">{variantePendente.variants.map((v) => <Btn key={v} variant="primary" onClick={() => registrar(variantePendente, v)}>{v}</Btn>)}</div></Modal>}
    </div>
  );
}

/* ============================================================
   RELATÓRIOS
   ============================================================ */
/**
 * RevisaoIA — Etapa 8.
 *
 * Tela de revisão humana dos eventos gerados pela IA (item 12 do
 * briefing). Nada aqui entra em `eventosScout` até o treinador apertar
 * "Confirmar análise" — a lista é 100% editável antes disso: pode
 * confirmar, corrigir o jogador, mudar o resultado, ou excluir.
 */
function RevisaoIA({ data, update, params, nav }) {
  const evento = data.eventos.find((e) => e.id === params.id);
  const scout = data.scouts[params.id];
  const atletasSeguro = evento ? data.atletas.filter((a) => (a.categoriaIds || []).includes(evento.categoriaId)) : [];
  // Continua (ou retoma) a análise de qualquer segmento que ainda não
  // tenha terminado quando o treinador chegou nesta tela — mesmo hook
  // usado durante o jogo ao vivo, agora rodando aqui.
  useAnaliseAoVivo({ evento, scout, atletas: atletasSeguro, update, uid });

  if (!evento || !scout) return <div className="px-5 pt-6"><Btn onClick={() => nav("calendario")}>Voltar</Btn></div>;
  const atletas = atletasSeguro;
  const periodos = evento.periodos && evento.periodos.length ? evento.periodos : gerarPeriodos(2, 20);
  const videosPorPeriodo = scout.videosPorPeriodo || {};
  const cores = scout.coresUniforme;

  const [itens, setItens] = useState([]);
  const [confirmando, setConfirmando] = useState(false);
  const [apenasNaoIdentificados, setApenasNaoIdentificados] = useState(false);
  const [segmentoAtivo, setSegmentoAtivo] = useState(null); // { periodoNumero, indice }
  const [videoUrls, setVideoUrls] = useState({}); // "p{n}-s{i}" -> url
  const [erroVideoPorSegmento, setErroVideoPorSegmento] = useState({});
  const videoRefs = useRef({});
  const carregadosRef = useRef(new Set());

  // Reabre um segmento pra análise (usado pelo botão "Tentar analisar de
  // novo" quando dá erro ou termina sem nenhum evento). O hook
  // useAnaliseAoVivo detecta o status "idle" e dispara a análise de novo
  // sozinho, do mesmo jeito que faz quando um trecho novo é gravado.
  const atualizarSegmento = (periodoNumero, indice, patch) => {
    update((d) => {
      const s = d.scouts[evento.id];
      const seg = (s.videosPorPeriodo?.[periodoNumero]?.segmentos || []).find((x) => x.indice === indice);
      if (seg) Object.assign(seg, patch);
      return d;
    });
  };

  // Junta na lista local qualquer item novo que a análise em segundo
  // plano tenha jogado em scout.itensRevisaoPendentes — sem sobrescrever
  // o que o treinador já estiver editando.
  useEffect(() => {
    const pendentesAtuais = scout.itensRevisaoPendentes || [];
    const novos = pendentesAtuais.filter((it) => !carregadosRef.current.has(it.idTemp));
    if (novos.length > 0) {
      novos.forEach((it) => carregadosRef.current.add(it.idTemp));
      setItens((prev) => [...prev, ...novos].sort((a, b) => (a.periodoNumero - b.periodoNumero) || (a.segmentoIndice - b.segmentoIndice) || (a.timestampSeg - b.timestampSeg)));
    }
  }, [scout.itensRevisaoPendentes]);

  const segmentosComVideo = periodos.flatMap((p) => (videosPorPeriodo[p.numero]?.segmentos || []).map((s) => ({ ...s, periodoNumero: p.numero, periodoLabel: p.label })));

  useEffect(() => {
    if (!segmentoAtivo && segmentosComVideo.length > 0) setSegmentoAtivo({ periodoNumero: segmentosComVideo[0].periodoNumero, indice: segmentosComVideo[0].indice });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentosComVideo.length]);

  // Busca a URL de reprodução de cada segmento (uma vez).
  useEffect(() => {
    segmentosComVideo.forEach((seg) => {
      const chave = `p${seg.periodoNumero}-s${seg.indice}`;
      if (videoUrls[chave] || !seg.key) return;
      obterUrlReproducao({ partidaId: `${evento.id}_p${seg.periodoNumero}_s${seg.indice}`, videoKey: seg.key })
        .then(({ url }) => setVideoUrls((prev) => ({ ...prev, [chave]: url })))
        .catch((e) => setErroVideoPorSegmento((prev) => ({ ...prev, [chave]: e.message })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentosComVideo.length]);

  const verLance = (it) => {
    setSegmentoAtivo({ periodoNumero: it.periodoNumero, indice: it.segmentoIndice });
    setTimeout(() => {
      const el = videoRefs.current[`p${it.periodoNumero}-s${it.segmentoIndice}`];
      if (!el) return;
      el.currentTime = Math.max(0, it.timestampSeg - 2);
      el.play();
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const atualizarItem = (idTemp, patch) => setItens((prev) => prev.map((it) => (it.idTemp === idTemp ? { ...it, ...patch } : it)));

  const corConfianca = (nivel) => (nivel === "alta" ? C.lime : nivel === "media" ? C.orange : C.red);
  const labelTipo = (tipo) => ({ passe: "Passe", finalizacao: "Finalização", bola_parada: "Bola parada", drible: "Drible", falta: "Falta" }[tipo] || tipo);
  const mmss = (seg) => `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(Math.floor(seg % 60)).padStart(2, "0")}`;

  const aptos = itens.filter((it) => !it.excluido && it.confirmado);
  const foraIdentificado = (it) => (it.tipo !== "bola_parada" && it.lado === "pro" ? !it.atletaId : false);
  const semJogador = aptos.filter(foraIdentificado).length;
  const totalNaoIdentificados = itens.filter((it) => !it.excluido && foraIdentificado(it)).length;
  const itensExibidos = apenasNaoIdentificados ? itens.filter((it) => !it.excluido && foraIdentificado(it)) : itens;

  const segmentosProcessando = segmentosComVideo.filter((s) => s.analiseStatus === "processando" || s.analiseStatus === "idle");
  const jaAplicadosAutomaticamente = scout.eventosScout.filter((e) => e.fonte === "ia").length;

  const confirmarAnalise = () => {
    setConfirmando(true);
    update((d) => {
      const s = d.scouts[evento.id];
      aplicarEventosConfirmados(s, itens, uid, data.atletas);
      const idsProcessados = new Set(itens.map((it) => it.idTemp));
      s.itensRevisaoPendentes = (s.itensRevisaoPendentes || []).filter((it) => !idsProcessados.has(it.idTemp));
      return d;
    });
    nav("scout-jogo", { id: evento.id, forcarEtapa: "mvp" });
  };

  const continuarSemRevisar = () => nav("scout-jogo", { id: evento.id, forcarEtapa: "mvp" });

  return (
    <div>
      <ScreenHeader title="Revisar jogo" onBack={() => nav("scout-jogo", { id: evento.id })} subtitle={`${jaAplicadosAutomaticamente} evento(s) já aplicado(s) automaticamente`} />
      <div className="px-5 pb-24">
        {cores && (
          <div className="flex items-center gap-3 mb-3 text-xs" style={{ color: C.textMuted }}>
            <span className="flex items-center gap-1"><span style={{ width: 12, height: 12, borderRadius: 999, background: cores.favor.hex, border: `1px solid ${C.line}`, display: "inline-block" }} /> A favor</span>
            <span className="flex items-center gap-1"><span style={{ width: 12, height: 12, borderRadius: 999, background: cores.contra.hex, border: `1px solid ${C.line}`, display: "inline-block" }} /> Adversário</span>
          </div>
        )}

        <div className="rounded-xl p-3 mb-3" style={{ background: C.limeDim, border: `1px solid ${C.lime}` }}>
          <p style={{ color: C.lime, fontSize: 12 }}>
            A análise já rodou sozinha durante o jogo — {jaAplicadosAutomaticamente} lance(s) de alta confiança já entraram direto nas estatísticas. Abaixo está só o que ficou incerto (ou gol sem comemoração clara) pra você confirmar.
          </p>
        </div>

        {segmentosComVideo.length === 0 ? (
          <EmptyHint text="Nenhum vídeo foi gravado nesta partida." />
        ) : (
          <>
            {/* Fixo no topo da tela (sticky) — o vídeo desce junto com a
                rolagem, então dá pra ver o lance enquanto seleciona a
                estatística mais abaixo, sem perder o vídeo de vista. */}
            <div style={{ position: "sticky", top: 0, zIndex: 20, background: C.bg, paddingTop: 4, paddingBottom: 8, marginBottom: 8 }}>
              <div className="flex gap-1.5 mb-2 flex-wrap">
                {segmentosComVideo.map((seg) => {
                  const ativo = segmentoAtivo?.periodoNumero === seg.periodoNumero && segmentoAtivo?.indice === seg.indice;
                  const pendentesDoSegmento = itens.filter((it) => !it.excluido && !it.confirmado && it.periodoNumero === seg.periodoNumero && it.segmentoIndice === seg.indice).length;
                  const eventosDoSegmento = itens.filter((it) => it.periodoNumero === seg.periodoNumero && it.segmentoIndice === seg.indice).length;
                  return (
                    <button key={`p${seg.periodoNumero}-s${seg.indice}`} onClick={() => setSegmentoAtivo({ periodoNumero: seg.periodoNumero, indice: seg.indice })} className="py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5" style={{ background: ativo ? C.limeDim : C.surface, border: `1px solid ${ativo ? C.lime : C.line}`, color: ativo ? C.lime : C.textMuted }}>
                      {seg.analiseStatus === "processando" && <Loader2 size={12} className="animate-spin" />}
                      {seg.analiseStatus === "concluido" && <CheckCircle2 size={12} color={pendentesDoSegmento > 0 ? C.orange : (eventosDoSegmento === 0 ? C.textFaint : C.lime)} />}
                      {seg.analiseStatus === "erro" && <AlertTriangle size={12} color={C.red} />}
                      {seg.periodoLabel} · trecho {seg.indice + 1}
                      {seg.analiseStatus === "concluido" && pendentesDoSegmento > 0 && <span style={{ color: C.orange }}>⚠️ {pendentesDoSegmento}</span>}
                      {seg.analiseStatus === "concluido" && pendentesDoSegmento === 0 && eventosDoSegmento === 0 && <span style={{ color: C.textFaint }}>· vazio</span>}
                    </button>
                  );
                })}
              </div>

              {segmentosComVideo.map((seg) => {
                const chave = `p${seg.periodoNumero}-s${seg.indice}`;
                const ativo = segmentoAtivo?.periodoNumero === seg.periodoNumero && segmentoAtivo?.indice === seg.indice;
                const eventosDoSegmento = itens.filter((it) => it.periodoNumero === seg.periodoNumero && it.segmentoIndice === seg.indice).length;
                return (
                  <React.Fragment key={chave}>
                    {ativo && seg.analiseStatus === "erro" && (
                      <div className="rounded-lg px-3 py-2.5 mb-2 text-xs" style={{ background: "rgba(255,90,90,0.08)", border: `1px solid ${C.red}` }}>
                        <p style={{ color: C.red }} className="mb-1.5">⚠️ A análise desse trecho falhou: {seg.analiseErro || "erro desconhecido"}</p>
                        <button
                          onClick={() => atualizarSegmento(seg.periodoNumero, seg.indice, { analiseStatus: "idle", analiseErro: null })}
                          className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg font-semibold"
                          style={{ background: C.red, color: "#fff" }}
                        >
                          <RotateCcw size={12} /> Tentar analisar de novo
                        </button>
                      </div>
                    )}
                    {ativo && seg.analiseStatus === "concluido" && eventosDoSegmento === 0 && (
                      <div className="rounded-lg px-3 py-2.5 mb-2 text-xs" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                        <p style={{ color: C.textMuted }} className="mb-1.5">A análise desse trecho terminou sem identificar nenhum evento. Se você sabe que teve lance nesse trecho, tente analisar de novo — às vezes a IA não reconhece de primeira.</p>
                        <button
                          onClick={() => atualizarSegmento(seg.periodoNumero, seg.indice, { analiseStatus: "idle", analiseErro: null })}
                          className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg font-semibold"
                          style={{ background: C.limeDim, color: C.lime, border: `1px solid ${C.lime}` }}
                        >
                          <RotateCcw size={12} /> Tentar analisar de novo
                        </button>
                      </div>
                    )}
                    <div className="rounded-xl overflow-hidden" style={{ background: "#000", border: `1px solid ${C.line}`, display: ativo ? "block" : "none" }}>
                      {erroVideoPorSegmento[chave] && <p className="text-center py-6 text-xs" style={{ color: C.red }}>{erroVideoPorSegmento[chave]}</p>}
                      {!erroVideoPorSegmento[chave] && !videoUrls[chave] && <p className="text-center py-6 text-xs" style={{ color: C.textMuted }}>Carregando vídeo…</p>}
                      {videoUrls[chave] && (
                        <video ref={(el) => { videoRefs.current[chave] = el; }} src={videoUrls[chave]} controls playsInline preload="metadata" className="w-full" style={{ maxHeight: 220 }} />
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {segmentosProcessando.length > 0 ? (
              <div className="rounded-xl p-4 mb-3 flex flex-col items-center gap-1.5" style={{ background: C.surface2, border: `1px solid ${C.line}` }}>
                <div className="flex items-center gap-2" style={{ color: C.textMuted, fontSize: 12 }}>
                  <Loader2 size={14} className="animate-spin" /> Analisando {segmentosProcessando.length} trecho(s)…
                </div>
                <span style={{ color: C.textFaint, fontSize: 10, textAlign: "center" }}>Pode aguardar aqui — os resultados aparecem sozinhos assim que ficarem prontos.</span>
              </div>
            ) : segmentosComVideo.length > 0 && (
              <div className="rounded-xl p-3 mb-3 flex items-center gap-2" style={{ background: C.limeDim, border: `1px solid ${C.lime}` }}>
                <CheckCircle2 size={14} color={C.lime} />
                <span style={{ color: C.lime, fontSize: 12, fontWeight: 700 }}>
                  Análise concluída
                  {itens.filter((it) => !it.excluido && !it.confirmado).length > 0 && (
                    <span style={{ color: C.orange, fontWeight: 600 }}> (⚠️ {itens.filter((it) => !it.excluido && !it.confirmado).length} requer{itens.filter((it) => !it.excluido && !it.confirmado).length === 1 ? "" : "em"} revisão manual)</span>
                  )}
                </span>
              </div>
            )}

            {itens.length === 0 && segmentosProcessando.length === 0 ? (
              <EmptyHint text="Nada ficou pendente — tudo que a IA encontrou já foi aplicado automaticamente." />
            ) : itens.length > 0 && (
              <>
                {totalNaoIdentificados > 0 && (
                  <button
                    onClick={() => setApenasNaoIdentificados((v) => !v)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs mb-3"
                    style={{ background: apenasNaoIdentificados ? `${C.orange}22` : C.surface2, color: C.orange, border: `1px solid ${C.orange}` }}
                  >
                    <AlertTriangle size={13} /> {apenasNaoIdentificados ? "Mostrando só não identificados" : `Mostrar só não identificados (${totalNaoIdentificados})`}
                  </button>
                )}

                <div className="flex flex-col gap-2">
                  {itensExibidos.map((it) => (
                    <div key={it.idTemp} className="rounded-xl p-3" style={{ background: it.excluido ? "transparent" : C.surface2, border: `1px solid ${C.line}`, opacity: it.excluido ? 0.45 : 1 }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span style={{ color: C.textFaint, fontSize: 10 }}>{periodos.find((p) => p.numero === it.periodoNumero)?.label} · trecho {it.segmentoIndice + 1}</span>
                          <span style={{ color: C.textFaint, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{mmss(it.timestampSeg)}</span>
                          <span style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{labelTipo(it.tipo)}</span>
                          {videoUrls[`p${it.periodoNumero}-s${it.segmentoIndice}`] && !it.excluido && (
                            <button onClick={() => verLance(it)} className="flex items-center gap-1" style={{ color: C.lime, fontSize: 10 }}>
                              <Play size={11} fill={C.lime} /> Ver lance
                            </button>
                          )}
                        </div>
                        <span className="px-1.5 py-0.5 rounded-full" style={{ fontSize: 10, color: corConfianca(it.nivelConfianca), background: `${corConfianca(it.nivelConfianca)}22` }}>
                          {Math.round(it.confianca * 100)}%
                        </span>
                      </div>

                      {!it.excluido && (
                        <div className="flex flex-col gap-1.5">
                          {it.resultado === "gol" && it.tipo === "finalizacao" && (
                            <p style={{ color: C.orange, fontSize: 10 }}>⚠️ Marcado como gol, mas sem comemoração clara — confirme com atenção antes de aceitar.</p>
                          )}
                          {it.tipo === "falta" && !it.pistaSonora && (
                            <p style={{ color: C.orange, fontSize: 10 }}>⚠️ Sem apito/reclamação claros identificados no áudio — julgamento mais incerto, confirme com atenção.</p>
                          )}
                          {it.tipo === "falta" && it.pistaSonora && (
                            <p style={{ color: C.textFaint, fontSize: 10 }}>🔊 Apito ou reclamação identificados no áudio.</p>
                          )}

                          {(it.tipo === "passe" || it.tipo === "finalizacao") && (
                            <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
                              <button onClick={() => atualizarItem(it.idTemp, { lado: "pro" })} className="flex-1 py-1.5 text-xs font-semibold" style={{ background: it.lado === "pro" ? C.limeDim : "transparent", color: it.lado === "pro" ? C.lime : C.textMuted }}>A favor</button>
                              <button onClick={() => atualizarItem(it.idTemp, { lado: "contra", atletaId: null, destinoId: null })} className="flex-1 py-1.5 text-xs font-semibold" style={{ background: it.lado === "contra" ? `${C.orange}22` : "transparent", color: it.lado === "contra" ? C.orange : C.textMuted }}>Contra (adversário)</button>
                            </div>
                          )}
                          {it.tipo === "falta" && (
                            <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
                              <button onClick={() => atualizarItem(it.idTemp, { lado: "pro" })} className="flex-1 py-1.5 text-xs font-semibold" style={{ background: it.lado === "pro" ? C.limeDim : "transparent", color: it.lado === "pro" ? C.lime : C.textMuted }}>Nossa equipe cometeu</button>
                              <button onClick={() => atualizarItem(it.idTemp, { lado: "contra", atletaId: null })} className="flex-1 py-1.5 text-xs font-semibold" style={{ background: it.lado === "contra" ? `${C.orange}22` : "transparent", color: it.lado === "contra" ? C.orange : C.textMuted }}>Adversário cometeu</button>
                            </div>
                          )}

                          {it.tipo === "bola_parada" && (() => {
                            const chuteInicial = { penalti: "penalti", falta_cobrada: "falta", lateral: "escanteio", escanteio: "escanteio" }[it.categoriaBolaParada] || "escanteio";
                            const categoriaKey = it.categoriaKeyManual || chuteInicial;
                            const categoriaObj = BOLAS_PARADAS.find((c) => c.key === categoriaKey) || BOLAS_PARADAS[0];
                            return (
                              <div className="flex flex-col gap-1.5">
                                <p style={{ color: C.orange, fontSize: 10 }}>⚠️ A IA identificou uma bola parada, mas não sabe qual foi a jogada ensaiada — selecione abaixo.</p>
                                <select
                                  value={categoriaKey}
                                  onChange={(e) => {
                                    const novaCat = BOLAS_PARADAS.find((c) => c.key === e.target.value);
                                    atualizarItem(it.idTemp, { categoriaKeyManual: novaCat.key, categoriaLabelManual: novaCat.label, jogada: novaCat.jogadas ? "" : novaCat.label });
                                  }}
                                  className="rounded-lg px-2 py-1.5 text-xs"
                                  style={{ background: C.surface, color: C.text, border: `1px solid ${C.line}` }}
                                >
                                  {BOLAS_PARADAS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                                </select>
                                {categoriaObj.jogadas && (
                                  <select
                                    value={it.jogada || ""}
                                    onChange={(e) => atualizarItem(it.idTemp, { jogada: e.target.value })}
                                    className="rounded-lg px-2 py-1.5 text-xs"
                                    style={{ background: C.surface, color: it.jogada ? C.text : C.orange, border: `1px solid ${C.line}` }}
                                  >
                                    <option value="">Qual jogada foi usada?</option>
                                    {categoriaObj.jogadas.map((j) => <option key={j} value={j}>{j}</option>)}
                                  </select>
                                )}
                              </div>
                            );
                          })()}

                          {it.lado === "pro" && (it.tipo === "passe" || it.tipo === "finalizacao" || it.tipo === "drible" || it.tipo === "falta") && (
                            <div className="flex items-center gap-2">
                              <select value={it.atletaId || ""} onChange={(e) => { const a = atletas.find((x) => x.id === e.target.value); atualizarItem(it.idTemp, { atletaId: a?.id || null, atletaNumero: a?.numero ?? null, atletaNome: a?.nome || null }); }} className="flex-1 rounded-lg px-2 py-1.5 text-xs" style={{ background: C.surface, color: it.atletaId ? C.text : C.orange, border: `1px solid ${C.line}` }}>
                                <option value="">{it.atletaNumero != null ? `#${it.atletaNumero} não identificado` : "Não identificado"}</option>
                                {atletas.map((a) => <option key={a.id} value={a.id}>{a.numero} · {a.nome}</option>)}
                              </select>
                              {it.tipo === "passe" && (
                                <select value={it.destinoId || ""} onChange={(e) => { const a = atletas.find((x) => x.id === e.target.value); atualizarItem(it.idTemp, { destinoId: a?.id || null, destinoNumero: a?.numero ?? null }); }} className="flex-1 rounded-lg px-2 py-1.5 text-xs" style={{ background: C.surface, color: it.destinoId ? C.text : C.orange, border: `1px solid ${C.line}` }}>
                                  <option value="">destino não identificado</option>
                                  {atletas.map((a) => <option key={a.id} value={a.id}>{a.numero} · {a.nome}</option>)}
                                </select>
                              )}
                            </div>
                          )}

                          {it.tipo === "passe" && (
                            <select value={it.resultado || "certo"} onChange={(e) => atualizarItem(it.idTemp, { resultado: e.target.value })} className="rounded-lg px-2 py-1.5 text-xs" style={{ background: C.surface, color: C.text, border: `1px solid ${C.line}` }}>
                              <option value="certo">Certo</option>
                              <option value="errado">Errado</option>
                            </select>
                          )}
                          {it.tipo === "finalizacao" && (
                            <select value={it.resultado || "fora"} onChange={(e) => atualizarItem(it.idTemp, { resultado: e.target.value })} className="rounded-lg px-2 py-1.5 text-xs" style={{ background: C.surface, color: C.text, border: `1px solid ${C.line}` }}>
                              <option value="gol">Gol</option>
                              <option value="defendida">Defesa do goleiro</option>
                              <option value="trave">Trave</option>
                              <option value="nova_jogada">Nova jogada (rebote)</option>
                              <option value="fora">Pra fora</option>
                            </select>
                          )}
                          {it.tipo === "bola_parada" && (
                            <select value={it.resultado || "neutro"} onChange={(e) => atualizarItem(it.idTemp, { resultado: e.target.value })} className="rounded-lg px-2 py-1.5 text-xs" style={{ background: C.surface, color: C.text, border: `1px solid ${C.line}` }}>
                              <option value="gol">Gerou gol a favor</option>
                              <option value="chance_perigosa">Chance perigosa</option>
                              <option value="erro">Erro de jogada</option>
                              <option value="neutro">Sem consequência clara</option>
                            </select>
                          )}

                          <div className="flex items-center justify-between mt-1">
                            <button onClick={() => atualizarItem(it.idTemp, { confirmado: !it.confirmado })} className="flex items-center gap-1.5 text-xs" style={{ color: it.confirmado ? C.lime : C.textMuted }}>
                              {it.confirmado ? <CheckCircle2 size={14} /> : <Circle size={14} />} {it.confirmado ? "Confirmado" : "Confirmar"}
                            </button>
                            <button onClick={() => atualizarItem(it.idTemp, { excluido: true })} className="flex items-center gap-1 text-xs" style={{ color: C.textFaint }}>
                              <Trash2 size={13} /> Excluir
                            </button>
                          </div>
                        </div>
                      )}
                      {it.excluido && (
                        <button onClick={() => atualizarItem(it.idTemp, { excluido: false })} className="text-xs" style={{ color: C.textMuted }}>Restaurar</button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-5 py-3" style={{ background: C.bg, borderTop: `1px solid ${C.line}`, maxWidth: 480, margin: "0 auto" }}>
        {semJogador > 0 && <p style={{ color: C.orange, fontSize: 10 }} className="text-center mb-1.5">{semJogador} evento(s) confirmado(s) sem jogador identificado não entrarão nas estatísticas individuais.</p>}
        {itens.length > 0 ? (
          <Btn variant="primary" className="w-full" onClick={confirmarAnalise} disabled={confirmando}>
            <Check size={16} /> Confirmar revisão ({aptos.length} evento{aptos.length === 1 ? "" : "s"})
          </Btn>
        ) : (
          <Btn className="w-full" onClick={continuarSemRevisar} disabled={segmentosProcessando.length > 0}>
            {segmentosProcessando.length > 0 ? "Aguardando análise…" : <>Continuar <ChevronRight size={15} /></>}
          </Btn>
        )}
      </div>
    </div>
  );
}

// Melhores momentos — replay dos gols direto no relatório, pulando pro
// segundo exato do vídeo (quando o lance veio da análise por IA e temos
// o timestamp guardado). Some sozinho se a partida não teve vídeo.
function MelhoresMomentos({ C, evento, scout, periodos, atletas }) {
  const [urls, setUrls] = useState({});
  const [abertoId, setAbertoId] = useState(null);
  const [carregandoId, setCarregandoId] = useState(null);

  // Gols, finalizações, assistências, faltas, bolas paradas e dribles —
  // tudo que veio da análise de vídeo carrega o timestamp exato do lance.
  // Eventos lançados manualmente (sem vídeo) não entram aqui, porque não
  // têm um segundo exato pra pular no replay.
  const relevantes = { gol: 1, gol_adv: 1, finalizacao_time: 1, assistencia: 1, falta: 1, bola_parada: 1, positivo: 1 };
  const lances = scout.eventosScout
    .filter((e) => relevantes[e.acao] && e.timestampSeg != null && e.segmentoIndice != null && (e.acao !== "positivo" || e.variante === "Jogada individual"))
    .sort((a, b) => (a.periodoNumero - b.periodoNumero) || (a.timestampSeg - b.timestampSeg));

  if (lances.length === 0) return null;

  const labelPeriodo = (n) => periodos.find((p) => p.numero === n)?.label || `${n}º Tempo`;
  // Cada tipo de bola parada tem seu próprio ícone — antes todas usavam o
  // mesmo símbolo de "🔄" (troca), que parecia substituição até pra
  // pênalti. Agora cada categoria tem um ícone que combina com a jogada.
  const iconeBolaParada = (categoria = "") => {
    if (/goleiro/i.test(categoria)) return "🧤";
    if (/meio/i.test(categoria)) return "🔵";
    if (/escanteio|lateral/i.test(categoria)) return "🚩";
    if (/p[êe]nalti/i.test(categoria)) return "🔴";
    if (/falta/i.test(categoria)) return "📍";
    return "🔄";
  };
  const labelLance = (ev) => {
    const at = ev.atletaId ? atletas.find((a) => a.id === ev.atletaId) : null;
    const nomeAt = at ? `${at.numero} · ${at.nome} — ` : "";
    if (ev.acao === "gol") return `⚽ ${nomeAt}Gol a favor`;
    if (ev.acao === "gol_adv") return "🥅 Gol adversário";
    if (ev.acao === "assistencia") return `🎯 ${nomeAt}Assistência`;
    if (ev.acao === "finalizacao_time") return `${ev.lado === "contra" ? "🔻" : "🎯"} Finalização ${ev.lado === "contra" ? "contra" : "a favor"} — ${ev.variante}`;
    if (ev.acao === "falta") return `🟨 Falta ${ev.variante === "Cometida" ? "cometida" : "sofrida"}${nomeAt ? ` — ${nomeAt}` : ""}`;
    if (ev.acao === "bola_parada") return `${iconeBolaParada(ev.categoria)} ${ev.categoria} a favor`;
    if (ev.acao === "positivo") return `⚡ ${nomeAt}Drible`;
    return ev.acao;
  };

  const abrirLance = async (ev) => {
    const chave = `p${ev.periodoNumero}-s${ev.segmentoIndice}`;
    if (abertoId === ev.id) { setAbertoId(null); return; }
    if (!urls[chave]) {
      const seg = (scout.videosPorPeriodo?.[ev.periodoNumero]?.segmentos || []).find((s) => s.indice === ev.segmentoIndice);
      if (!seg?.key) return;
      setCarregandoId(ev.id);
      try {
        const { url } = await obterUrlReproducao({ partidaId: `${evento.id}_p${ev.periodoNumero}_s${ev.segmentoIndice}`, videoKey: seg.key });
        setUrls((prev) => ({ ...prev, [chave]: url }));
      } catch (e) { setCarregandoId(null); return; }
      setCarregandoId(null);
    }
    setAbertoId(ev.id);
  };

  return (
    <MelhoresMomentosBody C={C} lances={lances} labelPeriodo={labelPeriodo} labelLance={labelLance} abertoId={abertoId} urls={urls} carregandoId={carregandoId} abrirLance={abrirLance} />
  );
}

function MelhoresMomentosBody({ C, lances, labelPeriodo, labelLance, abertoId, urls, carregandoId, abrirLance }) {
  return (
    <>
      <CourtLine label="Melhores Momentos" />
      <div className="flex flex-col gap-2 mb-2">
        {lances.map((ev) => {
          const chave = `p${ev.periodoNumero}-s${ev.segmentoIndice}`;
          return (
            <div key={ev.id} className="rounded-xl p-3" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
              <div className="flex items-center justify-between">
                <span style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>
                  {labelLance(ev)} — {labelPeriodo(ev.periodoNumero)}
                </span>
                <button onClick={() => abrirLance(ev)} className="flex items-center gap-1" style={{ color: C.lime, fontSize: 11 }}>
                  {carregandoId === ev.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} fill={C.lime} />} {abertoId === ev.id ? "Fechar" : "Assistir"}
                </button>
              </div>
              {abertoId === ev.id && urls[chave] && (
                <video
                  src={`${urls[chave]}#t=${Math.max(0, ev.timestampSeg - 2)}`}
                  controls
                  playsInline
                  autoPlay
                  className="w-full rounded-lg mt-2"
                  style={{ maxHeight: 200 }}
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function VideosDaPartida({ C, evento, scout, periodos }) {
  const [urls, setUrls] = useState({});
  const [abertoChave, setAbertoChave] = useState(null);
  const [carregandoChave, setCarregandoChave] = useState(null);

  const porPeriodo = periodos
    .map((p) => ({ periodo: p, segmentos: (scout.videosPorPeriodo?.[p.numero]?.segmentos || []).filter((s) => s.key) }))
    .filter((g) => g.segmentos.length > 0);

  if (porPeriodo.length === 0) return null;

  const abrirFechar = async (periodoNumero, seg) => {
    const chave = `p${periodoNumero}-s${seg.indice}`;
    if (abertoChave === chave) { setAbertoChave(null); return; }
    if (!urls[chave]) {
      setCarregandoChave(chave);
      try {
        const { url } = await obterUrlReproducao({ partidaId: `${evento.id}_p${periodoNumero}_s${seg.indice}`, videoKey: seg.key });
        setUrls((prev) => ({ ...prev, [chave]: url }));
      } catch (e) { setCarregandoChave(null); return; }
      setCarregandoChave(null);
    }
    setAbertoChave(chave);
  };

  return (
    <>
      <CourtLine label="Vídeos da Partida" />
      <div className="flex flex-col gap-3 mb-2">
        {porPeriodo.map(({ periodo, segmentos }) => (
          <div key={periodo.numero}>
            <p style={{ color: C.textFaint, fontSize: 10, letterSpacing: 0.5 }} className="uppercase mb-1.5">{periodo.label}</p>
            <div className="flex flex-col gap-2">
              {segmentos.map((seg) => {
                const chave = `p${periodo.numero}-s${seg.indice}`;
                return (
                  <div key={chave} className="rounded-xl p-3" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                    <div className="flex items-center justify-between">
                      <span style={{ color: C.text, fontSize: 12 }}>Trecho {seg.indice + 1}</span>
                      <button onClick={() => abrirFechar(periodo.numero, seg)} className="flex items-center gap-1" style={{ color: C.lime, fontSize: 11 }}>
                        {carregandoChave === chave ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} fill={C.lime} />} {abertoChave === chave ? "Fechar" : "Assistir"}
                      </button>
                    </div>
                    {abertoChave === chave && urls[chave] && (
                      <video src={urls[chave]} controls playsInline autoPlay className="w-full rounded-lg mt-2" style={{ maxHeight: 220 }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function RelatorioJogo({ data, update, params, nav, readOnly }) {
  const evento = data.eventos.find((e) => e.id === params.id);
  const scout = data.scouts[params.id];
  const [editandoBolaParada, setEditandoBolaParada] = useState(null); // id do evento sendo editado
  if (!evento || !scout) return <div className="px-5 pt-6"><Btn onClick={() => nav("calendario")}>Voltar</Btn></div>;
  const equipe = data.equipes.find((e) => e.id === evento.equipeId);
  const atletas = data.atletas.filter((a) => (a.categoriaIds || []).includes(evento.categoriaId));
  const periodos = evento.periodos && evento.periodos.length ? evento.periodos : gerarPeriodos(2, 20);
  const goleiros = atletas.filter((a) => a.posicao === "Goleiro");
  const jogadores = atletas.filter((a) => a.posicao !== "Goleiro");

  const contarPeriodo = (n, filtro) => scout.eventosScout.filter((e) => e.periodoNumero === n && filtro(e)).length;

  const statsAtleta = (atletaId) => {
    const evs = scout.eventosScout.filter((e) => e.atletaId === atletaId);
    return {
      gols: evs.filter((e) => e.acao === "gol").length,
      assistencias: evs.filter((e) => e.acao === "assistencia").length,
      positivosPasse: evs.filter((e) => e.acao === "positivo" && e.variante === "Passe importante").length,
      positivosJogada: evs.filter((e) => e.acao === "positivo" && e.variante === "Jogada individual").length,
      erros: evs.filter((e) => e.acao === "erro").length,
      faltasCometidas: evs.filter((e) => e.acao === "falta" && e.variante === "Cometida").length,
      faltasSofridas: evs.filter((e) => e.acao === "falta" && e.variante === "Sofrida").length,
      defesas: evs.filter((e) => e.acao === "defesa").length,
      // Etapa 9 — aditivo: alimentado pelo scout manual (se o treinador
      // registrar "passe"/"finalizacao_jogador") e pelos eventos
      // confirmados na revisão da IA (fonte: "ia"), sem lógica separada.
      passesCertos: evs.filter((e) => e.acao === "passe" && e.variante === "Certo").length,
      passesErrados: evs.filter((e) => e.acao === "passe" && e.variante === "Errado").length,
      finalizacoesIndividuais: evs.filter((e) => e.acao === "finalizacao_jogador").length,
      finalizacoesIndividuaisGol: evs.filter((e) => e.acao === "finalizacao_jogador" && e.variante === "Gol").length,
    };
  };
  const jogadoresComDados = jogadores.map((a) => ({ a, s: statsAtleta(a.id) })).filter(({ s }) => Object.values(s).some((v) => v > 0));
  const golsSofridos = scout.placarVisitante;

  const substituicoes = scout.eventosScout.filter((e) => e.acao === "substituicao");
  const bolasParadas = scout.eventosScout.filter((e) => e.acao === "bola_parada");
  const participantesParaNota = atletas.filter((a) => (scout.minutagem?.[a.id]?.segundosTotais > 0) || scout.eventosScout.some((e) => e.atletaId === a.id));
  const destaquesOrdenados = participantesParaNota.map((atleta) => ({ atleta, nota: calcularNotaSugerida(scout, atleta.id) })).sort((a, b) => b.nota - a.nota);
  const mvp = scout.mvpId ? data.atletas.find((a) => a.id === scout.mvpId) : null;
  const participantes = atletas.filter((a) => scout.minutagem?.[a.id] || scout.eventosScout.some((e) => e.atletaId === a.id));

  return (
    <div>
      <ScreenHeader title="Relatório" onBack={() => nav("evento-detalhe", { id: evento.id })} subtitle={`${equipe?.nome} × ${evento.adversario}`} />
      <div className="px-5">
        <Card className="text-center">
          <p style={{ color: C.textMuted, fontSize: 12 }}>{formatData(evento.data)}{evento.local && ` · ${evento.local}`} · {periodos.length}× {periodos[0].duracaoMin} min</p>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 44, color: C.text }}>{scout.placarCasa} — {scout.placarVisitante}</p>
          {mvp && <p style={{ color: C.lime, fontSize: 12 }} className="mt-1">🏆 MVP: {mvp.numero} · {mvp.nome}</p>}
        </Card>

        {!readOnly && (
          <button
            onClick={() => {
              // Quando o jogo é finalizado, "concluir()" zera o entradaEmSeg
              // de todo mundo (pra fechar a minutagem certinho). Isso fazia
              // a tela de edição achar que "ninguém está em quadra". Aqui a
              // gente restaura entradaEmSeg pra quem já tinha minutagem
              // registrada, só pra poder editar de novo — não soma minutos
              // extras porque o cronômetro não volta a rodar sozinho.
              update((d) => {
                const s = d.scouts[evento.id];
                const totalAgora = tempoTotalAtual(s.cronometro);
                Object.keys(s.minutagem || {}).forEach((id) => {
                  if (s.minutagem[id].entradaEmSeg == null) {
                    s.minutagem[id].entradaEmSeg = totalAgora;
                  }
                });
                return d;
              });
              nav("scout-jogo", { id: evento.id, forcarEtapa: "ao_vivo" });
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm mb-2"
            style={{ background: C.limeDim, color: C.lime, border: `1px solid ${C.lime}` }}
          >
            <SquarePen size={16} /> Editar estatísticas
          </button>
        )}

        <MelhoresMomentos C={C} evento={evento} scout={scout} periodos={periodos} atletas={atletas} />
        <VideosDaPartida C={C} evento={evento} scout={scout} periodos={periodos} />

        <CourtLine label="Comparação por período" />
        <table className="w-full text-xs" style={{ color: C.text }}>
          <thead><tr style={{ color: C.textFaint }}><td>Estatística</td>{periodos.map((p) => <td key={p.numero} className="text-center">{p.label.replace(/º.*/, "º")}</td>)}</tr></thead>
          <tbody>
            {[["Gols marcados", (e) => e.acao === "gol"], ["Gols sofridos", (e) => e.acao === "gol_adv"], ["Positivos", (e) => e.acao === "positivo"], ["Erros", (e) => e.acao === "erro"], ["Faltas cometidas", (e) => e.acao === "falta" && e.variante === "Cometida"], ["Faltas sofridas", (e) => e.acao === "falta" && e.variante === "Sofrida"]].map(([label, filtro]) => (
              <tr key={label} style={{ borderTop: `1px solid ${C.line}` }}>
                <td className="py-1.5">{label}</td>
                {periodos.map((p) => <td key={p.numero} className="text-center">{contarPeriodo(p.numero, filtro)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>

        <CourtLine label="Finalizações por tempo (total)" />
        <table className="w-full text-xs" style={{ color: C.text }}>
          <thead><tr style={{ color: C.textFaint }}><td>Tempo</td><td className="text-center">A favor</td><td className="text-center">Contra</td></tr></thead>
          <tbody>
            {periodos.map((p) => (
              <tr key={p.numero} style={{ borderTop: `1px solid ${C.line}` }}>
                <td className="py-1.5">{p.label}</td>
                <td className="text-center">{contarPeriodo(p.numero, (e) => e.acao === "finalizacao_time" && (e.lado || "pro") === "pro")}</td>
                <td className="text-center">{contarPeriodo(p.numero, (e) => e.acao === "finalizacao_time" && e.lado === "contra")}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <CourtLine label="Finalizações da Equipe (total da partida)" />
        {["pro", "contra"].map((lado) => (
          <div key={lado} className="mb-2">
            <p style={{ color: lado === "pro" ? C.lime : C.orange, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }} className="mb-1 font-bold">{lado === "pro" ? "A favor" : "Contra"}</p>
            <div className="grid grid-cols-5 gap-1.5">
              {FINALIZACOES_TIME.map((f) => (
                <div key={f.key} className="rounded-lg py-2.5 flex flex-col items-center gap-1" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: f.color }}>{scout.eventosScout.filter((e) => e.acao === "finalizacao_time" && e.variante === f.key && (e.lado || "pro") === lado).length}</span>
                  <span style={{ fontSize: 8, color: C.textMuted, textAlign: "center", lineHeight: 1.1 }}>{f.key}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <CourtLine label="Passes da Equipe (total da partida)" />
        {["pro", "contra"].map((lado) => {
          const certos = lado === "pro"
            ? scout.eventosScout.filter((e) => e.acao === "passe" && e.variante === "Certo").length
            : scout.eventosScout.filter((e) => e.acao === "passe_time" && e.lado === "contra" && e.variante === "Certo").length;
          const errados = lado === "pro"
            ? scout.eventosScout.filter((e) => e.acao === "passe" && e.variante === "Errado").length
            : scout.eventosScout.filter((e) => e.acao === "passe_time" && e.lado === "contra" && e.variante === "Errado").length;
          const total = certos + errados;
          return (
            <div key={lado} className="mb-2">
              <p style={{ color: lado === "pro" ? C.lime : C.orange, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }} className="mb-1 font-bold">{lado === "pro" ? "A favor" : "Contra"}</p>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-lg py-2.5 flex flex-col items-center gap-1" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: C.lime }}>{certos}</span>
                  <span style={{ fontSize: 8, color: C.textMuted }}>Certos</span>
                </div>
                <div className="rounded-lg py-2.5 flex flex-col items-center gap-1" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: C.red }}>{errados}</span>
                  <span style={{ fontSize: 8, color: C.textMuted }}>Errados</span>
                </div>
                <div className="rounded-lg py-2.5 flex flex-col items-center gap-1" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: C.text }}>{total > 0 ? `${Math.round((certos / total) * 100)}%` : "—"}</span>
                  <span style={{ fontSize: 8, color: C.textMuted }}>Precisão</span>
                </div>
              </div>
            </div>
          );
        })}

        <CourtLine label="Minutagem em quadra" />
        <div className="flex flex-col gap-1.5">
          {participantes.length === 0 && <EmptyHint text="Nenhum atleta participou do jogo." />}
          {participantes.map((a) => {
            const seg = scout.minutagem?.[a.id]?.segundosTotais ?? 0;
            return (
              <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs" style={{ background: C.surface }}>
                <span style={{ color: C.text }}>{a.numero} · {a.nome}</span>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 15, color: C.lime }}>{formatMMSS(seg)}</span>
              </div>
            );
          })}
        </div>

        <CourtLine label="Individual — jogadores de linha" />
        {jogadoresComDados.length === 0 && <EmptyHint text="Nenhum evento individual registrado." />}
        <div className="flex flex-col gap-2">
          {jogadoresComDados.map(({ a, s }) => (
            <Card key={a.id}>
              <p style={{ color: C.text, fontWeight: 700, fontSize: 13 }} className="mb-2">{a.numero} · {a.nome}</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[["Gols", s.gols], ["Assist.", s.assistencias], ["Positivos", s.positivosPasse + s.positivosJogada], ["Erros", s.erros]].map(([l, v]) => (
                  <div key={l}><p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: C.lime }}>{v}</p><p style={{ fontSize: 9, color: C.textMuted }}>{l}</p></div>
                ))}
              </div>
              <p style={{ color: C.textFaint, fontSize: 10 }} className="mt-1">Faltas: {s.faltasCometidas} cometidas · {s.faltasSofridas} sofridas</p>
              {(s.positivosPasse > 0 || s.positivosJogada > 0) && <p style={{ color: C.textFaint, fontSize: 10 }}>Positivos: {s.positivosPasse} passe(s) importante(s) · {s.positivosJogada} jogada(s) individual(is)</p>}
              {(s.passesCertos + s.passesErrados > 0) && (
                <p style={{ color: C.textFaint, fontSize: 10 }}>
                  Passes: {s.passesCertos}/{s.passesCertos + s.passesErrados} certos ({Math.round((s.passesCertos / (s.passesCertos + s.passesErrados)) * 100)}%)
                </p>
              )}
              {s.finalizacoesIndividuais > 0 && (
                <p style={{ color: C.textFaint, fontSize: 10 }}>
                  Finalizações: {s.finalizacoesIndividuaisGol}/{s.finalizacoesIndividuais} viraram gol
                </p>
              )}
            </Card>
          ))}
        </div>

        {goleiros.length > 0 && (
          <>
            <CourtLine label="Goleiros" />
            <div className="flex flex-col gap-2">
              {goleiros.map((g) => {
                const s = statsAtleta(g.id);
                const pct = s.defesas + golsSofridos > 0 ? Math.round((s.defesas / (s.defesas + golsSofridos)) * 100) : 0;
                return (
                  <Card key={g.id}>
                    <p style={{ color: C.text, fontWeight: 700, fontSize: 13 }} className="mb-2">{g.numero} · {g.nome}</p>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[["Defesas", s.defesas], ["Gols sofr.", golsSofridos], ["% defesa", `${pct}%`], ["Erros", s.erros]].map(([l, v]) => (
                        <div key={l}><p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: C.blue }}>{v}</p><p style={{ fontSize: 9, color: C.textMuted }}>{l}</p></div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {(() => {
          const errosCriticos = scout.eventosScout.filter((e) => e.acao === "erro" && e.variante && e.variante !== "Simples");
          if (errosCriticos.length === 0) return null;
          return (
            <>
              <CourtLine label="Erros que geraram perigo/gol adversário" />
              <div className="flex flex-col gap-1.5">
                {errosCriticos.map((ev) => {
                  const at = data.atletas.find((x) => x.id === ev.atletaId);
                  return (
                    <div key={ev.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs" style={{ background: C.redDim }}>
                      <span style={{ color: C.text }}>{at?.numero} · {at?.nome} — {ev.variante}</span>
                      <span style={{ color: C.textFaint }}>{periodos.find((p) => p.numero === ev.periodoNumero)?.label}</span>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}

        {substituicoes.length > 0 && (
          <>
            <CourtLine label="Substituições" />
            <div className="flex flex-col gap-1.5">
              {substituicoes.map((ev) => <div key={ev.id} className="px-3 py-2 rounded-lg text-xs" style={{ background: C.surface, color: C.text }}>{acaoLabel(data, ev)} · P{ev.periodoNumero}</div>)}
            </div>
          </>
        )}

        {bolasParadas.length > 0 && (
          <>
            <CourtLine label="Bolas Paradas" />
            <div className="flex flex-col gap-1.5">
              {bolasParadas.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs" style={{ background: C.surface }}>
                  <span style={{ color: C.text }}>{ev.categoria} — {ev.jogada}: <span style={{ color: C.textMuted }}>{ev.resultado}</span></span>
                  <div className="flex items-center gap-2">
                    <span style={{ color: C.textFaint }}>P{ev.periodoNumero}</span>
                    {!readOnly && ev.fonte === "ia" && (
                      <button onClick={() => setEditandoBolaParada(ev.id)} style={{ color: C.lime }}><Pencil size={12} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {editandoBolaParada && (() => {
          const ev = bolasParadas.find((e) => e.id === editandoBolaParada);
          if (!ev) return null;
          const def = BOLAS_PARADAS.find((b) => b.label === ev.categoria);
          return (
            <Modal title="Qual foi a jogada?" onClose={() => setEditandoBolaParada(null)}>
              <div className="flex flex-col gap-3">
                <p style={{ color: C.textMuted, fontSize: 12 }}>{ev.categoria} — identificado pela análise de vídeo. Complete com a jogada ensaiada usada e o resultado real, se quiser deixar mais preciso.</p>
                {def?.jogadas && (
                  <div>
                    <p style={{ color: C.textFaint, fontSize: 10 }} className="uppercase mb-1.5">Jogada ensaiada</p>
                    <div className="flex flex-wrap gap-1.5">
                      {def.jogadas.map((j) => (
                        <button key={j} onClick={() => update((d) => { const alvo = d.scouts[evento.id].eventosScout.find((x) => x.id === ev.id); if (alvo) alvo.jogada = j; return d; })} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: ev.jogada === j ? C.limeDim : C.surface, border: `1px solid ${ev.jogada === j ? C.lime : C.line}`, color: ev.jogada === j ? C.lime : C.textMuted }}>{j}</button>
                      ))}
                    </div>
                  </div>
                )}
                {def?.outcomes && (
                  <div>
                    <p style={{ color: C.textFaint, fontSize: 10 }} className="uppercase mb-1.5">Resultado</p>
                    <div className="flex flex-wrap gap-1.5">
                      {def.outcomes.map((o) => (
                        <button key={o} onClick={() => update((d) => { const alvo = d.scouts[evento.id].eventosScout.find((x) => x.id === ev.id); if (alvo) alvo.resultado = o; return d; })} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: ev.resultado === o ? C.limeDim : C.surface, border: `1px solid ${ev.resultado === o ? C.lime : C.line}`, color: ev.resultado === o ? C.lime : C.textMuted }}>{o}</button>
                      ))}
                    </div>
                  </div>
                )}
                <Btn variant="primary" className="w-full" onClick={() => setEditandoBolaParada(null)}>Pronto</Btn>
              </div>
            </Modal>
          );
        })()}

        <CourtLine label="Destaques da partida" />
        {destaquesOrdenados.length === 0 && <EmptyHint text="Nenhuma nota registrada." />}
        <div className="flex flex-col gap-1.5">
          {destaquesOrdenados.map(({ atleta, nota }) => (
            <div key={atleta.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs" style={{ background: C.surface }}>
              <span style={{ color: C.text }}>{atleta.numero} · {atleta.nome}</span>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: C.lime }}>{nota.toFixed(1)}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg p-3 text-xs" style={{ background: C.surface2, color: C.textMuted }}>Exportação em PDF, Excel e HTML fica disponível na versão completa do sistema.</div>
      </div>
    </div>
  );
}

function RelatorioTreino({ data, params, nav }) {
  const evento = data.eventos.find((e) => e.id === params.id);
  const scout = data.scouts[params.id];
  if (!evento || !scout) return <div className="px-5 pt-6"><Btn onClick={() => nav("calendario")}>Voltar</Btn></div>;
  const equipe = data.equipes.find((e) => e.id === evento.equipeId);
  const atletas = data.atletas.filter((a) => (a.categoriaIds || []).includes(evento.categoriaId));
  const presencaLabel = { presente: "Presente", atrasado: "Atrasado", ausente: "Ausente", liberado: "Liberado" };
  return (
    <div>
      <ScreenHeader title="Relatório do treino" onBack={() => nav("evento-detalhe", { id: evento.id })} subtitle={equipe?.nome} />
      <div className="px-5">
        <Card>
          <p style={{ color: C.textMuted, fontSize: 12 }}>{formatData(evento.data)} · {evento.tipoTreino}</p>
          {evento.objetivo && <p style={{ color: C.text, fontSize: 14 }} className="mt-1">Objetivo: {evento.objetivo}</p>}
          <p style={{ color: C.textMuted, fontSize: 12 }} className="mt-1">{scout.eventosScout.length} ações registradas</p>
        </Card>
        <CourtLine label="Presença" />
        <div className="flex flex-col gap-1.5">{atletas.map((a) => <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs" style={{ background: C.surface }}><span style={{ color: C.text }}>{a.numero} · {a.nome}</span><span style={{ color: C.textMuted }}>{presencaLabel[scout.presencas?.[a.id]] || "—"}</span></div>)}</div>
        <CourtLine label="Avaliações" />
        <div className="flex flex-col gap-2">
          {Object.entries(scout.avaliacoes || {}).length === 0 && <EmptyHint text="Nenhuma avaliação registrada." />}
          {Object.entries(scout.avaliacoes || {}).map(([atletaId, av]) => {
            const a = data.atletas.find((x) => x.id === atletaId);
            if (!a) return null;
            return <Card key={atletaId}><div className="flex items-center justify-between"><span style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{a.numero} · {a.nome}</span><span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: C.lime }}>{av.nota}/10</span></div>{av.obs && <p style={{ color: C.textMuted, fontSize: 12 }} className="mt-1">{av.obs}</p>}</Card>;
          })}
        </div>
        <div className="mt-4 rounded-lg p-3 text-xs" style={{ background: C.surface2, color: C.textMuted }}>Exportação em PDF, Excel e HTML fica disponível na versão completa do sistema.</div>
      </div>
    </div>
  );
}

/* ============================================================
   RANKINGS
   ============================================================ */
function RankingsScreen({ data }) {
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const jogosFinalizados = data.eventos.filter((e) => e.tipo === "jogo" && e.status === "finalizado" && (!filtroCategoria || e.categoriaId === filtroCategoria));

  const porAtleta = {};
  jogosFinalizados.forEach((ev) => {
    const scout = data.scouts[ev.id];
    if (!scout) return;
    (scout.eventosScout || []).forEach((e) => {
      if (!e.atletaId) return;
      porAtleta[e.atletaId] = porAtleta[e.atletaId] || { gols: 0, assistencias: 0, notas: [] };
      if (e.acao === "gol") porAtleta[e.atletaId].gols++;
      if (e.acao === "assistencia") porAtleta[e.atletaId].assistencias++;
    });
    const idsComParticipacaoNoJogo = new Set([...Object.keys(scout.minutagem || {}), ...(scout.eventosScout || []).filter((e) => e.atletaId).map((e) => e.atletaId)]);
    idsComParticipacaoNoJogo.forEach((atletaId) => {
      porAtleta[atletaId] = porAtleta[atletaId] || { gols: 0, assistencias: 0, notas: [] };
      porAtleta[atletaId].notas.push(calcularNotaSugerida(scout, atletaId));
    });
  });

  const nomeDe = (id) => { const a = data.atletas.find((x) => x.id === id); return a ? `${a.numero} · ${a.nome}` : "?"; };
  const artilheiros = Object.entries(porAtleta).map(([id, s]) => ({ id, v: s.gols })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 10);
  const assistentes = Object.entries(porAtleta).map(([id, s]) => ({ id, v: s.assistencias })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 10);
  const notas = Object.entries(porAtleta).filter(([, s]) => s.notas.length).map(([id, s]) => ({ id, media: s.notas.reduce((a, b) => a + b, 0) / s.notas.length, n: s.notas.length })).sort((a, b) => b.media - a.media).slice(0, 10);

  const Ranking = ({ title, items, render }) => (
    <>
      <CourtLine label={title} />
      {items.length === 0 && <EmptyHint text="Sem dados suficientes ainda." />}
      <div className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <div key={it.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: C.surface }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: i === 0 ? C.lime : C.textFaint, width: 18 }}>{i + 1}</span>
            <span style={{ color: C.text, fontSize: 13, flex: 1 }}>{nomeDe(it.id)}</span>
            {render(it)}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div>
      <ScreenHeader title="Rankings" subtitle="Artilheiros, assistências e notas" />
      <div className="px-5">
        <Select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="mb-1">
          <option value="">Todas as categorias</option>
          {data.categorias.map((c) => <option key={c.id} value={c.id}>{categoriaLabel(data, c.id)}</option>)}
        </Select>

        <Ranking title="Artilheiros" items={artilheiros} render={(it) => <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: C.lime }}>{it.v}</span>} />
        <Ranking title="Líderes de assistências" items={assistentes} render={(it) => <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: C.blue }}>{it.v}</span>} />
        <Ranking title="Ranking de notas" items={notas} render={(it) => (
          <div className="text-right">
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: C.text }}>{it.media.toFixed(1)}</span>
            <p style={{ fontSize: 9, color: C.textFaint }}>{it.n} jogo{it.n > 1 ? "s" : ""}</p>
          </div>
        )} />
      </div>
    </div>
  );
}

/* ============================================================
   ESTATÍSTICAS
   ============================================================ */
function EstatisticasScreen({ data, update, nav, readOnly }) {
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [modalPremiacao, setModalPremiacao] = useState(false);
  const [formPremiacao, setFormPremiacao] = useState({ titulo: "", categoriaId: "", data: "" });
  const jogosFinalizados = data.eventos.filter((e) => e.tipo === "jogo" && e.status === "finalizado" && (!filtroCategoria || e.categoriaId === filtroCategoria));

  const porCategoria = {};
  jogosFinalizados.forEach((ev) => {
    const s = data.scouts[ev.id];
    if (!s) return;
    porCategoria[ev.categoriaId] = porCategoria[ev.categoriaId] || { gp: 0, gc: 0, jogos: 0, v: 0, e: 0, d: 0 };
    const pc = porCategoria[ev.categoriaId];
    pc.gp += s.placarCasa || 0;
    pc.gc += s.placarVisitante || 0;
    pc.jogos++;
    if (s.placarCasa > s.placarVisitante) pc.v++;
    else if (s.placarCasa === s.placarVisitante) pc.e++;
    else pc.d++;
  });

  const premiacoes = [...(data.premiacoes || [])]
    .filter((p) => !filtroCategoria || !p.categoriaId || p.categoriaId === filtroCategoria)
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  const salvarPremiacao = () => {
    if (!formPremiacao.titulo.trim()) return;
    update((d) => { d.premiacoes = d.premiacoes || []; d.premiacoes.push({ id: uid(), ...formPremiacao, titulo: formPremiacao.titulo.trim() }); return d; });
    setFormPremiacao({ titulo: "", categoriaId: "", data: "" });
    setModalPremiacao(false);
  };
  const removerPremiacao = (id) => update((d) => { d.premiacoes = (d.premiacoes || []).filter((p) => p.id !== id); return d; });

  return (
    <div>
      <ScreenHeader title="Estatísticas" subtitle="Desempenho por categoria" />
      <div className="px-5">
        <Select value={filtroCategoria} onChange={(e2) => setFiltroCategoria(e2.target.value)} className="mb-1">
          <option value="">Todas as categorias</option>
          {data.categorias.map((c) => <option key={c.id} value={c.id}>{categoriaLabel(data, c.id)}</option>)}
        </Select>

        <CourtLine label="Desempenho por categoria" />
        {Object.keys(porCategoria).length === 0 && <EmptyHint text="Nenhum jogo finalizado ainda." />}
        <div className="flex flex-col gap-2">
          {Object.entries(porCategoria).map(([catId, pc]) => <CategoriaStatsCard key={catId} nome={categoriaLabel(data, catId)} pc={pc} />)}
        </div>

        <div className="flex items-center justify-between mt-5 mb-2">
          <span className="text-xs tracking-widest uppercase" style={{ color: C.textFaint, fontFamily: FONT_BODY }}>Premiações</span>
          {!readOnly && <button onClick={() => { setFormPremiacao((f) => ({ ...f, categoriaId: filtroCategoria || f.categoriaId })); setModalPremiacao(true); }} className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.lime }}><Plus size={13} /> Adicionar</button>}
        </div>
        {premiacoes.length === 0 && <EmptyHint text="Nenhuma premiação registrada ainda." />}
        <div className="flex flex-col gap-2">
          {premiacoes.map((p) => (
            <Card key={p.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award size={16} color={C.yellow} />
                  <div>
                    <p style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{p.titulo}</p>
                    <p style={{ color: C.textMuted, fontSize: 11 }}>{p.categoriaId ? categoriaLabel(data, p.categoriaId) : "Geral"}{p.data && ` · ${formatData(p.data)}`}</p>
                  </div>
                </div>
                {!readOnly && <Trash2 size={14} color={C.red} onClick={() => removerPremiacao(p.id)} />}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {modalPremiacao && (
        <Modal title="Nova premiação" onClose={() => setModalPremiacao(false)}>
          <Field label="Título"><Input autoFocus value={formPremiacao.titulo} onChange={(e) => setFormPremiacao({ ...formPremiacao, titulo: e.target.value })} placeholder="Ex: Campeão Liga Municipal 2026" /></Field>
          <Field label="Categoria (opcional)">
            <Select value={formPremiacao.categoriaId} onChange={(e) => setFormPremiacao({ ...formPremiacao, categoriaId: e.target.value })}>
              <option value="">Geral</option>
              {data.categorias.map((c) => <option key={c.id} value={c.id}>{categoriaLabel(data, c.id)}</option>)}
            </Select>
          </Field>
          <Field label="Data (opcional)"><Input type="date" value={formPremiacao.data} onChange={(e) => setFormPremiacao({ ...formPremiacao, data: e.target.value })} /></Field>
          <Btn variant="primary" className="w-full mt-2" onClick={salvarPremiacao}>Salvar</Btn>
        </Modal>
      )}
    </div>
  );
        }
