/** Formatação do painel Previdência e INSS: padrão brasileiro, sinal de menos tipográfico, ausência dita em palavras. */

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const SEM_DADO = "Sem dado";

const ok = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** Número com casas fixas; null vira "Sem dado". */
export function num(v: number | null | undefined, casas = 0): string {
  if (!ok(v)) return SEM_DADO;
  const r = Number(v.toFixed(casas));
  return (Object.is(r, -0) ? 0 : r).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).replace("-", "−");
}

/** R$ com centavos (valor médio de um benefício); espaço inseparável entre o símbolo e o número. */
export const reais = (v: number | null | undefined, casas = 2) => (ok(v) ? `R$\u00a0${num(v, casas)}` : SEM_DADO);

/** Quantidade grande em milhões, com uma ou duas casas ("42,66 milhões"; abaixo de dois, "1,47 milhão"). */
export const milhoes = (v: number | null | undefined, casas = 2) => (ok(v) ? `${num(v / 1e6, casas)} ${Math.abs(v) < 2e6 ? "milhão" : "milhões"}` : SEM_DADO);

/** Valor em R$ milhões (RTN) em bilhões ou trilhões, com o sinal de menos quando negativo. */
export function bilhoesDeMilhoes(v: number | null | undefined, casas = 1): string {
  if (!ok(v)) return SEM_DADO;
  const a = Math.abs(v);
  if (a >= 1e6) return `R$\u00a0${num(v / 1e6, 2)} ${a >= 2e6 ? "trilhões" : "trilhão"}`;
  return `R$\u00a0${num(v / 1e3, casas)} bilhões`;
}

/** Valor em R$ mil (AEPS) em bilhões, com uma casa; abaixo de R$ 1 bilhão, em milhões. */
export function bilhoesDeMil(v: number | null | undefined, casas = 1): string {
  if (!ok(v)) return SEM_DADO;
  if (Math.abs(v) < 1e6) return `R$\u00a0${num(v / 1e3, 0)} milhões`;
  return `R$\u00a0${num(v / 1e6, casas)} bilhões`;
}

/** Variação percentual com sinal ("+33,1%", "−5,2%"); null quando falta a base. */
export function variacao(atual: number | null | undefined, base: number | null | undefined, casas = 1): string {
  if (!ok(atual) || !ok(base) || base === 0) return SEM_DADO;
  const x = 100 * (atual / base - 1);
  const r = Number(x.toFixed(casas));
  return `${r > 0 ? "+" : ""}${num(x, casas)}%`;
}

/** Valor em reais em bilhões ("R$ 74,2 bilhões") ou milhões, para totais do mês. */
export function reaisGrandes(v: number | null | undefined): string {
  if (!ok(v)) return SEM_DADO;
  const a = Math.abs(v);
  if (a >= 1e9) return `R$\u00a0${num(v / 1e9, 1)} bilhões`;
  if (a >= 1e6) return `R$\u00a0${num(v / 1e6, 1)} milhões`;
  return `R$\u00a0${num(v, 0)}`;
}

export const pct = (v: number | null | undefined, casas = 1) => (ok(v) ? `${num(v, casas)}%` : SEM_DADO);

/** "2026-08" → "agosto de 2026". */
export function mesExtenso(m: string | null | undefined): string {
  if (!m || !/^\d{4}-\d{2}/.test(m)) return "mês não informado";
  return `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;
}

/** "2026-08" → "ago/2026". */
export function mesCurto(m: string | null | undefined): string {
  if (!m || !/^\d{4}-\d{2}/.test(m)) return "mês não informado";
  return `${MESES_CURTOS[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}`;
}

/** "2026-10-20T12:21:04Z" ou "2026-08-27" → "20/10/2026". */
export function dataBr(d: string | null | undefined): string {
  if (!d || !/^\d{4}-\d{2}-\d{2}/.test(d)) return "data não informada";
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

/** Divisão protegida: null quando falta um dos lados ou o denominador é zero. */
export const razao = (a: number | null | undefined, b: number | null | undefined) => (ok(a) && ok(b) && b !== 0 ? a / b : null);
