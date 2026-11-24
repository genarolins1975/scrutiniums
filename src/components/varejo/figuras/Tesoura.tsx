"use client";

import { useState, type CSSProperties, type PointerEvent } from "react";
import { mesCurto, mesExtenso, num, pontos as fmtPp, SEM_DADO, variacao } from "@/lib/varejo/formato";
import { areaEntre, caminho, eixo, linear, marcasDeTempo } from "./geometria";

export type SerieTesoura = { rotulo: string; valores: readonly (number | null)[]; cor: string; espessura?: number };

/**
 * A "tesoura": duas séries no mesmo eixo, com a área entre elas preenchida e rotulada. Serve à receita contra o volume em índice
 * (a abertura aproxima o efeito dos preços) e a um estado contra o Brasil (a área mostra quando o estado andou acima ou abaixo).
 *
 * As linhas e a área são um SVG esticado na largura do bloco, com traço que não escala; todo texto é HTML posicionado por cima, por
 * isso nunca fica abaixo de 12 px, nem no celular. A faixa de leitura acima do gráfico mostra o mês sob o cursor (ou o último, sem
 * interação) com os dois valores e a diferença: funciona com mouse, toque e teclado (setas, pelo controle deslizante invisível sobre
 * o gráfico) e, sem JavaScript, fica no último mês. No celular os rótulos de fim de linha viram a legenda de cima.
 */
