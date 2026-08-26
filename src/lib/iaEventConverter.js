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
    // bola_parada e drible só existem "a favor" — a IA não tenta rastrear
    // essas categorias do adversário.
    const lado = (ev.tipo === "bola_parada" || ev.tipo === "drible") ? "pro" : (ev.lado === "contra" ? "contra" : "pro");
    const atleta = lado === "contra" ? null : mapearAtletaPorNumero(atletas, ev.atletaNumero);
    const destino = ev.tipo === "passe" && lado === "pro" ? mapearAtletaPorNumero(atletas, ev.atletaDestinoNumero) : null;
    const nivel = classificarConfianca(ev.confianca);
    const ehGolSemComemoracao = ev.tipo === "finalizacao" && ev.resultado === "gol" && !ev.comemoracaoClara;
    // Falta e bola parada sempre pedem revisão manual, mesmo com confiança
    // alta — são julgamentos mais delicados (falta em especial) e bola
    // parada precisa que o treinador escolha a jogada usada.
    const sempreRevisar = ev.tipo === "falta" || ev.tipo === "bola_parada";
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
      categoriaBolaParada: ev.categoriaBolaParada || null,
      pistaSonora: !!ev.pistaSonora,
      comemoracaoClara: !!ev.comemoracaoClara,
      confianca: ev.confianca,
      nivelConfianca: nivel,
      // Sobe sozinho pras estatísticas quando a confiança é alta — exceto
      // gol sem comemoração clara (afeta o placar) e falta/bola parada
      // (sempre pedem revisão manual).
      confirmado: nivel === "alta" && !ehGolSemComemoracao && !sempreRevisar,
      excluido: false,
    };
  });
}

function variantePasse(resultado) {
  return resultado === "certo" ? "Certo" : "Errado";
}

const CATEGORIA_BOLA_PARADA_LABEL = {
  escanteio: "Escanteio / Lateral Ofensivo",
  lateral: "Escanteio / Lateral Ofensivo",
  falta_cobrada: "Falta",
  penalti: "Pênalti",
};

