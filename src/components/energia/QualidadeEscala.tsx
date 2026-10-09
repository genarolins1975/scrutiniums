"use client";

import { useId } from "react";
import type { EscalaPaineis } from "@/lib/energia/series-temporais";

/**
 * Escolha da escala vertical dos pequenos múltiplos: a mesma em todos os painéis (altura igual é valor igual) ou a própria de cada painel
 * (uma distribuidora muito acima das outras não achata as demais; a comparação passa a ser de forma, e os pequenos múltiplos avisam). Serve
 * ao comparador e à ficha do município, que usam a escala comum por padrão.
 */
export function QualidadeEscala({ valor, onMudar }: { valor: EscalaPaineis; onMudar: (e: EscalaPaineis) => void }) {
  const nome = useId();
  const opcoes: { id: EscalaPaineis; rotulo: string }[] = [
    { id: "compartilhada", rotulo: "A mesma em todos os painéis" },
    { id: "livre", rotulo: "Própria de cada painel" },
  ];
  return (
    <div role="radiogroup" aria-label="Escala vertical dos painéis" className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="rotulo text-mineral">Escala vertical</span>
      {opcoes.map((o) => (
        <label key={o.id} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-carvao">
          <input type="radio" name={nome} value={o.id} checked={valor === o.id} onChange={() => onMudar(o.id)} className="h-4 w-4 accent-energia" />
          {o.rotulo}
        </label>
      ))}
    </div>
  );
}
