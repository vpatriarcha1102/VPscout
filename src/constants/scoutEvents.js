/**
 * Vocabulário de eventos de scout (eventosScout) — VPScouts
 * ------------------------------------------------------------
 * Este arquivo NÃO redefine nada que já existe em App.jsx.
 * Ele documenta e centraliza:
 *   1) as ações que o scout MANUAL de partida já usa hoje (para referência);
 *   2) as ações NOVAS, aditivas, que o Scout IA poderá gerar;
 *   3) a configuração de confiança usada para decidir se um evento
 *      da IA entra automaticamente, precisa de revisão, ou é descartado.
 */

export const ACOES_PARTIDA_EXISTENTES = [
  "positivo",
  "erro",
  "falta",
  "cartao",
  "defesa",
  "gol",
  "gol_adv",
  "assistencia",
  "finalizacao_time",
  "bola_parada",
  "substituicao",
];

export const ACOES_PARTIDA_NOVAS = {
  PASSE: "passe",
  FINALIZACAO_JOGADOR: "finalizacao_jogador",
};

export const ACOES_PARTIDA = [
  ...ACOES_PARTIDA_EXISTENTES,
  ...Object.values(ACOES_PARTIDA_NOVAS),
];

export const FONTE_EVENTO = {
  MANUAL: "manual",
  IA: "ia",
};

export const LIMIARES_CONFIANCA = {
  AUTO_ACEITAR: 0.90,
  REVISAO: 0.70,
};

export function classificarConfianca(confianca) {
  if (confianca >= LIMIARES_CONFIANCA.AUTO_ACEITAR) return "alta";
  if (confianca >= LIMIARES_CONFIANCA.REVISAO) return "media";
  return "baixa";
}
