/**
 * Formatação do Observatório de Gás Natural. Reaproveita a do Setor Elétrico (ausência vira "–", nunca 0; sinal de menos
 * tipográfico) e acrescenta os períodos mensais da gold do gás ("AAAA-MM" e "AAAA-MM a AAAA-MM").
 */
import { AUSENTE, mesAno } from "@/lib/energia/formato";

export { AUSENTE, num, reais, pct, sinal, dataBR, dataExtenso, mesAno, mesAnoCurto, carimbo } from "@/lib/energia/formato";

const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-08" → "agosto de 2026". */
export function mesExtenso(anomes: string | null | undefined): string {
  if (!anomes || !/^\d{4}-\d{2}/.test(anomes)) return AUSENTE;
  return `${MESES_LONGOS[Number(anomes.slice(5, 7)) - 1]} de ${anomes.slice(0, 4)}`;
}

/** "2025-09 a 2026-08" → "set/2025 a ago/2026"; "2026-08" → "ago/2026"; outros textos passam como estão. */
export function periodoLegivel(periodo: string | null | undefined): string {
  if (!periodo) return AUSENTE;
  return periodo.replace(/(\d{4})-(\d{2})(?:-(\d{2}))?/g, (m, a, mm, d) => (d ? `${d}/${mm}/${a}` : mesAno(`${a}-${mm}`)));
}
