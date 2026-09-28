"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * Gráfico de linhas SVG com camada de leitura: cruz + dica no hover, setas do
 * teclado percorrem os pontos, rótulo direto no fim de cada linha e legenda.
 * Ausência é lacuna na linha (nunca zero). Um único eixo Y.
 */
export type SerieLinha = {
  id: string;
  rotulo: string;
  cor: string;
  tracejada?: boolean;
  espessura?: number;
};

type Ponto = Record<string, string | number | null | undefined>;

export type GraficoLinhasProps = {
  titulo: string;
  dados: Ponto[];
  chaveX: string;
  series: SerieLinha[];
  unidade: string;
  casas?: number;
  formatoX?: "data" | "hora" | "mes" | "md" | "texto";
  zeroNoEixo?: boolean;
  banda?: { inferior: string; superior: string; rotulo: string; cor?: string };
  marcos?: { x: string; rotulo: string }[];
  altura?: number;
  rotulosDiretos?: boolean;
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function fmtX(v: string, f: GraficoLinhasProps["formatoX"], longo = false): string {
  if (!v) return "";
  if (f === "hora") return longo && v.length > 5 ? `${v.slice(8, 10)}/${v.slice(5, 7)} ${v.slice(11, 13)}h` : v.length > 5 ? `${v.slice(11, 13)}h` : `${v.slice(0, 2)}h`;
  if (f === "mes") return `${MESES[Number(v.slice(5, 7)) - 1]}/${v.slice(2, 4)}`;
  if (f === "md") return `${v.slice(3, 5)}/${v.slice(0, 2)}`;
  if (f === "data") return longo ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : `${MESES[Number(v.slice(5, 7)) - 1]}/${v.slice(2, 4)}`;
  return v;
}

function fmtV(v: number | null | undefined, casas: number, unidade: string): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "sem dado";
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })} ${unidade}`.trim();
}

function ticks(min: number, max: number, n = 4): number[] {
  const span = max - min || 1;
  const bruto = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => span / p <= n + 0.5) ?? mag * 10;
  const ini = Math.ceil(min / passo) * passo;
  const out: number[] = [];
  for (let v = ini; v <= max + 1e-9; v += passo) out.push(Number(v.toFixed(10)));
  return out;
}

export function GraficoLinhas({
  titulo,
  dados,
  chaveX,
  series,
  unidade,
  casas = 1,
  formatoX = "data",
  zeroNoEixo = false,
  banda,
  marcos = [],
  altura = 300,
  rotulosDiretos = true,
}: GraficoLinhasProps) {
  const uid = useId();
  const [largura, setLargura] = useState(760);
  const [ativo, setAtivo] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setLargura(Math.max(300, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const L = largura < 520 ? 44 : 56;
  const R = rotulosDiretos ? (largura < 520 ? 70 : 108) : 16;
  const T = 14;
  const B = 30;
  const w = largura;
  const h = altura;

  const { yMin, yMax } = useMemo(() => {
    const vals: number[] = [];
    for (const d of dados) {
      for (const s of series) {
        const v = d[s.id];
        if (typeof v === "number" && Number.isFinite(v)) vals.push(v);
      }
      if (banda) {
        for (const k of [banda.inferior, banda.superior]) {
          const v = d[k];
          if (typeof v === "number" && Number.isFinite(v)) vals.push(v);
        }
      }
    }
    if (!vals.length) return { yMin: 0, yMax: 1 };
    let mn = Math.min(...vals);
    const mx = Math.max(...vals);
    if (zeroNoEixo) mn = Math.min(0, mn);
    const pad = (mx - mn) * 0.06 || 1;
    return { yMin: zeroNoEixo && mn >= 0 ? 0 : mn - pad, yMax: mx + pad };
  }, [dados, series, banda, zeroNoEixo]);

  const n = dados.length;
  const x = (i: number) => L + (n <= 1 ? 0 : (i / (n - 1)) * (w - L - R));
  const y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin || 1)) * (h - T - B);

  const caminhos = series.map((s) => {
    let d = "";
    let aberto = false;
    dados.forEach((p, i) => {
      const v = p[s.id];
      if (typeof v === "number" && Number.isFinite(v)) {
        d += `${aberto ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        aberto = true;
      } else {
        aberto = false; // lacuna: ausência não é zero
      }
    });
    return d;
  });

  let bandaPath = "";
  if (banda) {
    const sup: string[] = [];
    const inf: string[] = [];
    dados.forEach((p, i) => {
      const a = p[banda.superior];
      const b = p[banda.inferior];
      if (typeof a === "number" && typeof b === "number") {
        sup.push(`${x(i).toFixed(1)},${y(a).toFixed(1)}`);
        inf.unshift(`${x(i).toFixed(1)},${y(b).toFixed(1)}`);
      }
    });
    if (sup.length) bandaPath = `M${sup.join("L")}L${inf.join("L")}Z`;
  }

  // rótulos diretos no último ponto válido, afastados para não colidir
  const finais = series
    .map((s) => {
      for (let i = n - 1; i >= 0; i--) {
        const v = dados[i][s.id];
        if (typeof v === "number" && Number.isFinite(v)) return { s, i, v, yy: y(v) };
      }
      return null;
    })
    .filter((f): f is { s: SerieLinha; i: number; v: number; yy: number } => !!f)
    .sort((a, b) => a.yy - b.yy);
  for (let k = 1; k < finais.length; k++) {
    if (finais[k].yy - finais[k - 1].yy < 14) finais[k].yy = finais[k - 1].yy + 14;
  }

  const yt = ticks(yMin, yMax);
  const nx = Math.min(largura < 520 ? 4 : 7, n);
  const xt = n <= 1 ? [0] : Array.from({ length: nx }, (_, k) => Math.round((k / Math.max(nx - 1, 1)) * (n - 1)));

  function mover(ev: React.PointerEvent<SVGRectElement>) {
    const r = (ev.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * (w - L - R);
    const i = Math.round((px / (w - L - R)) * (n - 1));
    setAtivo(Math.max(0, Math.min(n - 1, i)));
  }

  function teclado(ev: React.KeyboardEvent<SVGSVGElement>) {
    if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
      ev.preventDefault();
      setAtivo((a) => {
        const base = a ?? n - 1;
        return Math.max(0, Math.min(n - 1, base + (ev.key === "ArrowRight" ? 1 : -1)));
      });
    } else if (ev.key === "Escape") setAtivo(null);
  }

  const pa = ativo !== null ? dados[ativo] : null;
  const tipX = ativo !== null ? x(ativo) : 0;

  return (
    <div ref={ref} className="relative w-full">
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 px-1 text-xs text-carvao-muted" aria-label="Legenda">
        {series.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <svg width="18" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="18" y2="4" stroke={s.cor} strokeWidth="2.5" strokeDasharray={s.tracejada ? "4 3" : undefined} />
            </svg>
            {s.rotulo}
          </li>
        ))}
        {banda && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-4" style={{ background: banda.cor ?? "color-mix(in srgb, var(--serie-referencia) 22%, transparent)" }} />
            {banda.rotulo}
          </li>
        )}
      </ul>
      <svg
        width="100%"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-labelledby={`${uid}-t`}
        tabIndex={0}
        onKeyDown={teclado}
        onBlur={() => setAtivo(null)}
        className="block overflow-visible focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
      >
        <title id={`${uid}-t`}>{`${titulo}. Use as setas para percorrer os pontos.`}</title>
        {yt.map((v) => (
          <g key={v}>
            <line x1={L} x2={w - R} y1={y(v)} y2={y(v)} stroke="var(--cor-grade)" strokeWidth="1" />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--cor-mineral)">
              {v.toLocaleString("pt-BR", { maximumFractionDigits: Math.abs(yMax - yMin) < 5 ? 1 : 0 })}
            </text>
          </g>
        ))}
        {xt.map((i) => (
          <text key={i} x={x(i)} y={h - 8} textAnchor="middle" fontSize="11" fill="var(--cor-mineral)">
            {fmtX(String(dados[i]?.[chaveX] ?? ""), formatoX)}
          </text>
        ))}
        {bandaPath && <path d={bandaPath} fill={banda?.cor ?? "color-mix(in srgb, var(--serie-referencia) 22%, transparent)"} stroke="none" />}
        {marcos.map((m) => {
          const i = dados.findIndex((d) => String(d[chaveX]) >= m.x);
          if (i < 0) return null;
          return (
            <g key={m.x}>
              <line x1={x(i)} x2={x(i)} y1={T} y2={h - B} stroke="var(--cor-mineral)" strokeWidth="1" strokeDasharray="3 3" />
              <text x={x(i) + 4} y={T + 10} fontSize="10" fill="var(--cor-mineral)">
                {m.rotulo}
              </text>
            </g>
          );
        })}
        {series.map((s, k) => (
          <path
            key={s.id}
            d={caminhos[k]}
            fill="none"
            stroke={s.cor}
            strokeWidth={s.espessura ?? 2}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={s.tracejada ? "5 4" : undefined}
          />
        ))}
        {rotulosDiretos &&
          finais.map((f) => (
            <g key={f.s.id}>
              <circle cx={x(f.i)} cy={y(f.v)} r="3.5" fill={f.s.cor} stroke="#fff" strokeWidth="1.5" />
              <text x={x(f.i) + 8} y={f.yy + 4} fontSize="11" fill="var(--cor-carvao)">
                {f.s.rotulo.length > 14 && largura < 520 ? f.s.rotulo.slice(0, 12) + "…" : f.s.rotulo}
              </text>
            </g>
          ))}
        {ativo !== null && (
          <g pointerEvents="none">
            <line x1={tipX} x2={tipX} y1={T} y2={h - B} stroke="var(--cor-carvao)" strokeWidth="1" opacity="0.5" />
            {series.map((s) => {
              const v = pa?.[s.id];
              return typeof v === "number" && Number.isFinite(v) ? (
                <circle key={s.id} cx={tipX} cy={y(v)} r="4.5" fill={s.cor} stroke="#fff" strokeWidth="2" />
              ) : null;
            })}
          </g>
        )}
        <rect
          x={L}
          y={T}
          width={Math.max(1, w - L - R)}
          height={Math.max(1, h - T - B)}
          fill="transparent"
          onPointerMove={mover}
          onPointerDown={mover}
          onPointerLeave={() => setAtivo(null)}
        />
      </svg>
      {pa && (
        <div
          role="status"
          className="pointer-events-none absolute top-6 z-20 min-w-[11rem] border border-linha bg-superficie px-3 py-2 text-xs shadow-[0_6px_20px_rgba(26,29,33,0.12)]"
          style={{ left: `min(max(0px, calc(${(tipX / w) * 100}% - 5.5rem)), calc(100% - 12rem))` }}
        >
          <p className="rotulo text-mineral">{fmtX(String(pa[chaveX]), formatoX, true)}</p>
          <ul className="mt-1 space-y-0.5">
            {series.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 text-carvao">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="inline-block h-2 w-2" style={{ background: s.cor }} />
                  {s.rotulo}
                </span>
                <span className="tabular-nums">{fmtV(pa[s.id] as number | null, casas, unidade)}</span>
              </li>
            ))}
            {banda && typeof pa[banda.inferior] === "number" && (
              <li className="flex justify-between gap-3 text-mineral">
                <span>{banda.rotulo}</span>
                <span className="tabular-nums">
                  {fmtV(pa[banda.inferior] as number, casas, "")} a {fmtV(pa[banda.superior] as number, casas, unidade)}
                </span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
