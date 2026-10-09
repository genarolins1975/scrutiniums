"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { dominioComZero, rotuloTick } from "@/lib/energia/escalas";
import { COR_NATUREZA, type NaturezaDaFonte } from "@/lib/energia/geracao";
import type { NaturezaGeracao } from "@/lib/energia/tipos-geracao";

/**
 * Barras horizontais por fonte, para comparar fontes (a pergunta é "quanto cada uma representa", não "como se divide ao longo do
 * tempo"). Cada barra parte de zero, o nome fica ao lado dela e o valor na ponta; a energia em MWmed acompanha o percentual, porque
 * o percentual esconde a escala. Medição é barra cheia; estimativa do ONS (a MMGD) e previsão do ONS (as térmicas Tipo III) são
 * barra vazada com contorno tracejado e o selo de natureza no nome: a forma e o texto dizem o que a cor sozinha não diria.
 * Categoria com cobertura alterada na fonte leva a marca "cobertura alterada" (o texto por extenso vem na legenda do gráfico).
 *
 * Interação como a dos demais gráficos de barras do módulo: Tab entra, as setas percorrem as barras, Home e End vão aos extremos,
 * Enter ou Espaço selecionam, e a seleção é controlada pela página (a mesma categoria na tabela e na análise). Sem `onSelecionar`
 * a lista é só leitura. Cada linha é texto (nome, valor e energia), então o gráfico também é lido como lista.
 */
export type ItemBarraFonte = {
  id: string;
  rotulo: string;
  /** Valor em %, como publicado. */
  valor: number;
  /** Valor já formatado (pt-BR) com a unidade. */
  texto: string;
  /** Segunda medida da linha (a energia em MWmed). */
  auxiliar?: string;
  natureza: NaturezaDaFonte;
  /** A fonte publicou outro número de usinas com dado: a participação não se compara com a de outro período. */
  cobertura?: boolean;
};

/** O selo diz "Estimado" ou "Previsto"; o texto ao lado diz por quem e que não é medição. */
const TEXTO_NATUREZA: Record<Exclude<NaturezaDaFonte, "medicao">, string> = {
  estimativa: "pelo ONS, não medição",
  previsao: "pelo ONS, não medição",
};

/**
 * Mesma grade nas linhas e no eixo: nome, barra e valor. No celular o nome e o valor ficam numa linha e a barra vai abaixo. As
 * linhas são enxutas de propósito: o estilo comum mora na lista (seletores filhos), para a marcação de cada linha não repetir as
 * classes (a página tem de caber em cerca de 600 KB de HTML).
 */
const GRADE = "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_6.5rem]";
const LISTA =
  "mt-2 text-sm leading-snug text-carvao [&>li>*]:grid [&>li>*]:min-h-[44px] [&>li>*]:w-full [&>li>*]:grid-cols-[minmax(0,1fr)_auto] [&>li>*]:items-center [&>li>*]:gap-x-4 [&>li>*]:px-2 [&>li>*]:py-1.5 [&>li>*]:text-left sm:[&>li>*]:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_6.5rem] [&>li>button:hover]:bg-energia-fundo [&>li>button:focus-visible]:outline [&>li>button:focus-visible]:outline-2 [&>li>button:focus-visible]:-outline-offset-2 [&>li>button:focus-visible]:outline-energia";

/** Medição é barra cheia com contorno; estimativa e previsão do ONS, barra vazada com contorno tracejado (o contorno também aparece em alto contraste). */
const BARRA: Record<NaturezaDaFonte, string> = {
  medicao: "bg-energia border border-energia",
  estimativa: "bg-energia/20 border-2 border-dashed border-energia",
  previsao: "bg-energia/20 border-2 border-dashed border-energia",
};

