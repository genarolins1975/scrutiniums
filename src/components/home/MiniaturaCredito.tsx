import type { MiniaturaCreditoDados } from "@/lib/amostras";
import { mesAno } from "@/lib/energia/formato";

/**
 * Miniatura data-driven do Crédito: a curva da inadimplência nacional nos
 * últimos meses e, abaixo, os 27 estados como uma matriz de barras ordenada
 * pela inadimplência. Abstrata na forma, real nos números; sem gold, mostra
 * o vazio com aviso. No celular o desenho dá lugar a três números em HTML,
 * para o texto não encolher.
 */
const pc = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export function MiniaturaCredito({ dados }: { dados: MiniaturaCreditoDados }) {
  const W = 520;
  const H = 190;
  const s = dados.serieInad;
  if (!s.length) {
    return <p className="flex h-40 items-center justify-center text-sm text-mineral">Amostra indisponível: a gold do Crédito não foi lida nesta publicação.</p>;
  }
  const vals = s.map((p) => p.v);
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const pad = (mx - mn) * 0.25 || 0.5;
  const x = (i: number) => 24 + (i / (s.length - 1)) * (W - 48);
  const y = (v: number) => 14 + (1 - (v - (mn - pad)) / (mx - mn + 2 * pad)) * 84;
  const linha = s.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const area = `${linha}L${x(s.length - 1).toFixed(1)},112L${x(0).toFixed(1)},112Z`;
  const ufs = dados.ufs;
  const ufMax = ufs.length ? Math.max(...ufs.map((u) => u.inad)) : 1;
  const larguraUf = (W - 48) / Math.max(1, ufs.length);
  const ultimo = s[s.length - 1];
  const menorUf = ufs[0];
  const maiorUf = ufs[ufs.length - 1];
  const descricao = `Inadimplência do crédito no país: ${pc(ultimo.v)} em ${mesAno(ultimo.p)}, série de ${s.length} meses; abaixo, os ${ufs.length} estados ordenados pela inadimplência.`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="hidden h-auto w-full sm:block" role="img" aria-label={descricao}>
        <path d={area} fill="var(--cor-bronze)" fillOpacity="0.12" />
        <path d={linha} fill="none" stroke="var(--cor-bronze)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx={x(s.length - 1)} cy={y(ultimo.v)} r="3.5" fill="var(--cor-bronze)" stroke="var(--cor-superficie)" strokeWidth="1.5" />
        <text x={x(s.length - 1) - 6} y={y(ultimo.v) - 8} textAnchor="end" fontSize="13" fontWeight="600" fill="var(--cor-carvao)" className="tabular-nums">
          {pc(ultimo.v)}
        </text>
        <text x={24} y={12} fontSize="10.5" fill="var(--cor-mineral)" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
          inadimplência · {mesAno(s[0].p)} a {mesAno(ultimo.p)}
        </text>
        {ufs.map((u, i) => {
          const h = 6 + (u.inad / ufMax) * 40;
          return (
            <g key={u.uf}>
              <rect x={24 + i * larguraUf + 1} y={176 - h} width={Math.max(2, larguraUf - 2)} height={h} fill="var(--cor-bronze)" fillOpacity={0.35 + 0.6 * (u.inad / ufMax)}>
                <title>{`${u.uf}: ${pc(u.inad)}`}</title>
              </rect>
            </g>
          );
        })}
        <text x={24} y={H - 2} fontSize="10.5" fill="var(--cor-mineral)">
          {ufs.length} estados, da menor à maior inadimplência
        </text>
      </svg>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:hidden" aria-label={descricao}>
        <div className="col-span-2">
          <dt className="rotulo text-mineral">Inadimplência no país · {mesAno(ultimo.p)}</dt>
          <dd className="font-serif text-2xl leading-tight tabular-nums text-carvao">{pc(ultimo.v)}</dd>
          <dd className="text-xs text-mineral">
            de {pc(mn)} a {pc(mx)} entre {mesAno(s[0].p)} e {mesAno(ultimo.p)}
          </dd>
        </div>
        {menorUf && maiorUf && (
          <>
            <div>
              <dt className="rotulo text-mineral">Menor entre os estados</dt>
              <dd className="font-serif text-lg leading-tight tabular-nums text-carvao">
                {menorUf.uf} · {pc(menorUf.inad)}
              </dd>
            </div>
            <div>
              <dt className="rotulo text-mineral">Maior entre os estados</dt>
              <dd className="font-serif text-lg leading-tight tabular-nums text-carvao">
                {maiorUf.uf} · {pc(maiorUf.inad)}
              </dd>
            </div>
          </>
        )}
      </dl>
    </div>
  );
}
