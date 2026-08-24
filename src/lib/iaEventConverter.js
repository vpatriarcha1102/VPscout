/**
 * iaEventConverter — Etapa 7 (+ ampliado para vídeo por tempo/segmentos e
 * lado pro/contra via cor de uniforme, incluindo passes do adversário).
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

// periodoNumero + segmentoIndice: de qual tempo e de qual trechinho de
// vídeo veio este lote de eventos — cada item revisável carrega essa
// informação consigo, porque a revisão final junta eventos de vários
// tempos e vários segmentos numa lista só.
export function gerarEventosRevisaveis(eventosIA, atletas, periodoNumero, segmentoIndice = 0) {
  return (eventosIA || []).map((ev, i) => {
    const lado = ev.lado === "contra" ? "contra" : "pro";
    const atleta = lado === "contra" ? null : mapearAtletaPorNumero(atletas, ev.atletaNumero);
    const destino = ev.tipo === "passe" && lado === "pro" ? mapearAtletaPorNumero(atletas, ev.atletaDestinoNumero) : null;
    const nivel = classificarConfianca(ev.confianca);
    const ehGolSemComemoracao = ev.tipo === "finalizacao" && ev.resultado === "gol" && !ev.comemoracaoClara;
    return {
      idTemp: `ia-p${periodoNumero}-s${segmentoIndice}-${i}-${ev.timestampSeg}`,
      periodoNumero,
      segmentoIndice,
      tipo: ev.tipo,
      lado,
      timestampSeg: ev.timestampSeg,
      atletaId: atleta?.id || null,
      atletaNumero: lado === "pro" ? (ev.atletaNumero ?? null) : null,
      atletaNome: atleta?.nome || null,
      destinoId: destino?.id || null,
      destinoNumero: lado === "pro" ? (ev.atletaDestinoNumero ?? null) : null,
      destinoNome: destino?.nome || null,
      resultado: ev.resultado || null,
      comemoracaoClara: !!ev.comemoracaoClara,
      confianca: ev.confianca,
      nivelConfianca: nivel,
      // Sobe sozinho pras estatísticas quando a confiança é alta — exceto
      // gol, que só sobe sozinho se teve comemoração clara e inequívoca;
      // sem isso, mesmo com confiança alta, fica pendente de revisão
      // manual (porque afeta o placar).
      confirmado: nivel === "alta" && !ehGolSemComemoracao,
      excluido: false,
    };
  });
}

function variantePasse(resultado) {
  return resultado === "certo" ? "Certo" : "Errado";
}

// Precisa bater exatamente com as chaves de FINALIZACOES_TIME no App.jsx —
// são essas 5 categorias que alimentam o card "Finalizações da equipe".
function varianteFinalizacao(resultado) {
  if (resultado === "gol") return "Gol";
  if (resultado === "defendida") return "Defesa do goleiro";
  if (resultado === "trave") return "Trave";
  if (resultado === "nova_jogada") return "Nova jogada";
  return "Pra fora";
}

// Aplica os itens confirmados (de um ou mais tempos/segmentos de vídeo,
// já misturados numa lista só — cada item leva seu próprio
// periodoNumero) nos eventos reais do scout, exatamente no mesmo
// formato usado pelo scout manual — por isso alimenta as mesmas
// estatísticas individuais e de equipe automaticamente, sem lógica
// separada em nenhum outro lugar do app.
//
// Time "pro": passe e finalização entram tanto na conta da equipe quanto
// na conta individual do atleta (quando identificado).
// Time "contra" (adversário): entram SÓ na conta da equipe — nunca temos
// atletaId do adversário porque só cadastramos os próprios atletas.
export function aplicarEventosConfirmados(scout, itens, uid) {
  const validos = itens.filter((it) => !it.excluido && it.confirmado);
  const agora = Date.now();

  for (const it of validos) {
    const periodoNumero = it.periodoNumero ?? scout.periodoAtual ?? 1;
    const lado = it.lado === "contra" ? "contra" : "pro";

    if (it.tipo === "passe") {
      if (lado === "pro") {
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
      } else {
        // Passe do adversário — conta só pra estatística de equipe dele,
        // sem atleta identificado (não cadastramos jogadores do outro time).
        scout.eventosScout.push({
          id: uid(),
          acao: "passe_time",
          atletaId: null,
          lado: "contra",
          variante: variantePasse(it.resultado),
          periodoNumero,
          ts: agora,
          fonte: "ia",
          confianca: it.confianca,
        });
      }
    } else if (it.tipo === "finalizacao") {
      // Tally de equipe — sempre registrado, dos dois times, é o que
      // alimenta "Finalizações da equipe a favor/contra" no relatório.
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

      // Estatística individual só faz sentido para o próprio time e com
      // o jogador identificado.
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
