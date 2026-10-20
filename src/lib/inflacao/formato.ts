/**
 * Formatação do painel de inflação, em português do Brasil e sem depender do idioma da página (o painel não tem versão
 * inglesa). Ausência vira "sem dado", nunca zero; o sinal de menos é o tipográfico. Variação é percentual (%); diferença
 * entre duas variações e contribuição para o índice são pontos percentuais (p.p.), nunca "%".
 */
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const SEM_DADO = "sem dado";

export function num(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return SEM_DADO;
  const t = Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  return v < 0 && Number(t.replace(/\./g, "").replace(",", ".")) !== 0 ? `−${t}` : t;
}

/** "4,58%" */
export function pct(v: number | null | undefined, casas = 2): string {
  const n = num(v, casas);
  return n === SEM_DADO ? n : `${n}%`;
}

/** "+0,62%" ou "−0,40%": variação com sinal explícito. */
export function pctSinal(v: number | null | undefined, casas = 2): string {
  const n = num(v, casas);
  if (n === SEM_DADO) return n;
  return v! > 0 && !/^0,0*$/.test(n) ? `+${n}%` : `${n}%`;
}

/** "0,57 p.p." com sinal explícito quando pedido. */
export function pp(v: number | null | undefined, casas = 2, comSinal = false): string {
  const n = num(v, casas);
  if (n === SEM_DADO) return n;
  return `${comSinal && v! > 0 && !/^0,0*$/.test(n) ? "+" : ""}${n} p.p.`;
}

/** "0,57 ponto percentual acima do Brasil", por extenso, para a frase da primeira tela. */
export function distanciaBrasil(dif: number | null | undefined): string {
  if (dif === null || dif === undefined || !Number.isFinite(dif)) return SEM_DADO;
  if (Math.abs(dif) < 0.005) return "igual à do Brasil";
  const a = Math.abs(dif);
  return `${num(a, 2)} ${a >= 1.995 ? "pontos percentuais" : "ponto percentual"} ${dif > 0 ? "acima" : "abaixo"} da do Brasil`;
}

/** "2026-09" → "setembro de 2026". */
export function mesExtenso(m: string | null | undefined): string {
  if (!m || !/^\d{4}-\d{2}/.test(m)) return SEM_DADO;
  return `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;
}

/** "2026-09" → "set/2026". */
export function mesAno(m: string | null | undefined): string {
  if (!m || !/^\d{4}-\d{2}/.test(m)) return SEM_DADO;
  return `${CURTOS[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}`;
}

/** "2026-10-09" → "09/10/2026"; carimbo ISO com hora vira a data em Brasília. */
export function dataBr(iso: string | null | undefined): string {
  if (!iso) return SEM_DADO;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.split("-").reverse().join("/");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return SEM_DADO;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "+R$ 1,08" ou "−R$ 0,10": diferença em reais com sinal explícito. */
export function reaisSinal(v: number | null | undefined, casas = 2): string {
  const n = num(v === null || v === undefined ? v : Math.abs(v), casas);
  if (n === SEM_DADO) return n;
  if (/^0,0*$/.test(n)) return `R$ ${n}`;
  return `${v! > 0 ? "+" : "−"}R$ ${n}`;
}

/** "R$ 21,61" */
export function reais(v: number | null | undefined, casas = 2): string {
  const n = num(v, casas);
  return n === SEM_DADO ? n : `R$ ${n}`;
}
