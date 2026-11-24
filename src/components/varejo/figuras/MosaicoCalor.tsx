"use client";

import Link from "next/link";
import { useState, type PointerEvent } from "react";
import { mesCurto, mesExtenso, SEM_DADO, variacao } from "@/lib/varejo/formato";
import { corDoPasso, passoDivergente } from "./escala";
import { marcasDeTempo } from "./geometria";
import { LegendaDivergente } from "./MapaBlocos";

export type LinhaMosaico = { id: string; nome: string; valores: readonly (number | null)[]; href?: string };
export type ContagemMes = { alta: number; queda: number; estavel: number; semDado: number };

/**
 * Mosaico de calor: uma faixa por linha (atividade), uma coluna por mês, cor pela variação na escala divergente do Varejo. Mostra de
 * relance onde e quando as atividades andaram juntas ou separadas. Com `contagem`, a faixa de cima conta, mês a mês, quantas linhas
 * subiram (barras para cima) e quantas caíram (para baixo), a partir do zero: é a difusão, no mesmo eixo de tempo do mosaico.
 *
 * As faixas são SVG esticado (um retângulo por mês); nomes, valores e anos são HTML. A coluna de valores à direita mostra o mês em
 * leitura, que começa no mês escolhido na página e acompanha o cursor, o dedo arrastado sobre as faixas ou as setas do teclado (controle deslizante invisível).
 * "Abrir este mês" leva ao endereço com `?mes=`, para o resto da página sair no mês lido. Mês sem valor publicado é um traço fino,
 * nunca a cor do centro. No celular, o nome de cada linha fica acima da faixa e as colunas viram um código de barras.
 */
