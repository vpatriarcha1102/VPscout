import { useEffect, useRef } from "react";
import { getAIAnalysisService } from "../services/aiAnalysisService";
import { gerarEventosRevisaveis, aplicarEventosConfirmados } from "../lib/iaEventConverter";

/**
 * useAnaliseAoVivo — dispara a análise de cada segmento de vídeo assim
 * que ele termina de subir, SEM esperar o jogo acabar e sem abrir
 * nenhuma tela de revisão no meio da partida.
 *
 * Cada segmento, quando a análise termina:
 * - eventos de alta confiança entram DIRETO nas estatísticas (via
 *   aplicarEventosConfirmados, o mesmo caminho usado pela revisão manual);
 * - eventos incertos (baixa/média confiança, ou "gol" sem comemoração
 *   clara) ficam guardados em scout.itensRevisaoPendentes, pra você
 *   olhar com calma quando apertar "Finalizar jogo".
 *
 * Só fica ativo enquanto a tela de scout ao vivo está aberta (é montado
 * dentro do ScoutJogo).
 */
export function useAnaliseAoVivo({ evento, scout, atletas, update, uid }) {
  const iniciadosRef = useRef(new Set()); // chaves "p{periodo}-s{indice}" já disparadas

  const videosPorPeriodo = scout?.videosPorPeriodo || {};
  // Assinatura simples do estado atual de segmentos, só pra saber quando
  // vale a pena reexaminar (evita rodar o efeito a cada tecla digitada
  // em outro canto do app).
  const assinatura = Object.entries(videosPorPeriodo)
    .map(([p, v]) => `${p}:${(v.segmentos || []).map((s) => `${s.indice}${s.analiseStatus || "idle"}`).join(",")}`)
    .join("|");

  useEffect(() => {
    if (!evento || !scout) return;

    // 1) Dispara análise de qualquer segmento novo (tem key, nunca foi
    // analisado ainda).
    Object.entries(videosPorPeriodo).forEach(([periodoStr, v]) => {
      const periodoNumero = Number(periodoStr);
      (v.segmentos || []).forEach((seg) => {
        const chave = `p${periodoNumero}-s${seg.indice}`;
        if (!seg.key || seg.analiseStatus === "processando" || seg.analiseStatus === "concluido") return;
        if (iniciadosRef.current.has(chave)) return;
        iniciadosRef.current.add(chave);

        const partidaId = `${evento.id}_p${periodoNumero}_s${seg.indice}`;
        update((d) => {
          const s = d.scouts[evento.id];
          const alvo = (s.videosPorPeriodo[periodoNumero]?.segmentos || []).find((x) => x.indice === seg.indice);
          if (alvo) { alvo.analiseStatus = "processando"; alvo.analiseErro = null; alvo.analiseIniciadaEm = Date.now(); }
          return d;
        });

        (async () => {
          try {
            const service = getAIAnalysisService();
            const jogadoresCadastrados = atletas.map((a) => ({ numero: a.numero, nome: a.nome, posicao: a.posicao }));
            await service.iniciarAnalise({ partidaId, videoKey: seg.key, jogadoresCadastrados, coresUniforme: scout.coresUniforme });
          } catch (e) {
            update((d) => {
              const s = d.scouts[evento.id];
              const alvo = (s.videosPorPeriodo[periodoNumero]?.segmentos || []).find((x) => x.indice === seg.indice);
              if (alvo) { alvo.analiseStatus = "erro"; alvo.analiseErro = e.message; }
              return d;
            });
          }
        })();
      });
    });

    // 2) Consulta status dos que estão processando, e quando concluir,
    // separa automaticamente o que sobe sozinho do que fica pendente.
    // Um novo efeito roda a cada mudança de status dos segmentos, então
    // sempre usa uma leitura fresca de videosPorPeriodo (evita closure
    // desatualizada travando a descoberta de novos segmentos).
    const temPendente = Object.values(videosPorPeriodo).some((v) => (v.segmentos || []).some((s) => s.analiseStatus === "processando"));
    if (!temPendente) return undefined;

    const id = setInterval(async () => {
      const service = getAIAnalysisService();
      const pendentes = [];
      Object.entries(videosPorPeriodo).forEach(([periodoStr, v]) => {
        (v.segmentos || []).forEach((seg) => {
          if (seg.analiseStatus === "processando") pendentes.push({ periodoNumero: Number(periodoStr), seg });
        });
      });
      for (const { periodoNumero, seg } of pendentes) {
        const partidaId = `${evento.id}_p${periodoNumero}_s${seg.indice}`;
        // Trava de segurança: se ficar "processando" por mais de 5 minutos
        // (o servidor já desiste sozinho aos 3), marca erro aqui também —
        // evita que a tela fique girando pra sempre se, por algum motivo,
        // a resposta do servidor nunca chegar de volta.
        if (seg.analiseIniciadaEm && Date.now() - seg.analiseIniciadaEm > 5 * 60 * 1000) {
          update((d) => {
            const s = d.scouts[evento.id];
            const alvo = (s.videosPorPeriodo[periodoNumero]?.segmentos || []).find((x) => x.indice === seg.indice);
            if (alvo) { alvo.analiseStatus = "erro"; alvo.analiseErro = "A análise demorou demais e foi cancelada. Tente regravar esse trecho."; }
            return d;
          });
          continue;
        }
        try {
          const st = await service.consultarStatus(partidaId);
          if (st.status === "concluido") {
            const itens = gerarEventosRevisaveis(st.eventos || [], atletas, periodoNumero, seg.indice);
            update((d) => {
              const s = d.scouts[evento.id];
              const alvo = (s.videosPorPeriodo[periodoNumero]?.segmentos || []).find((x) => x.indice === seg.indice);
              if (alvo) { alvo.analiseStatus = "concluido"; alvo.analiseAtualizadaEm = Date.now(); }
              // Auto-aplica os confiáveis direto nas estatísticas...
              aplicarEventosConfirmados(s, itens, uid);
              // ...e guarda o resto (incerto) pra revisão manual no fim.
              const pendentesRestantes = itens.filter((it) => !it.confirmado);
              s.itensRevisaoPendentes = [...(s.itensRevisaoPendentes || []), ...pendentesRestantes];
              return d;
            });
          } else if (st.status === "erro") {
            update((d) => {
              const s = d.scouts[evento.id];
              const alvo = (s.videosPorPeriodo[periodoNumero]?.segmentos || []).find((x) => x.indice === seg.indice);
              if (alvo) { alvo.analiseStatus = "erro"; alvo.analiseErro = st.erro; }
              return d;
            });
          }
        } catch (e) { /* tenta de novo no próximo tick */ }
      }
    }, 6000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura]);
}
