/** Formatação do painel Educação nos municípios: padrão brasileiro, sinal de menos tipográfico, ausência dita em palavras. */

export const SEM_DADO = "Sem dado";

const ok = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** Número com casas fixas; null vira "Sem dado". */
export function num(v: number | null | undefined, casas = 0): string {
  if (!ok(v)) return SEM_DADO;
  const r = Number(v.toFixed(casas));
  return (Object.is(r, -0) ? 0 : r).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).replace("-", "−");
}

/** Ideb com a casa que o INEP publica ("6,1"). */
export const ideb = (v: number | null | undefined) => num(v, 1);

export const pct = (v: number | null | undefined, casas = 1) => (ok(v) ? `${num(v, casas)}%` : SEM_DADO);

/** Diferença com sinal ("+0,3", "−0,2", "0,0"). */
export function comSinal(v: number | null | undefined, casas = 1): string {
  if (!ok(v)) return SEM_DADO;
  const r = Number(v.toFixed(casas));
  return `${r > 0 ? "+" : ""}${num(r, casas)}`;
}

/** Quantidade grande em milhões ("23,06 milhões"). */
export const milhoes = (v: number | null | undefined, casas = 2) => (ok(v) ? `${num(v / 1e6, casas)} milhões` : SEM_DADO);

/** "2026-10-20T12:21:04Z" ou "2026-08-05" → "20/10/2026". */
export function dataBr(d: string | null | undefined): string {
  if (!d || !/^\d{4}-\d{2}-\d{2}/.test(d)) return "data não informada";
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

/** Divisão protegida: null quando falta um dos lados ou o denominador é zero. */
export const razao = (a: number | null | undefined, b: number | null | undefined) => (ok(a) && ok(b) && b !== 0 ? a / b : null);

/** Parte, em %, de um número no total. */
export const parte = (a: number | null | undefined, total: number | null | undefined) => {
  const x = razao(a, total);
  return x === null ? null : 100 * x;
};