export function MosaicoCalor({ titulo, meses, linhas, contagem, limite, mesInicial, hrefDoMes, unidade = "%", rotuloContagem = "atividades" }: Readonly<{
  /** Nome acessível. */
  titulo: string;
  meses: readonly string[];
  linhas: readonly LinhaMosaico[];
  contagem?: readonly ContagemMes[];
  limite: number;
  /** Mês em leitura ao abrir (o mês da página). */
  mesInicial?: string;
  /** Modelo do endereço do mês, com `__MES__` no lugar do mês ("/varejo/brasil?mes=__MES__#difusao"). */
  hrefDoMes?: string;
  unidade?: string;
  rotuloContagem?: string;
}>) {
  const n = meses.length;
  const inicial = Math.max(0, mesInicial ? meses.indexOf(mesInicial) : n - 1);
  const [cursor, setCursor] = useState<number | null>(null);
  const i = cursor ?? inicial;
  const tempo = marcasDeTempo(meses, 10);
  const total = contagem ? Math.max(1, ...contagem.map((c) => c.alta + c.queda + c.estavel + c.semDado)) : 1;
  const aoMover = (ev: PointerEvent<HTMLDivElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    setCursor(Math.min(n - 1, Math.max(0, Math.floor(((ev.clientX - r.left) / Math.max(1, r.width)) * n))));
  };
  // o mouse devolve a leitura ao mês da página quando sai; o dedo deixa a leitura onde parou
  const aoSair = (ev: PointerEvent<HTMLDivElement>) => {
    if (ev.pointerType === "mouse") setCursor(null);
  };
  const c = contagem?.[i];
  const grade = "md:grid md:grid-cols-[17.5rem_minmax(0,1fr)_4.5rem] md:items-center md:gap-x-4";
  const marcador = <span aria-hidden="true" className="pointer-events-none absolute -inset-y-0.5 border-x-2 border-carvao" style={{ left: `${(100 * i) / n}%`, width: `${100 / n}%`, minWidth: 3 }} />;
  return (
    <div data-grafico="mosaico" data-figura-varejo="mosaico" className="min-w-0">
      <p className="sr-only">
        {titulo}. {linhas.length} linhas por {n} meses, de {mesExtenso(meses[0])} a {mesExtenso(meses[n - 1])}. Os valores de cada mês estão na tabela equivalente.
      </p>

      {/* o mês em leitura */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-y border-linha py-3" data-leitura-mosaico="">
        <p className="text-carvao" aria-hidden="true">
          <span className="numero-p">{mesCurto(meses[i])}</span>
          {c && (
            <span className="t-meta ml-3 text-carvao-muted">
              {c.alta} em alta, {c.queda} em queda{c.estavel > 0 ? `, ${c.estavel} ${c.estavel === 1 ? "estável" : "estáveis"}` : ""}{c.semDado > 0 ? `, ${c.semDado} sem valor` : ""}
            </span>
          )}
        </p>
        {hrefDoMes && (
          <Link href={hrefDoMes.replace("__MES__", meses[i])} prefetch={false} scroll={false} className="inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 [@media(hover:hover)]:hover:decoration-carvao">
            Abrir {mesExtenso(meses[i])} na lista abaixo
          </Link>
        )}
      </div>

      <div className="relative mt-4">
        {/* difusão: quantas subiram e quantas caíram em cada mês, a partir do zero */}
        {contagem && (
          <div className={`${grade} mb-3`} data-faixa-difusao="">
            <p className="text-sm leading-snug text-carvao">
              Quantas {rotuloContagem} subiram
              <span className="block text-carvao-muted">e quantas caíram</span>
            </p>
            <div className="relative mt-1 h-20 touch-pan-y md:mt-0" onPointerDown={aoMover} onPointerMove={aoMover} onPointerLeave={aoSair}>
              <svg viewBox={`0 0 ${n} ${2 * total}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
                {contagem.map((k, j) => (
                  <g key={j}>
                    {k.alta > 0 && <rect x={j + 0.08} width={0.84} y={total - k.alta} height={k.alta} fill="var(--escala-varejo-pos-2)" />}
                    {k.queda > 0 && <rect x={j + 0.08} width={0.84} y={total} height={k.queda} fill="var(--escala-varejo-neg-2)" />}
                  </g>
                ))}
                <line x1={0} x2={n} y1={total} y2={total} stroke="var(--cor-carvao)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              </svg>
              {marcador}
            </div>
            <p className="hidden text-xs leading-tight text-mineral md:block" aria-hidden="true">
              <span className="block">↑ até {total}</span>
              <span className="mt-9 block">↓ até {total}</span>
            </p>
          </div>
        )}

        <ol className="space-y-2 md:space-y-1">
          {linhas.map((l) => {
            const v = l.valores[i];
            return (
              <li key={l.id} className={grade} data-linha-mosaico={l.id}>
                <p className="flex items-baseline justify-between gap-3 text-sm leading-snug text-carvao md:block">
                  {l.href ? (
                    <Link href={l.href} prefetch={false} className="underline decoration-linha underline-offset-4 [@media(hover:hover)]:hover:decoration-carvao">
                      {l.nome}
                    </Link>
                  ) : (
                    l.nome
                  )}
                  <span className="shrink-0 tabular-nums text-carvao-muted md:hidden" aria-hidden="true">{v === null ? SEM_DADO : variacao(v)}</span>
                </p>
                <div className="relative mt-1 h-6 touch-pan-y md:mt-0 md:h-7" onPointerDown={aoMover} onPointerMove={aoMover} onPointerLeave={aoSair}>
                  <svg viewBox={`0 0 ${n} 1`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
                    {l.valores.map((x, j) => {
                      const passo = passoDivergente(x, limite);
                      return passo ? <rect key={j} x={j + 0.04} width={0.92} y={0} height={1} fill={corDoPasso(passo)} /> : <rect key={j} x={j + 0.04} width={0.92} y={0.45} height={0.1} fill="var(--cor-mineral-soft)" />;
                    })}
                  </svg>
                  {marcador}
                </div>
                <p className="hidden text-right text-sm tabular-nums text-carvao md:block" aria-hidden="true">{v === null ? <span className="text-xs text-mineral">{SEM_DADO}</span> : variacao(v)}</p>
              </li>
            );
          })}
        </ol>

        {/* eixo do tempo, alinhado às faixas */}
        <div className={`${grade} mt-1`} aria-hidden="true">
          <span />
          <div className="relative h-5">
            {tempo.map((t) => (
              <span key={t.i} className="absolute border-l border-mineral-soft pl-1 text-xs tabular-nums text-mineral" style={{ left: `${(100 * t.i) / n}%` }}>
                {t.rotulo}
              </span>
            ))}
          </div>
          <span />
        </div>

        {/* teclado: controle deslizante nativo, invisível, sobre a área das faixas (mouse e dedo leem direto nas faixas) */}
        <div className={`${grade} pointer-events-none absolute inset-0`}>
          <span className="hidden md:block" />
          <div className="relative h-full">
            <input
              type="range"
              min={0}
              max={n - 1}
              step={1}
              value={i}
              onChange={(ev) => setCursor(Number(ev.target.value))}
              aria-label={`${titulo}: mês em leitura`}
              aria-valuetext={`${mesExtenso(meses[i])}${c ? `: ${c.alta} em alta, ${c.queda} em queda` : ""}. ${linhas.map((l) => `${l.nome} ${l.valores[i] === null ? SEM_DADO : variacao(l.valores[i])}`).join("; ")}`}
              className="peer pointer-events-none absolute inset-0 h-full w-full opacity-0"
            />
            <span aria-hidden="true" className="pointer-events-none absolute -inset-1 hidden outline outline-2 outline-offset-2 outline-carvao peer-focus-visible:block" />
          </div>
          <span className="hidden md:block" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-x-10 gap-y-3">
        <LegendaDivergente limite={limite} unidade={unidade} semValor={linhas.some((l) => l.valores.some((x) => x === null))} />
        {contagem && (
          <ul className="t-meta flex flex-wrap gap-x-5 gap-y-1 text-carvao-muted" aria-label="Legenda da contagem">
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-3 shrink-0" style={{ background: "var(--escala-varejo-pos-2)" }} />
              {rotuloContagem} em alta no mês
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-3 shrink-0" style={{ background: "var(--escala-varejo-neg-2)" }} />
              em queda
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
