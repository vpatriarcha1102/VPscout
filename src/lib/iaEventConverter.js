/**
 * iaEventConverter — Etapa 7 (+ ampliado para vídeo por tempo e lado
 * pro/contra via cor de uniforme).
 * Ponte entre o formato bruto que a IA devolve (identificando jogador
 * por número da camisa, e o lado do lance pela cor do uniforme) e o
 * formato que o VPScouts já usa em scout.eventosScout (identificando
 * por atletaId interno).
 */

import { LIMIARES_CONFIANCA, classificarConfianca } from "../constants/scoutEvents";

export function mapearAtletaPorNumero(atletas, numero) {
  if (numero === null || numero === undefined) return null;
  return atletas.find((a) => String(a.numero) === String(numero)) || null;
}

// periodoNumero: de qual tempo/vídeo veio este lote de eventos — cada
// item revisável carrega essa informação consigo, porque a revisão
// final junta eventos de vários tempos numa lista só.
export function gerarEventosRevisaveis(eventosIA, atletas, periodoNumero) {
  return (eventosIA || []).map((ev, i) => {
    const atleta = ev.lado === "contra" ? null : mapearAtletaPorNumero(atletas, ev.atletaNumero);
    const destino = ev.tipo === "passe" ? mapearAtletaPorNumero(atletas, ev.atletaDestinoNumero) : null;
    const nivel = classificarConfianca(ev.confianca);
    return {
      idTemp: `ia-p${periodoNumero}-${i}-${ev.timestampSeg}`,
      periodoNumero,
      tipo: ev.tipo,
      lado: ev.tipo === "finalizacao" ? (ev.lado === "contra" ? "contra" : "pro") : "pro",
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

// Aplica os itens confirmados na revisão (de um ou mais tempos/vídeos,
// já misturados numa lista só — cada item leva seu próprio
// periodoNumero) nos eventos reais do scout, exatamente no mesmo
// formato usado pelo scout manual — por isso alimenta as mesmas
// estatísticas individuais e de equipe automaticamente, sem lógica
// separada em nenhum outro lugar do app.
export function aplicarEventosConfirmados(scout, itens, uid) {
  const validos = itens.filter((it) => !it.excluido && it.confirmado);
  const agora = Date.now();

  for (const it of validos) {
    const periodoNumero = it.periodoNumero ?? scout.periodoAtual ?? 1;

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
      const lado = it.lado === "contra" ? "contra" : "pro";

      scout.eventosScout.push({
        id: uid(),
        acao: "finalizacao_time",
        atletaId: null,
        variante: varianteFinalizacao(it.resultado),
        lado,
        periodoNumero,
        ts: agora,
        fonte: "ia",
        confianca: it.confianca,
      });

      if (lado === "pro" && it.atletaId) {
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
      }

      if (it.resultado === "gol") {
        if (lado === "pro") {
          scout.placarCasa = (scout.placarCasa || 0) + 1;
          if (it.atletaId) {
            scout.eventosScout.push({
              id: uid(),
              acao: "gol",
              atletaId: it.atletaId,
              variante: null,
              periodoNumero,
              ts: agora,
              fonte: "ia",
              confianca: it.confianca,
            });
          }
        } else {
          scout.placarVisitante = (scout.placarVisitante || 0) + 1;
          scout.eventosScout.push({
            id: uid(),
            acao: "gol_adv",
            atletaId: null,
            variante: null,
            periodoNumero,
            ts: agora,
            fonte: "ia",
            confianca: it.confianca,
          });
        }
      }
    }
  }
  return validos.length;
}

export { LIMIARES_CONFIANCA };
