/**
 * Transformações de exibição declaradas nas páginas (natureza CALCULADO):
 * nunca substituem o dado, só o acompanham; a série original fica na tabela.
 */

/** Média móvel de n pontos até cada data; só devolve valor quando a janela está completa e sem lacuna. */
export function mediaMovel(valores: (number | null)[], n = 7): (number | null)[] {
  return valores.map((_, i) => {
    if (i < n - 1) return null;
    const janela = valores.slice(i - n + 1, i + 1);
    if (janela.some((v) => v === null || v === undefined || !Number.isFinite(v))) return null;
    return (janela as number[]).reduce((a, b) => a + b, 0) / n;
  });
}
