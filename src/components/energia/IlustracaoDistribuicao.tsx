/**
 * Ilustração conceitual (sem dados) de como uma previsão probabilística é
 * mostrada: mediana, faixas P25 a P75 e P10 a P90 que se abrem com o horizonte.
 * Não há números nem escala: é material didático, marcado como tal.
 */
export function IlustracaoDistribuicao() {
  // viewBox estreito: no celular a escala fica perto de 1 e o texto, legível (12 px)
  const w = 380;
  const h = 240;
  const x0 = 16;
  const xh = 150;
  const x1 = w - 72;
  const yc = 128;
  const leque = (a: number) => `M${xh},${yc} L${x1},${yc - a} L${x1},${yc + a * 0.8} Z`;
  return (
    <figure className="border border-dashed border-mineral bg-papel p-4">
      <svg viewBox={`0 0 ${w} ${h}`} className="block w-full" role="img" aria-label="Ilustração conceitual sem dados: o passado aparece como uma linha única; o futuro aparece como uma mediana com duas faixas de incerteza que se abrem com o horizonte.">
        <line x1={x0} y1={h - 30} x2={x1} y2={h - 30} stroke="var(--cor-mineral-soft)" />
        <line x1={xh} y1={20} x2={xh} y2={h - 30} stroke="var(--cor-mineral)" strokeDasharray="3 3" />
        <text x={xh - 6} y={30} textAnchor="end" fontSize="12" fill="var(--cor-mineral)">realizado</text>
        <text x={xh + 6} y={30} fontSize="12" fill="var(--cor-mineral)">futuro</text>
        <path d={`M${x0},${yc + 20} C${x0 + 60},${yc - 10} ${x0 + 110},${yc + 30} ${xh},${yc}`} fill="none" stroke="var(--cor-carvao)" strokeWidth="2" />
        <path d={leque(70)} fill="var(--cor-previsto)" fillOpacity="0.14" />
        <path d={leque(36)} fill="var(--cor-previsto)" fillOpacity="0.26" />
        <line x1={xh} y1={yc} x2={x1} y2={yc - 6} stroke="var(--cor-previsto)" strokeWidth="2" strokeDasharray="6 4" />
        <text x={x1 + 4} y={yc - 70} fontSize="12" fill="var(--cor-carvao)">P90</text>
        <text x={x1 + 4} y={yc - 34} fontSize="12" fill="var(--cor-carvao)">P75</text>
        <text x={x1 + 4} y={yc - 2} fontSize="12" fill="var(--cor-carvao)">mediana</text>
        <text x={x1 + 4} y={yc + 34} fontSize="12" fill="var(--cor-carvao)">P25</text>
        <text x={x1 + 4} y={yc + 60} fontSize="12" fill="var(--cor-carvao)">P10</text>
        <text x={(xh + x1) / 2} y={h - 12} textAnchor="middle" fontSize="12" fill="var(--cor-mineral)">horizonte da previsão</text>
      </svg>
      <figcaption className="mt-2 text-xs text-mineral">
        Ilustração conceitual, sem dados e sem escala. Mostra o formato em que uma previsão aparecerá: a mediana e faixas que se
        abrem com o horizonte. Uma faixa só é chamada de &quot;80%&quot; quando a cobertura observada no passado sustentar isso.
      </figcaption>
    </figure>
  );
}
