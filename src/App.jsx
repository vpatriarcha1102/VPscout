import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Home, Building2, Users, Calendar as CalendarIcon, Plus, X, ChevronRight,
  Play, Check, Undo2, Trash2, Pencil, SquarePen, Clock, MapPin,
  Shield, Trophy, Dumbbell, ArrowLeft, Circle, CheckCircle2, XCircle,
  AlertCircle, FileText, Target, Footprints, Star, Repeat, Award, SlidersHorizontal, BarChart3,
  CircleDot, Zap, Hand, CreditCard, AlertTriangle, ThumbsUp, User, ChevronLeft, LogOut, Lock, GraduationCap,
  Sparkles, Loader2, RotateCcw, HardDriveDownload, FolderOpen, CloudUpload,
  Pause, Volume2, VolumeX, RotateCw, Maximize2, Minimize2
} from "lucide-react";
import { installStorageShim } from "./lib/storage";
import { VideoRecordingPanel } from "./components/VideoRecordingPanel";
import { getAIAnalysisService } from "./services/aiAnalysisService";
import { useAnaliseAoVivo } from "./hooks/useAnaliseAoVivo";
import { obterUrlReproducao } from "./services/videoPlaybackService";
import { gerarEventosRevisaveis, aplicarEventosConfirmados } from "./lib/iaEventConverter";
import * as videoStore from "./lib/videoStore";
import * as uploadService from "./services/videoUploadService";
import { firebaseConfigurado } from "./lib/firebase";
import { headersComToken } from "./lib/apiToken";

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
  { key: "passe", label: "PASSE", icon: Footprints, color: C.text, variants: ["Certo", "Errado"] },
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

// "Está escuro lá fora" — janela horária usada só pra escolher QUAL EMOJI
// mostrar (🌙 ☁️ ⛈️), independente do texto da saudação. Vai das 18h até
// as 04h59 (a partir das 05h já considera "dia" pra fins de emoji, mesmo
// que o texto da saudação nessa hora ainda seja "Bom dia").
function ehNoiteParaEmoji(h) {
  return h >= 18 || h < 5;
}

function getSaudacao(nome, emojiClima) {
  const h = new Date().getHours();
  // Sem "chute" por horário enquanto o clima real não carrega: mostrar um
  // emoji e trocar por outro alguns milissegundos depois (ex: ☀️ virando
  // ❄️) dava a impressão de bug. Agora só aparece emoji quando já é o
  // clima de verdade — antes disso, a saudação fica sem emoji mesmo.
  const emoji = emojiClima || "";
  const espaco = emoji ? ` ${emoji}` : "";
  if (h < 12) return `Bom dia, ${nome}${espaco}`;
  if (h < 18) return `Boa tarde, ${nome}${espaco}`;
  return `Boa noite, ${nome}${espaco}`;
}

// Traduz o código de clima da Open-Meteo (padrão internacional WMO) num
// emoji. Retorna null pra qualquer situação que a gente não soube
// traduzir — nesse caso getSaudacao() cai no emoji padrão por horário.
//
// Conjunto FECHADO de emojis, sempre a partir do clima real — só estes 5:
// ☀️ céu limpo de dia, 🌙 céu limpo de noite, ⛅️ qualquer nublado/chuva
// fraca (de dia ou de noite, não tem versão separada pra noite), ⛈️
// tempestade, ❄️ frio (temperatura abaixo de 18°, tem prioridade sobre
// ☀️/⛅️/🌙, mas não sobre ⛈️).
function emojiPorCodigoClima(codigo, tempC, ehNoite) {
  if (codigo == null) return null;

  if (codigo >= 95) return "⛈️"; // tempestade — sempre, de dia ou de noite
  if (tempC != null && tempC < 18) return "❄️"; // frio — sempre que a temperatura estiver abaixo de 18°
  if (ehNoite) return codigo === 0 || codigo === 1 ? "🌙" : "⛅️"; // céu limpo à noite vs qualquer outra coisa
  return codigo === 0 || codigo === 1 ? "☀️" : "⛅️"; // céu limpo de dia vs qualquer outra coisa
}

