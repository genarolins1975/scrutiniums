"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Fan chart do PLD: realizado (médias semanais) à esquerda, corte, e o
 * horizonte à direita com a previsão central e as faixas de incerteza. Quando
 * não há previsão publicada, o horizonte aparece hachurado com o motivo: a
 * ausência é mostrada no mesmo lugar em que o número apareceria, nunca
 * preenchida. Toda largura de faixa é declarada pelos quantis que a formam.
 */
export type PontoRealizado = { x: string; v: number | null; parcial?: boolean };
export type PontoPrevisto = { x: string; p10: number; p25?: number; p50: number; p75?: number; p90: number };

function fmtSemana(x: string): string {
  return `${x.slice(8, 10)}/${x.slice(5, 7)}`;
}
function fmtV(v: number | null | undefined, unidade: string): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "sem dado";
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unidade}`;
}

export function FanChart({
  realizado,
  futuro,
  previsao,
  unidade,
  rotuloSerie,
  motivoIndisponivel,
  rotuloFaixa,
}: {
  realizado: PontoRealizado[];
  /** Semanas do horizonte (só a data inicial de cada uma). */
  futuro: { x: string }[];
  previsao: PontoPrevisto[] | null;
  unidade: string;
  rotuloSerie: string;
  motivoIndisponivel?: string;
  /** Como a faixa externa deve ser chamada (por exemplo, "faixa P10 a P90"); nunca "80%" sem calibração. */
  rotuloFaixa?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(720);
  const [ativo, setAtivo] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setLargura(Math.max(300, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const L = 54;
  const R = 16;
  const T = 18;
  const B = 32;
  const h = 300;
  const w = largura;
  const pontos = [...realizado.map((p) => ({ x: p.x, tipo: "real" as const })), ...futuro.map((p) => ({ x: p.x, tipo: "fut" as const }))];
  const n = pontos.length;
  const vals: number[] = realizado.map((p) => p.v).filter((v): v is number => typeof v === "number");
  if (previsao) for (const p of previsao) vals.push(p.p10, p.p90);
  const mn = vals.length ? Math.min(...vals) : 0;
  const mx = vals.length ? Math.max(...vals) : 1;
  const pad = (mx - mn) * 0.1 || 10;
  const y0 = Math.max(0, mn - pad);
  const y1 = mx + pad;
  const x = (i: number) => L + (n <= 1 ? 0 : (i / (n - 1)) * (w - L - R));
  const y = (v: number) => T + (1 - (v - y0) / (y1 - y0 || 1)) * (h - T - B);
  const iCorte = realizado.length - 1;
  let linha = "";
  let aberto = false;
  realizado.forEach((p, i) => {
    if (typeof p.v === "number") {
      linha += `${aberto ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`;
      aberto = true;
    } else aberto = false;
  });
  const prevIdx = (k: number) => realizado.length + k;
  const areaPrev = (a: "p10" | "p25", b: "p90" | "p75") => {
    if (!previsao) return "";
    const sup = previsao.map((p, k) => `${x(prevIdx(k)).toFixed(1)},${y((p[b] ?? p.p90) as number).toFixed(1)}`);
    const inf = [...previsao].reverse().map((p, i) => `${x(prevIdx(previsao.length - 1 - i)).toFixed(1)},${y((p[a] ?? p.p10) as number).toFixed(1)}`);
    return `M${sup.join("L")}L${inf.join("L")}Z`;
  };
  const yt = (() => {
    const out: number[] = [];
    const passo = Math.pow(10, Math.floor(Math.log10((y1 - y0) / 4 || 1)));
    const p = [1, 2, 2.5, 5, 10].map((m) => m * passo).find((q) => (y1 - y0) / q <= 5) ?? passo;
    for (let v = Math.ceil(y0 / p) * p; v <= y1; v += p) out.push(v);
    return out;
  })();

  function mover(ev: React.PointerEvent<SVGRectElement>) {
    const r = ev.currentTarget.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * (w - L - R);
    setAtivo(Math.max(0, Math.min(n - 1, Math.round((px / (w - L - R)) * (n - 1)))));
  }
  const pa = ativo !== null ? pontos[ativo] : null;
  const real = ativo !== null && ativo < realizado.length ? realizado[ativo] : null;
  const prev = ativo !== null && ativo >= realizado.length && previsao ? previsao[ativo - realizado.length] : null;

  return (
    <div ref={ref} className="relative w-full">
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 px-1 text-xs text-carvao-muted" aria-label="Legenda">
        <li className="flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="18" y2="4" stroke="var(--cor-carvao)" strokeWidth="2.5" />
          </svg>
          {rotuloSerie} (realizado, médias semanais)
        </li>
        {previsao ? (
          <>
            <li className="flex items-center gap-1.5">
              <svg width="18" height="8" aria-hidden="true">
                <line x1="0" y1="4" x2="18" y2="4" stroke="var(--cor-previsto)" strokeWidth="2.5" strokeDasharray="4 3" />
              </svg>
              previsão central (mediana)
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-2.5 w-4" style={{ background: "color-mix(in srgb, var(--cor-previsto) 25%, transparent)" }} />
              {rotuloFaixa ?? "faixa P10 a P90"}
            </li>
          </>
        ) : (
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-4 border border-dashed border-mineral" /> horizonte sem previsão publicada
          </li>
        )}
      </ul>
      <svg
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-labelledby={`${uid}-t`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            setAtivo((a) => Math.max(0, Math.min(n - 1, (a ?? iCorte) + (e.key === "ArrowRight" ? 1 : -1))));
          } else if (e.key === "Escape") setAtivo(null);
        }}
        onBlur={() => setAtivo(null)}
        className="block overflow-visible focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
      >
        <title id={`${uid}-t`}>
          {previsao
            ? `${rotuloSerie}: realizado e previsão com faixa de incerteza.`
            : `${rotuloSerie}: realizado por semana e horizonte sem previsão publicada. ${motivoIndisponivel ?? ""}`}
        </title>
        <defs>
          <pattern id={`${uid}-hachura`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="var(--cor-mineral-soft)" strokeWidth="1" />
          </pattern>
        </defs>
        {yt.map((v) => (
          <g key={v}>
            <line x1={L} x2={w - R} y1={y(v)} y2={y(v)} stroke="var(--cor-grade)" />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--cor-mineral)">
              {v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </text>
          </g>
        ))}
        {futuro.length > 0 && (
          <g>
            <rect x={x(iCorte)} y={T} width={Math.max(1, x(n - 1) - x(iCorte))} height={h - T - B} fill={previsao ? "transparent" : `url(#${uid}-hachura)`} opacity={0.6} />
            <line x1={x(iCorte)} x2={x(iCorte)} y1={T} y2={h - B} stroke="var(--cor-carvao)" strokeDasharray="3 3" />
            <text x={x(iCorte) + 5} y={T + 11} fontSize="10" fill="var(--cor-mineral)">
              corte
            </text>
            {!previsao && (
              <text x={(x(iCorte) + x(n - 1)) / 2} y={(T + h - B) / 2} textAnchor="middle" fontSize="12" fill="var(--cor-carvao)">
                previsão indisponível
              </text>
            )}
          </g>
        )}
        {previsao && (
          <>
            <path d={areaPrev("p10", "p90")} fill="var(--cor-previsto)" fillOpacity="0.14" />
            {previsao.every((p) => p.p25 !== undefined && p.p75 !== undefined) && <path d={areaPrev("p25", "p75")} fill="var(--cor-previsto)" fillOpacity="0.24" />}
            <path
              d={`M${x(iCorte)},${typeof realizado[iCorte]?.v === "number" ? y(realizado[iCorte].v as number) : y(previsao[0].p50)} ${previsao.map((p, k) => `L${x(prevIdx(k)).toFixed(1)},${y(p.p50).toFixed(1)}`).join(" ")}`}
              fill="none"
              stroke="var(--cor-previsto)"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
          </>
        )}
        <path d={linha} fill="none" stroke="var(--cor-carvao)" strokeWidth="2" strokeLinejoin="round" />
        {realizado.map((p, i) =>
          typeof p.v === "number" ? <circle key={p.x} cx={x(i)} cy={y(p.v)} r={p.parcial ? 3 : 2.5} fill={p.parcial ? "var(--cor-superficie)" : "var(--cor-carvao)"} stroke="var(--cor-carvao)" strokeWidth="1.5" /> : null,
        )}
        {pontos.map((p, i) => (i % Math.max(1, Math.round(n / (largura < 520 ? 4 : 8))) === 0 || i === n - 1 ? (
          <text key={p.x} x={x(i)} y={h - 10} textAnchor="middle" fontSize="11" fill="var(--cor-mineral)">
            {fmtSemana(p.x)}
          </text>
        ) : null))}
        {ativo !== null && <line x1={x(ativo)} x2={x(ativo)} y1={T} y2={h - B} stroke="var(--cor-carvao)" opacity="0.5" />}
        <rect x={L} y={T} width={Math.max(1, w - L - R)} height={Math.max(1, h - T - B)} fill="transparent" onPointerMove={mover} onPointerDown={mover} onPointerLeave={() => setAtivo(null)} />
      </svg>
      <p className="sr-only" aria-live="polite">
        {pa ? `Semana de ${fmtSemana(pa.x)}: ${real ? fmtV(real.v, unidade) : prev ? `mediana ${fmtV(prev.p50, unidade)}, faixa ${fmtV(prev.p10, "")} a ${fmtV(prev.p90, unidade)}` : "sem previsão publicada"}` : ""}
      </p>
      {pa && (
        <div aria-hidden="true" className="pointer-events-none absolute top-6 z-20 min-w-[12rem] border border-linha bg-superficie px-3 py-2 text-xs shadow-[0_6px_20px_rgba(26,29,33,0.12)]" style={{ left: `min(max(0px, calc(${(x(ativo as number) / w) * 100}% - 6rem)), calc(100% - 13rem))` }}>
          <p className="rotulo text-mineral">semana de {fmtSemana(pa.x)}</p>
          {real ? (
            <p className="mt-1 tabular-nums text-carvao">
              {fmtV(real.v, unidade)}
              {real.parcial ? " (semana incompleta)" : ""}
            </p>
          ) : prev ? (
            <ul className="mt-1 space-y-0.5 tabular-nums text-carvao">
              <li>mediana {fmtV(prev.p50, unidade)}</li>
              <li className="text-mineral">
                {rotuloFaixa ?? "P10 a P90"}: {fmtV(prev.p10, "")} a {fmtV(prev.p90, unidade)}
              </li>
            </ul>
          ) : (
            <p className="mt-1 text-carvao-muted">sem previsão publicada</p>
          )}
        </div>
      )}
      <details className="mt-3 text-xs">
        <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">Dados do gráfico em tabela</summary>
        <div className="tabela-scroll mt-2 max-h-72 overflow-y-auto" tabIndex={0} role="region" aria-label="Médias semanais realizadas e previsão (tabela rolável)">
          <table className="w-full border-collapse tabular-nums">
            <thead className="sticky top-0 bg-superficie">
              <tr className="text-left text-mineral">
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">Semana (início)</th>
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">Realizado ({unidade})</th>
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">Previsão ({unidade})</th>
              </tr>
            </thead>
            <tbody>
              {realizado.map((p) => (
                <tr key={p.x} className="border-b border-linha">
                  <th scope="row" className="px-2 py-1 text-left font-normal text-carvao">{fmtSemana(p.x)}{p.parcial ? " (parcial)" : ""}</th>
                  <td className="px-2 py-1 text-carvao">{fmtV(p.v, "")}</td>
                  <td className="px-2 py-1 text-mineral">–</td>
                </tr>
              ))}
              {futuro.map((p, k) => (
                <tr key={p.x} className="border-b border-linha">
                  <th scope="row" className="px-2 py-1 text-left font-normal text-carvao">{fmtSemana(p.x)}</th>
                  <td className="px-2 py-1 text-mineral">ainda não realizado</td>
                  <td className="px-2 py-1 text-carvao">{previsao?.[k] ? `${fmtV(previsao[k].p50, "")} (${fmtV(previsao[k].p10, "")} a ${fmtV(previsao[k].p90, "")})` : "indisponível"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
