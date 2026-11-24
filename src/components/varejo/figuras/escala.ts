/**
 * Escala de cor das figuras do Varejo. Uma só, divergente, para toda variação (mosaico das atividades, mapa de blocos dos estados):
 * queda em sépia, alta no azul da coleção, centro neutro. Os tons são tokens de src/app/globals.css (`--escala-varejo-*`); aqui só
 * mora a regra que leva um valor a um passo, para o mosaico, o mapa e a legenda nunca divergirem. Cor não é julgamento: a legenda
 * diz sempre o que cada lado significa, e todo bloco colorido traz o valor em texto ou na tabela equivalente.
 */
export const PASSOS = ["neg-3", "neg-2", "neg-1", "centro", "pos-1", "pos-2", "pos-3"] as const;
export type Passo = (typeof PASSOS)[number];

export const corDoPasso = (p: Passo): string => `var(--escala-varejo-${p})`;

/** Tinta legível sobre o passo: papel nos dois extremos, carvão nos demais (contraste de 4,6:1 ou mais em todos). */
export const tintaDoPasso = (p: Passo): string => (p === "neg-3" || p === "pos-3" ? "var(--cor-papel)" : "var(--cor-carvao)");

/**
 * Passo de um valor: zero (já arredondado a uma casa) é o centro; de cada lado, três faixas iguais até o limite, e acima dele a cor
 * satura no último passo. Ausência não tem passo (null): o desenho mostra o estado "sem valor publicado", nunca o centro.
 */
export function passoDivergente(valor: number | null | undefined, limite: number): Passo | null {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return null;
  const r = Number(valor.toFixed(1));
  if (r === 0) return "centro";
  const t = Math.abs(r) / (limite > 0 ? limite : 1);
  const n = t <= 1 / 3 ? 1 : t <= 2 / 3 ? 2 : 3;
  return `${r > 0 ? "pos" : "neg"}-${n}` as Passo;
}

/** Os seis cortes da legenda, do mais negativo ao mais positivo, para um limite: −L, −2L/3, −L/3, +L/3, +2L/3, +L. */
export function cortesDaEscala(limite: number): number[] {
  return [-1, -2 / 3, -1 / 3, 1 / 3, 2 / 3, 1].map((f) => Number((f * limite).toFixed(1)));
}

/** Limite simétrico de uma coleção de valores: o maior valor absoluto, arredondado para cima no degrau (padrão: 1 ponto). */
export function limiteSimetrico(valores: readonly (number | null)[], degrau = 1): number {
  const m = Math.max(0, ...valores.filter((x): x is number => x !== null).map(Math.abs));
  return Math.max(degrau, Math.ceil(m / degrau) * degrau);
}

/** Cores fixas das partes do cupom de R$ 100, usadas também pelos comparativos de companhias: neutros para o que sai, o azul da coleção só no que sobra. */
export const COR_DA_PARTE = {
  custo: "var(--serie-4)",
  despesas: "var(--serie-2)",
  financeiro: "var(--serie-3)",
  impostos: "var(--serie-5)",
  outros: "var(--serie-6)",
  lucro: "var(--cor-gas)",
} as const;

/** As duas séries da coleção: volume (crescimento real) no azul, receita nominal no neutro de referência. */
export const COR_VOLUME = "var(--cor-gas)";
export const COR_RECEITA = "var(--serie-referencia)";
