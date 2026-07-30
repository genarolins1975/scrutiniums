/**
 * Amostra sóbria de painel analítico construída em HTML/SVG.
 * Ilustra o formato dos resultados: título, série temporal,
 * fontes, critérios, período de referência e limitações.
 */
export function AmostraPainel() {
  return (
    <figure className="border border-linha bg-papel">
      <div className="flex items-baseline justify-between gap-4 border-b border-linha px-5 py-4">
        <p className="rotulo text-mineral">Painel analítico · amostra</p>
        <p className="rotulo text-bronze">Série mensal</p>
      </div>
      <div className="px-5 pt-5">
        <p className="font-serif text-lg text-carvao">Concentração setorial de crédito</p>
        <p className="mt-1 text-xs text-mineral">
          Índice normalizado (base 100) · duas séries comparadas
        </p>
      </div>
      <svg
        viewBox="0 0 420 190"
        className="mt-4 w-full"
        role="img"
        aria-label="Gráfico de linhas de exemplo com duas séries mensais e eixos de referência"
      >
        {/* Linhas de grade finas */}
        <g stroke="var(--cor-linha)" strokeWidth="1">
          <line x1="40" y1="20" x2="400" y2="20" />
          <line x1="40" y1="60" x2="400" y2="60" />
          <line x1="40" y1="100" x2="400" y2="100" />
          <line x1="40" y1="140" x2="400" y2="140" />
        </g>
        {/* Eixos */}
        <g stroke="var(--cor-mineral)" strokeWidth="1">
          <line x1="40" y1="12" x2="40" y2="150" />
          <line x1="40" y1="150" x2="400" y2="150" />
        </g>
        {/* Rótulos do eixo Y */}
        <g fill="var(--cor-mineral)" fontSize="9" fontFamily="var(--font-sans), sans-serif">
          <text x="34" y="23" textAnchor="end">140</text>
          <text x="34" y="63" textAnchor="end">120</text>
          <text x="34" y="103" textAnchor="end">100</text>
          <text x="34" y="143" textAnchor="end">80</text>
        </g>
        {/* Rótulos do eixo X */}
        <g fill="var(--cor-mineral)" fontSize="9" fontFamily="var(--font-sans), sans-serif">
          <text x="40" y="164">jan</text>
          <text x="130" y="164">abr</text>
          <text x="220" y="164">jul</text>
          <text x="310" y="164">out</text>
          <text x="392" y="164">dez</text>
        </g>
        {/* Série 1: carvão */}
        <polyline
          points="40,118 76,110 112,114 148,98 184,92 220,96 256,80 292,74 328,66 364,60 400,52"
          fill="none"
          stroke="var(--serie-1)"
          strokeWidth="1.5"
        />
        {/* Série 2: bronze */}
        <polyline
          points="40,128 76,126 112,120 148,122 184,112 220,108 256,110 292,100 328,96 364,90 400,86"
          fill="none"
          stroke="var(--serie-3)"
          strokeWidth="1.5"
        />
      </svg>
      <div className="flex flex-wrap gap-x-6 gap-y-1 px-5 pb-2 pt-1 text-xs text-carvao-muted">
        <span className="flex items-center gap-2">
          <span className="inline-block h-px w-5 bg-carvao" aria-hidden="true" />
          Segmento A
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-px w-5 bg-bronze" aria-hidden="true" />
          Segmento B
        </span>
      </div>
      <figcaption className="border-t border-linha px-5 py-3 text-xs text-mineral">
        Fontes: bases públicas e registros oficiais · Critérios e limitações publicados na
        metodologia · Período de referência: últimos 12 meses
      </figcaption>
    </figure>
  );
}
