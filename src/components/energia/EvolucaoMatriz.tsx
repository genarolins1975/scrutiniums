"use client";

import { useEffect, useRef, useState } from "react";
import type { FonteGeracao } from "@/lib/energia/tipos";
import { COR_FONTE, NOME_FONTE, ORDEM_FONTES } from "@/components/energia/BarrasMix";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { umDe, useEstadoUrl } from "@/lib/energia/useEstadoUrl";

/**
 * Como a matriz mudou: a participação de cada fonte, mês a mês, como área
 * empilhada a 100%. Um controle de tempo percorre os meses (play opcional,
 * parado com prefers-reduced-motion) e destaca a composição do mês; um
 * comparador põe dois meses lado a lado. A linha vertical marca a mudança de
 * regime do balanço em 29/04/2023, lida do dado. Participação não é
 * capacidade instalada.
 */
export type MesMatriz = { m: string; mwmed: Record<FonteGeracao, number>; total: number; dias: number };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesAno = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}`;
const fmt = (v: number, casas = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const part = (x: MesMatriz, f: FonteGeracao) => (x.total > 0 ? (100 * x.mwmed[f]) / x.total : 0);

export function EvolucaoMatriz({ meses, regime }: { meses: MesMatriz[]; regime?: string }) {
  const ids = meses.map((x) => x.m);
  const [mes, setMes] = useEstadoUrl<string>("mes", ids[ids.length - 1] ?? "", umDe(ids));
  const [comparar, setComparar] = useState<string>(ids[0] ?? "");
  const [tocando, setTocando] = useState(false);
  const [reduzido, setReduzido] = useState(false);
  const timer = useRef<number | null>(null);
  const idx = Math.max(0, ids.indexOf(mes));

  useEffect(() => {
    setReduzido(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  useEffect(() => {
    if (!tocando) return;
    timer.current = window.setInterval(() => {
      const i = ids.indexOf(mes);
      if (i >= ids.length - 1) setTocando(false);
      else setMes(ids[i + 1]);
    }, 450);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [tocando, mes, ids, setMes]);

  const W = 760;
  const H = 300;
  const L = 44;
  const R = 16;
  const T = 14;
  const B = 28;
  const n = meses.length;
  const x = (i: number) => L + (n <= 1 ? 0 : (i / (n - 1)) * (W - L - R));
  const y = (p: number) => T + (1 - p / 100) * (H - T - B);
  // áreas empilhadas na ordem das fontes
  const camadas = ORDEM_FONTES.map((f, k) => {
    const base = meses.map((m) => ORDEM_FONTES.slice(0, k).reduce((s, g) => s + part(m, g), 0));
    const topo = meses.map((m, i) => base[i] + part(m, f));
    const sup = meses.map((_, i) => `${x(i).toFixed(1)},${y(topo[i]).toFixed(1)}`);
    const inf = meses.map((_, i) => `${x(n - 1 - i).toFixed(1)},${y(base[n - 1 - i]).toFixed(1)}`);
    return { f, d: `M${sup.join("L")}L${inf.join("L")}Z` };
  });
  const atual = meses[idx];
  const outro = meses.find((m) => m.m === comparar) ?? meses[0];
  const iRegime = regime ? ids.findIndex((m) => m >= regime.slice(0, 7)) : -1;
  const anos = Array.from(new Set(ids.map((m) => m.slice(0, 4))));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setTocando((t) => !t)}
          aria-pressed={tocando}
          className="rotulo inline-flex min-h-[44px] items-center gap-2 border border-carvao px-4 text-carvao hover:bg-carvao hover:text-marfim"
        >
          <span aria-hidden="true">{tocando ? "❚❚" : "▶"}</span> {tocando ? "Pausar" : "Percorrer os meses"}
        </button>
        <label className="flex min-w-[14rem] flex-1 items-center gap-3 text-xs text-mineral">
          <span className="sr-only">Mês em destaque</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, n - 1)}
            value={idx}
            onChange={(e) => {
              setTocando(false);
              setMes(ids[Number(e.target.value)]);
            }}
            aria-valuetext={atual ? mesAno(atual.m) : ""}
            className="h-11 w-full accent-[var(--cor-energia)]"
          />
          <span className="whitespace-nowrap font-serif text-lg tabular-nums text-carvao">{atual ? mesAno(atual.m) : ""}</span>
        </label>
        {reduzido && <span className="text-xs text-mineral">Movimento reduzido: o controle avança sem animação.</span>}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block h-auto w-full" role="img" aria-label={`Participação de cada fonte na geração verificada do SIN, mês a mês, de ${ids[0] ? mesAno(ids[0]) : ""} a ${ids[n - 1] ? mesAno(ids[n - 1]) : ""}. Mês em destaque ${atual ? mesAno(atual.m) : ""}: ${atual ? ORDEM_FONTES.map((f) => `${NOME_FONTE[f]} ${fmt(part(atual, f))}%`).join(", ") : ""}.`}>
        {[0, 25, 50, 75, 100].map((p) => (
          <g key={p}>
            <line x1={L} x2={W - R} y1={y(p)} y2={y(p)} stroke="var(--cor-grade)" />
            <text x={L - 6} y={y(p) + 4} textAnchor="end" fontSize="10.5" fill="var(--cor-mineral)">
              {p}%
            </text>
          </g>
        ))}
        {camadas.map((c) => (
          <path key={c.f} d={c.d} fill={COR_FONTE[c.f]} opacity={0.82} />
        ))}
        {anos.map((a) => {
          const i = ids.findIndex((m) => m.startsWith(a));
          return (
            <text key={a} x={x(i)} y={H - 10} fontSize="10.5" fill="var(--cor-mineral)">
              {a}
            </text>
          );
        })}
        {iRegime >= 0 && (
          <g>
            <line x1={x(iRegime)} x2={x(iRegime)} y1={T} y2={H - B} stroke="var(--cor-carvao)" strokeDasharray="3 3" />
            <text x={x(iRegime) + 4} y={T + 10} fontSize="10" fill="var(--cor-carvao)">
              mudança de regime
            </text>
          </g>
        )}
        {atual && (
          <g pointerEvents="none">
            <line x1={x(idx)} x2={x(idx)} y1={T} y2={H - B} stroke="var(--cor-carvao)" strokeWidth="2" />
            {ORDEM_FONTES.map((f, k) => {
              const base = ORDEM_FONTES.slice(0, k).reduce((s, g) => s + part(atual, g), 0);
              const p = part(atual, f);
              if (p < 5) return null;
              const yy = y(base + p / 2);
              const direita = idx < n / 2;
              return (
                <text key={f} x={x(idx) + (direita ? 8 : -8)} y={yy + 4} textAnchor={direita ? "start" : "end"} fontSize="11.5" fontWeight="600" fill="var(--cor-carvao)" className="tabular-nums" stroke="var(--cor-superficie)" strokeWidth="3" paintOrder="stroke">
                  {NOME_FONTE[f]} {fmt(p, 0)}%
                </text>
              );
            })}
          </g>
        )}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-carvao-muted" aria-label="Legenda">
        {ORDEM_FONTES.map((f) => (
          <li key={f} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5" style={{ background: COR_FONTE[f] }} />
            {NOME_FONTE[f]}
          </li>
        ))}
      </ul>

      <div className="mt-6 border-t border-linha pt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="rotulo text-mineral">Comparar dois meses</p>
          <label className="flex items-center gap-2 text-xs text-mineral">
            Comparar {atual ? mesAno(atual.m) : ""} com
            <select value={outro.m} onChange={(e) => setComparar(e.target.value)} className="min-h-[44px] border border-linha bg-superficie px-2 text-sm text-carvao">
              {meses.map((m) => (
                <option key={m.m} value={m.m}>
                  {mesAno(m.m)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ul className="mt-3 space-y-3">
          {[atual, outro].filter(Boolean).map((m, k) => (
            <li key={`${m.m}-${k}`} className="grid items-center gap-2 sm:grid-cols-[9.5rem_1fr]">
              <p className="text-sm text-carvao">
                {mesAno(m.m)}
                <span className="block text-xs text-mineral">
                  {fmt(m.total, 0)} MWmed · {m.dias} dias
                </span>
              </p>
              <div className="flex h-8 w-full gap-[2px]" role="img" aria-label={`${mesAno(m.m)}: ${ORDEM_FONTES.map((f) => `${NOME_FONTE[f]} ${fmt(part(m, f))}%`).join(", ")}`}>
                {ORDEM_FONTES.map((f) => {
                  const p = part(m, f);
                  return (
                    <div key={f} title={`${NOME_FONTE[f]}: ${fmt(p)}%`} className="flex h-full items-center overflow-hidden" style={{ width: `${p}%`, background: COR_FONTE[f] }}>
                      {p >= 7 && <span className={`px-1.5 text-[0.7rem] font-medium tabular-nums ${f === "hidraulica" ? "text-white" : f === "termica" ? "mx-1 rounded-sm bg-superficie text-carvao" : "text-carvao"}`}>{fmt(p, 0)}%</span>}
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
        {atual && outro && (
          <p className="mt-3 text-sm text-carvao-muted">
            Diferença em pontos percentuais ({mesAno(atual.m)} menos {mesAno(outro.m)}):{" "}
            {ORDEM_FONTES.map((f) => {
              const d = part(atual, f) - part(outro, f);
              return `${NOME_FONTE[f]} ${d > 0 ? "+" : d < 0 ? "−" : ""}${fmt(Math.abs(d))}`;
            }).join(" · ")}
            . {regime && (atual.m < regime.slice(0, 7)) !== (outro.m < regime.slice(0, 7)) ? "Os dois meses estão em regimes diferentes do balanço: a comparação não é homogênea." : ""}
          </p>
        )}
      </div>
      <TabelaDados
        titulo="Participação mensal por fonte na geração verificada do SIN (%)"
        colunas={["Mês", ...ORDEM_FONTES.map((f) => `${NOME_FONTE[f]} (%)`), "Total (MWmed)", "Dias"]}
        linhas={meses.map((m) => [mesAno(m.m), ...ORDEM_FONTES.map((f) => part(m, f)), m.total, m.dias])}
        casas={[null, 1, 1, 1, 1, 0, 0]}
        limite={meses.length}
      />
    </div>
  );
}
