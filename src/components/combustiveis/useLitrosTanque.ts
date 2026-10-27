"use client";

import { useEstadoUrl } from "@/components/painel/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/painel/estadoUrl";

const numero = tiposUrl.numero();
const ESQUEMA = {
  // Vazio ou adulterado continua sem cálculo: nunca vira tanque padrão ou zero.
  litros: campo({ ler: (v: string) => numero.ler(v) ?? Number.NaN, escrever: (v: number) => Number.isFinite(v) ? String(v) : "" }, 40, { historico: "replace" }),
};

/** A entrada e a consulta detalhada compartilham o mesmo contrato e as ilhas se avisam. */
export function useLitrosTanque(): [number, (v: number) => void] {
  const [v, definir] = useEstadoUrl(ESQUEMA, { atraso: 0 });
  return [v.litros, (litros) => definir({ litros })];
}
