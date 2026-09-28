import type { MiniaturaEnergiaDados } from "@/lib/amostras";
import { IconeSetor, type TipoIcone } from "@/components/energia/IconeSetor";
import { num, pct, reais } from "@/lib/energia/formato";

/**
 * Miniatura viva do Setor Elétrico: água → geração → rede → consumo → preço,
 * com um número real em cada etapa e uma partícula percorrendo o caminho
 * (CSS motion path; parada com prefers-reduced-motion). Cores com significado:
 * água em azul, geração em verde, rede em teal, preço em vinho.
 */
const ETAPAS: { id: keyof Pick<MiniaturaEnergiaDados, "ear" | "hes" | "fluxoNeSe" | "carga" | "pld">; rotulo: string; icone: TipoIcone; cor: string; fmt: (v: number) => string; sub: string }[] = [
  { id: "ear", rotulo: "Água", icone: "agua", cor: "var(--serie-hidraulica)", fmt: (v) => pct(v, 0), sub: "reservatórios do SIN" },
  { id: "hes", rotulo: "Geração", icone: "geracao", cor: "var(--serie-eolica)", fmt: (v) => pct(v, 0), sub: "hidráulica, eólica e solar" },
  { id: "fluxoNeSe", rotulo: "Rede", icone: "rede", cor: "var(--cor-energia)", fmt: (v) => `${num(Math.abs(v), 0)} MWmed`, sub: "Nordeste → SE/CO" },
  { id: "carga", rotulo: "Consumo", icone: "carga", cor: "var(--cor-carvao-muted)", fmt: (v) => `${num(v / 1000, 1)} GWmed`, sub: "carga do SIN" },
  { id: "pld", rotulo: "Preço", icone: "preco", cor: "var(--serie-pld)", fmt: (v) => `${reais(v, 0)}/MWh`, sub: "PLD médio SE/CO" },
];

export function MiniaturaEnergia({ dados }: { dados: MiniaturaEnergiaDados }) {
  const W = 520;
  const H = 190;
  const xs = ETAPAS.map((_, i) => 52 + i * ((W - 104) / (ETAPAS.length - 1)));
  const ys = [70, 96, 62, 100, 74];
  const caminho = xs.map((x, i) => (i === 0 ? `M${x},${ys[i]}` : `C${(xs[i - 1] + x) / 2},${ys[i - 1]} ${(xs[i - 1] + x) / 2},${ys[i]} ${x},${ys[i]}`)).join(" ");
  const temAlgo = ETAPAS.some((e) => dados[e.id] !== null);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Do reservatório ao preço: ${ETAPAS.map((e) => `${e.rotulo} ${dados[e.id] === null ? "sem dado" : e.fmt(dados[e.id] as number)}`).join("; ")}.`}>
        <path d={caminho} fill="none" stroke="var(--cor-linha)" strokeWidth="2" />
        <path d={caminho} fill="none" stroke="var(--cor-energia)" strokeWidth="2" strokeDasharray="4 10" opacity="0.7" className="fluxo-animado" />
        {temAlgo && (
          <circle r="4" fill="var(--cor-energia)" className="percorre-caminho" style={{ offsetPath: `path("${caminho}")`, offsetRotate: "0deg" } as React.CSSProperties} />
        )}
        {ETAPAS.map((e, i) => {
          const v = dados[e.id];
          return (
            <g key={e.id}>
              <circle cx={xs[i]} cy={ys[i]} r="15" fill="var(--cor-superficie)" stroke={e.cor} strokeWidth="2" />
              <foreignObject x={xs[i] - 9} y={ys[i] - 9} width="18" height="18">
                <div style={{ color: e.cor }} className="flex h-full w-full items-center justify-center">
                  <IconeSetor tipo={e.icone} tamanho={14} />
                </div>
              </foreignObject>
              <text x={xs[i]} y={ys[i] + 34} textAnchor="middle" fontSize="11" fill="var(--cor-mineral)" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {e.rotulo}
              </text>
              <text x={xs[i]} y={ys[i] + 52} textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--cor-carvao)" className="tabular-nums">
                {v === null ? "sem dado" : e.fmt(v)}
              </text>
              <text x={xs[i]} y={ys[i] + 66} textAnchor="middle" fontSize="9.5" fill="var(--cor-mineral)">
                {e.sub}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
