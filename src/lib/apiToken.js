/**
 * apiToken — Etapa 4.
 * Anexa o token de aplicação (VITE_APP_SHARED_TOKEN) às chamadas para as
 * Netlify Functions do VPScouts. Não é um segredo de verdade — as
 * chaves reais (R2, Gemini) nunca saem do backend.
 */
export function headersComToken(extra = {}) {
  const token = import.meta.env.VITE_APP_SHARED_TOKEN;
  return {
    "Content-Type": "application/json",
    ...(token ? { "X-VPScouts-Token": token } : {}),
    ...extra,
  };
}
