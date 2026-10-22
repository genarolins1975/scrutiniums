/** Valores em reais, escritos à brasileira: bilhões com uma casa, milhões sem casa abaixo de R$ 1 bilhão. */
export function reaisCurto(valor: number): string {
  const v = Math.abs(valor);
  const sinal = valor < 0 ? '−' : '';
  if (v >= 1e9) return `${sinal}R$ ${(v / 1e9).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bi`;
  if (v >= 1e6) return `${sinal}R$ ${Math.round(v / 1e6).toLocaleString('pt-BR')} mi`;
  return `${sinal}R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

/** Milhões com uma casa, para as tabelas de conferência. */
export function milhoes(valor: number): string {
  return (valor / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function parcela(valor: number, total: number): string {
  if (!(total > 0)) return '';
  const p = (100 * valor) / total;
  return `${p < 1 && p > 0 ? p.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : Math.round(p).toLocaleString('pt-BR')}%`;
}
