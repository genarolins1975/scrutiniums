export type Resultado = { valor: number | null; estado: "CALCULADO_EXPERIMENTAL" | "COBERTURA_INSUFICIENTE" | "REFERENCIA_PENDENTE" | "RECORTE_INCOMPATIVEL"; territorio?: string; periodo?: string; edicao?: string };
export const CESTA_V03 = ["education", "health", "work", "food"] as const;
export const CESTA = [...CESTA_V03, "assistance"] as const;
function geometrica(valores: (number | null)[]): Resultado {
  if (valores.some(v => v === null)) return { valor: null, estado: "COBERTURA_INSUFICIENTE" };
  if (valores.some(v => !Number.isFinite(v) || v! < 0 || v! > 100)) throw new Error("Valor fora da escala");
  return { valor: valores.includes(0) ? 0 : Math.exp(valores.reduce<number>((s, v) => s + Math.log(v!), 0) / valores.length), estado: "CALCULADO_EXPERIMENTAL" };
}
export function normaliza(valor: number | null, referencia: { validada: boolean; inferior: number; superior: number; sentido: "maior" | "menor" }): number | null {
  if (valor === null || !referencia.validada) return null;
  if (!Number.isFinite(valor) || !Number.isFinite(referencia.inferior) || !Number.isFinite(referencia.superior) || referencia.superior <= referencia.inferior) throw new Error("Referência inválida");
  const z = 100 * (valor - referencia.inferior) / (referencia.superior - referencia.inferior);
  return Math.max(0, Math.min(100, referencia.sentido === "maior" ? z : 100 - z));
}
export function escoreCapitulo(pilares: { acesso: number | null; resposta: number | null; qualidade: number | null }, validado: boolean, contexto?: Pick<Resultado,"territorio"|"periodo"|"edicao">): Resultado {
  const r = geometrica([pilares.acesso, pilares.resposta, pilares.qualidade]);
  if (r.valor === null) return r;
  return validado ? { ...r, ...contexto } : { valor: null, estado: "REFERENCIA_PENDENTE" };
}
export function escoreAgregado(cap: Partial<Record<typeof CESTA[number], Resultado>>, edicao: string, validado: boolean): Resultado {
  const registros = CESTA.map(id => cap[id]);
  if (registros.some(r => !r || r.valor === null)) return { valor: null, estado: "COBERTURA_INSUFICIENTE" };
  if (!validado || registros.some(r => r!.estado !== "CALCULADO_EXPERIMENTAL")) return { valor: null, estado: "REFERENCIA_PENDENTE" };
  const a = registros[0]!;
  if (registros.some(r => !r!.territorio || !r!.periodo || r!.edicao !== edicao || r!.territorio !== a.territorio || r!.periodo !== a.periodo)) return { valor: null, estado: "RECORTE_INCOMPATIVEL" };
  return { ...geometrica(registros.map(r => r!.valor)), territorio: a.territorio, periodo: a.periodo, edicao };
}
