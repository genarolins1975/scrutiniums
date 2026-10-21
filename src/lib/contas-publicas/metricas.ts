export type Medida = { valor: number; status: 'calculado' } | { valor: null; status: 'ausente' | 'inelegivel'; motivo: string };
/** Sem imputação: falta de dado, zero e denominador inválido são estados distintos. */
export function razao(n: number | null, d: number | null, escala = 100): Medida {
  if (n === null || d === null) return { valor: null, status: 'ausente', motivo: 'Numerador ou denominador não disponível.' };
  if (![n,d,escala].every(Number.isFinite) || d <= 0) return { valor: null, status: 'inelegivel', motivo: 'Entradas não finitas ou denominador não positivo.' };
  const valor = n / d * escala;
  return Number.isFinite(valor) ? { valor, status: 'calculado' } : {valor:null,status:'inelegivel',motivo:'Resultado fora do intervalo numérico suportado.'};
}
export function desvioPercentual(realizado: number | null, referencia: number | null): Medida {
  return razao(realizado === null || referencia === null ? null : realizado - referencia, referencia);
}
export type Recorte = { perimetro: string; periodo: string; unidade: string; estagio: string; classificacao: string };
export function compararRecortes(a: Recorte, b: Recorte): { comparavel: boolean; divergencias: (keyof Recorte)[] } {
  const campos: (keyof Recorte)[] = ['perimetro','periodo','unidade','estagio','classificacao'];
  const divergencias = campos.filter(c => !a[c].trim() || !b[c].trim() || a[c] !== b[c]);
  return { comparavel: divergencias.length === 0, divergencias };
}
