/**
 * iaEventConverter — Etapa 7
 * Ponte entre o formato bruto que a IA devolve (identificando jogador
 * por número da camisa) e o formato que o VPScouts já usa em
 * scout.eventosScout (identificando por atletaId interno).
 */

import { LIMIARES_CONFIANCA, classificarConfianca } from "../constants/scoutEvents";

export function mapearAtletaPorNumero(atletas, numero) {
  if (numero === null || numero === undefined) return null;
  return atletas.find((a) => String(a.numero) === String(numero)) || null;
}

export function gerarEventosRevisaveis(eventosIA, atletas) {
  return (eventosIA || []).map((ev, i) => {
    const atleta = mapearAtletaPorNumero(atletas, ev.atletaNumero);
    const destino = ev.tipo === "passe" ? mapearAtletaPorNumero(atletas, ev.atletaDestinoNumero) : null;
    const nivel = classificarConfianca(ev.confianca);
    return {
      idTemp: `ia-${i}-${ev.timestampSeg}`,
      tipo: ev.tipo,
      timestampSeg: ev.timestampSeg,
      atletaId: atleta?.id || null,
      atletaNumero: ev.atletaNumero ?? null,
      atletaNome: atleta?.nome || null,
      destinoId: destino?.id || null,
      destinoNumero: ev.atletaDestinoNumero ?? null,
      destinoNome: destino?.nome || null,
      resultado: ev.resultado || null,
      confianca: ev.confianca,
      nivelConfianca: nivel,
      confirmado: nivel === "alta",
      excluido: false,
    };
  });
}

function variantePasse(resultado) {
  return resultado === "certo" ? "Certo" : "Errado";
}

function varianteFinalizacao(resultado) {
  if (resultado === "gol") return "Gol";
  if (resultado === "no_alvo") return "No alvo";
  if (resultado === "bloqueada") return "Bloqueada";
  return "Fora";
}

export function aplicarEventosConfirmados(scout, itens, periodoNumero, uid) {
  const validos = itens.filter((it) => !it.excluido && it.confirmado);
  const agora = Date.now();

  for (const it of validos) {
    if (it.tipo === "passe") {
      if (!it.atletaId) continue;
      scout.eventosScout.push({
        id: uid(),
        acao: "passe",
        atletaId: it.atletaId,
        destinoId: it.destinoId || null,
        variante: variantePasse(it.resultado),
        periodoNumero,
        ts: agora,
        fonte: "ia",
        confianca: it.confianca,
      });
    } else if (it.tipo === "finalizacao") {
      if (!it.atletaId) continue;
      scout.eventosScout.push({
        id: uid(),
        acao: "finalizacao_jogador",
        atletaId: it.atletaId,
        variante: varianteFinalizacao(it.resultado),
        periodoNumero,
        ts: agora,
        fonte: "ia",
        confianca: it.confianca,
      });
    } else if (it.tipo === "gol") {
      scout.placarCasa = (scout.placarCasa || 0) + 1;
      scout.eventosScout.push({
        id: uid(),
        acao: "gol",
        atletaId: it.atletaId || null,
        variante: null,
        periodoNumero,
        ts: agora,
        fonte: "ia",
        confianca: it.confianca,
      });
      scout.eventosScout.push({
        id: uid(),
        acao: "finalizacao_time",
        atletaId: null,
        variante: "Gol",
        lado: "pro",
        periodoNumero,
        ts: agora,
        fonte: "ia",
      });
    }
  }
  return validos.length;
}

export { LIMIARES_CONFIANCA };
