/**
 * Formatação da coleção Varejo, no padrão brasileiro. Ausência é sempre texto ("sem dado"), nunca zero; variação leva sinal
 * tipográfico; pontos percentuais e variação percentual têm escritas diferentes.
 */

export const SEM_DADO = "sem dado";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function num(v: number | null | undefined, casas = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return SEM_DADO;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).replace(/^-/, "−");
}

/** "+1,7%", "−0,8%", "0,0%". */
export function variacao(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return SEM_DADO;
  const arred = Number(v.toFixed(casas));
  return `${arred > 0 ? "+" : ""}${num(arred, casas)}%`;
}

/** "+4,9 p.p.": diferença entre duas variações, em pontos percentuais. */
export function pontos(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return SEM_DADO;
  const arred = Number(v.toFixed(casas));
  return `${arred > 0 ? "+" : ""}${num(arred, casas)} p.p.`;
}

export function pct(v: number | null | undefined, casas = 1): string {
  return v === null || v === undefined || !Number.isFinite(v) ? SEM_DADO : `${num(v, casas)}%`;
}

/** "2026-09" → "setembro de 2026". */
export function mesExtenso(mes: string): string {
  const [a, m] = mes.split("-");
  const nome = MESES[Number(m) - 1];
  return nome ? `${nome} de ${a}` : mes;
}

/** "2026-09" → "set/2026". */
export function mesCurto(mes: string): string {
  const [a, m] = mes.split("-");
  const nome = MESES_CURTOS[Number(m) - 1];
  return nome ? `${nome}/${a}` : mes;
}

/** Data de captura "2026-11-23T20:05:03Z" → "23/11/2026" (calendário de Brasília). */
export function dataBr(iso: string | null | undefined): string {
  if (!iso) return "data não informada";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "data não informada";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(d);
}

/** Valor da PAC, que vem em mil reais, em R$ trilhões ou bilhões. */
export const trilhoes = (milReais: number | null | undefined, casas = 2) => (milReais == null ? SEM_DADO : num(milReais / 1e9, casas));
export const bilhoes = (milReais: number | null | undefined, casas = 1) => (milReais == null ? SEM_DADO : num(milReais / 1e6, casas));
export const milhoesDe = (v: number | null | undefined, casas = 1) => (v == null ? SEM_DADO : num(v / 1e6, casas));

/** Verbo do achado, decidido sobre o valor já arredondado (0,04 com uma casa é estabilidade, não alta). */
export function direcao(v: number | null | undefined, casas = 1): "alta" | "queda" | "estavel" | "ausente" {
  if (v === null || v === undefined || !Number.isFinite(v)) return "ausente";
  const arred = Number(v.toFixed(casas));
  return arred > 0 ? "alta" : arred < 0 ? "queda" : "estavel";
}

export const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);