const RESULTADO_BOLA_PARADA_LABEL = {
  chance_perigosa: "Chance perigosa",
  gol: "Gerou gol a favor",
  erro: "Erro de jogada",
  neutro: "Erro de jogada",
};

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

  // Assistência automática: um passe certo (lado pro) cujo destino marcou
  // gol até 12s depois, no mesmo trecho de vídeo, conta como assistência —
  // sem precisar que a IA detecte isso como um tipo de evento à parte.
  const assistenciaPorGol = new Map(); // idTemp do gol -> atletaId de quem passou
  const gols = validos.filter((it) => it.tipo === "finalizacao" && it.resultado === "gol" && it.lado === "pro" && it.atletaId);
  for (const gol of gols) {
    const passeAntes = validos.find((it) =>
      it.tipo === "passe" && it.lado === "pro" && it.resultado === "certo" &&
      it.destinoId === gol.atletaId && it.atletaId && it.atletaId !== gol.atletaId &&
      it.periodoNumero === gol.periodoNumero && it.segmentoIndice === gol.segmentoIndice &&
      gol.timestampSeg - it.timestampSeg >= 0 && gol.timestampSeg - it.timestampSeg <= 12
    );
    if (passeAntes) assistenciaPorGol.set(gol.idTemp, passeAntes.atletaId);
  }

  // Erro que gera perigo: um passe errado (lado pro) seguido, até 8s depois
  // no mesmo trecho, de uma finalização do adversário — conta como "Ação
  // Errada" (Gerou chance perigosa / Gerou gol adversário) além do próprio
  // passe errado, sem duplicar o gol em si (a finalização do adversário já
  // cuida disso sozinha, como item confirmado à parte).
  const erroGeradoPorPasse = new Map(); // idTemp do passe -> variante do erro
  const passesErradosPro = validos.filter((it) => it.tipo === "passe" && it.lado === "pro" && it.resultado === "errado" && it.atletaId);
  for (const pe of passesErradosPro) {
    const finalizacaoContraDepois = validos.find((it) =>
      it.tipo === "finalizacao" && it.lado === "contra" &&
      it.periodoNumero === pe.periodoNumero && it.segmentoIndice === pe.segmentoIndice &&
      it.timestampSeg - pe.timestampSeg >= 0 && it.timestampSeg - pe.timestampSeg <= 8
    );
    if (finalizacaoContraDepois) {
      erroGeradoPorPasse.set(pe.idTemp, finalizacaoContraDepois.resultado === "gol" ? "Gerou gol adversário" : "Gerou chance perigosa");
    }
  }

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
        const varianteErro = erroGeradoPorPasse.get(it.idTemp);
        if (varianteErro) {
          scout.eventosScout.push({
            id: uid(),
            acao: "erro",
            atletaId: it.atletaId,
            variante: varianteErro,
            periodoNumero,
            segmentoIndice: it.segmentoIndice,
            timestampSeg: it.timestampSeg,
            ts: agora,
            fonte: "ia",
            confianca: it.confianca,
          });
        }
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
        segmentoIndice: it.segmentoIndice,
        timestampSeg: it.timestampSeg,
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
          segmentoIndice: it.segmentoIndice,
          timestampSeg: it.timestampSeg,
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
              segmentoIndice: it.segmentoIndice,
              timestampSeg: it.timestampSeg,
              ts: agora,
              fonte: "ia",
              confianca: it.confianca,
            });
            const assistenteId = assistenciaPorGol.get(it.idTemp);
            if (assistenteId) {
              scout.eventosScout.push({
                id: uid(),
                acao: "assistencia",
                atletaId: assistenteId,
                variante: null,
                periodoNumero,
                segmentoIndice: it.segmentoIndice,
                timestampSeg: it.timestampSeg,
                ts: agora,
                fonte: "ia",
                confianca: it.confianca,
              });
            }
          }
        } else {
          scout.placarVisitante = (scout.placarVisitante || 0) + 1;
          scout.eventosScout.push({
            id: uid(),
            acao: "gol_adv",
            atletaId: null,
            variante: null,
            periodoNumero,
            segmentoIndice: it.segmentoIndice,
            timestampSeg: it.timestampSeg,
            ts: agora,
            fonte: "ia",
            confianca: it.confianca,
          });
        }
      }
    } else if (it.tipo === "drible") {
      // Sempre "a favor" — jogada individual do próprio elenco.
      if (!it.atletaId) continue;
      scout.eventosScout.push({
        id: uid(),
        acao: "positivo",
        atletaId: it.atletaId,
        variante: "Jogada individual",
        periodoNumero,
        segmentoIndice: it.segmentoIndice,
        timestampSeg: it.timestampSeg,
        ts: agora,
        fonte: "ia",
        confianca: it.confianca,
      });
    } else if (it.tipo === "falta") {
      scout.eventosScout.push({
        id: uid(),
        acao: "falta",
        atletaId: lado === "pro" ? it.atletaId : null,
        variante: lado === "pro" ? "Cometida" : "Sofrida",
        periodoNumero,
        segmentoIndice: it.segmentoIndice,
        timestampSeg: it.timestampSeg,
        ts: agora,
        fonte: "ia",
        confianca: it.confianca,
      });
    } else if (it.tipo === "bola_parada") {
      // Sempre "a favor". A categoria e a jogada específica agora vêm da
      // seleção feita pelo treinador na própria tela de revisão manual
      // (categoriaLabelManual / jogada) — a IA só dá o palpite inicial.
      const categoriaFinal = it.categoriaLabelManual || CATEGORIA_BOLA_PARADA_LABEL[it.categoriaBolaParada] || "Falta";
      scout.eventosScout.push({
        id: uid(),
        acao: "bola_parada",
        atletaId: null,
        categoria: categoriaFinal,
        jogada: it.jogada || categoriaFinal,
        resultado: RESULTADO_BOLA_PARADA_LABEL[it.resultado] || "Erro de jogada",
        periodoNumero,
        segmentoIndice: it.segmentoIndice,
        timestampSeg: it.timestampSeg,
        ts: agora,
        fonte: "ia",
        confianca: it.confianca,
      });
      if (it.resultado === "gol") {
        scout.placarCasa = (scout.placarCasa || 0) + 1;
      }
    }
  }
  return validos.length;
}

export { LIMIARES_CONFIANCA };
