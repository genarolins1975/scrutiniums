"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useCursorSincronizado } from "@/components/energia/CursorSincronizado";
import type { SerieLinha } from "@/components/energia/GraficoLinhas";
import { escalaLinear, formatarValor, rotuloTick, valido, type Dominio } from "@/lib/energia/escalas";
import { dominiosPaineis, formatarX, indiceDoValorX, painelSemDado, type EscalaPaineis, type FormatoX, type PontoSerie } from "@/lib/energia/series-temporais";

/**
 * Pequenos múltiplos: uma grade de gráficos de linha pequenos, um por
 * entidade (submercado, fonte, distribuidora), sobre o mesmo eixo de tempo.
 * É a alternativa da gramática de gráficos (seção 8.2) a empilhar muitas
 * linhas num gráfico só ou a usar dois eixos verticais.
 *
 * - Escala vertical compartilhada por padrão: altura igual é valor igual em
 *   qualquer painel. `escala="livre"` dá a cada painel a própria régua e
 *   mostra um aviso visível acima da grade (a comparação passa a ser de forma,
 *   não de nível); os rótulos do eixo de cada painel mostram a régua usada.
 * - Eixo de tempo alinhado: todos os painéis leem as mesmas linhas de
 *   `dados`, e o cursor é um só. Passar o mouse, tocar ou usar as setas num
 *   painel mostra a cruz e o valor daquele dia no cabeçalho de todos. Dentro
 *   de um <CursorSincronizado> o cursor também acompanha outros gráficos com
 *   a mesma chaveX.
 * - Teclado: um único ponto de parada na grade (tabindex itinerante). Setas
 *   esquerda e direita percorrem o tempo, Home e End vão aos extremos, setas
 *   acima e abaixo trocam de painel mantendo a data, Esc limpa. A leitura do
 *   painel em foco sai numa região aria-live.
 * - Ausência é lacuna na linha; painel sem nenhum valor mostra hachura e
 *   "sem dado no período", nunca uma linha em zero.
 * - Responsiva: uma coluna no celular, duas a partir de 640 px e o número
 *   pedido a partir de 1024 px. Altura fixa por painel (sem salto de layout) e
 *   largura padrão de servidor, como GraficoLinhas. As linhas finas da grade
 *   são bordas das células, não o fundo que aparece entre elas: com número
 *   ímpar de painéis, o espaço que sobra na última linha fica vazio, sem bloco.
 * - Legenda: uma entrada por rótulo e traço, mesmo quando cada painel usa um
 *   id de série próprio; se a cor muda entre painéis, a amostra é neutra.
 * - Tabela equivalente com todos os painéis, recolhida e montada ao abrir.
 */
export type PainelMultiplo = {
  id: string;
  titulo: string;
  /** Colunas de `dados` desenhadas no painel; padrão: uma série com a coluna `id`, na cor do gráfico. */
  series?: SerieLinha[];
  /** Observação curta sob o título (ex.: "sem medição até 2019"). */
  nota?: string;
};

export type PequenosMultiplosProps = {
  titulo: string;
  dados: PontoSerie[];
  chaveX: string;
  paineis: PainelMultiplo[];
  unidade: string;
  casas?: number;
  formatoX?: FormatoX;
  /** "compartilhada" (padrão) ou "livre", com aviso visível. */
  escala?: EscalaPaineis;
  zeroNoEixo?: boolean;
  /** Altura de cada gráfico em px (fixa, sem salto de layout). */
  alturaPainel?: number;
  /** Colunas a partir de 1024 px; no celular é sempre uma. */
  colunas?: 2 | 3 | 4;
  /** Cor da série padrão de cada painel (token CSS). */
  cor?: string;
  /** Nível do título de cada painel: 3 em página de módulo, 4 dentro de seção com h3. */
  nivelTitulo?: 3 | 4;
  sincronizarCursor?: boolean;
  grupoCursor?: string;
  tabelaAbertaInicial?: boolean;
};