// Pede a localização (se a pessoa liberar) e busca o clima atual na
// Open-Meteo (gratuita, sem precisar de chave/cadastro) pra decidir qual
// emoji mostrar na saudação. Se a localização não estiver disponível, a
// pessoa negar, ou a busca falhar por qualquer motivo, simplesmente não
// atualiza nada — a saudação fica sem emoji (getSaudacao trata isso).
function useEmojiClima() {
  const [emoji, setEmoji] = useState(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    // Evita pedir localização/buscar de novo toda vez que a pessoa abre
    // o app — reaproveita por 30 minutos dentro da mesma sessão.
    // Importante: o cache guarda também se foi calculado de dia ou de
    // noite, pra não ficar com um emoji de noite "preso" na tela depois
    // que já amanheceu (e vice-versa) só porque ainda está dentro da
    // janela de 30 minutos.
    try {
      const emCache = JSON.parse(window.localStorage.getItem("vps_clima_cache") || "null");
      if (emCache && Date.now() - emCache.ts < 30 * 60 * 1000 && emCache.noite === ehNoiteParaEmoji(new Date().getHours())) {
        setEmoji(emCache.emoji);
        return;
      }
    } catch { /* ignora cache corrompido */ }

    let cancelado = false;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,is_day`);
          if (!resp.ok) return;
          const j = await resp.json();
          const cur = j.current || {};
          // is_day vem calculado pela própria Open-Meteo com o nascer/pôr
          // do sol REAL de onde a pessoa está (varia com estação e
          // latitude) — mais preciso que um horário fixo de relógio tipo
          // "depois das 18h é noite", que erra bastante dependendo da
          // época do ano.
          const noiteAgora = cur.is_day != null ? cur.is_day === 0 : ehNoiteParaEmoji(new Date().getHours());
          const calculado = emojiPorCodigoClima(cur.weather_code, cur.temperature_2m, noiteAgora);
          if (!cancelado && calculado) {
            setEmoji(calculado);
            try { window.localStorage.setItem("vps_clima_cache", JSON.stringify({ emoji: calculado, noite: noiteAgora, ts: Date.now() })); } catch { /* ignora */ }
          }
        } catch { /* sem internet, API fora do ar etc. — fica no emoji padrão */ }
      },
      () => { /* localização negada/indisponível — fica no emoji padrão */ },
      { timeout: 5000, maximumAge: 30 * 60 * 1000 }
    );
    return () => { cancelado = true; };
  }, []);

  return emoji;
}

// Mapa com a rota embutido direto na tela do jogo — 100% gratuito, sem
// chave de API e sem precisar de cartão de crédito cadastrado em lugar
// nenhum (o Google exige cartão até pra APIs "grátis"). Usa:
//   • OpenStreetMap — os "quadradinhos" visuais do mapa
//   • Nominatim — transforma o endereço do jogo em latitude/longitude
//   • OSRM (demo pública) — calcula a rota entre dois pontos
//   • Leaflet — biblioteca que desenha tudo isso na tela (carregada via
//     CDN, sem precisar instalar nada no projeto)
let leafletCarregando = null;
function carregarLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletCarregando) return leafletCarregando;
  leafletCarregando = new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.body.appendChild(script);
  });
  return leafletCarregando;
}

function distanciaKmEntre(a, b) {
  const R = 6371;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function RotaJogoScreen({ data, params, nav }) {
  const evento = data.eventos.find((e) => e.id === params.id);
  const divRef = useRef(null);
  const mapaRef = useRef(null);
  const origemMarkerRef = useRef(null);
  const polyRef = useRef(null);
  const destRef = useRef(null);
  const watchIdRef = useRef(null);
  const ultimaRotaRef = useRef(0);
  const [status, setStatus] = useState("carregando"); // carregando | pronto | sem-local | erro
  const [info, setInfo] = useState(null); // { distanciaKm, duracaoMin }

  const [longe, setLonge] = useState(false);

  useEffect(() => {
    if (!evento?.local) { setStatus("sem-local"); return; }
    let cancelado = false;

    async function calcularRota(origem, L, mapa) {
      const dest = destRef.current;
      if (!dest) return;
      try {
        const rota = await fetch(`https://router.project-osrm.org/route/v1/driving/${origem.lon},${origem.lat};${dest.lon},${dest.lat}?overview=full&geometries=geojson`).then((r) => r.json());
        const rInfo = rota?.routes?.[0];
        if (!rInfo || cancelado) return;
        const linha = rInfo.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
        if (polyRef.current) polyRef.current.remove();
        polyRef.current = L.polyline(linha, { color: "#2DE0F0", weight: 4 }).addTo(mapa);
        mapa.fitBounds(polyRef.current.getBounds(), { padding: [28, 28] });
        setInfo({ distanciaKm: (rInfo.distance / 1000).toFixed(1), duracaoMin: Math.round(rInfo.duration / 60) });
      } catch { /* mantém a última rota conhecida na tela, tenta de novo no próximo ciclo */ }
    }

    (async () => {
      try {
        const L = await carregarLeaflet();
        if (cancelado || !divRef.current) return;

        // Pega a localização ANTES de buscar o endereço — é isso que
        // resolve o problema de endereços vagos (só o nome da escola,
        // sem cidade) caírem num lugar de nome parecido em outro estado:
        // em vez de confiar cegamente no 1º resultado do buscador de
        // endereços, a gente pede vários candidatos e escolhe o que
        // estiver geograficamente mais perto de onde a pessoa está.
        const posicaoInicial = await new Promise((resolve) => {
          if (!("geolocation" in navigator)) return resolve(null);
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            () => resolve(null),
            { timeout: 6000, maximumAge: 5 * 60 * 1000 }
          );
        });
        if (cancelado) return;

        const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=br&q=${encodeURIComponent(evento.local)}`).then((r) => r.json());
        if (cancelado) return;
        if (!geo?.length) { setStatus("erro"); return; }

        let escolhido = geo[0];
        if (posicaoInicial) {
          escolhido = geo
            .map((g) => ({ g, dist: distanciaKmEntre(posicaoInicial, { lat: parseFloat(g.lat), lon: parseFloat(g.lon) }) }))
            .sort((a, b) => a.dist - b.dist)[0].g;
        }
        const destLat = parseFloat(escolhido.lat), destLon = parseFloat(escolhido.lon);
        destRef.current = { lat: destLat, lon: destLon };

        // Mesmo escolhendo o mais próximo, se ainda ficou muito longe da
        // pessoa, avisa — pode ser um jogo fora mesmo, mas também pode
        // ser que o endereço cadastrado precise ficar mais completo
        // (com cidade), então mostra o aviso sem esconder o mapa.
        if (posicaoInicial && distanciaKmEntre(posicaoInicial, { lat: destLat, lon: destLon }) > 150) setLonge(true);

        const mapa = L.map(divRef.current);
        mapaRef.current = mapa;
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(mapa);
        L.marker([destLat, destLon]).addTo(mapa).bindPopup("Local do jogo");
        mapa.setView([destLat, destLon], 14);
        setStatus("pronto");

        if (!("geolocation" in navigator)) return;

        // Já usa a posição que pegamos há pouco como primeiro ponto (sem
        // pedir permissão de novo), e a partir daqui liga o watchPosition
        // pra manter atualizando sozinho.
        if (posicaoInicial) {
          origemMarkerRef.current = L.marker([posicaoInicial.lat, posicaoInicial.lon]).addTo(mapa).bindPopup("Você está aqui");
          ultimaRotaRef.current = Date.now();
          calcularRota(posicaoInicial, L, mapa);
        }

        // watchPosition (em vez de getCurrentPosition uma vez só) — o
        // pontinho "você está aqui" se move sozinho conforme a pessoa se
        // desloca de verdade, sem precisar sair e voltar na tela.
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            if (cancelado) return;
            const origem = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            if (!origemMarkerRef.current) {
              origemMarkerRef.current = L.marker([origem.lat, origem.lon]).addTo(mapa).bindPopup("Você está aqui");
            } else {
              origemMarkerRef.current.setLatLng([origem.lat, origem.lon]);
            }
            // A rota em si (a linha e o tempo estimado) recalcula a cada
            // 15s — o pontinho "você está aqui" já se move a cada
            // atualização do GPS (instantâneo); só o traçado da rota e o
            // tempo estimado ficam com esse intervalo curto pra não
            // sobrecarregar o servidor gratuito de rotas.
            const agora = Date.now();
            if (agora - ultimaRotaRef.current > 15000) {
              ultimaRotaRef.current = agora;
              calcularRota(origem, L, mapa);
            }
          },
          () => { /* localização negada — mapa fica só com o destino marcado */ },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
      } catch {
        if (!cancelado) setStatus("erro");
      }
    })();

    return () => {
      cancelado = true;
      if (watchIdRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchIdRef.current);
      if (mapaRef.current) { mapaRef.current.remove(); mapaRef.current = null; }
      origemMarkerRef.current = null;
      polyRef.current = null;
    };
  }, [evento?.local]);

  if (!evento) return <div className="px-5 pt-6"><Btn onClick={() => nav("calendario")}>Voltar</Btn></div>;

  return (
    <div>
      <ScreenHeader title="Rota até o jogo" subtitle={evento.local} onBack={() => nav("evento-detalhe", { id: evento.id })} />
      <div className="px-5 pb-8">
        {status === "sem-local" && <EmptyHint text="Esse evento não tem local cadastrado." />}
        {status === "erro" && <EmptyHint text="Não conseguimos localizar esse endereço no mapa." />}
        {status !== "sem-local" && status !== "erro" && (
          <>
            {longe && (
              <div className="rounded-lg px-3 py-2 mb-3 flex items-start gap-2" style={{ background: "#3A2A0F", border: `1px solid ${C.orange}` }}>
                <AlertTriangle size={14} color={C.orange} className="shrink-0 mt-0.5" />
                <p style={{ color: C.orange, fontSize: 11 }}>O local marcado ficou bem longe de onde você está. Se não for jogo fora mesmo, confira se o endereço cadastrado tem cidade/bairro — só o nome do colégio às vezes engana o buscador.</p>
              </div>
            )}
            {info && (
              <div className="flex gap-2 mb-3">
                <div className="flex-1 rounded-lg p-3 text-center" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: C.lime }}>{info.duracaoMin} min</p>
                  <p style={{ fontSize: 10, color: C.textMuted }}>tempo sem trânsito (aproximado)</p>
                </div>
                <div className="flex-1 rounded-lg p-3 text-center" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: C.text }}>{info.distanciaKm} km</p>
                  <p style={{ fontSize: 10, color: C.textMuted }}>distância</p>
                </div>
              </div>
            )}
            <div className="rounded-xl overflow-hidden relative" style={{ border: `1px solid ${C.line}`, height: 380 }}>
              {status === "carregando" && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: C.surface2, zIndex: 1 }}>
                  <p style={{ color: C.textMuted, fontSize: 12 }}>Carregando mapa…</p>
                </div>
              )}
              <div ref={divRef} className="w-full h-full" />
            </div>
            <p style={{ color: C.textFaint, fontSize: 10 }} className="mt-2 text-center">
              O ponto "você está aqui" se atualiza sozinho enquanto essa tela ficar aberta. O tempo acima é uma estimativa sem considerar trânsito — pra hora certa, use o Waze ou Google Maps abaixo.
            </p>
          </>
        )}
        <div className="flex gap-2 mt-4">
          <Btn
            className="flex-1"
            onClick={() => {
              const d = destRef.current;
              // Usa as coordenadas que a gente já resolveu (o candidato mais
              // próximo de onde você está, ver acima) em vez de deixar o
              // Google geocodificar o endereço de novo — se o endereço
              // cadastrado for vago (só o nome do local, sem cidade), o
              // Google pode achar um lugar diferente do que o app achou,
              // e essa era uma causa real da diferença de tempo/rota.
              const destino = d ? `${d.lat},${d.lon}` : evento.local;
              window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`, "_blank");
            }}
          >
            Abrir no Google Maps
          </Btn>
          <Btn
            className="flex-1"
            onClick={() => {
              const d = destRef.current;
              const url = d ? `https://waze.com/ul?ll=${d.lat},${d.lon}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(evento.local)}&navigate=yes`;
              window.open(url, "_blank");
            }}
          >
            Abrir no Waze
          </Btn>
        </div>
      </div>
    </div>
  );
}