export function BarrasPorFonte({
  titulo,
  subtitulo,
  unidade = "%",
  itens,
  selecionado = null,
  onSelecionar,
  rodape,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  unidade?: string;
  itens: readonly ItemBarraFonte[];
  selecionado?: string | null;
  onSelecionar?: (id: string | null) => void;
  /** Texto sob o eixo que pertence ao gráfico (o total e o fechamento da composição). */
  rodape?: ReactNode;
}) {
  const [cursor, setCursor] = useState(0);
  const alvos = useRef<(HTMLButtonElement | null)[]>([]);
  const dom = dominioComZero(itens.map((i) => i.valor));
  const teto = dom.max > 0 ? dom.max : 1;
  const ticks = dom.ticks.filter((t) => t > 0 && t <= teto);
  const cursorEfetivo = Math.min(cursor, Math.max(itens.length - 1, 0));

  function irPara(j: number) {
    const alvo = Math.max(0, Math.min(itens.length - 1, j));
    setCursor(alvo);
    alvos.current[alvo]?.focus();
  }

  function teclado(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const k = e.key;
    if (k === "ArrowDown" || k === "ArrowRight") irPara(i + 1);
    else if (k === "ArrowUp" || k === "ArrowLeft") irPara(i - 1);
    else if (k === "Home") irPara(0);
    else if (k === "End") irPara(itens.length - 1);
    else return;
    e.preventDefault();
  }

  if (!itens.length) {
    return (
      <div data-grafico="barras" data-orientacao="horizontal" className="border border-dashed border-linha px-4 py-6 text-sm text-carvao-muted">
        <p data-titulo-grafico="true">{titulo}</p>
        <p className="mt-1">Nenhuma categoria com dado nesta janela.</p>
      </div>
    );
  }

  return (
    <div data-grafico="barras" data-orientacao="horizontal" className="w-full">
      <p data-titulo-grafico="true" className="text-sm font-medium text-carvao">
        {titulo}
        <span className="font-normal text-mineral">, em {unidade}</span>
      </p>
      {subtitulo && <p className="mt-0.5 text-xs leading-relaxed text-carvao-muted">{subtitulo}</p>}
      <ol className={LISTA} aria-label={titulo}>
        {itens.map((it, i) => {
          const sel = it.id === selecionado;
          const conteudo = (
            <>
              <span className="min-w-0">
                <span className="block [overflow-wrap:anywhere]">{it.rotulo}</span>
                {it.natureza !== "medicao" && (
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-carvao-muted">
                    <SeloNatureza natureza={it.natureza === "estimativa" ? "ESTIMADO" : "PREVISTO"} texto />
                    <span>{TEXTO_NATUREZA[it.natureza]}</span>
                  </span>
                )}
                {it.cobertura && <span className="mt-0.5 block text-xs text-carvao-muted">cobertura da fonte alterada</span>}
              </span>
              <span className="text-right tabular-nums sm:order-3">
                <span className="block font-medium">{it.texto}</span>
                {it.auxiliar && <span className="block text-xs text-carvao-muted">{it.auxiliar}</span>}
              </span>
              <span aria-hidden="true" className="relative col-span-2 mt-1.5 block h-4 bg-linha/40 sm:order-2 sm:col-span-1 sm:mt-0">
                <span
                  className={`absolute inset-y-0 left-0 box-border block ${BARRA[it.natureza]}`}
                  style={{ width: `${Math.max((it.valor / teto) * 100, 0).toFixed(2)}%`, minWidth: it.valor > 0 ? 3 : 0 }}
                />
              </span>
            </>
          );
          return (
            <li key={it.id} className={sel ? "bg-energia-fundo" : undefined}>
              {onSelecionar ? (
                <button
                  type="button"
                  ref={(el) => {
                    alvos.current[i] = el;
                  }}
                  aria-pressed={sel}
                  tabIndex={i === cursorEfetivo ? 0 : -1}
                  onFocus={() => setCursor(i)}
                  onKeyDown={(e) => teclado(e, i)}
                  onClick={() => onSelecionar(sel ? null : it.id)}
                >
                  {conteudo}
                </button>
              ) : (
                <div>{conteudo}</div>
              )}
            </li>
          );
        })}
      </ol>
      <div aria-hidden="true" className={`${GRADE} mt-1 px-2 text-xs tabular-nums text-mineral`}>
        <span className="hidden sm:block" />
        <span className="relative col-span-2 block h-4 sm:col-span-1">
          <span className="absolute left-0">0</span>
          {ticks.map((t) => (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: `${(t / teto) * 100}%` }}>
              {rotuloTick(t, dom.passo)}
              {t === ticks[ticks.length - 1] ? unidade : ""}
            </span>
          ))}
        </span>
      </div>
      {rodape}
    </div>
  );
}

/**
 * Natureza da energia da janela numa barra única que fecha 100%: medição das usinas, previsão do ONS (grupos Tipo III) e estimativa
 * do ONS (a MMGD). Empilhar só se justifica porque as três partes somam o todo, e cada parte leva rótulo, glifo e valor na legenda.
 */
export function BarraNatureza({
  titulo,
  partes,
}: {
  titulo: string;
  partes: { id: NaturezaGeracao; rotulo: string; pct: number; texto: string }[];
}) {
  const GLIFO: Record<NaturezaGeracao, string> = { verificada: "●", grupo_tipo3: "◌", grupo_mmgd: "◐" };
  const leitura = partes.map((p) => `${p.rotulo} ${p.texto}`).join("; ");
  return (
    <div data-grafico="barras" data-orientacao="horizontal" className="w-full">
      <p data-titulo-grafico="true" className="text-sm font-medium text-carvao">
        {titulo}
        <span className="font-normal text-mineral">, em %</span>
      </p>
      <div role="img" aria-label={`${titulo}: ${leitura}`} className="mt-3 flex h-9 w-full gap-0.5" style={{ forcedColorAdjust: "none" }}>
        {partes.map((p) => (
          <span key={p.id} className="block h-full" style={{ width: `${p.pct}%`, minWidth: p.pct > 0 ? 3 : 0, background: COR_NATUREZA[p.id] }} />
        ))}
      </div>
      <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-3" aria-label="Legenda">
        {partes.map((p) => (
          <li key={p.id} className="flex items-start gap-2 text-sm leading-snug text-carvao">
            <span aria-hidden="true" className="mt-[0.3em] inline-block h-2.5 w-2.5 shrink-0" style={{ background: COR_NATUREZA[p.id] }} />
            <span className="min-w-0">
              <span aria-hidden="true" className="mr-1 text-carvao-muted">
                {GLIFO[p.id]}
              </span>
              <span className="[overflow-wrap:anywhere]">{p.rotulo}</span>
              <span className="block font-medium tabular-nums">{p.texto}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
