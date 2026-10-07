"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useCursorSincronizado } from "@/components/energia/CursorSincronizado";
import { rotuloTick } from "@/lib/energia/escalas";
import {
  dominioLinhas,
  formatarX,
  indiceDoValorX,
  indicesDoIntervalo,
  intervaloDosIndices,
  mesmaEscala,
  periodosProntos,
  rotulosDoEixoX,
  type FormatoX,
  type IntervaloX,
} from "@/lib/energia/series-temporais";

/**
 * Gráfico de linhas SVG com camada de leitura: cruz + dica no hover, setas do
 * teclado percorrem os pontos (Home e End vão ao início e ao fim), rótulo
 * direto no fim de cada linha quando não colide, legenda sempre presente e
 * tabela equivalente recolhida (montada só ao abrir, para não pesar o HTML).
 * Ausência é lacuna na linha (nunca zero). Um único eixo Y.
 *
 * Recursos opcionais (desligados por padrão; sem as props novas o gráfico é
 * o mesmo de antes):
 *
 * - `zoom`: seleção de intervalo por arrasto (mouse, em larguras de 520 px
 *   ou mais), por períodos prontos ("30 dias", "12 meses") e por controles
 *   nativos de início e fim (teclado: setas, Home, End, PageUp, PageDown).
 *   No celular não há arrasto: o toque continua abrindo a dica e o recorte é
 *   feito pelos controles de período. "Restaurar intervalo" volta à série
 *   completa. O eixo vertical é recalculado para o trecho e o texto de
 *   estado diz isso; a tabela equivalente mostra o mesmo trecho.
 * - Cursor sincronizado: sob um <CursorSincronizado>, gráficos com a mesma
 *   chaveX (ou o mesmo grupoCursor) mostram a cruz no mesmo X.
 * - `legendaInterativa`: botões com aria-pressed ocultam e mostram séries. A
 *   unidade continua na legenda; ao menos uma série fica visível. Se ocultar
 *   muda a escala, um aviso visível e anunciado diz a escala nova e a de
 *   todas as séries, com a opção de manter a escala completa.
 */
export type SerieLinha = {
  id: string;
  rotulo: string;
  /** Rótulo curto (SE/CO, S, NE, N): usado no celular e quando linhas terminam juntas. */
  sigla?: string;
  cor: string;
  tracejada?: boolean;
  espessura?: number;
};

export type { IntervaloX };

type Ponto = Record<string, string | number | null | undefined>;

export type GraficoLinhasProps = {
  titulo: string;
  dados: Ponto[];
  chaveX: string;
  series: SerieLinha[];
  unidade: string;
  casas?: number;
  formatoX?: FormatoX;
  zeroNoEixo?: boolean;
  banda?: { inferior: string; superior: string; rotulo: string; cor?: string };
  marcos?: { x: string; rotulo: string }[];
  altura?: number;
  rotulosDiretos?: boolean;
  /** Liga o zoom por intervalo (arrasto, períodos prontos, início e fim, restaurar). */
  zoom?: boolean;
  /** Intervalo inicial, em valores de chaveX, quando o zoom não é controlado. */
  intervaloInicial?: IntervaloX | null;
  /** Intervalo controlado (ex.: vindo da URL); null é a série completa. Use com onIntervalo. */
  intervalo?: IntervaloX | null;
  onIntervalo?: (intervalo: IntervaloX | null) => void;
  /** Legenda com botões para ocultar e mostrar séries. */
  legendaInterativa?: boolean;
  /** Séries ocultas ao abrir (ids), quando a legenda não é controlada. */
  ocultasIniciais?: string[];
  /** Séries ocultas controladas; use com onOcultas. */
  ocultas?: string[];
  onOcultas?: (ids: string[]) => void;
  /** Ao ocultar séries: "ajustar" (padrão) recalcula o eixo às visíveis, com aviso; "manter" preserva a escala de todas. */
  escalaAoOcultar?: "ajustar" | "manter";
  /** Participa do cursor sincronizado quando há um CursorSincronizado acima (padrão: sim). */
  sincronizarCursor?: boolean;
  /** Grupo do cursor sincronizado; padrão: a chaveX. */
  grupoCursor?: string;
  /** Abre a tabela equivalente já montada (ex.: modo Auditar). */
  tabelaAbertaInicial?: boolean;
};

