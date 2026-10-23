/**
 * Valor de um NumeroIndicador a partir de um número que pode faltar: presente, só o valor; ausente (null, indefinido ou não finito),
 * o null com o motivo, que o tipo exige. Ausência nunca vira zero.
 */
export function valorOuAusencia(valor: number | null | undefined, motivo: string): { valor: number } | { valor: null; motivoAusencia: string } {
  return typeof valor === "number" && Number.isFinite(valor) ? { valor } : { valor: null, motivoAusencia: motivo };
}
