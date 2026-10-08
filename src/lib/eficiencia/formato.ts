/**
 * Formatação numérica em português brasileiro para o OBEE. Toda unidade sai
 * por extenso ou com símbolo explícito; nenhum valor sai sem unidade.
 */

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: min, maximumFractionDigits: max });

const INT = nf(0, 0);
const D1 = nf(1, 1);
const D2 = nf(2, 2);

export function inteiro(v: number): string {
  return INT.format(v);
}

export function decimal(v: number, casas = 1): string {
  return casas === 2 ? D2.format(v) : casas === 0 ? INT.format(v) : D1.format(v);
}

/** Reais com escala por extenso: R$ 566,4 milhões; R$ 23,58 bilhões. */
export function reaisExtenso(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `R$ ${D2.format(v / 1e9)} bilhões`;
  if (a >= 1e6) return `R$ ${D1.format(v / 1e6)} milhões`;
  if (a >= 1e3) return `R$ ${D1.format(v / 1e3)} mil`;
  return `R$ ${D2.format(v)}`;
}

/** Reais curtos para eixo e rótulo de gráfico: R$ 1,2 bi; R$ 566 mi. */
export function reaisCurto(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `R$ ${nf(0, 1).format(v / 1e9)} bi`;
  if (a >= 1e6) return `R$ ${INT.format(v / 1e6)} mi`;
  if (a >= 1e3) return `R$ ${INT.format(v / 1e3)} mil`;
  return `R$ ${INT.format(v)}`;
}

export function reaisCompleto(v: number): string {
  return `R$ ${D2.format(v)}`;
}

export function percentual(v: number, casas = 1): string {
  return `${decimal(v, casas)}%`;
}

/** Contagem com rótulo no singular ou plural. */
export function contagem(v: number, singular: string, plural: string): string {
  return `${INT.format(v)} ${v === 1 ? singular : plural}`;
}

/** Data ISO (com ou sem hora) para dd/mm/aaaa. */
export function dataBr(iso: string | null | undefined): string {
  if (!iso) return "não informada";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return d ? `${d}/${m}/${a}` : iso;
}
