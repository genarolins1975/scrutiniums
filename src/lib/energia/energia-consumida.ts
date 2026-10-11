/** Conversão dimensional, sem modelo do SIN ou hipótese de preço. */
export function energiaConsumida(watts: number, horas: number, dias: number): number | null {
  if (![watts, horas, dias].every(Number.isFinite) || watts < 0 || horas < 0 || horas > 24 || dias < 0) return null;
  return watts / 1000 * horas * dias;
}
