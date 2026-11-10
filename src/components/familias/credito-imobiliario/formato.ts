/**
 * Formatação do painel Crédito imobiliário e moradia, sem dependência de servidor: serve à página e às ilhas de cliente (o simulador e
 * a consulta por município). Ausência é sempre texto, nunca zero.
 */
export const SEM_DADO = "sem dado";

export function num(v: number, casas: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).replace(/^-/, "−");
}

export const n0 = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? num(v, 0) : SEM_DADO);
export const pc = (v: number | null | undefined, casas = 1) => (typeof v === "number" && Number.isFinite(v) ? `${num(v, casas)}%` : SEM_DADO);
export const reais0 = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? `R$ ${num(v, 0)}` : SEM_DADO);

/** Valor em reais com a escala por extenso (trilhões, bilhões, milhões); abaixo de um milhão, em reais inteiros. */
export function dinheiro(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return SEM_DADO;
  const a = Math.abs(v);
  const nome = (x: number, casas: number, um: string, muitos: string) => (Number(x.toFixed(casas)) < 2 ? um : muitos);
  if (a >= 1e12) return `R$ ${num(v / 1e12, 2)} ${nome(a / 1e12, 2, "trilhão", "trilhões")}`;
  if (a >= 1e9) return `R$ ${num(v / 1e9, 1)} ${nome(a / 1e9, 1, "bilhão", "bilhões")}`;
  if (a >= 1e6) return `R$ ${num(v / 1e6, 1)} ${nome(a / 1e6, 1, "milhão", "milhões")}`;
  return `R$ ${num(v, 0)}`;
}

export const CONFIABILIDADE: Record<string, string> = { alta: "alta", media: "média", baixa: "baixa", sem_dependencia: "sem dependência bancária" };
