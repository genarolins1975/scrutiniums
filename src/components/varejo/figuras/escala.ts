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

/** Fundo de cada segmento do ranking nas figuras dos grupos (mapa de blocos, dispersão): tons claros de token, com carvão por cima. */
const SEGMENTOS_COM_COR = ["alimentar", "farmacia-beleza", "departamento", "eletromoveis", "moda", "digital", "foodservice", "construcao"];
export const corDoSegmento = (slug: string | null | undefined): string => `var(--segmento-varejo-${slug && SEGMENTOS_COM_COR.includes(slug) ? slug : "outros"})`;

/** Hachura de estimativa da fonte e de prejuízo: a mesma do cupom, em papel sobre a cor da marca. A leitura nunca depende só dela: o texto diz "estimado". */
export const HACHURA = "repeating-linear-gradient(135deg, var(--cor-papel) 0 2px, transparent 2px 5px)";
/** Hachura de ausência sobre o fundo da página (estado "não divulgado", "sem dado"). */
export const HACHURA_AUSENCIA = "repeating-linear-gradient(135deg, var(--cor-mineral-soft) 0 1px, transparent 1px 4px)";

/** Subida e descida de posição ou de valor entre dois períodos: o azul e o sépia da escala divergente; parado, o neutro de referência. */
export const COR_SUBIU = "var(--cor-gas)";
export const COR_DESCEU = "var(--escala-varejo-neg-2)";
export const COR_PARADO = "var(--serie-referencia)";
