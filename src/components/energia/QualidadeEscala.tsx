"use client";

import { useId } from "react";
import type { EscalaPaineis } from "@/lib/energia/series-temporais";
import { useTx } from "@/lib/energia/useIdioma";

/**
 * Escolha da escala vertical dos pequenos múltiplos: a mesma em todos os painéis (altura igual é valor igual) ou a própria de cada painel
 * (uma distribuidora muito acima das outras não achata as demais; a comparação passa a ser de forma, e os pequenos múltiplos avisam). Serve
 * ao comparador e à ficha do município, que usam a escala comum por padrão.
 */
export function QualidadeEscala({ valor, onMudar }: { valor: EscalaPaineis; onMudar: (e: EscalaPaineis) => void }) {
  const nome = useId();
  const tx = useTx();
  const opcoes: { id: EscalaPaineis; rotulo: string }[] = [
    { id: "compartilhada", rotulo: tx("A mesma em todos os painéis", "The same in all panels") },
    { id: "livre", rotulo: tx("Própria de cada painel", "Each panel's own") },
  ];
  return (
    <div role="radiogroup" aria-label={tx("Escala vertical dos painéis", "Vertical scale of the panels")} className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="rotulo text-mineral">{tx("Escala vertical", "Vertical scale")}</span>
      {opcoes.map((o) => (
        <label key={o.id} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-carvao">
          <input type="radio" name={nome} value={o.id} checked={valor === o.id} onChange={() => onMudar(o.id)} className="h-4 w-4 accent-energia" />
          {o.rotulo}
        </label>
      ))}
    </div>
  );
}
