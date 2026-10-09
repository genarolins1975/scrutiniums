"use client";

import { useEffect, useId, useRef, useState } from "react";
import { diaSerial, ticksTempo } from "@/lib/energia/calendario";
import {
  alternarEstado,
  atrasoDoMarco,
  datasDoCronograma,
  estadosDisponiveis,
  filtrarPorEstado,
  previsaoMaisRecente,
  previsoesOrdenadas,
  rotuloAtraso,
  textoAtraso,
  type Atraso,
  type DataBaseCronograma,
  type ItemCronograma,
  type MarcoCronograma,
} from "@/lib/energia/cronograma";
import { escalaLinear } from "@/lib/energia/escalas";
import { dataBR } from "@/lib/energia/formato";

/**
 * Cronograma de expansão: uma linha do tempo por marco de cada item (usina,
 * linha de transmissão), com o que era previsto e o que aconteceu separados
 * (gramática de gráficos, seção 8.2; módulo Expansão, seção 9.9).
 *
 * - Previsão é círculo vazado, uma marca por previsão informada (snapshot),
 *   com a mais recente em traço mais grosso: o deslizamento do cronograma
 *   fica visível. Realizado é círculo cheio. Forma e preenchimento, não só
 *   cor, distinguem as duas coisas.
 * - Atraso só com data-base declarada (prop `dataBase`): a régua é a
 *   previsão vigente naquela data, marcada com losango vazado. Sem data-base
 *   não há coluna de atraso e a legenda diz por quê. Atraso realizado e
 *   deslocamento de previsão ainda não realizada têm rótulos distintos.
 * - Marco sem previsão nem realizado diz "sem dado"; nada é desenhado numa
 *   data inventada.
 * - Filtro por estado (estágio, UF, o que o rótulo disser) em caixas de
 *   seleção nativas, controlável por props para ir à URL. O eixo de tempo é
 *   o de todos os itens: filtrar não muda a escala em silêncio.
 * - Cada marco é alvo de foco com 44 px de altura (tabindex itinerante):
 *   setas percorrem, Home e End vão aos extremos; a dica aparece no foco, no
 *   toque e no hover, e a leitura completa está no rótulo acessível.
 * - Tabela equivalente com todas as previsões, o realizado e o atraso.
 */
export type CronogramaProps = {
  titulo: string;
  itens: ItemCronograma[];
  /** Régua do atraso (ex.: { data: "2022-06-30", rotulo: "cronograma da outorga" }); sem ela, atraso não é calculado. */
  dataBase?: DataBaseCronograma | null;
  /** Nome do campo `estado` no filtro (ex.: "Estágio", "UF"). */
  rotuloFiltro?: string;
  /** Estados visíveis controlados (null = todos); use com onEstados. */
  estados?: string[] | null;
  estadosIniciais?: string[] | null;
  onEstados?: (estados: string[] | null) => void;
  /** Acima desta altura a área dos marcos rola na vertical. */
  alturaMaxima?: number;
};

const LARGURA_SSR = 760;
const ALTURA_MARCO = 44;
const ALTURA_ITEM = 30;
const PX_CARACTERE = 6.4;

const r1 = (v: number) => Math.round(v * 10) / 10;

function cabe(texto: string, largura: number): string {
  if (texto.length * PX_CARACTERE <= largura) return texto;
  const n = Math.floor(largura / PX_CARACTERE) - 1;
  return n >= 3 ? `${texto.slice(0, n).trimEnd()}…` : "";
}

const losango = (x: number, y: number, m = 8) => `${r1(x)},${r1(y - m)} ${r1(x + m)},${r1(y)} ${r1(x)},${r1(y + m)} ${r1(x - m)},${r1(y)}`;

type Linha =
  | { tipo: "item"; item: ItemCronograma; y: number }
  | { tipo: "marco"; item: ItemCronograma; marco: MarcoCronograma; y: number; chave: string; atraso: Atraso };