const STORAGE_KEY = "futsal-data-v1";

// Rede de segurança extra, independente do Firestore/localStorage principal:
// a cada gravação bem-sucedida, guarda também uma cópia crua no
// localStorage DESTE aparelho, uma por dia (a última gravação do dia
// sobrescreve a anterior do MESMO dia, mas o dia anterior fica intocado).
// Serve pra, se algum dia o dado sincronizado sumir ou vier corrompido por
// qualquer motivo (rede, configuração, bug), sempre existir uma versão
// recente e íntegra pra recuperar sem depender de nada externo — o
// treinador não precisa ter lembrado de baixar um backup manual.
const SNAPSHOT_PREFIX = "vpscouts_snapshot_local_v1_";
const SNAPSHOT_DIAS_GUARDADOS = 7;

function chaveSnapshotHoje() {
  return SNAPSHOT_PREFIX + new Date().toISOString().slice(0, 10); // AAAA-MM-DD
}

function salvarSnapshotLocalDoDia(serializado) {
  try {
    window.localStorage.setItem(chaveSnapshotHoje(), serializado);
    const limite = Date.now() - SNAPSHOT_DIAS_GUARDADOS * 24 * 60 * 60 * 1000;
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(SNAPSHOT_PREFIX)) continue;
      const t = new Date(`${k.slice(SNAPSHOT_PREFIX.length)}T00:00:00`).getTime();
      if (!Number.isNaN(t) && t < limite) window.localStorage.removeItem(k);
    }
  } catch (e) { /* best-effort — se o localStorage estiver cheio, segue sem travar o app */ }
}

