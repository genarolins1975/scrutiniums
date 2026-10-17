import type { Submercado } from "@/lib/energia/tipos";
import { nomeSubmercado } from "@/lib/energia/formato";
import { idiomaEnergia, tx as txBase } from "@/lib/energia/idioma";
import type { Idioma } from "@/lib/idioma";

/**
 * Mapa esquemático dos quatro submercados e das quatro fronteiras monitoradas
 * pelo ONS. Posição aproximada da geografia; espessura da seta proporcional ao
 * fluxo médio do dia; sentido pelo sinal do fluxo. Não é diagrama elétrico:
 * cada fronteira agrega várias linhas de transmissão.
 */
const XY: Record<Submercado, { x: number; y: number }> = {
  N: { x: 120, y: 60 },
  NE: { x: 420, y: 120 },
  SE: { x: 280, y: 290 },
  S: { x: 170, y: 420 },
};

export type FluxoFronteira = { de: Submercado; para: Submercado; fluxo: number | null };

/**
 * Componente usado no servidor (página PLD) e dentro de componente de cliente (diferenças regionais): o idioma vem por propriedade
 * quando quem chama é de cliente; sem ela, vale o da página no servidor.
 */
export function MapaSubmercados({
  fluxos,
  precos,
  diaFluxo,
  diaPreco,
  idioma = idiomaEnergia(),
}: {
  fluxos: FluxoFronteira[];
  precos: Partial<Record<Submercado, number | null>>;
  diaFluxo: string;
  diaPreco: string;
  idioma?: Idioma;
}) {
  const tx = <T,>(pt: T, en: T): T => txBase(pt, en, idioma);
  const POS = Object.fromEntries((Object.keys(XY) as Submercado[]).map((s) => [s, { ...XY[s], nome: nomeSubmercado(s, idioma) }])) as Record<Submercado, { x: number; y: number; nome: string }>;
  const semDado = tx("sem dado", "no data");
  const mw = tx("MWmed", "MWavg");
  const fmt = (v: number | null, casas = 0) => {
    if (v === null || !Number.isFinite(v)) return semDado;
    return v.toLocaleString(idioma === "en" ? "en-US" : "pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  };
  const maxF = Math.max(1, ...fluxos.map((f) => Math.abs(f.fluxo ?? 0)));
  const resumo = fluxos
    .map((f) => {
      if (f.fluxo === null) return tx(`${POS[f.de].nome} e ${POS[f.para].nome}: sem dado`, `${POS[f.de].nome} and ${POS[f.para].nome}: no data`);
      const [o, d] = f.fluxo >= 0 ? [f.de, f.para] : [f.para, f.de];
      return tx(`${POS[o].nome} para ${POS[d].nome}: ${fmt(Math.abs(f.fluxo))} MWmed`, `${POS[o].nome} to ${POS[d].nome}: ${fmt(Math.abs(f.fluxo))} MWavg`);
    })
    .join("; ");
  return (
    <figure>
      {/* no celular o esquema em SVG ficaria com texto de 6 a 9 px: vira lista legível */}
      <div className="sm:hidden">
        <ul className="grid grid-cols-2 gap-2" aria-label={tx(`PLD médio de ${diaPreco}, R$/MWh`, `Average PLD for ${diaPreco}, R$/MWh`)}>
          {(["N", "NE", "SE", "S"] as Submercado[]).map((sm) => (
            <li key={sm} className="border border-carvao/80 bg-superficie p-3">
              <p className="text-xs text-mineral">{POS[sm].nome}</p>
              <p className="mt-1 whitespace-nowrap font-serif text-lg tabular-nums text-carvao">R$&nbsp;{fmt(precos[sm] ?? null, 2)}</p>
            </li>
          ))}
        </ul>
        <ul className="mt-3 space-y-1.5 text-sm text-carvao" aria-label={tx(`Fluxos médios de ${diaFluxo}`, `Average flows for ${diaFluxo}`)}>
          {fluxos.map((f) => {
            if (f.fluxo === null) {
              return (
                <li key={`${f.de}${f.para}`} className="text-mineral">
                  {tx(`${POS[f.de].nome} e ${POS[f.para].nome}: sem dado`, `${POS[f.de].nome} and ${POS[f.para].nome}: no data`)}
                </li>
              );
            }
            const [o, d] = f.fluxo >= 0 ? [f.de, f.para] : [f.para, f.de];
            return (
              <li key={`${f.de}${f.para}`} className="flex items-baseline justify-between gap-3 border-b border-linha pb-1.5">
                <span>
                  {POS[o].nome} <span aria-hidden="true">→</span>
                  <span className="sr-only">{tx("para", "to")}</span> {POS[d].nome}
                </span>
                <span className="whitespace-nowrap tabular-nums">
                  {fmt(Math.abs(f.fluxo))} {mw}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <svg
        viewBox="0 0 540 460"
        className="mx-auto hidden w-full max-w-xl sm:block"
        role="img"
        aria-label={tx(
          `Fluxos médios de ${diaFluxo}: ${resumo}. PLD médio de ${diaPreco}: ${(Object.keys(POS) as Submercado[]).map((s) => `${POS[s].nome} R$ ${fmt(precos[s] ?? null, 2)}`).join(", ")}.`,
          `Average flows for ${diaFluxo}: ${resumo}. Average PLD for ${diaPreco}: ${(Object.keys(POS) as Submercado[]).map((s) => `${POS[s].nome} R$ ${fmt(precos[s] ?? null, 2)}`).join(", ")}.`,
        )}
      >
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
                {f.fluxo === null ? semDado : `${fmt(Math.abs(v))} ${mw}`}
              </text>
            </g>
          );
        })}
        {(Object.keys(POS) as Submercado[]).map((s) => {
          const p = POS[s];
          return (
            <g key={s}>
              <rect x={p.x - 66} y={p.y - 28} width="132" height="56" fill="var(--cor-superficie)" stroke="var(--cor-carvao)" strokeWidth="1" rx="3" />
              <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="12" fill="var(--cor-mineral)">
                {p.nome.length > 14 ? tx("Sudeste/C.-Oeste", "Southeast/C.-West") : p.nome}
              </text>
              <text x={p.x} y={p.y + 12} textAnchor="middle" fontSize="15" fill="var(--cor-carvao)" fontWeight="600" className="tabular-nums">
                R$ {fmt(precos[s] ?? null, 2)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-xs text-mineral sm:text-center">
        <span className="hidden sm:inline">
          {tx(
            `Caixas: PLD médio de ${diaPreco} (R$/MWh). Setas: sentido e fluxo médio verificado entre subsistemas em ${diaFluxo}. Esquema sem escala geográfica.`,
            `Boxes: average PLD for ${diaPreco} (R$/MWh). Arrows: direction and average verified flow between subsystems on ${diaFluxo}. Diagram without geographic scale.`,
          )}
        </span>
        <span className="sm:hidden">
          {tx(
            `PLD médio de ${diaPreco} e fluxo médio verificado entre subsistemas em ${diaFluxo}, no sentido indicado.`,
            `Average PLD for ${diaPreco} and average verified flow between subsystems on ${diaFluxo}, in the direction shown.`,
          )}
        </span>
      </figcaption>
    </figure>
  );
}