export function Tesoura({
  titulo,
  meses,
  a,
  b,
  formato,
  casas = 1,
  base,
  rotuloBase,
  rotuloArea,
  rotuloAreaAbaixo,
  corArea = "var(--escala-varejo-pos-1)",
  corAreaAbaixo = "var(--escala-varejo-neg-1)",
  marcos = [],
  altura = 380,
  alturaCelular = 250,
}: Readonly<{
  /** Nome acessível da figura. */
  titulo: string;
  meses: readonly string[];
  /** A série de cima na leitura (a diferença é `a` menos `b`). */
  a: SerieTesoura;
  b: SerieTesoura;
  /** "indice": valores sem sinal e diferença em pontos do índice; "variacao": valores em % com sinal e diferença em p.p. */
  formato: "indice" | "variacao";
  casas?: number;
  /** Linha de referência horizontal (100 no índice, 0 na variação), sempre dentro do eixo. */
  base: number;
  rotuloBase?: string;
  /** O que a área significa quando `a` está acima de `b`. */
  rotuloArea: string;
  /** O que a área significa quando `a` está abaixo de `b`; sem ele, a área de baixo usa o mesmo rótulo e a mesma cor. */
  rotuloAreaAbaixo?: string;
  corArea?: string;
  corAreaAbaixo?: string;
  /** Marcos verticais que vêm da fonte (mudança de cobertura), nunca eventos inventados. */
  marcos?: readonly { mes: string; rotulo: string }[];
  altura?: number;
  alturaCelular?: number;
}>) {
  const n = meses.length;
  const ultimo = (() => {
    for (let i = n - 1; i >= 0; i--) if (a.valores[i] !== null && b.valores[i] !== null) return i;
    return Math.max(0, n - 1);
  })();
  const [cursor, setCursor] = useState<number | null>(null);
  const i = cursor ?? ultimo;

  const L = 1000;
  const A = 400;
  const { min, max, marcas } = eixo([...a.valores, ...b.valores], { n: 5, incluir: base });
  const x = linear([0, Math.max(1, n - 1)], [0, L]);
  const y = linear([min, max], [A - 6, 6]);
  const pctX = (k: number) => (100 * x(k)) / L;
  const pctY = (v: number) => (100 * y(v)) / A;
  const area = areaEntre(a.valores, b.valores, x, y);
  const tempo = marcasDeTempo(meses);
  const valor = (v: number | null) => (v === null ? SEM_DADO : formato === "indice" ? num(v, casas) : variacao(v, casas));
  const dif = (k: number) => {
    const p = a.valores[k];
    const q = b.valores[k];
    return p === null || q === null ? null : p - q;
  };
  const difTexto = (d: number | null) => (d === null ? SEM_DADO : formato === "indice" ? `${d > 0 ? "+" : ""}${num(d, casas)} ${Math.abs(d) < 2 && Math.abs(d) >= 1 ? "ponto" : "pontos"}` : fmtPp(d, casas));
  const fa = a.valores[ultimo];
  const fb = b.valores[ultimo];
  // rótulos de fim de linha: afastados quando as duas pontas ficam a menos de 11% da altura uma da outra
  let ya = fa === null ? 50 : pctY(fa);
  let yb = fb === null ? 50 : pctY(fb);
  if (Math.abs(ya - yb) < 11) {
    const meio = (ya + yb) / 2;
    const cima = ya <= yb;
    ya = meio + (cima ? -5.5 : 5.5);
    yb = meio + (cima ? 5.5 : -5.5);
  }
  const aoMover = (ev: PointerEvent<HTMLDivElement>) => {
    if (ev.pointerType !== "mouse") return;
    const r = ev.currentTarget.getBoundingClientRect();
    const k = Math.round(((ev.clientX - r.left) / Math.max(1, r.width)) * (n - 1));
    setCursor(Math.min(n - 1, Math.max(0, k)));
  };
  const d = dif(i);
  const primeiro = a.valores.findIndex((v, k) => v !== null && b.valores[k] !== null);
  const descricao =
    primeiro >= 0
      ? `${titulo}. Em ${mesExtenso(meses[primeiro])}: ${a.rotulo.toLowerCase()} ${valor(a.valores[primeiro])}, ${b.rotulo.toLowerCase()} ${valor(b.valores[primeiro])}. Em ${mesExtenso(meses[ultimo])}: ${a.rotulo.toLowerCase()} ${valor(fa)}, ${b.rotulo.toLowerCase()} ${valor(fb)}, diferença de ${difTexto(dif(ultimo))}.`
      : `${titulo}: sem valores publicados no período.`;
  const alturas = { "--h": `${alturaCelular}px`, "--h-sm": `${altura}px` } as CSSProperties;
  const temAbaixo = Boolean(area.abaixo);

  return (
    <div data-grafico="tesoura" data-figura-varejo="tesoura" className="min-w-0">
      <p className="sr-only">{descricao}</p>

      {/* faixa de leitura: o mês sob o cursor (ou o último), os dois valores e a diferença */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-y border-linha py-3 sm:grid-cols-[minmax(0,0.9fr)_repeat(3,minmax(0,1fr))]" data-leitura-tesoura="" aria-hidden="true">
        <div className="col-span-2 sm:col-span-1">
          <dt className="t-meta text-carvao-muted">Mês</dt>
          <dd className="numero-p text-carvao">{mesCurto(meses[i])}</dd>
        </div>
        {[a, b].map((s) => (
          <div key={s.rotulo}>
            <dt className="t-meta flex items-center gap-2 text-carvao-muted">
              <span className="h-[3px] w-4 shrink-0" style={{ background: s.cor }} />
              {s.rotulo}
            </dt>
            <dd className="numero-p tabular-nums text-carvao">{valor(s.valores[i])}</dd>
          </div>
        ))}
        <div className="col-span-2 sm:col-span-1">
          <dt className="t-meta flex items-center gap-2 text-carvao-muted">
            <span className="h-3 w-4 shrink-0" style={{ background: d !== null && d < 0 && rotuloAreaAbaixo ? corAreaAbaixo : corArea }} />
            {d !== null && d < 0 && rotuloAreaAbaixo ? rotuloAreaAbaixo : rotuloArea}
          </dt>
          <dd className="numero-p tabular-nums text-carvao">{difTexto(d)}</dd>
        </div>
      </dl>

      <div className="mt-4 grid grid-cols-[2.5rem_minmax(0,1fr)] sm:grid-cols-[2.75rem_minmax(0,1fr)_9.5rem]">
        {/* eixo vertical */}
        <div className="relative h-[var(--h)] sm:h-[var(--h-sm)]" style={alturas} aria-hidden="true">
          {marcas.map((m) => (
            <span key={m} className={`absolute right-2 -translate-y-1/2 text-xs tabular-nums ${m === base ? "text-carvao" : "text-mineral"}`} style={{ top: `${pctY(m)}%` }}>
              {num(m, Number.isInteger(m) ? 0 : 1)}
            </span>
          ))}
        </div>

        {/* área do gráfico */}
        <div className="relative h-[var(--h)] touch-pan-y sm:h-[var(--h-sm)]" style={alturas} onPointerMove={aoMover} onPointerLeave={() => setCursor(null)}>
          <svg viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true" focusable="false">
            {marcas.map((m) => (
              <line key={m} x1={0} x2={L} y1={y(m)} y2={y(m)} stroke={m === base ? "var(--cor-mineral)" : "var(--cor-grade)"} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {marcos.map((mc) => {
              const k = meses.indexOf(mc.mes);
              return k < 0 ? null : <line key={mc.mes} x1={x(k)} x2={x(k)} y1={0} y2={A} stroke="var(--cor-mineral)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />;
            })}
            {area.acima && <path d={area.acima} fill={corArea} fillOpacity={0.6} />}
            {area.abaixo && <path d={area.abaixo} fill={rotuloAreaAbaixo ? corAreaAbaixo : corArea} fillOpacity={0.6} />}
            <path d={caminho(b.valores, x, y)} fill="none" stroke={b.cor} strokeWidth={b.espessura ?? 2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path d={caminho(a.valores, x, y)} fill="none" stroke={a.cor} strokeWidth={a.espessura ?? 2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>

          {marcos.map((mc) => {
            const k = meses.indexOf(mc.mes);
            if (k < 0) return null;
            const esquerda = pctX(k) > 55;
            return (
              <span key={mc.mes} className={`pointer-events-none absolute top-0 max-w-[11rem] bg-papel px-1.5 text-xs leading-snug text-carvao-muted ${esquerda ? "-translate-x-full text-right" : ""}`} style={{ left: `${pctX(k)}%` }}>
                {mc.rotulo}
              </span>
            );
          })}

          {/* cursor do mês em leitura e os dois pontos */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-carvao/50" style={{ left: `${pctX(i)}%` }} />
          {[a, b].map((s) => {
            const v = s.valores[i];
            return v === null ? null : (
              <span key={s.rotulo} aria-hidden="true" className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-papel" style={{ left: `${pctX(i)}%`, top: `${pctY(v)}%`, background: s.cor }} />
            );
          })}

          {/* teclado e toque: um controle deslizante nativo, invisível, sobre o gráfico */}
          <input
            type="range"
            min={0}
            max={Math.max(0, n - 1)}
            step={1}
            value={i}
            onChange={(ev) => setCursor(Number(ev.target.value))}
            aria-label={`${titulo}: mês em leitura`}
            aria-valuetext={`${mesExtenso(meses[i])}: ${a.rotulo.toLowerCase()} ${valor(a.valores[i])}, ${b.rotulo.toLowerCase()} ${valor(b.valores[i])}, diferença de ${difTexto(d)}`}
            className="peer absolute inset-0 h-full w-full cursor-crosshair opacity-0"
          />
          <span aria-hidden="true" className="pointer-events-none absolute -inset-1 hidden outline outline-2 outline-offset-2 outline-carvao peer-focus-visible:block" />
        </div>

        {/* rótulos diretos no fim das linhas (a partir de 640 px; no celular a faixa de leitura faz esse papel) */}
        <div className="relative hidden h-[var(--h-sm)] sm:block" style={alturas} aria-hidden="true">
          {(
            [
              [a, ya, fa],
              [b, yb, fb],
            ] as const
          ).map(([s, top, v]) => (
            <span key={s.rotulo} className="absolute left-3 -translate-y-1/2 text-sm leading-tight text-carvao" style={{ top: `${top}%` }}>
              <span className="block font-medium" style={{ color: s.cor === "var(--serie-referencia)" ? "var(--cor-carvao-muted)" : s.cor }}>
                {s.rotulo}
              </span>
              <span className="block text-xs tabular-nums text-carvao-muted">
                {valor(v)} em {mesCurto(meses[ultimo])}
              </span>
            </span>
          ))}
        </div>

        {/* eixo do tempo */}
        <div aria-hidden="true" />
        <div className="relative mt-1.5 h-5" aria-hidden="true">
          {tempo.map((t) => (
            <span key={t.i} className={`absolute text-xs tabular-nums text-mineral ${pctX(t.i) < 4 ? "" : pctX(t.i) > 96 ? "-translate-x-full" : "-translate-x-1/2"}`} style={{ left: `${pctX(t.i)}%` }}>
              {t.rotulo}
            </span>
          ))}
        </div>
      </div>

      <ul className="t-meta mt-3 flex flex-wrap gap-x-5 gap-y-1 text-carvao-muted" aria-hidden="true">
        <li className="flex items-center gap-2">
          <span className="h-3 w-4 shrink-0" style={{ background: corArea, opacity: 0.6 }} />
          {rotuloArea}
        </li>
        {temAbaixo && rotuloAreaAbaixo && (
          <li className="flex items-center gap-2">
            <span className="h-3 w-4 shrink-0" style={{ background: corAreaAbaixo, opacity: 0.6 }} />
            {rotuloAreaAbaixo}
          </li>
        )}
        {rotuloBase && (
          <li className="flex items-center gap-2">
            <span className="h-px w-4 shrink-0 bg-mineral" />
            {rotuloBase}
          </li>
        )}
        <li className="hidden [@media(hover:none)]:list-item">Arraste o dedo sobre o gráfico para ler outro mês.</li>
      </ul>
    </div>
  );
}