// Do mais recente pro mais antigo, pra listar na tela de Backup.
function listarSnapshotsLocais() {
  try {
    const dias = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(SNAPSHOT_PREFIX)) dias.push(k.slice(SNAPSHOT_PREFIX.length));
    }
    return dias.sort().reverse();
  } catch (e) { return []; }
}

function lerSnapshotLocal(dia) {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_PREFIX + dia);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

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
function mmssParaSeg(mmss) {
  if (!mmss) return null;
  const partes = String(mmss).split(":").map(Number);
  if (partes.length !== 2 || partes.some(Number.isNaN)) return null;
  return partes[0] * 60 + partes[1];
}

// Reconstrói, a partir do goleiro titular + das substituições
// registradas, quem estava em quadra no gol em cada trecho do jogo —
// necessário pra creditar cada gol sofrido ao goleiro certo, e não pra
// todo mundo que jogou no gol naquela partida.
function reconstruirEscaladasGoleiro(scout, atletas) {
  const golPosIds = new Set(atletas.filter((a) => a.posicao === "Goleiro").map((a) => a.id));
  const subs = (scout.eventosScout || [])
    .filter((e) => e.acao === "substituicao")
    .map((e) => ({ ...e, seg: e.segJogo ?? mmssParaSeg(e.minutoJogo) }))
    .filter((e) => e.seg != null)
    .sort((a, b) => a.seg - b.seg);

  let goleiroAtualId = Object.entries(scout.minutagem || {})
    .filter(([id]) => golPosIds.has(id))
    .map(([id, m]) => ({ id, entrada: m.entradaEmSeg ?? 0 }))
    .sort((a, b) => a.entrada - b.entrada)[0]?.id || null;

  const escaladas = [];
  let inicioAtual = 0;
  subs.forEach((sub) => {
    if (golPosIds.has(sub.saiId) && sub.saiId === goleiroAtualId) {
      escaladas.push({ atletaId: goleiroAtualId, inicio: inicioAtual, fim: sub.seg });
      goleiroAtualId = golPosIds.has(sub.entraId) ? sub.entraId : null;
      inicioAtual = sub.seg;
    } else if (golPosIds.has(sub.entraId) && !goleiroAtualId) {
      goleiroAtualId = sub.entraId;
      inicioAtual = sub.seg;
    }
  });
  if (goleiroAtualId) escaladas.push({ atletaId: goleiroAtualId, inicio: inicioAtual, fim: Infinity });
  return escaladas;
}

// Quantos gols cada goleiro específico sofreu, com base em quem estava
// em quadra no momento exato de cada gol adversário (não o placar
// inteiro da partida repetido pra todos os goleiros que jogaram).
function golsSofridosPorGoleiro(scout, atletas) {
  const escaladas = reconstruirEscaladasGoleiro(scout, atletas);
  const contagem = {};
  (scout.eventosScout || []).filter((e) => e.acao === "gol_adv").forEach((ev) => {
    const seg = ev.segJogo ?? mmssParaSeg(ev.minutoJogo);
    let alvo = seg != null ? escaladas.find((e) => seg >= e.inicio && seg < e.fim)?.atletaId : null;
    if (!alvo) {
      // Sem tempo registrado (gol de antes dessa atualização, ou vindo
      // da IA sem minutagem): melhor esforço — se só um goleiro jogou a
      // partida inteira, credita pra ele; senão, pro último que esteve
      // em quadra.
      alvo = escaladas.length === 1 ? escaladas[0].atletaId : escaladas[escaladas.length - 1]?.atletaId || null;
    }
    if (alvo) contagem[alvo] = (contagem[alvo] || 0) + 1;
  });
  return contagem;
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
// autoComplete="off" + autoCorrect/autoCapitalize/spellCheck desligados por
// padrão: sem isso, o teclado do celular (QuickType/autocorreção) às vezes
// troca sozinho um nome digitado por outro valor sugerido/salvo antes no
// mesmo campo (ex: escrever "Rosário" e o campo virar "Santa Marcelina" do
// nada). Continua dando pra sobrescrever passando a prop explicitamente,
// já que o spread de "props" vem depois desses valores padrão.
function Input(props) { return <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} {...props} className={`w-full px-3 py-2.5 rounded-lg text-sm outline-none focus:ring-1 ${props.className || ""}`} style={{ ...inputStyle, ...(props.style || {}) }} />; }
function Select(props) { return <select {...props} className={`w-full px-3 py-2.5 rounded-lg text-sm outline-none ${props.className || ""}`} style={{ ...inputStyle, ...(props.style || {}) }} />; }
function TextArea(props) { return <textarea autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} {...props} className={`w-full px-3 py-2.5 rounded-lg text-sm outline-none ${props.className || ""}`} style={{ ...inputStyle, ...(props.style || {}) }} />; }

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
    ...(isGoleiro ? [["Defesas", stats.defesas], ["Gols sofridos", stats.golsSofridos], ["Gols", stats.gols], ["Assistências", stats.assistencias]] : [["Gols", stats.gols], ["Assistências", stats.assistencias]]),
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