const LARGURA_SSR_PAINEL = 360;
const COLUNAS: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function PequenosMultiplos({
  titulo,
  dados,
  chaveX,
  paineis,
  unidade,
  casas = 1,
  formatoX = "data",
  escala = "compartilhada",
  zeroNoEixo = false,
  alturaPainel = 140,
  colunas = 3,
  cor = "var(--cor-energia)",
  nivelTitulo = 3,
  sincronizarCursor = true,
  grupoCursor,
  tabelaAbertaInicial = false,
}: PequenosMultiplosProps) {
  const uid = useId();
  const [iAtivo, setIAtivo] = useState<number | null>(null);
  const [painelFoco, setPainelFoco] = useState(0);
  const [anuncio, setAnuncio] = useState("");
  const [tabelaAberta, setTabelaAberta] = useState(tabelaAbertaInicial);
  const alvos = useRef<(SVGSVGElement | null)[]>([]);

  const n = dados.length;
  const xs = dados.map((d) => String(d[chaveX] ?? ""));
  const seriesDe = (p: PainelMultiplo): SerieLinha[] => p.series ?? [{ id: p.id, rotulo: p.titulo, cor }];
  const doms = dominiosPaineis(
    dados,
    paineis.map((p) => seriesDe(p).map((s) => s.id)),
    { escala, zero: zeroNoEixo },
  );
  const multiSeries = paineis.some((p) => seriesDe(p).length > 1);
  // Legenda: uma entrada por rótulo e traço. Se a mesma série muda de cor entre painéis (cor da entidade), a amostra da legenda fica
  // neutra e uma linha diz que a cor distingue o painel; o título de cada painel nomeia a entidade.
  const grupos = new Map<string, { rotulo: string; cor: string; tracejada: boolean; mista: boolean }>();
  for (const s of paineis.flatMap((p) => seriesDe(p))) {
    const chave = `${s.rotulo}|${s.tracejada ? "t" : "c"}`;
    const g = grupos.get(chave);
    if (!g) grupos.set(chave, { rotulo: s.rotulo, cor: s.cor, tracejada: !!s.tracejada, mista: false });
    else if (g.cor !== s.cor) g.mista = true;
  }
  const entradasLegenda = Array.from(grupos, ([chave, g]) => ({ chave, rotulo: g.rotulo, tracejada: g.tracejada, cor: g.mista ? "var(--cor-carvao)" : g.cor, mista: g.mista }));
  const corPorPainel = entradasLegenda.some((e) => e.mista);

  const sinc = useCursorSincronizado(sincronizarCursor ? (grupoCursor ?? chaveX) : null);
  const publicar = sinc?.publicar;
  const limpar = sinc?.limpar;
  const xAtivo = iAtivo !== null && iAtivo < n ? xs[iAtivo] : null;
  useEffect(() => {
    if (!publicar || !limpar) return;
    if (xAtivo !== null) publicar(xAtivo, uid);
    else limpar(uid);
  }, [publicar, limpar, xAtivo, uid]);
  useEffect(() => () => limpar?.(uid), [limpar, uid]);
  const valorExterno = sinc?.cursor && sinc.cursor.origem !== uid ? sinc.cursor.valor : null;
  const iExterno = iAtivo === null ? indiceDoValorX(xs, valorExterno) : -1;
  const iCruz = iAtivo !== null ? iAtivo : iExterno >= 0 ? iExterno : null;

  const leitura = (k: number, i: number): string => {
    const p = paineis[k];
    const d = dados[i];
    if (!p || !d) return "";
    const ss = seriesDe(p);
    const valores = ss.map((s) => `${ss.length > 1 ? `${s.rotulo} ` : ""}${formatarValor(d[s.id] as number | null, casas, unidade)}`).join("; ");
    return `${p.titulo}, ${formatarX(xs[i], formatoX, true)}: ${valores}`;
  };

  function irPara(k: number, i: number | null) {
    const kk = Math.max(0, Math.min(paineis.length - 1, k));
    setPainelFoco(kk);
    if (i !== null) {
      const ii = Math.max(0, Math.min(n - 1, i));
      setIAtivo(ii);
      setAnuncio(leitura(kk, ii));
    }
    if (kk !== k) return;
    alvos.current[kk]?.focus();
  }

  function teclado(ev: React.KeyboardEvent<SVGSVGElement>, k: number) {
    const base = iAtivo ?? n - 1;
    const t = ev.key;
    if (t === "ArrowRight") irPara(k, base + 1);
    else if (t === "ArrowLeft") irPara(k, base - 1);
    else if (t === "Home") irPara(k, 0);
    else if (t === "End") irPara(k, n - 1);
    else if (t === "ArrowDown" && k < paineis.length - 1) irPara(k + 1, base);
    else if (t === "ArrowUp" && k > 0) irPara(k - 1, base);
    else if (t === "Escape") {
      setIAtivo(null);
      setAnuncio("");
    } else return;
    ev.preventDefault();
  }

  if (!paineis.length || !n) {
    return (
      <div className="flex h-[88px] items-center border border-dashed border-linha px-4 text-sm text-carvao-muted">
        Nenhum dado para exibir nos painéis.
      </div>
    );
  }

  const domCompartilhado = escala === "compartilhada" ? doms[0] : null;
  const instrucoes = `${paineis.length} painéis de ${titulo}, com o mesmo eixo de tempo. Use Tab para entrar na grade, as setas esquerda e direita para percorrer as datas, Home e End para os extremos e as setas acima e abaixo para trocar de painel. A tabela com os mesmos dados está abaixo da grade.`;

  return (
    <div className="relative w-full" data-grafico="pequenos-multiplos" data-escala={escala}>
      {escala === "livre" ? (
        <p role="note" data-aviso="escala-livre" className="mb-2 border-l-2 border-aviso bg-papel px-3 py-2 text-sm text-carvao">
          <strong className="font-medium">Escala livre:</strong> cada painel tem o próprio eixo vertical. Compare a forma das curvas, não a altura entre painéis.
        </p>
      ) : (
        <p className="mb-2 text-xs text-carvao-muted" data-aviso="escala-compartilhada">
          Escala compartilhada: a mesma régua vertical em todos os painéis
          {domCompartilhado ? `, de ${rotuloTick(domCompartilhado.min, domCompartilhado.passo)} a ${rotuloTick(domCompartilhado.max, domCompartilhado.passo)} ${unidade}` : ""}.
        </p>
      )}
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 px-1 text-xs text-carvao-muted" aria-label="Legenda">
        {multiSeries &&
          entradasLegenda.map((e) => (
            <li key={e.chave} className="flex items-center gap-1.5">
              <svg width="18" height="8" aria-hidden="true">
                <line x1="0" y1="4" x2="18" y2="4" stroke={e.cor} strokeWidth="2.5" strokeDasharray={e.tracejada ? "4 3" : undefined} />
              </svg>
              {e.rotulo}
            </li>
          ))}
        {multiSeries && corPorPainel && <li className="text-mineral">A cor identifica o painel</li>}
        <li className="text-mineral">Valores em {unidade}</li>
        <li className="text-mineral">Lacuna na linha: sem dado</li>
      </ul>
      <p id={`${uid}-i`} className="sr-only">
        {instrucoes}
      </p>
      <ul
        className={`grid grid-cols-1 border-l border-t border-linha ${COLUNAS[colunas]}`}
        aria-label={titulo}
        onBlur={(e) => {
          // o foco saiu da grade (não apenas de um painel para outro): o cursor some
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setIAtivo(null);
            setAnuncio("");
          }
        }}
      >
        {paineis.map((p, k) => (
          <li key={p.id} className="min-w-0 border-b border-r border-linha bg-superficie" data-painel={p.id}>
            <Painel
              painel={p}
              series={seriesDe(p)}
              dados={dados}
              xs={xs}
              dom={doms[k]}
              altura={alturaPainel}
              casas={casas}
              unidade={unidade}
              formatoX={formatoX}
              nivelTitulo={nivelTitulo}
              iCruz={iCruz}
              tabIndex={k === painelFoco ? 0 : -1}
              descricao={`${uid}-i`}
              registrar={(el) => {
                alvos.current[k] = el;
              }}
              onTeclado={(ev) => teclado(ev, k)}
              onFoco={() => setPainelFoco(k)}
              onPonteiro={(i, anunciar) => {
                setIAtivo(i);
                if (anunciar) setAnuncio(leitura(k, i));
              }}
              onSair={() => setIAtivo(null)}
            />
          </li>
        ))}
      </ul>
      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>
      <details className="mt-3 text-xs" open={tabelaAbertaInicial || undefined} onToggle={(e) => setTabelaAberta((e.currentTarget as HTMLDetailsElement).open)}>
        <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
          Dados dos painéis em tabela ({n.toLocaleString("pt-BR")} {n === 1 ? "linha" : "linhas"}, {paineis.length} {paineis.length === 1 ? "painel" : "painéis"})
        </summary>
        {tabelaAberta && (
          <div className="tabela-scroll mt-2 max-h-80 overflow-y-auto" tabIndex={0} role="region" aria-label={`${titulo}: dados em tabela (rolável)`}>
            <table className="w-full border-collapse tabular-nums">
              <caption className="sr-only">{`${titulo}, em ${unidade}`}</caption>
              <thead className="sticky top-0 bg-superficie">
                <tr className="text-left text-mineral">
                  <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">
                    {formatoX === "hora" ? "Hora" : formatoX === "mes" ? "Mês" : formatoX === "texto" ? "Item" : "Data"}
                  </th>
                  {paineis.flatMap((p) =>
                    seriesDe(p).map((s, j, ss) => (
                      <th key={`${p.id}-${s.id}`} scope="col" className="border-b border-linha px-2 py-1.5 text-right font-medium">
                        {ss.length > 1 ? `${p.titulo} · ${s.rotulo}` : p.titulo} ({unidade})
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {dados.map((d, i) => (
                  <tr key={i} className="border-b border-linha">
                    <th scope="row" className="px-2 py-1 text-left font-normal text-carvao">
                      {formatarX(xs[i], formatoX, true)}
                    </th>
                    {paineis.flatMap((p) =>
                      seriesDe(p).map((s) => {
                        const v = d[s.id];
                        return (
                          <td key={`${p.id}-${s.id}`} className={`px-2 py-1 text-right ${valido(v) ? "text-carvao" : "italic text-mineral"}`}>
                            {formatarValor(v as number | null, casas)}
                          </td>
                        );
                      }),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </div>
  );
}

type PainelProps = {
  painel: PainelMultiplo;
  series: SerieLinha[];
  dados: PontoSerie[];
  xs: string[];
  dom: Dominio;
  altura: number;
  casas: number;
  unidade: string;
  formatoX: FormatoX;
  nivelTitulo: 3 | 4;
  iCruz: number | null;
  tabIndex: number;
  descricao: string;
  registrar: (el: SVGSVGElement | null) => void;
  onTeclado: (ev: React.KeyboardEvent<SVGSVGElement>) => void;
  onFoco: () => void;
  onPonteiro: (i: number, anunciar: boolean) => void;
  onSair: () => void;
};

function Painel({
  painel,
  series,
  dados,
  xs,
  dom,
  altura,
  casas,
  unidade,
  formatoX,
  nivelTitulo,
  iCruz,
  tabIndex,
  descricao,
  registrar,
  onTeclado,
  onFoco,
  onPonteiro,
  onSair,
}: PainelProps) {
  const uid = useId().replace(/:/g, "");
  const [largura, setLargura] = useState(LARGURA_SSR_PAINEL);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setLargura(Math.max(220, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const w = largura;
  const h = altura;
  const L = 44;
  const R = 12;
  const T = 8;
  const B = 22;
  const n = dados.length;
  const x = (i: number) => L + (n <= 1 ? (w - L - R) / 2 : (i / (n - 1)) * (w - L - R));
  const y = escalaLinear([dom.min, dom.max], [h - B, T]);
  const semDado = painelSemDado(
    dados,
    series.map((s) => s.id),
  );
  const Titulo = nivelTitulo === 4 ? "h4" : "h3";

  const caminhos = series.map((s) => {
    let d = "";
    let aberto = false;
    dados.forEach((p, i) => {
      const v = p[s.id];
      if (valido(v)) {
        d += `${aberto ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        aberto = true;
      } else aberto = false; // lacuna: ausência não é zero
    });
    return d;
  });
  // ponto isolado (vizinhos ausentes) não forma segmento: marca pequena para não sumir
  const isolados = series.flatMap((s) =>
    dados
      .map((p, i) => ({ i, v: p[s.id] }))
      .filter(({ i, v }) => valido(v) && !valido(dados[i - 1]?.[s.id]) && !valido(dados[i + 1]?.[s.id]))
      .map(({ i, v }) => ({ s, i, v: v as number })),
  );

  const pCruz = iCruz !== null ? dados[iCruz] : null;
  const leituraCabecalho =
    pCruz && iCruz !== null
      ? `${formatarX(xs[iCruz], formatoX, true)}: ${series.map((s) => `${series.length > 1 ? `${s.rotulo} ` : ""}${formatarValor(pCruz[s.id] as number | null, casas, unidade)}`).join(" · ")}`
      : "";

  function indice(ev: React.PointerEvent<SVGRectElement>): number {
    const r = ev.currentTarget.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / (r.width || 1)) * (w - L - R);
    return Math.max(0, Math.min(n - 1, Math.round((px / (w - L - R || 1)) * (n - 1))));
  }

  return (
    <div ref={ref} className="px-3 pb-2 pt-2">
      <div className="flex min-h-[2.5rem] flex-wrap items-baseline justify-between gap-x-3">
        <Titulo id={`${uid}-t`} className="text-sm font-medium text-carvao">
          {painel.titulo}
        </Titulo>
        <span aria-hidden="true" className="text-xs tabular-nums text-carvao-muted" data-leitura="">
          {leituraCabecalho}
        </span>
      </div>
      {painel.nota && <p className="text-xs text-mineral">{painel.nota}</p>}
      <svg
        ref={registrar}
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-labelledby={`${uid}-t`}
        aria-describedby={descricao}
        tabIndex={tabIndex}
        onKeyDown={onTeclado}
        onFocus={onFoco}
        className="block overflow-visible focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
      >
        <defs>
          <pattern id={`${uid}-hachura`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" fill="var(--cor-superficie)" />
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--cor-mineral-soft)" strokeWidth="1.5" />
          </pattern>
        </defs>
        {dom.ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={w - R} y1={y(t)} y2={y(t)} stroke="var(--cor-grade)" strokeWidth="1" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--cor-mineral)" className="tabular-nums">
              {rotuloTick(t, dom.passo)}
            </text>
          </g>
        ))}
        {n > 0 && (
          <>
            <text x={x(0)} y={h - 6} textAnchor="start" fontSize="10" fill="var(--cor-mineral)">
              {formatarX(xs[0], formatoX, true)}
            </text>
            {n > 1 && (
              <text x={x(n - 1)} y={h - 6} textAnchor="end" fontSize="10" fill="var(--cor-mineral)">
                {formatarX(xs[n - 1], formatoX, true)}
              </text>
            )}
          </>
        )}
        {semDado ? (
          <g data-estado="sem-dado">
            <rect x={L} y={T} width={Math.max(1, w - L - R)} height={Math.max(1, h - T - B)} fill={`url(#${uid}-hachura)`} stroke="var(--cor-mineral-soft)" strokeDasharray="3 3" />
            <text x={L + (w - L - R) / 2} y={T + (h - T - B) / 2 + 4} textAnchor="middle" fontSize="12" fill="var(--cor-carvao-muted)">
              sem dado no período
            </text>
          </g>
        ) : (
          <>
            {series.map((s, k) => (
              <path
                key={s.id}
                d={caminhos[k]}
                fill="none"
                stroke={s.cor}
                strokeWidth={s.espessura ?? 1.75}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={s.tracejada ? "5 4" : undefined}
              />
            ))}
            {isolados.map(({ s, i, v }) => (
              <circle key={`${s.id}-${i}`} cx={x(i)} cy={y(v)} r="2" fill={s.cor} />
            ))}
          </>
        )}
        {iCruz !== null && pCruz && (
          <g pointerEvents="none" data-cursor="">
            <line x1={x(iCruz)} x2={x(iCruz)} y1={T} y2={h - B} stroke="var(--cor-carvao)" strokeWidth="1" opacity="0.5" />
            {series.map((s) => {
              const v = pCruz[s.id];
              return valido(v) ? <circle key={s.id} cx={x(iCruz)} cy={y(v)} r="3.5" fill={s.cor} stroke="var(--cor-superficie)" strokeWidth="1.5" /> : null;
            })}
          </g>
        )}
        <rect
          x={L}
          y={T}
          width={Math.max(1, w - L - R)}
          height={Math.max(1, h - T - B)}
          fill="transparent"
          onPointerMove={(e) => onPonteiro(indice(e), false)}
          onPointerDown={(e) => onPonteiro(indice(e), true)}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") onSair();
          }}
        />
      </svg>
    </div>
  );
}
