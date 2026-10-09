import type { ReactNode } from "react";

/**
 * Legenda de recorte de uma figura de Água e clima: período, universo e unidade em três colunas, logo abaixo da figura que descrevem
 * (o recorte como legenda, e não como bloco antes dela). Sem estado: serve às figuras que são componentes de cliente e às páginas.
 * O atributo `data-recorte-painel` é o mesmo que a abertura do módulo usa.
 */
export function AguaLegenda({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
      <div>
        <dt className="rotulo text-mineral">Período</dt>
        <dd className="mt-0.5">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Universo</dt>
        <dd className="mt-0.5">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Unidade</dt>
        <dd className="mt-0.5">{unidade}</dd>
      </div>
    </dl>
  );
}