function leituraMarco(item: ItemCronograma, m: MarcoCronograma, a: Atraso, comAtraso: boolean): string {
  const ps = previsoesOrdenadas(m.previsoes);
  const recente = ps.at(-1);
  const prev = recente
    ? `previsão mais recente ${dataBR(recente.data)}, informada em ${dataBR(recente.informadaEm)}; ${ps.length} ${ps.length === 1 ? "previsão registrada" : "previsões registradas"}`
    : "sem previsão registrada";
  const real = m.realizado ? `realizado em ${dataBR(m.realizado)}` : "sem data realizada";
  return `${item.rotulo}, ${m.rotulo}: ${prev}; ${real}${comAtraso ? `; ${textoAtraso(a)}` : ""}`;
}

export function Cronograma({
  titulo,
  itens,
  dataBase = null,
  rotuloFiltro = "Estado",
  estados: estadosControlados,
  estadosIniciais = null,
  onEstados,
  alturaMaxima = 560,
}: CronogramaProps) {
  const uid = useId().replace(/:/g, "");
  const [largura, setLargura] = useState(LARGURA_SSR);
  const [estadosInternos, setEstadosInternos] = useState<string[] | null>(estadosIniciais);
  const [ativo, setAtivo] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [focoVisivel, setFocoVisivel] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const raiz = useRef<HTMLDivElement>(null);
  const alvos = useRef<Map<string, SVGGElement>>(new Map());

  useEffect(() => {
    const el = raiz.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setLargura(Math.max(280, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (ativo === null) return;
    const fora = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAtivo(null);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [ativo]);

  const comAtraso = !!dataBase && diaSerial(dataBase.data) !== null;
  const disponiveis = estadosDisponiveis(itens);
  const todos = disponiveis.map((e) => e.estado);
  const selecionados = estadosControlados !== undefined ? estadosControlados : estadosInternos;
  const visiveis = filtrarPorEstado(itens, selecionados);

  function mudarEstados(novo: string[] | null) {
    if (estadosControlados === undefined) setEstadosInternos(novo);
    onEstados?.(novo);
    const vis = filtrarPorEstado(itens, novo);
    setAnuncio(`Mostrando ${vis.length} de ${itens.length} itens.`);
  }

  // eixo de tempo de todos os itens (não só dos filtrados): filtrar não muda a escala
  const seriais = datasDoCronograma(itens)
    .map((d) => diaSerial(d))
    .filter((s): s is number => s !== null);
  const sBase = comAtraso ? (diaSerial(dataBase?.data) as number) : null;
  if (sBase !== null) seriais.push(sBase);
  let sMin = seriais.length ? Math.min(...seriais) : 0;
  let sMax = seriais.length ? Math.max(...seriais) : 1;
  const folga = Math.max(15, Math.round((sMax - sMin) * 0.03));
  sMin -= folga;
  sMax += folga;

  const w = largura;
  const colRotulo = Math.round(Math.min(220, Math.max(96, w * 0.3)));
  const colAtraso = comAtraso ? (w < 520 ? 88 : 128) : 0;
  const x = escalaLinear([sMin, sMax], [colRotulo + 12, w - colAtraso - 16]);
  const marcasTempo = ticksTempo(sMin, sMax, w < 520 ? 3 : 6);

  const linhas: Linha[] = [];
  let yy = 0;
  for (const item of visiveis) {
    linhas.push({ tipo: "item", item, y: yy });
    yy += ALTURA_ITEM;
    for (const marco of item.marcos) {
      linhas.push({ tipo: "marco", item, marco, y: yy, chave: `${item.id}::${marco.id}`, atraso: atrasoDoMarco(marco, dataBase) });
      yy += ALTURA_MARCO;
    }
  }
  const h = yy;
  const marcos = linhas.filter((l): l is Extract<Linha, { tipo: "marco" }> => l.tipo === "marco");
  const chaves = marcos.map((m) => m.chave);
  const chaveCursor = cursor !== null && chaves.includes(cursor) ? cursor : chaves[0];

  function irPara(i: number) {
    const alvo = chaves[Math.max(0, Math.min(chaves.length - 1, i))];
    if (!alvo) return;
    setCursor(alvo);
    alvos.current.get(alvo)?.focus();
  }

  function teclado(ev: React.KeyboardEvent<SVGGElement>, i: number) {
    const t = ev.key;
    if (t === "ArrowDown" || t === "ArrowRight") irPara(i + 1);
    else if (t === "ArrowUp" || t === "ArrowLeft") irPara(i - 1);
    else if (t === "Home") irPara(0);
    else if (t === "End") irPara(chaves.length - 1);
    else if (t === "Escape") setAtivo(null);
    else return;
    ev.preventDefault();
  }

  const desenhaMarco = (l: Extract<Linha, { tipo: "marco" }>, i: number) => {
    const { item, marco, y: y0, chave, atraso } = l;
    const cy = y0 + ALTURA_MARCO / 2;
    const ps = previsoesOrdenadas(marco.previsoes);
    const recente = ps.at(-1) ?? null;
    const sReal = diaSerial(marco.realizado);
    const base = atraso.estado === "realizado" || atraso.estado === "previsto" || atraso.estado === "sem-comparacao" ? atraso.base : null;
    const pontos = [...ps.map((p) => diaSerial(p.data) as number), ...(sReal !== null ? [sReal] : [])];
    const leitura = leituraMarco(item, marco, atraso, comAtraso);
    const rotulo = rotuloAtraso(atraso);
    return (
      <g
        key={chave}
        ref={(el) => {
          if (el) alvos.current.set(chave, el);
          else alvos.current.delete(chave);
        }}
        role="img"
        aria-label={leitura}
        tabIndex={chave === chaveCursor ? 0 : -1}
        data-marco={chave}
        className="cursor-default outline-none focus:outline-none"
        onKeyDown={(e) => teclado(e, i)}
        onFocus={(e) => {
          setCursor(chave);
          setAtivo(chave);
          let visivel = true;
          try {
            visivel = e.currentTarget.matches(":focus-visible");
          } catch {
            /* navegador sem :focus-visible: mostra o anel */
          }
          setFocoVisivel(visivel ? chave : null);
        }}
        onBlur={() => {
          setFocoVisivel(null);
          setAtivo((a) => (a === chave ? null : a));
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setAtivo(chave);
        }}
        onPointerDown={() => {
          setAtivo(chave);
          setAnuncio(leitura);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setAtivo((a) => (a === chave ? null : a));
        }}
      >
        <rect x="0" y={y0} width={w} height={ALTURA_MARCO} fill="transparent" />
        <text x="14" y={r1(cy + 4)} fontSize="12" fill="var(--cor-carvao-muted)">
          {cabe(marco.rotulo, colRotulo - 18)}
        </text>
        {pontos.length > 1 && (
          <line x1={r1(x(Math.min(...pontos)))} x2={r1(x(Math.max(...pontos)))} y1={r1(cy)} y2={r1(cy)} stroke="var(--cor-mineral-soft)" strokeWidth="1.5" />
        )}
        {base && diaSerial(base.data) !== null && (
          <polygon data-forma="base" points={losango(x(diaSerial(base.data) as number), cy)} fill="none" stroke="var(--cor-carvao-muted)" strokeWidth="1.5" strokeLinejoin="round" />
        )}
        {ps.map((p, k) => {
          const s = diaSerial(p.data) as number;
          const eRecente = p === recente;
          return (
            <circle
              key={`${p.informadaEm}-${k}`}
              data-forma="previsao"
              data-recente={eRecente ? "sim" : "nao"}
              cx={r1(x(s))}
              cy={r1(cy)}
              r={eRecente ? 6 : 4}
              fill="var(--cor-superficie)"
              stroke="var(--cor-previsto)"
              strokeWidth={eRecente ? 2.25 : 1.5}
              strokeOpacity={eRecente ? 1 : 0.6}
            />
          );
        })}
        {sReal !== null && <circle data-forma="realizado" cx={r1(x(sReal))} cy={r1(cy)} r="5.5" fill="var(--cor-carvao)" stroke="var(--cor-superficie)" strokeWidth="1.5" />}
        {!ps.length && sReal === null && (
          <text data-estado="sem-dado" x={colRotulo + 12} y={r1(cy + 4)} fontSize="12" fontStyle="italic" fill="var(--cor-carvao-muted)">
            sem dado
          </text>
        )}
        {comAtraso && (
          <text
            x={w - 4}
            y={r1(cy + 4)}
            textAnchor="end"
            fontSize="12"
            fontStyle={atraso.estado === "realizado" ? undefined : "italic"}
            fill={atraso.estado === "realizado" ? "var(--cor-carvao)" : "var(--cor-carvao-muted)"}
            className="tabular-nums"
            data-atraso={atraso.estado}
          >
            {rotulo}
          </text>
        )}
        {focoVisivel === chave && (
          <rect x="1" y={y0 + 1} width={Math.max(0, w - 2)} height={ALTURA_MARCO - 2} fill="none" stroke="var(--cor-energia)" strokeWidth="2" rx="2" />
        )}
      </g>
    );
  };

  const linhaAtiva = marcos.find((m) => m.chave === ativo) ?? null;
  let dica: React.ReactNode = null;
  if (linhaAtiva) {
    const { item, marco, atraso, y: y0 } = linhaAtiva;
    const ps = previsoesOrdenadas(marco.previsoes);
    const recente = previsaoMaisRecente(marco.previsoes);
    const base = atraso.estado === "realizado" || atraso.estado === "previsto" || atraso.estado === "sem-comparacao" ? atraso.base : null;
    const mostradas = ps.slice(-6).reverse();
    const est = 110 + mostradas.length * 16;
    const acima = y0 + ALTURA_MARCO + est > h && y0 - est >= 0;
    // sem w-max: a largura da dica se ajusta ao espaço entre left e a borda do gráfico, então ela nunca cria rolagem horizontal na página
    dica = (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-20 min-w-[14rem] max-w-[20rem] border border-linha bg-superficie px-3 py-2 text-xs shadow-[0_6px_20px_rgba(26,29,33,0.12)]"
        style={{ top: acima ? y0 : y0 + ALTURA_MARCO, transform: acima ? "translateY(-100%)" : undefined, left: `min(${colRotulo}px, calc(100% - 15rem))` }}
      >
        <p className="font-medium text-carvao">{item.rotulo}</p>
        <p className="text-carvao-muted">{marco.rotulo}</p>
        <p className="rotulo mt-1.5 text-mineral">Previsões ({ps.length})</p>
        {mostradas.length ? (
          <ul className="space-y-0.5">
            {mostradas.map((p, k) => (
              <li key={`${p.informadaEm}-${k}`} className="flex justify-between gap-3 text-carvao">
                <span className="tabular-nums">{dataBR(p.data)}</span>
                <span className="text-carvao-muted">
                  informada em {dataBR(p.informadaEm)}
                  {p === recente ? " (mais recente)" : ""}
                  {p === base ? " (data-base)" : ""}
                </span>
              </li>
            ))}
            {ps.length > mostradas.length && <li className="text-carvao-muted">e mais {ps.length - mostradas.length} anteriores na tabela</li>}
          </ul>
        ) : (
          <p className="italic text-carvao-muted">sem previsão registrada</p>
        )}
        <p className="mt-1.5 flex justify-between gap-3 border-t border-linha pt-1">
          <span className="text-carvao-muted">Realizado</span>
          <span className={marco.realizado ? "tabular-nums text-carvao" : "italic text-carvao-muted"}>{marco.realizado ? dataBR(marco.realizado) : "sem registro"}</span>
        </p>
        {marco.realizado && marco.fonteRealizado && <p className="text-carvao-muted">{marco.fonteRealizado}</p>}
        {comAtraso && <p className="mt-1 text-carvao">{textoAtraso(atraso)}</p>}
      </div>
    );
  }

  const temFiltro = todos.length > 1;
  const instrucoes = `${marcos.length} ${marcos.length === 1 ? "marco" : "marcos"} de ${visiveis.length} ${visiveis.length === 1 ? "item" : "itens"}. Previsões são círculos vazados, uma por previsão informada, e o realizado é círculo cheio. Use Tab para entrar, as setas para percorrer os marcos e Home e End para ir ao início e ao fim. A tabela com os mesmos dados está logo abaixo.`;

  return (
    <div ref={raiz} className="relative w-full" data-grafico="cronograma">
      {temFiltro && (
        <fieldset className="mb-2 flex flex-wrap items-center gap-x-4">
          <legend className="rotulo float-left mr-3 text-mineral">Filtrar por {rotuloFiltro.toLowerCase()}</legend>
          {disponiveis.map((e) => (
            <label key={e.estado} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-carvao">
              <input
                type="checkbox"
                checked={selecionados === null || selecionados.includes(e.estado)}
                onChange={() => mudarEstados(alternarEstado(selecionados, e.estado, todos))}
                className="h-4 w-4 accent-energia"
              />
              {e.estado} <span className="tabular-nums text-mineral">({e.total})</span>
            </label>
          ))}
          <button
            type="button"
            aria-disabled={selecionados === null}
            onClick={() => selecionados !== null && mudarEstados(null)}
            className={`rotulo inline-flex min-h-[44px] items-center border px-3 ${selecionados === null ? "cursor-default border-linha text-mineral" : "border-carvao-muted text-carvao hover:border-carvao"}`}
          >
            Mostrar todos
          </button>
        </fieldset>
      )}
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 px-1 text-xs text-carvao-muted" aria-label="Legenda">
        <li className="flex items-center gap-1.5">
          <svg width="30" height="14" aria-hidden="true">
            <circle cx="6" cy="7" r="3.5" fill="var(--cor-superficie)" stroke="var(--cor-previsto)" strokeWidth="1.5" strokeOpacity="0.6" />
            <circle cx="21" cy="7" r="5.5" fill="var(--cor-superficie)" stroke="var(--cor-previsto)" strokeWidth="2.25" />
          </svg>
          Previsto (vazado; uma marca por previsão informada, a mais recente em traço grosso)
        </li>
        <li className="flex items-center gap-1.5">
          <svg width="14" height="14" aria-hidden="true">
            <circle cx="7" cy="7" r="5.5" fill="var(--cor-carvao)" />
          </svg>
          Realizado (cheio)
        </li>
        {comAtraso && dataBase && (
          <li className="flex items-center gap-1.5">
            <svg width="18" height="18" aria-hidden="true">
              <polygon points={losango(9, 9, 7)} fill="none" stroke="var(--cor-carvao-muted)" strokeWidth="1.5" />
            </svg>
            Previsão vigente na data-base ({dataBR(dataBase.data)}, {dataBase.rotulo})
          </li>
        )}
      </ul>
      <p className="mb-2 px-1 text-xs text-carvao-muted" data-nota="atraso">
        {comAtraso && dataBase
          ? `Atraso: data realizada menos a previsão vigente em ${dataBR(dataBase.data)}. Marco ainda não realizado usa a previsão mais recente e leva "(prev.)". O sinal "+" indica atraso e "−", antecipação.`
          : "Atraso não calculado: nenhuma data-base foi declarada para este cronograma. As previsões aparecem com a data em que foram informadas."}
      </p>
      <p id={`${uid}-i`} className="sr-only">
        {instrucoes}
      </p>
      {marcos.length === 0 ? (
        <div className="flex h-[88px] items-center border border-dashed border-linha px-4 text-sm text-carvao-muted">
          {itens.length ? `Nenhum item no filtro de ${rotuloFiltro.toLowerCase()} selecionado.` : "Nenhum item com cronograma para exibir."}
        </div>
      ) : (
        <>
          {/* eixo de tempo fora da área rolável: continua visível com muitos marcos */}
          <svg width="100%" height="22" viewBox={`0 0 ${w} 22`} aria-hidden="true" className="block overflow-visible">
            {marcasTempo.map((t) => (
              <g key={t.serial}>
                <text x={r1(x(t.serial))} y="12" textAnchor="middle" fontSize="12" fill="var(--cor-mineral)" className="tabular-nums">
                  {t.rotulo}
                </text>
                <line x1={r1(x(t.serial))} x2={r1(x(t.serial))} y1="16" y2="22" stroke="var(--cor-grade)" strokeWidth="1" />
              </g>
            ))}
            {comAtraso && (
              <text x={w - 4} y="12" textAnchor="end" fontSize="12" fill="var(--cor-mineral)">
                Atraso
              </text>
            )}
          </svg>
          <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: alturaMaxima }}>
            <div className="relative">
              <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} role="group" aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-i`} className="block overflow-visible">
                <title id={`${uid}-t`}>{titulo}</title>
                <g aria-hidden="true">
                  {marcasTempo.map((t) => (
                    <line key={t.serial} x1={r1(x(t.serial))} x2={r1(x(t.serial))} y1="0" y2={h} stroke="var(--cor-grade)" strokeWidth="1" />
                  ))}
                  {sBase !== null && (
                    <line data-linha="data-base" x1={r1(x(sBase))} x2={r1(x(sBase))} y1="0" y2={h} stroke="var(--cor-carvao-muted)" strokeWidth="1" strokeDasharray="3 3" />
                  )}
                  {linhas.map((l) =>
                    l.tipo === "item" ? (
                      <g key={`item-${l.item.id}`}>
                        <rect x="0" y={l.y} width={w} height={ALTURA_ITEM} fill="var(--cor-papel)" />
                        <text x="4" y={l.y + 19} fontSize="12" fontWeight={600} fill="var(--cor-carvao)">
                          {cabe(`${l.item.rotulo}${l.item.detalhe ? ` · ${l.item.detalhe}` : ""} · ${l.item.estado}`, w - 8)}
                        </text>
                      </g>
                    ) : l.chave === ativo ? (
                      <rect key={`ativo-${l.chave}`} x="0" y={l.y} width={w} height={ALTURA_MARCO} fill="var(--cor-grade)" opacity="0.55" />
                    ) : null,
                  )}
                </g>
                {marcos.map((l, i) => desenhaMarco(l, i))}
              </svg>
              {dica}
            </div>
          </div>
        </>
      )}
      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>
      <details className="mt-3 text-xs">
        <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
          Cronograma em tabela ({marcos.length.toLocaleString("pt-BR")} {marcos.length === 1 ? "marco" : "marcos"})
        </summary>
        <div className="tabela-scroll mt-2 max-h-96 overflow-y-auto" tabIndex={0} role="region" aria-label={`${titulo}: dados em tabela (rolável)`}>
          <table className="w-full min-w-[40rem] border-collapse">
            <caption className="sr-only">
              {`${titulo}.` + (comAtraso && dataBase ? ` Atraso contra a previsão vigente em ${dataBR(dataBase.data)} (${dataBase.rotulo}).` : " Atraso não calculado: sem data-base declarada.")}
            </caption>
            <thead className="sticky top-0 bg-superficie">
              <tr className="text-left text-mineral">
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">Item</th>
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">{rotuloFiltro}</th>
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">Marco</th>
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">Previsões (data prevista, informada em)</th>
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">Realizado</th>
                {comAtraso && <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">Previsão na data-base</th>}
                {comAtraso && <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">Atraso</th>}
              </tr>
            </thead>
            <tbody>
              {marcos.map(({ item, marco, chave, atraso }) => {
                const ps = previsoesOrdenadas(marco.previsoes);
                const base = atraso.estado === "realizado" || atraso.estado === "previsto" || atraso.estado === "sem-comparacao" ? atraso.base : null;
                return (
                  <tr key={chave} data-marco={chave} className="border-b border-linha align-top">
                    <th scope="row" className="px-2 py-1 text-left font-normal text-carvao">{item.rotulo}</th>
                    <td className="px-2 py-1 text-carvao">{item.estado}</td>
                    <td className="px-2 py-1 text-carvao">{marco.rotulo}</td>
                    <td className="px-2 py-1 text-carvao">
                      {ps.length ? (
                        <ol className="space-y-0.5">
                          {ps.map((p, k) => (
                            <li key={`${p.informadaEm}-${k}`} className="tabular-nums">
                              {dataBR(p.data)}, informada em {dataBR(p.informadaEm)}
                              {p.snapshot ? ` (${p.snapshot})` : ""}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <span className="italic text-mineral">sem previsão registrada</span>
                      )}
                    </td>
                    <td className="px-2 py-1 tabular-nums text-carvao">
                      {marco.realizado ? dataBR(marco.realizado) : <span className="italic text-mineral">sem registro</span>}
                      {marco.realizado && marco.fonteRealizado ? <span className="block text-carvao-muted">{marco.fonteRealizado}</span> : null}
                    </td>
                    {comAtraso && (
                      <td className="px-2 py-1 tabular-nums text-carvao">
                        {base ? `${dataBR(base.data)}, informada em ${dataBR(base.informadaEm)}` : <span className="italic text-mineral">sem previsão vigente</span>}
                      </td>
                    )}
                    {comAtraso && <td className="px-2 py-1 text-carvao">{textoAtraso(atraso)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