const fmtX = formatarX;

function fmtV(v: number | null | undefined, casas: number, unidade: string): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "sem dado";
  // sinal de menos tipográfico, como no resto do portal
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).replace(/^-/, "\u2212")} ${unidade}`.trim();
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

/** Abaixo desta largura: rótulos curtos e, com zoom, sem arrasto (controles de período). */
const ESTREITO = 520;
const SEM_OCULTAS: string[] = [];

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
  zoom = false,
  intervaloInicial = null,
  intervalo: intervaloControlado,
  onIntervalo,
  legendaInterativa = false,
  ocultasIniciais = SEM_OCULTAS,
  ocultas: ocultasControladas,
  onOcultas,
  escalaAoOcultar = "ajustar",
  sincronizarCursor = true,
  grupoCursor,
  tabelaAbertaInicial = false,
}: GraficoLinhasProps) {
  const uid = useId();
  const [largura, setLargura] = useState(760);
  const [ativo, setAtivo] = useState<number | null>(null);
  const [tabelaAberta, setTabelaAberta] = useState(tabelaAbertaInicial);
  const [intervaloInterno, setIntervaloInterno] = useState<IntervaloX | null>(intervaloInicial);
  const [ocultasInternas, setOcultasInternas] = useState<string[]>(ocultasIniciais);
  const [modoEscala, setModoEscala] = useState<"ajustar" | "manter">(escalaAoOcultar);
  const [arrasto, setArrasto] = useState<{ a: number; b: number } | null>(null);
  const [aviso, setAviso] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setLargura(Math.max(300, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // no toque não há "sair com o ponteiro": a dica fica aberta até um toque fora do gráfico
  const temAtivo = ativo !== null;
  useEffect(() => {
    if (!temAtivo) return;
    const fora = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAtivo(null);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [temAtivo]);

  /* ---------- trecho exibido (zoom) ---------- */
  const N = dados.length;
  // valores de X e períodos prontos só mudam com os dados: não são refeitos a cada movimento do cursor
  const xsTodos = useMemo(() => (zoom ? dados.map((d) => String(d[chaveX] ?? "")) : []), [zoom, dados, chaveX]);
  const periodos = useMemo(
    () => (zoom ? periodosProntos(xsTodos, formatoX).map((p) => ({ ...p, indices: indicesDoIntervalo(xsTodos, p) })) : []),
    [zoom, xsTodos, formatoX],
  );
  const ivAtual = zoom ? (intervaloControlado !== undefined ? intervaloControlado : intervaloInterno) : null;
  const [i0, i1] = zoom ? indicesDoIntervalo(xsTodos, ivAtual) : [0, N - 1];
  const ampliado = zoom && N > 0 && (i0 > 0 || i1 < N - 1);
  const vis = ampliado ? dados.slice(i0, i1 + 1) : dados;

  /* ---------- séries visíveis (legenda interativa) ---------- */
  const ocultasLista = legendaInterativa ? (ocultasControladas ?? ocultasInternas) : SEM_OCULTAS;
  let seriesVis = ocultasLista.length ? series.filter((s) => !ocultasLista.includes(s.id)) : series;
  if (!seriesVis.length) seriesVis = series; // nunca um gráfico sem linha: todas ocultas equivale a nenhuma
  const temOcultas = seriesVis.length < series.length;

  const L = largura < ESTREITO ? 44 : 56;
  const R = rotulosDiretos ? (largura < ESTREITO ? 92 : 124) : 16;
  const T = 14;
  const B = 30;
  const w = largura;
  const h = altura;

  // domínio com as mesmas regras de sempre, sobre o trecho e as séries exibidos;
  // as variantes existem para dizer quando (e quanto) a escala mudou
  const extras = banda ? [banda.inferior, banda.superior] : [];
  const domTodas = dominioLinhas(vis, [...series.map((s) => s.id), ...extras], zeroNoEixo);
  const domVisiveis = temOcultas ? dominioLinhas(vis, [...seriesVis.map((s) => s.id), ...extras], zeroNoEixo) : domTodas;
  const { yMin, yMax } = modoEscala === "ajustar" ? domVisiveis : domTodas;
  const escalaDasVisiveis = temOcultas && modoEscala === "ajustar" && !mesmaEscala(domVisiveis, domTodas);
  const escalaDoTrecho = ampliado && !mesmaEscala(domTodas, dominioLinhas(dados, [...series.map((s) => s.id), ...extras], zeroNoEixo));

  const n = vis.length;
  const x = (i: number) => L + (n <= 1 ? 0 : (i / (n - 1)) * (w - L - R));
  const y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin || 1)) * (h - T - B);

  /* ---------- cursor sincronizado ---------- */
  const sinc = useCursorSincronizado(sincronizarCursor ? (grupoCursor ?? chaveX) : null);
  const publicar = sinc?.publicar;
  const limpar = sinc?.limpar;
  const xAtivo = ativo !== null && vis[ativo] ? String(vis[ativo][chaveX] ?? "") : null;
  useEffect(() => {
    if (!publicar || !limpar) return;
    if (xAtivo !== null) publicar(xAtivo, uid);
    else limpar(uid);
  }, [publicar, limpar, xAtivo, uid]);
  useEffect(() => () => limpar?.(uid), [limpar, uid]);
  const valorExterno = sinc?.cursor && sinc.cursor.origem !== uid ? sinc.cursor.valor : null;
  const iExterno = ativo === null && valorExterno !== null ? indiceDoValorX(vis.map((d) => String(d[chaveX] ?? "")), valorExterno) : -1;
  const iCruz = ativo !== null ? ativo : iExterno >= 0 ? iExterno : null;

  const caminhos = seriesVis.map((s) => {
    let d = "";
    let aberto = false;
    vis.forEach((p, i) => {
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
    vis.forEach((p, i) => {
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
  const finais = seriesVis
    .map((s) => {
      for (let i = n - 1; i >= 0; i--) {
        const v = vis[i][s.id];
        if (typeof v === "number" && Number.isFinite(v)) return { s, i, v, yy: y(v) };
      }
      return null;
    })
    .filter((f): f is { s: SerieLinha; i: number; v: number; yy: number } => !!f)
    .sort((a, b) => a.yy - b.yy);
  // linhas que terminam no mesmo ponto viram um só rótulo com as siglas ("SE/CO · NE · N"):
  // diz quais linhas se encontram no último ponto, sem afirmar que são iguais no resto do período
  const grupos: { itens: typeof finais; yy: number }[] = [];
  for (const f of finais) {
    const g = grupos.at(-1);
    if (g && Math.abs(g.itens[0].yy - f.yy) < 3 && g.itens[0].i === f.i) g.itens.push(f);
    else grupos.push({ itens: [f], yy: f.yy });
  }
  const rotulos = grupos.map((g) => ({ ...g, alvo: g.yy }));
  for (let k = 1; k < rotulos.length; k++) {
    if (rotulos[k].yy - rotulos[k - 1].yy < 14) rotulos[k].yy = rotulos[k - 1].yy + 14;
  }
  // rótulo direto seletivo: só onde cabe perto do próprio ponto e dentro da área
  // do gráfico; o que não cabe fica identificado pela legenda
  const finaisVisiveis = rotulos.filter((r) => Math.abs(r.yy - r.alvo) <= 10 && r.yy <= h - B - 4 && r.yy >= T + 4);

  // marcos só dentro do intervalo exibido; rótulos próximos são desempilhados
  const x0 = String(vis[0]?.[chaveX] ?? "");
  const x1 = String(vis[n - 1]?.[chaveX] ?? "");
  const marcosVisiveis: { m: { x: string; rotulo: string }; i: number; linha: number }[] = [];
  for (const m of marcos) {
    if (!n || m.x < x0 || m.x > x1) continue;
    const i = vis.findIndex((d) => String(d[chaveX]) >= m.x);
    if (i < 0) continue;
    const anterior = marcosVisiveis.at(-1);
    const linha = anterior && x(i) - x(anterior.i) < 110 ? anterior.linha + 1 : 0;
    marcosVisiveis.push({ m, i, linha });
  }

  const yt = ticks(yMin, yMax);
  // rótulo com as casas do passo: com passo 2,5 os ticks são "2,5" e "7,5", não "3" e "8"
  const passoY = yt.length > 1 ? yt[1] - yt[0] : 1;
  const nx = Math.min(largura < ESTREITO ? 4 : 7, n);
  const xt = n <= 1 ? [0] : Array.from({ length: nx }, (_, k) => Math.round((k / Math.max(nx - 1, 1)) * (n - 1)));

  const rotulosX = rotulosDoEixoX(xt.map((i) => String(vis[i]?.[chaveX] ?? "")), formatoX);

  /* ---------- interação ---------- */
  const podeArrastar = zoom && largura >= ESTREITO && n > 2;

  function indicePonteiro(ev: React.PointerEvent<SVGRectElement>): number {
    const r = (ev.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * (w - L - R);
    const i = Math.round((px / (w - L - R)) * (n - 1));
    return Math.max(0, Math.min(n - 1, i));
  }

  function mover(ev: React.PointerEvent<SVGRectElement>) {
    const i = indicePonteiro(ev);
    setAtivo(i);
    if (arrasto && arrasto.b !== i) setArrasto({ a: arrasto.a, b: i });
  }

  function pressionar(ev: React.PointerEvent<SVGRectElement>) {
    const i = indicePonteiro(ev);
    setAtivo(i);
    // arrasto só com mouse: no toque, arrastar rola a página e tocar abre a dica
    if (podeArrastar && ev.pointerType === "mouse" && ev.button === 0) {
      try {
        ev.currentTarget.setPointerCapture(ev.pointerId);
      } catch {
        /* navegador sem captura de ponteiro: o arrasto termina ao sair do gráfico */
      }
      setArrasto({ a: i, b: i });
    }
  }

  function soltar() {
    if (!arrasto) return;
    const a = Math.min(arrasto.a, arrasto.b);
    const b = Math.max(arrasto.a, arrasto.b);
    setArrasto(null);
    if (b - a >= 1) aplicarIndices(i0 + a, i0 + b);
  }

  function aplicarIndices(a: number, b: number) {
    const novo = intervaloDosIndices(xsTodos, a, b);
    if (intervaloControlado === undefined) setIntervaloInterno(novo);
    onIntervalo?.(novo);
    setAtivo(null);
    setAviso("");
  }

  function alternarSerie(id: string) {
    const atual = new Set(ocultasLista);
    if (atual.has(id)) atual.delete(id);
    else {
      if (series.length - atual.size <= 1) {
        setAviso("Ao menos uma série fica visível.");
        return;
      }
      atual.add(id);
    }
    const lista = series.map((s) => s.id).filter((i) => atual.has(i));
    if (ocultasControladas === undefined) setOcultasInternas(lista);
    onOcultas?.(lista);
    setAviso("");
  }

  function teclado(ev: React.KeyboardEvent<SVGSVGElement>) {
    if (ev.key === "Home" || ev.key === "End") {
      ev.preventDefault();
      setAtivo(ev.key === "Home" ? 0 : n - 1);
    } else if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
      ev.preventDefault();
      setAtivo((a) => {
        const base = a ?? n - 1;
        return Math.max(0, Math.min(n - 1, base + (ev.key === "ArrowRight" ? 1 : -1)));
      });
    } else if (ev.key === "Escape") {
      setAtivo(null);
      setArrasto(null);
    }
  }

  const pa = ativo !== null ? vis[ativo] : null;
  const tipX = ativo !== null ? x(ativo) : 0;
  const pCruz = iCruz !== null ? vis[iCruz] : null;
  const cruzX = iCruz !== null ? x(iCruz) : 0;

  /* ---------- textos de estado (zoom e escala) ---------- */
  const rotuloX = (i: number) => fmtX(xsTodos[i] ?? "", formatoX, true);
  const estado: string[] = [];
  if (ampliado) {
    estado.push(
      `Intervalo exibido: ${rotuloX(i0)} a ${rotuloX(i1)}, ${n.toLocaleString("pt-BR")} de ${N.toLocaleString("pt-BR")} pontos` +
        (escalaDoTrecho ? "; eixo vertical recalculado para o intervalo." : "."),
    );
  }
  if (escalaDasVisiveis) {
    estado.push(
      `Escala ajustada às séries visíveis: eixo de ${fmtV(domVisiveis.yMin, casas, "")} a ${fmtV(domVisiveis.yMax, casas, unidade)}; com todas as séries, ${fmtV(domTodas.yMin, casas, "")} a ${fmtV(domTodas.yMax, casas, unidade)}.`,
    );
  } else if (temOcultas && modoEscala === "manter") {
    estado.push("Escala mantida com todas as séries, inclusive as ocultas.");
  } else if (temOcultas) {
    estado.push("Ocultar séries não mudou a escala do eixo.");
  }
  if (aviso) estado.push(aviso);
  const textoEstado = estado.join(" ");

  const pontosSel = arrasto ? [Math.min(arrasto.a, arrasto.b), Math.max(arrasto.a, arrasto.b)] : null;
  const nomesOcultas = series.filter((s) => !seriesVis.includes(s)).map((s) => s.rotulo);
  const botao = "rotulo inline-flex min-h-[44px] items-center border px-3";

  return (
    <div ref={ref} className="relative w-full">
      {zoom && N > 2 && (
        <div role="group" aria-label={`Intervalo do gráfico: ${titulo}`} className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1" data-controles="intervalo">
          {periodos.length > 0 && <span className="rotulo mr-1 text-mineral">Período</span>}
          {periodos.map((p) => {
            const [a, b] = p.indices;
            const atual = ampliado && a === i0 && b === i1;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={atual}
                onClick={() => aplicarIndices(a, b)}
                className={`${botao} ${atual ? "border-energia bg-energia-fundo text-energia-dark" : "border-linha text-carvao-muted hover:border-carvao hover:text-carvao"}`}
              >
                {p.rotulo}
              </button>
            );
          })}
          <button
            type="button"
            aria-disabled={!ampliado}
            onClick={() => ampliado && aplicarIndices(0, N - 1)}
            className={`${botao} ${ampliado ? "border-carvao-muted text-carvao hover:border-carvao" : "cursor-default border-linha text-mineral"}`}
          >
            Restaurar intervalo
          </button>
          <span className="hidden text-xs text-mineral sm:inline">ou arraste sobre o gráfico com o mouse</span>
          <details className="w-full">
            <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
              Ajustar início e fim
            </summary>
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <label className="block text-xs text-carvao-muted">
                Início: <span className="tabular-nums text-carvao">{rotuloX(i0)}</span>
                <input
                  type="range"
                  min={0}
                  max={N - 2}
                  step={1}
                  value={i0}
                  aria-valuetext={rotuloX(i0)}
                  onChange={(e) => {
                    const v = Number(e.currentTarget.value);
                    aplicarIndices(v, Math.max(i1, v + 1));
                  }}
                  className="block h-11 w-full cursor-pointer accent-energia"
                />
              </label>
              <label className="block text-xs text-carvao-muted">
                Fim: <span className="tabular-nums text-carvao">{rotuloX(i1)}</span>
                <input
                  type="range"
                  min={1}
                  max={N - 1}
                  step={1}
                  value={i1}
                  aria-valuetext={rotuloX(i1)}
                  onChange={(e) => {
                    const v = Number(e.currentTarget.value);
                    aplicarIndices(Math.min(i0, v - 1), v);
                  }}
                  className="block h-11 w-full cursor-pointer accent-energia"
                />
              </label>
            </div>
          </details>
        </div>
      )}
      {legendaInterativa ? (
        <ul className="mb-1 flex flex-wrap items-center gap-x-1 gap-y-0 text-xs text-carvao-muted" aria-label="Legenda: ative ou oculte séries">
          {series.map((s) => {
            const visivel = seriesVis.includes(s);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-pressed={visivel}
                  onClick={() => alternarSerie(s.id)}
                  className={`inline-flex min-h-[44px] items-center gap-1.5 px-1.5 underline-offset-4 hover:underline ${visivel ? "text-carvao-muted" : "text-mineral"}`}
                >
                  <svg width="18" height="8" aria-hidden="true">
                    <line
                      x1="0"
                      y1="4"
                      x2="18"
                      y2="4"
                      stroke={visivel ? s.cor : "var(--cor-mineral-soft)"}
                      strokeWidth="2.5"
                      strokeDasharray={s.tracejada ? "4 3" : visivel ? undefined : "1 3"}
                    />
                  </svg>
                  {s.rotulo}
                  {!visivel && <span className="italic">(oculta)</span>}
                </button>
              </li>
            );
          })}
          {banda && (
            <li className="flex min-h-[44px] items-center gap-1.5 px-1.5">
              <span aria-hidden="true" className="inline-block h-2.5 w-4" style={{ background: banda.cor ?? "color-mix(in srgb, var(--serie-referencia) 22%, transparent)" }} />
              {banda.rotulo}
            </li>
          )}
          <li className="flex min-h-[44px] items-center px-1.5 text-mineral" data-legenda="unidade">
            Valores em {unidade}
          </li>
        </ul>
      ) : (
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
      )}
      {(zoom || legendaInterativa) && (
        <div className="mb-2 flex min-h-[1.25rem] flex-wrap items-center gap-x-3 px-1">
          <p className="text-xs text-carvao-muted" aria-live="polite" data-estado-grafico="">
            {textoEstado}
          </p>
          {legendaInterativa && temOcultas && (
            <button
              type="button"
              onClick={() => setModoEscala((m) => (m === "ajustar" ? "manter" : "ajustar"))}
              className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao"
            >
              {modoEscala === "ajustar" ? "Manter a escala de todas as séries" : "Ajustar a escala às séries visíveis"}
            </button>
          )}
        </div>
      )}
      {zoom && (
        <p id={`${uid}-d`} className="sr-only">
          Para ampliar um trecho, use os botões de período ou os controles de início e fim acima do gráfico.
        </p>
      )}
      {/* altura fixa em pixels: o HTML do servidor já reserva a altura final, e âncoras abaixo
          do gráfico não se deslocam quando a largura real é medida no cliente */}
      <svg
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-labelledby={`${uid}-t`}
        aria-describedby={zoom ? `${uid}-d` : undefined}
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
              {rotuloTick(v, passoY)}
            </text>
          </g>
        ))}
        {xt.map((i, k) => (
          <text key={i} x={x(i)} y={h - 8} textAnchor="middle" fontSize="11" fill="var(--cor-mineral)">
            {rotulosX[k]}
          </text>
        ))}
        {bandaPath && <path d={bandaPath} fill={banda?.cor ?? "color-mix(in srgb, var(--serie-referencia) 22%, transparent)"} stroke="none" />}
        {marcosVisiveis.map(({ m, i, linha }) => (
          <g key={m.x}>
            <line x1={x(i)} x2={x(i)} y1={T} y2={h - B} stroke="var(--cor-mineral)" strokeWidth="1" strokeDasharray="3 3" />
            {/* rótulo que não cabe à direita do marco passa para a esquerda: com 10 px a letra mede cerca de 5,4 px */}
            <text
              x={x(i) + (x(i) + 4 + m.rotulo.length * 5.4 > w - 4 ? -4 : 4)}
              textAnchor={x(i) + 4 + m.rotulo.length * 5.4 > w - 4 ? "end" : "start"}
              y={T + 10 + linha * 13}
              fontSize="10"
              fill="var(--cor-mineral)"
            >
              {m.rotulo}
            </text>
          </g>
        ))}
        {seriesVis.map((s, k) => (
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
          finaisVisiveis.map((r) => {
            const f = r.itens[0];
            const curto = (s: SerieLinha) => s.sigla ?? s.rotulo;
            const texto =
              r.itens.length > 1 ? r.itens.map((i) => curto(i.s)).join(largura < ESTREITO ? "·" : " · ") : largura < ESTREITO || f.s.rotulo.length > 18 ? curto(f.s) : f.s.rotulo;
            // rótulo que não cabe na margem direita é omitido: a legenda identifica a série
            if (x(f.i) + 8 + texto.length * 6.2 > w - 2) return null;
            return (
              <g key={f.s.id}>
                <circle cx={x(f.i)} cy={y(f.v)} r="3.5" fill={f.s.cor} stroke="var(--cor-superficie)" strokeWidth="1.5" />
                <text x={x(f.i) + 8} y={r.yy + 4} fontSize="11" fill="var(--cor-carvao)">
                  {texto}
                </text>
              </g>
            );
          })}
        {pontosSel && (
          <rect
            data-selecao="intervalo"
            x={x(pontosSel[0])}
            y={T}
            width={Math.max(1, x(pontosSel[1]) - x(pontosSel[0]))}
            height={Math.max(1, h - T - B)}
            fill="color-mix(in srgb, var(--cor-energia) 12%, transparent)"
            stroke="var(--cor-energia)"
            strokeWidth="1"
            pointerEvents="none"
          />
        )}
        {iCruz !== null && (
          <g pointerEvents="none" data-cursor={ativo !== null ? "local" : "sincronizado"}>
            <line x1={cruzX} x2={cruzX} y1={T} y2={h - B} stroke="var(--cor-carvao)" strokeWidth="1" opacity="0.5" />
            {seriesVis.map((s) => {
              const v = pCruz?.[s.id];
              return typeof v === "number" && Number.isFinite(v) ? (
                <circle key={s.id} cx={cruzX} cy={y(v)} r="4.5" fill={s.cor} stroke="var(--cor-superficie)" strokeWidth="2" />
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
          className={podeArrastar ? "cursor-crosshair" : undefined}
          onPointerMove={mover}
          onPointerDown={pressionar}
          onPointerUp={soltar}
          onPointerCancel={() => setArrasto(null)}
          onPointerLeave={(ev) => {
            // no toque o ponteiro "sai" ao levantar o dedo: a dica continua até outro toque
            if (ev.pointerType === "mouse") setAtivo(null);
            if (arrasto) soltar();
          }}
        />
      </svg>
      {/* leitura do ponto ativo para leitor de tela: região persistente, anunciada a cada mudança */}
      <p className="sr-only" aria-live="polite">
        {pa
          ? `${fmtX(String(pa[chaveX]), formatoX, true)}: ${seriesVis.map((s) => `${s.rotulo} ${fmtV(pa[s.id] as number | null, casas, unidade)}`).join("; ")}`
          : ""}
      </p>
      {pa && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-6 z-20 min-w-[11rem] border border-linha bg-superficie px-3 py-2 text-xs shadow-[0_6px_20px_rgba(26,29,33,0.12)]"
          style={{ left: `min(max(0px, calc(${(tipX / w) * 100}% - 5.5rem)), calc(100% - 12rem))` }}
        >
          <p className="rotulo text-mineral">{fmtX(String(pa[chaveX]), formatoX, true)}</p>
          <ul className="mt-1 space-y-0.5">
            {seriesVis.map((s) => (
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
      <details className="mt-3 text-xs" open={tabelaAbertaInicial || undefined} onToggle={(e) => setTabelaAberta((e.currentTarget as HTMLDetailsElement).open)}>
        <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
          {ampliado
            ? `Dados do gráfico em tabela (${n.toLocaleString("pt-BR")} de ${N.toLocaleString("pt-BR")} linhas, intervalo exibido)`
            : `Dados do gráfico em tabela (${n.toLocaleString("pt-BR")} ${n === 1 ? "linha" : "linhas"})`}
        </summary>
        {tabelaAberta && (
          <div className="tabela-scroll mt-2 max-h-80 overflow-y-auto" tabIndex={0} role="region" aria-label={`${titulo}: dados em tabela (rolável)`}>
            <table className="w-full border-collapse tabular-nums">
              <caption className="sr-only">
                {`${titulo}, em ${unidade}` +
                  (ampliado ? `; intervalo de ${rotuloX(i0)} a ${rotuloX(i1)}` : "") +
                  (nomesOcultas.length ? `; séries ocultas no gráfico e na tabela: ${nomesOcultas.join(", ")}` : "")}
              </caption>
              <thead className="sticky top-0 bg-superficie">
                <tr className="text-left text-mineral">
                  <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">
                    {formatoX === "hora" ? "Hora" : formatoX === "mes" ? "Mês" : formatoX === "texto" ? "Item" : "Data"}
                  </th>
                  {seriesVis.map((s) => (
                    <th key={s.id} scope="col" className="border-b border-linha px-2 py-1.5 font-medium">{s.rotulo} ({unidade})</th>
                  ))}
                  {banda && <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">{banda.rotulo} ({unidade})</th>}
                </tr>
              </thead>
              <tbody>
                {vis.map((p, i) => (
                  <tr key={i} className="border-b border-linha">
                    <th scope="row" className="px-2 py-1 text-left font-normal text-carvao">{fmtX(String(p[chaveX] ?? ""), formatoX, true)}</th>
                    {seriesVis.map((s) => (
                      <td key={s.id} className="px-2 py-1 text-carvao">{fmtV(p[s.id] as number | null, casas, "")}</td>
                    ))}
                    {banda && (
                      <td className="px-2 py-1 text-mineral">
                        {typeof p[banda.inferior] === "number" ? `${fmtV(p[banda.inferior] as number, casas, "")} a ${fmtV(p[banda.superior] as number, casas, "")}` : "sem dado"}
                      </td>
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
