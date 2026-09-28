import type { Submercado } from "@/lib/energia/tipos";

/**
 * Mapa esquemático dos quatro submercados e das quatro fronteiras monitoradas
 * pelo ONS. Posição aproximada da geografia; espessura da seta proporcional ao
 * fluxo médio do dia; sentido pelo sinal do fluxo. Não é diagrama elétrico:
 * cada fronteira agrega várias linhas de transmissão.
 */
const POS: Record<Submercado, { x: number; y: number; nome: string }> = {
  N: { x: 120, y: 60, nome: "Norte" },
  NE: { x: 420, y: 120, nome: "Nordeste" },
  SE: { x: 280, y: 290, nome: "Sudeste/Centro-Oeste" },
  S: { x: 170, y: 420, nome: "Sul" },
};

export type FluxoFronteira = { de: Submercado; para: Submercado; fluxo: number | null };

function fmt(v: number | null, casas = 0) {
  if (v === null || !Number.isFinite(v)) return "sem dado";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function MapaSubmercados({
  fluxos,
  precos,
  diaFluxo,
  diaPreco,
}: {
  fluxos: FluxoFronteira[];
  precos: Partial<Record<Submercado, number | null>>;
  diaFluxo: string;
  diaPreco: string;
}) {
  const maxF = Math.max(1, ...fluxos.map((f) => Math.abs(f.fluxo ?? 0)));
  const resumo = fluxos
    .map((f) => {
      if (f.fluxo === null) return `${POS[f.de].nome} e ${POS[f.para].nome}: sem dado`;
      const [o, d] = f.fluxo >= 0 ? [f.de, f.para] : [f.para, f.de];
      return `${POS[o].nome} para ${POS[d].nome}: ${fmt(Math.abs(f.fluxo))} MWmed`;
    })
    .join("; ");
  return (
    <figure>
      <svg viewBox="0 0 540 460" className="mx-auto block w-full max-w-xl" role="img" aria-label={`Fluxos médios de ${diaFluxo}: ${resumo}. PLD médio de ${diaPreco}: ${(Object.keys(POS) as Submercado[]).map((s) => `${POS[s].nome} R$ ${fmt(precos[s] ?? null, 2)}`).join(", ")}.`}>
        <defs>
          <marker id="seta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--cor-energia-dark)" />
          </marker>
        </defs>
        {fluxos.map((f) => {
          const a = POS[f.de];
          const b = POS[f.para];
          const v = f.fluxo ?? 0;
          const [o, d] = v >= 0 ? [a, b] : [b, a];
          const larg = 1.5 + 7 * (Math.abs(v) / maxF);
          // encurta para não entrar no nó
          const dx = d.x - o.x;
          const dy = d.y - o.y;
          const len = Math.hypot(dx, dy);
          const ux = dx / len;
          const uy = dy / len;
          const x1 = o.x + ux * 70;
          const y1 = o.y + uy * 34;
          const x2 = d.x - ux * 74;
          const y2 = d.y - uy * 38;
          // rótulo deslocado perpendicularmente à seta para não cobrir a linha
          const mx = (x1 + x2) / 2 - uy * 16;
          const my = (y1 + y2) / 2 + ux * 16;
          return (
            <g key={`${f.de}-${f.para}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--cor-energia-soft)" strokeWidth={larg} strokeLinecap="round" markerEnd={f.fluxo === null ? undefined : "url(#seta)"} opacity={f.fluxo === null ? 0.3 : 0.9} />
              <rect x={mx - 40} y={my - 10} width="80" height="19" fill="var(--cor-superficie)" stroke="var(--cor-linha)" rx="2" />
              <text x={mx} y={my + 3} textAnchor="middle" fontSize="10.5" fill="var(--cor-carvao)" className="tabular-nums">
                {f.fluxo === null ? "sem dado" : `${fmt(Math.abs(v))} MWmed`}
              </text>
            </g>
          );
        })}
        {(Object.keys(POS) as Submercado[]).map((s) => {
          const p = POS[s];
          return (
            <g key={s}>
              <rect x={p.x - 66} y={p.y - 28} width="132" height="56" fill="var(--cor-superficie)" stroke="var(--cor-carvao)" strokeWidth="1" rx="3" />
              <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="11" fill="var(--cor-mineral)">
                {p.nome.length > 14 ? "Sudeste/C.-Oeste" : p.nome}
              </text>
              <text x={p.x} y={p.y + 12} textAnchor="middle" fontSize="15" fill="var(--cor-carvao)" fontWeight="600" className="tabular-nums">
                R$ {fmt(precos[s] ?? null, 2)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-center text-xs text-mineral">
        Caixas: PLD médio de {diaPreco} (R$/MWh). Setas: sentido e fluxo médio verificado entre subsistemas em {diaFluxo}. Esquema sem escala geográfica.
      </figcaption>
    </figure>
  );
}
