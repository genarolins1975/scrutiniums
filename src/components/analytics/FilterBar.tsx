"use client";

import { useId } from "react";

/**
 * Barra de filtros com selects nativos (navegáveis por teclado) e
 * labels reais associadas via htmlFor.
 */
export type OpcaoFiltro = { valor: string; rotulo: string };

export type FiltroSelect = {
  id: string;
  rotulo: string;
  valor: string;
  opcoes: OpcaoFiltro[];
  onChange: (valor: string) => void;
};

export function FilterBar({ filtros }: { filtros: FiltroSelect[] }) {
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
      {filtros.map((f) => (
        <CampoSelect key={f.id} filtro={f} />
      ))}
    </div>
  );
}

function CampoSelect({ filtro }: { filtro: FiltroSelect }) {
  const autoId = useId();
  const selectId = `${autoId}-${filtro.id}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="rotulo text-carvao-muted">
        {filtro.rotulo}
      </label>
      <select
        id={selectId}
        value={filtro.valor}
        onChange={(e) => filtro.onChange(e.target.value)}
        className="min-h-[44px] min-w-[13rem] border border-linha bg-papel px-3 py-2 text-sm text-carvao focus:border-bronze"
      >
        {filtro.opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}