// Fica FORA do componente App de propósito: assim, a cada consulta ao
// IndexedDB (pra saber se tem vídeo subindo/com erro), só este componente
// pequeno re-renderiza — não o app inteiro. Antes esse estado vivia lá em
// cima, na raiz, e cada atualização (a cada poucos segundos, o tempo
// todo) forçava React a re-renderizar TODA a árvore de telas por baixo,
// o que pesava bastante, principalmente durante uma gravação.
function UploadStatusBadge({ C, onAbrir }) {
  const [status, setStatus] = useState(null); // null = nada pendente, não mostra nada
  useEffect(() => {
    let cancelado = false;
    const checar = async () => {
      try {
        const registros = await videoStore.listarTodosRegistros();
        if (cancelado) return;
        let enviando = 0, erro = 0;
        for (const r of registros) {
          if (r.status === "concluido") continue;
          if (r.status === "erro") erro++;
          else enviando++; // preparando | enviando | aguardando_conexao
        }
        const novo = (enviando > 0 || erro > 0) ? { enviando, erro } : null;
        // Só troca o estado se algo realmente mudou — evita re-render à
        // toa quando a consulta dá exatamente o mesmo resultado de antes.
        setStatus((atual) => (atual?.enviando === novo?.enviando && atual?.erro === novo?.erro) ? atual : novo);
      } catch (e) { /* best-effort */ }
    };
    checar();
    // 8s em vez de algo mais curto: é só um indicador, não precisa ser
    // instantâneo, e cada consulta tem um custo pequeno mas real.
    const id = setInterval(checar, 8000);
    return () => { cancelado = true; clearInterval(id); };
  }, []);

  if (!status) return null;
  return (
    <button
      onClick={onAbrir}
      className="fixed flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shadow-lg"
      style={{
        top: 10, right: 10, zIndex: 70,
        background: status.erro > 0 ? C.redDim : C.surface2,
        border: `1px solid ${status.erro > 0 ? C.red : C.line}`,
        fontSize: 11,
      }}
      aria-label="Status de envio dos vídeos"
    >
      {status.erro > 0 ? (
        <AlertTriangle size={13} color={C.red} />
      ) : (
        <CloudUpload size={13} color={C.lime} className="animate-pulse" />
      )}
      <span style={{ color: status.erro > 0 ? C.red : C.textMuted }}>
        {status.erro > 0 ? `${status.erro} trecho(s) com erro` : `${status.enviando} vídeo(s) enviando…`}
      </span>
    </button>
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
        // Só libera o salvamento automático quando a leitura teve SUCESSO
        // (mesmo que não tenha achado nada — aí é uma instalação nova de
        // verdade). Se a leitura falhar, "loaded" fica false de propósito:
        // preferimos travar o app com uma tela de erro a arriscar gravar
        // um estado vazio por cima de dados reais que só não puderam ser
        // lidos agora (rede instável, configuração, etc.).
        setLoaded(true);
      } catch (e) {
        setLoadError(true);
      }
    })();
  }, []);

  // Se a gravação no Firestore falhar (rede ruim, aparelho dormindo, etc.),
  // tentamos de novo sozinhos — antes a falha era engolida e o dado ficava
  // só no aparelho do treinador, sem nunca chegar nos alunos.
  const [syncFalhou, setSyncFalhou] = useState(false);
  const skipSaveRef = useRef(false); // true quando a mudança veio de OUTRO aparelho (não regravar)
  const ultimoRemotoRef = useRef(null);
  const pendenteRef = useRef(null); // último valor que ainda não foi confirmado no servidor

  const gravarComRetry = useCallback(async (serializado) => {
    pendenteRef.current = serializado;
    const esperas = [0, 1500, 4000, 10000, 20000];
    for (let i = 0; i < esperas.length; i++) {
      if (pendenteRef.current !== serializado) return; // já existe versão mais nova na fila
      if (esperas[i]) await new Promise((r) => setTimeout(r, esperas[i]));
      if (pendenteRef.current !== serializado) return;
      try {
        const r = await window.storage.set(STORAGE_KEY, serializado, false);
        if (r) {
          if (pendenteRef.current === serializado) pendenteRef.current = null;
          setSyncFalhou(false);
          return;
        }
      } catch (e) { /* tenta de novo */ }
    }
    setSyncFalhou(true); // voltará a tentar quando a internet voltar / app reabrir
  }, []);

  useEffect(() => {
    if (!loaded || loadError) return;
    // Aluno só LÊ: nunca grava, pra um aparelho com dados antigos jamais
    // sobrescrever o que o treinador salvou.
    if (sessao && sessao.tipo === "aluno") return;
    if (skipSaveRef.current) { skipSaveRef.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const serializado = JSON.stringify(data);
      ultimoValorEscritoRef.current = serializado;
      salvarSnapshotLocalDoDia(serializado);
      gravarComRetry(serializado);
    }, 350);
    return () => clearTimeout(saveTimer.current);
  }, [data, loaded, loadError, sessao, gravarComRetry]);

  // Reenvia o que ficou pendente quando a internet volta ou o app volta pra frente.
  useEffect(() => {
    const reenviar = () => {
      if (pendenteRef.current && !(sessao && sessao.tipo === "aluno")) gravarComRetry(pendenteRef.current);
    };
    const aoVisivel = () => { if (document.visibilityState === "visible") reenviar(); };
    window.addEventListener("online", reenviar);
    document.addEventListener("visibilitychange", aoVisivel);
    return () => { window.removeEventListener("online", reenviar); document.removeEventListener("visibilitychange", aoVisivel); };
  }, [sessao, gravarComRetry]);

  // Sincronização em tempo real entre dispositivos — inteiramente aditivo:
  // só faz algo se `window.storage.subscribe` existir (isto é, se o
  // Firebase estiver configurado, ver src/lib/storage.js). Sem Firebase,
  // este efeito não encontra `subscribe` e não faz nada — o app continua
  // funcionando só em localStorage, exatamente como antes.
  useEffect(() => {
    if (!loaded || typeof window.storage.subscribe !== "function") return undefined;
    const aplicarRemoto = (valorRemoto) => {
      // Ignora o próprio eco e valores que já aplicamos.
      if (!valorRemoto || valorRemoto === ultimoValorEscritoRef.current || valorRemoto === ultimoRemotoRef.current) return;
      try {
        const novo = { ...emptyState(), ...JSON.parse(valorRemoto) };
        ultimoRemotoRef.current = valorRemoto;
        skipSaveRef.current = true; // não regrava de volta o que acabou de chegar
        setData(novo);
      } catch (e) { /* ignora payload inválido */ }
    };
    const unsubscribe = window.storage.subscribe(STORAGE_KEY, aplicarRemoto);

    // Rede de segurança só para os ALUNOS: ao voltar pro app (ou quando a
    // internet volta, ou a cada 30s com a tela aberta) lê direto do servidor,
    // sem depender da conexão em tempo real que o celular costuma derrubar
    // quando o app fica em segundo plano.
    let timer = null;
    if (sessao && sessao.tipo === "aluno") {
      const buscar = async () => {
        try {
          const r = await window.storage.get(STORAGE_KEY, false);
          if (r && r.value) aplicarRemoto(r.value);
        } catch (e) { /* tenta no próximo ciclo */ }
      };
      const aoVisivel = () => { if (document.visibilityState === "visible") buscar(); };
      window.addEventListener("online", buscar);
      document.addEventListener("visibilitychange", aoVisivel);
      timer = setInterval(() => { if (document.visibilityState === "visible") buscar(); }, 30000);
      buscar();
      return () => {
        if (typeof unsubscribe === "function") unsubscribe();
        clearInterval(timer);
        window.removeEventListener("online", buscar);
        document.removeEventListener("visibilitychange", aoVisivel);
      };
    }
    return () => { if (typeof unsubscribe === "function") unsubscribe(); };
  }, [loaded, sessao]);

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

  // Restaura a partir de um snapshot local automático (o de "Vídeos que
  // gravou mas não subiram" abaixo é sobre vídeo — este aqui é sobre os
  // dados do app: atletas, jogos, scouts). Não depende de o treinador ter
  // baixado um backup manualmente antes.
  const restaurarSnapshotLocal = (dia) => {
    const snapshot = lerSnapshotLocal(dia);
    if (!snapshot || typeof snapshot !== "object") {
      alert("Não foi possível ler essa cópia automática.");
      return;
    }
    if (!window.confirm(`Isso vai SUBSTITUIR todos os dados atuais do app pelos dados salvos automaticamente em ${dia}. Essa ação não pode ser desfeita. Continuar?`)) return;
    setData({ ...emptyState(), ...snapshot });
    setModalBackup(false);
    alert("Dados restaurados a partir da cópia automática.");
  };

  // Recuperação de emergência: procura, no armazenamento local deste
  // aparelho (IndexedDB), qualquer trecho de vídeo que foi gravado mas
  // nunca terminou de subir (por exemplo, por causa de uma falha de rede
  // ou CORS) — e tenta enviar de novo, encaixando automaticamente de
  // volta no jogo/período certo pela própria chave do registro
  // (formato: "{idDoJogo}_p{periodo}_s{indice}").
  const [recuperando, setRecuperando] = useState(false);
  const [resultadoRecuperacao, setResultadoRecuperacao] = useState(null);
  // "1 de 2 · 37%" — sem isso, reenviar um trecho grande dava a impressão
  // de estar travado (spinner parado por mais de um minuto, sem nenhum
  // sinal de progresso), quando na real estava subindo normalmente.
  const [progressoRecuperacao, setProgressoRecuperacao] = useState(null);
  // Diagnóstico de configuração (Netlify env vars) — null = ainda não
  // rodou nessa sessão do modal.
  const [diagnostico, setDiagnostico] = useState(null);
  const [verificandoDiagnostico, setVerificandoDiagnostico] = useState(false);

  // Indicador global de upload: como o upload de um trecho continua em
  // segundo plano mesmo depois de trocar de período/tela (o vídeo NUNCA
  // para de subir só porque você começou a gravar outra coisa), sem isso
  // não havia como saber, olhando pra qualquer outra tela, se ainda tinha
  // trecho subindo ou se algum tinha falhado. Ver componente
  // <UploadStatusBadge> mais abaixo — fica isolado de propósito, fora
  // daqui, pra atualizar sozinho sem re-renderizar o app inteiro a cada
  // consulta (isso ficava pesando bastante, mesmo o app parecendo lento
  // de forma geral, principalmente durante a gravação).

  // Chama a function de diagnóstico (só booleans, nunca valores reais) pra
  // responder na hora "por que a IA não analisa" ou "por que os vídeos não
  // sobem" sem precisar ir atrás disso nos logs da Netlify.
  const verificarConfiguracao = async () => {
    setVerificandoDiagnostico(true);
    setDiagnostico(null);
    try {
      const res = await fetch("/.netlify/functions/check-config", {
        method: "POST",
        headers: headersComToken(),
        body: "{}",
      });
      if (!res.ok) throw new Error(`Falha ao consultar (HTTP ${res.status}).`);
      const dados = await res.json();
      setDiagnostico({ ok: true, ...dados });
    } catch (e) {
      setDiagnostico({ ok: false, erro: e?.message || "Falha ao consultar." });
    } finally {
      setVerificandoDiagnostico(false);
    }
  };

  const recuperarVideosPendentes = async () => {
    setRecuperando(true);
    setResultadoRecuperacao(null);
    try {
      const registros = await videoStore.listarTodosRegistros();
      const pendentes = registros.filter((r) => r.blob && r.status !== "concluido");
      if (pendentes.length === 0) {
        setResultadoRecuperacao({ total: 0, recuperados: 0, falharam: 0 });
        return;
      }
      let recuperados = 0;
      let falharam = 0;
      let contador = 0;
      for (const registro of pendentes) {
        contador++;
        const m = /^(.+)_p(\d+)_s(\d+)$/.exec(registro.partidaId);
        if (!m) { falharam++; continue; }
        const [, eventoId, periodoStr, indiceStr] = m;
        const periodoNumero = Number(periodoStr);
        const indice = Number(indiceStr);
        setProgressoRecuperacao({ atual: contador, total: pendentes.length, percent: 0 });
        try {
          await new Promise((resolve, reject) => {
            uploadService.retomarUploadPendente(registro.partidaId, {
              onProgresso: (percent) => setProgressoRecuperacao({ atual: contador, total: pendentes.length, percent }),
              onConcluido: ({ key }) => {
                update((d) => {
                  const s = d.scouts[eventoId];
                  if (!s) return d;
                  if (!s.videosPorPeriodo) s.videosPorPeriodo = {};
                  if (!s.videosPorPeriodo[periodoNumero]) s.videosPorPeriodo[periodoNumero] = { segmentos: [] };
                  const seg = s.videosPorPeriodo[periodoNumero].segmentos || [];
                  if (!seg.some((x) => x.indice === indice)) {
                    seg.push({ indice, key, analiseStatus: "idle" });
                    s.videosPorPeriodo[periodoNumero].segmentos = seg;
                  }
                  return d;
                });
                resolve();
              },
              onErro: (erro) => reject(new Error(erro)),
            }).catch(reject);
          });
          recuperados++;
        } catch (e) {
          falharam++;
        }
      }
      setResultadoRecuperacao({ total: pendentes.length, recuperados, falharam });
    } catch (e) {
      setResultadoRecuperacao({ erro: e?.message || "Falha ao procurar vídeos pendentes." });
    } finally {
      setRecuperando(false);
      setProgressoRecuperacao(null);
    }
  };

  // Roda a recuperação de vídeos pendentes sozinha, uma vez, assim que os
  // dados terminam de carregar — silenciosa (não mostra nada na tela a
  // menos que o treinador abra o Backup depois), só pra garantir que um
  // trecho gravado numa sessão anterior que não terminou de subir (app
  // fechado, aba recarregada, sem internet no momento) não fique esquecido
  // esperando o treinador lembrar de ir em Configurações reenviar na mão.
  const recuperacaoAutoDisparadaRef = useRef(false);
  useEffect(() => {
    if (!loaded || loadError || recuperacaoAutoDisparadaRef.current) return;
    recuperacaoAutoDisparadaRef.current = true;
    recuperarVideosPendentes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, loadError]);

  // Além de tentar uma vez ao abrir, tenta de novo toda vez que a conexão
  // voltar (evento "online" do navegador) — sem isso, se a internet caiu
  // no meio de um jogo e só voltou minutos/horas depois com o app ainda
  // aberto na mesma aba, nada disparava um novo reenvio sozinho até a
  // próxima vez que o app fosse recarregado do zero.
  useEffect(() => {
    if (!loaded || loadError) return undefined;
    const aoVoltarConexao = () => { recuperarVideosPendentes(); };
    window.addEventListener("online", aoVoltarConexao);
    return () => window.removeEventListener("online", aoVoltarConexao);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, loadError]);

  // Tela de saudação: aparece na abertura do app, mesmo offline, mesmo antes
  // de terminar de carregar os dados — e depois se desfaz com fade para a
  // tela de baixo (login ou, se já tinha sessão salva, direto para o início).
  if (splashVisivel) {
    return <SplashScreen onFim={() => setSplashVisivel(false)} />;
  }

  if (loadError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-6 text-center" style={{ background: C.bg, minHeight: 500 }}>
        <AlertTriangle size={28} color={C.red} />
        <p style={{ color: C.text, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600 }}>Não foi possível carregar seus dados</p>
        <p style={{ color: C.textMuted, fontFamily: FONT_BODY, fontSize: 12 }}>
          Por segurança, o app não vai continuar nem salvar nada até isso ser resolvido — assim nenhum dado salvo corre risco.
          Verifique sua internet e tente novamente.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ background: C.lime, color: "#0B0F0E", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontFamily: FONT_BODY, fontSize: 13 }}
        >
          Tentar novamente
        </button>
      </div>
    );
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
      {!readOnly && <UploadStatusBadge C={C} onAbrir={() => setModalBackup(true)} />}
      {!readOnly && syncFalhou && firebaseConfigurado && (
        <div className="fixed left-2 right-2 px-3 py-1.5 rounded-lg text-center pointer-events-none" style={{ top: 54, zIndex: 64, background: C.redDim, border: `1px solid ${C.red}`, maxWidth: 456, margin: "0 auto", color: C.red, fontSize: 11 }}>
          Sem conexão com o servidor — suas alterações estão salvas aqui e serão enviadas aos alunos automaticamente.
        </div>
      )}
      {!readOnly && !firebaseConfigurado && (
        <button
          onClick={() => setModalBackup(true)}
          className="fixed left-2 right-2 flex items-center gap-2 px-3 py-2 rounded-lg text-left"
          style={{ top: 54, zIndex: 65, background: C.redDim, border: `1px solid ${C.red}`, maxWidth: 456, margin: "0 auto" }}
        >
          <AlertTriangle size={15} color={C.red} className="shrink-0" />
          <span style={{ color: C.red, fontSize: 11, lineHeight: 1.3 }}>
            Sincronização entre aparelhos desligada — os alunos não veem suas atualizações ao vivo. Toque pra ver como configurar.
          </span>
        </button>
      )}
      <div className="pb-24">
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

              <div className="mt-1 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
                <p style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>Cópias automáticas neste aparelho</p>
                <p style={{ color: C.textFaint, fontSize: 10 }} className="mt-0.5 mb-2">
                  Sem precisar baixar nada, o app guarda sozinho uma cópia dos dados por dia, direto neste
                  aparelho — uma última linha de defesa se algo der errado na sincronização.
                </p>
                {listarSnapshotsLocais().length === 0 ? (
                  <p style={{ color: C.textFaint, fontSize: 10 }}>Nenhuma cópia automática ainda.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {listarSnapshotsLocais().map((dia) => (
                      <button
                        key={dia}
                        onClick={() => restaurarSnapshotLocal(dia)}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs"
                        style={{ background: C.surface, color: C.textMuted, border: `1px solid ${C.line}` }}
                      >
                        <span>{new Date(`${dia}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                        <span style={{ color: C.lime }}>Restaurar</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-1 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
                <p style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>Vídeos que gravou mas não subiram</p>
                <p style={{ color: C.textFaint, fontSize: 10 }} className="mt-0.5 mb-2">
                  Se algum trecho gravado NESTE aparelho falhou ao enviar, ele continua guardado aqui até conseguir subir. Toque abaixo pra tentar enviar de novo.
                </p>
                <Btn variant="outline" className="w-full" onClick={recuperarVideosPendentes} disabled={recuperando}>
                  {recuperando ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                  {recuperando
                    ? (progressoRecuperacao
                        ? `Reenviando ${progressoRecuperacao.atual} de ${progressoRecuperacao.total} — ${progressoRecuperacao.percent}%`
                        : "Procurando vídeos pendentes...")
                    : "Verificar e reenviar vídeos pendentes"}
                </Btn>
                {resultadoRecuperacao && (
                  <p className="mt-2" style={{ fontSize: 11, color: resultadoRecuperacao.erro || resultadoRecuperacao.falharam ? C.red : C.lime }}>
                    {resultadoRecuperacao.erro
                      ? `Erro: ${resultadoRecuperacao.erro}`
                      : resultadoRecuperacao.total === 0
                      ? "Nenhum vídeo pendente encontrado neste aparelho."
                      : `${resultadoRecuperacao.recuperados} de ${resultadoRecuperacao.total} trecho(s) reenviado(s) com sucesso${resultadoRecuperacao.falharam ? ` — ${resultadoRecuperacao.falharam} ainda falharam (tente de novo)` : ""}.`}
                  </p>
                )}
              </div>

              <div className="mt-1 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
                <p style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>Diagnóstico de configuração</p>
                <p style={{ color: C.textFaint, fontSize: 10 }} className="mt-0.5 mb-2">
                  Confere se as variáveis de ambiente da Netlify estão configuradas — sem isso, a análise por IA e a
                  sincronização entre aparelhos não funcionam. Nunca mostra os valores, só se cada uma existe.
                </p>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: firebaseConfigurado ? C.lime : C.red }} />
                  <span style={{ fontSize: 11, color: C.textMuted }}>
                    Sincronização entre aparelhos (Firebase): {firebaseConfigurado ? "configurada" : "NÃO configurada"}
                  </span>
                </div>
                <Btn variant="outline" className="w-full" onClick={verificarConfiguracao} disabled={verificandoDiagnostico}>
                  {verificandoDiagnostico ? <Loader2 size={15} className="animate-spin" /> : <AlertCircle size={15} />}
                  {verificandoDiagnostico ? "Verificando..." : "Verificar variáveis do servidor"}
                </Btn>
                {diagnostico && !diagnostico.ok && (
                  <p className="mt-2" style={{ fontSize: 11, color: C.red }}>Erro: {diagnostico.erro}</p>
                )}
                {diagnostico?.ok && (
                  <div className="mt-2 flex flex-col gap-1">
                    {[
                      ["Vídeo — conta (VIDEO_STORAGE_ACCOUNT_ID)", diagnostico.video?.VIDEO_STORAGE_ACCOUNT_ID],
                      ["Vídeo — chave de acesso (VIDEO_STORAGE_ACCESS_KEY_ID)", diagnostico.video?.VIDEO_STORAGE_ACCESS_KEY_ID],
                      ["Vídeo — chave secreta (VIDEO_STORAGE_SECRET_ACCESS_KEY)", diagnostico.video?.VIDEO_STORAGE_SECRET_ACCESS_KEY],
                      ["Vídeo — bucket (VIDEO_STORAGE_BUCKET)", diagnostico.video?.VIDEO_STORAGE_BUCKET],
                      ["IA (GEMINI_API_KEY)", diagnostico.ia?.GEMINI_API_KEY],
                      ["Token do app (APP_SHARED_TOKEN)", diagnostico.seguranca?.APP_SHARED_TOKEN],
                    ].map(([label, ok]) => (
                      <div key={label} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ok ? C.lime : C.red }} />
                        <span style={{ fontSize: 11, color: C.textMuted }}>{label}: {ok ? "presente" : "AUSENTE"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
        {view === "rota-jogo" && <RotaJogoScreen data={data} params={params} nav={nav} />}
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
  const emojiClima = useEmojiClima();

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
      <ScreenHeader title={getSaudacao(meuAtleta ? meuAtleta.nome : "Victor", emojiClima)} subtitle="Visão geral da temporada" />
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
  
