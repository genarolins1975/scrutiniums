/**
 * Pares de comparação: municípios da mesma região e da mesma classe de
 * porte populacional (moradores do Censo 2022). Critério declarado na
 * interface; não substitui seleção por densidade, renda ou condição de
 * abastecimento, que ficam para quando houver dados compatíveis.
 */
export const LIMITES_PORTE = [5_000, 10_000, 20_000, 50_000, 100_000, 500_000] as const;

export const ROTULO_PORTE: Record<number, string> = {
  0: "até 5 mil moradores",
  1: "5 mil a menos de 10 mil moradores",
  2: "10 mil a menos de 20 mil moradores",
  3: "20 mil a menos de 50 mil moradores",
  4: "50 mil a menos de 100 mil moradores",
  5: "100 mil a menos de 500 mil moradores",
  6: "500 mil moradores ou mais",
};

export function classePorte(pop: number | null | undefined): number | null {
  if (pop == null) return null;
  let i = 0;
  while (i < LIMITES_PORTE.length && pop >= LIMITES_PORTE[i]) i++;
  return i;
}

export function mediana(vs: readonly number[]): number | null {
  if (!vs.length) return null;
  const o = [...vs].sort((a, b) => a - b);
  const k = o.length >> 1;
  return o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2;
}
