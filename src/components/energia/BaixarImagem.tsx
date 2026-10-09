"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  FONTE_SISTEMA,
  VARIAVEIS_DA_MOLDURA,
  dataDoClique,
  enderecoDaPagina,
  escalaDoCanvas,
  extrairFonteEVersao,
  montarSvgImagem,
  nomeArquivoImagem,
  variaveisUsadas,
  type AmostraImagem,
  type ElementoImagem,
  type EntradaImagem,
  type ItemLegendaImagem,
  type Medidor,
} from "@/lib/energia/imagem-grafico";

/**
 * "Baixar imagem": leva o gráfico, como está na tela, para um PNG com o contexto junto (título, unidade, legenda, o desenho, a fonte, a
 * versão dos dados, o endereço da página e a data), para o leitor colocar num slide ou numa matéria sem perder de onde veio. Hoje só
 * havia link, CSV e XLSX.
 *
 * Como funciona: no clique, lê do DOM o contêiner do gráfico (`raiz`), clona os svgs marcados com `data-svg-grafico` (sem a cruz do
 * cursor, a seleção de intervalo e o realce de foco ou de passagem, que são do momento e não do dado), leva junto os padrões de hachura
 * (sem eles a marca "sem dado" sairia preta), troca `var(--token)` pelos valores que a página calcula, monta um svg com as funções puras
 * de `lib/energia/imagem-grafico`, desenha num canvas e baixa o PNG por um link temporário. Sem biblioteca, sem rede, sem fonte nem
 * imagem externa (o canvas não fica "tainted"). A imagem mostra o gráfico no momento do clique: série oculta, intervalo ampliado,
 * ordem e seleção valem como estão, e as notas de estado do gráfico (recorte parcial, intervalo, escala) vão junto.
 *
 * O botão só aparece depois da hidratação: o HTML do servidor segue sem `<button>` (testes de servidor leem esse HTML) e traz só um
 * espaço invisível do tamanho do botão, para o layout não saltar quando ele chega. Fonte e versão vêm do rodapé do painel mais
 * próximo (`section[data-painel-evidencia]`); fora de painel, a imagem leva só o endereço e a data. Oculto na impressão.
 */

const MENSAGEM_ERRO = "Não foi possível gerar a imagem neste navegador.";
const CLASSE_BOTAO =
  "rotulo inline-flex min-h-[24px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao [@media(pointer:coarse)]:min-h-[44px]";

/** Elementos do svg que são do momento da interação (cruz do cursor, seleção por arrasto) e não entram na imagem. */
const TRANSITORIOS = "title, desc, script, foreignObject, [data-cursor], [data-selecao], [data-nao-exportar]";
const ATRIBUTOS_DE_PAGINA = /^(tabindex|role|focusable|aria-.+|data-.+)$/;

const limpaTexto = (t: string | null | undefined) => (t || "").replace(/\s+/g, " ").trim();
const serializar = (no: Node) => new XMLSerializer().serializeToString(no);
/** Markup dos filhos de um nó, em XML (o XML do navegador escreve o espaço não separável como caractere, não como `&nbsp;`). */
const internoDe = (no: Node) => Array.from(no.childNodes).map(serializar).join("");

function limparClone(origem: SVGElement): SVGElement {
  const clone = origem.cloneNode(true) as SVGElement;
  clone.querySelectorAll(TRANSITORIOS).forEach((n) => n.remove());
  [clone].concat(Array.from(clone.querySelectorAll<SVGElement>("*"))).forEach((el) => {
    Array.from(el.attributes).forEach((a) => {
      if (ATRIBUTOS_DE_PAGINA.test(a.name)) el.removeAttribute(a.name);
    });
  });
  return clone;
}

function elementoSvg(svg: SVGElement, base: { left: number; top: number }): ElementoImagem | null {
  const r = svg.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  return {
    tipo: "svg",
    x: r.left - base.left,
    y: r.top - base.top,
    largura: r.width,
    altura: r.height,
    viewBox: svg.getAttribute("viewBox") || undefined,
    interno: internoDe(limparClone(svg)),
  };
}

/** Amostra da legenda: o svg pequeno da própria legenda ou a caixa de cor (`span` com fundo), já com a cor calculada pelo navegador. */
function lerAmostra(item: Element): AmostraImagem | null {
  const svg = item.querySelector("svg");
  if (svg) {
    const r = svg.getBoundingClientRect();
    const largura = Number(svg.getAttribute("width")) || r.width;
    const altura = Number(svg.getAttribute("height")) || r.height;
    if (largura > 0 && altura > 0) return { largura, altura, interno: internoDe(limparClone(svg)) };
  }
  const caixa = item.querySelector<HTMLElement>('[aria-hidden="true"]');
  if (caixa) {
    const r = caixa.getBoundingClientRect();
    const css = getComputedStyle(caixa);
    const borda = parseFloat(css.borderTopWidth) > 0 ? ` stroke="${css.borderTopColor}" stroke-width="1"` : "";
    const raio = Math.min(parseFloat(css.borderTopLeftRadius) || 0, r.width / 2, r.height / 2);
    if (r.width > 0 && r.height > 0) {
      const w = Math.max(0, r.width - (borda ? 1 : 0));
      const h = Math.max(0, r.height - (borda ? 1 : 0));
      const off = borda ? 0.5 : 0;
      return { largura: r.width, altura: r.height, interno: `<rect x="${off}" y="${off}" width="${w}" height="${h}" rx="${raio}" fill="${css.backgroundColor}"${borda}/>` };
    }
  }
  return null;
}

/** Itens da legenda visível, sem a unidade (que vai sob o título) e sem as séries que o leitor ocultou. */
function lerLegenda(raiz: HTMLElement): ItemLegendaImagem[] {
  const lista = raiz.querySelector('ul[aria-label^="Legenda"]');
  if (!lista) return [];
  const itens: ItemLegendaImagem[] = [];
  Array.from(lista.children).forEach((li) => {
    if (li.querySelector("button")?.getAttribute("aria-pressed") === "false") return;
    const texto = limpaTexto(li.textContent);
    if (/^Valores em /i.test(texto)) return;
    const amostra = lerAmostra(li);
    if (texto || amostra) itens.push({ texto, amostra });
  });
  return itens;
}

/** Padrões de hachura e demais definições que ficam num svg oculto fora dos svgs do gráfico. */
function lerDefinicoes(raiz: HTMLElement): string {
  let saida = "";
  raiz.querySelectorAll("svg").forEach((s) => {
    if (s.hasAttribute("data-svg-grafico") || s.closest("svg[data-svg-grafico]")) return;
    s.querySelectorAll("defs").forEach((d) => {
      saida += internoDe(d);
    });
  });
  return saida;
}

/** Notas que o próprio gráfico escreve sobre o que mostra agora (recorte parcial, intervalo exibido, escala; no histograma, amostra e período), marcadas com `data-nota-imagem` quando não têm outro marcador. */
function lerNotas(raiz: HTMLElement): string[] {
  const notas: string[] = [];
  raiz.querySelectorAll('[data-aviso], [data-estado-grafico], [data-aviso-rolagem] > span, [data-nota-imagem]').forEach((el) => {
    const t = limpaTexto(el.textContent);
    if (t && !notas.includes(t)) notas.push(t);
  });
  return notas;
}

/** Área do gráfico: os svgs marcados, ou, nos pequenos múltiplos, a grade inteira com a borda de cada célula e o título de cada painel. */
function lerGrafico(raiz: HTMLElement): EntradaImagem["grafico"] | null {
  const celulas = Array.from(raiz.querySelectorAll<HTMLElement>("li[data-painel]"));
  const grade = celulas[0]?.parentElement;
  if (grade) {
    const g = grade.getBoundingClientRect();
    if (g.width < 1 || g.height < 1) return null;
    const elementos: ElementoImagem[] = [
      { tipo: "linha", x1: 0.5, y1: 0, x2: 0.5, y2: g.height },
      { tipo: "linha", x1: 0, y1: 0.5, x2: g.width, y2: 0.5 },
    ];
    celulas.forEach((c) => {
      const r = c.getBoundingClientRect();
      const [esq, topo, dir, base] = [r.left - g.left, r.top - g.top, r.right - g.left, r.bottom - g.top];
      elementos.push({ tipo: "linha", x1: dir - 0.5, y1: topo, x2: dir - 0.5, y2: base }, { tipo: "linha", x1: esq, y1: base - 0.5, x2: dir, y2: base - 0.5 });
      const svg = c.querySelector<SVGElement>("svg[data-svg-grafico]");
      const largura = svg ? svg.getBoundingClientRect().width : r.width;
      const titulo = c.querySelector("h3, h4");
      if (titulo) {
        const t = titulo.getBoundingClientRect();
        elementos.push({ tipo: "texto", x: t.left - g.left, y: t.top - g.top, texto: limpaTexto(titulo.textContent), tamanho: 14, peso: 600, larguraMax: largura, maxLinhas: 2 });
      }
      const nota = c.querySelector("p");
      if (nota) {
        const t = nota.getBoundingClientRect();
        elementos.push({ tipo: "texto", x: t.left - g.left, y: t.top - g.top, texto: limpaTexto(nota.textContent), tamanho: 12, cor: "var(--cor-mineral)", larguraMax: largura, maxLinhas: 2 });
      }
      if (svg) {
        const e = elementoSvg(svg, g);
        if (e) elementos.push(e);
      }
    });
    return { largura: g.width, altura: g.height, elementos };
  }
  const svgs = Array.from(raiz.querySelectorAll<SVGElement>("svg[data-svg-grafico]")).filter((s) => {
    const r = s.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1;
  });
  if (!svgs.length) return null;
  const rects = svgs.map((s) => s.getBoundingClientRect());
  const esq = Math.min(...rects.map((r) => r.left));
  const topo = Math.min(...rects.map((r) => r.top));
  const dir = Math.max(...rects.map((r) => r.right));
  const base = Math.max(...rects.map((r) => r.bottom));
  const elementos = svgs.map((s) => elementoSvg(s, { left: esq, top: topo })).filter((e): e is ElementoImagem => !!e);
  return { largura: dir - esq, altura: base - topo, elementos };
}

/** Fonte e versão do rodapé do painel mais próximo, e a âncora do painel para o endereço. */
function lerPainel(raiz: HTMLElement): { fonte: string | null; versao: string | null; ancora: string | null } {
  const painel = raiz.closest("section[data-painel-evidencia]");
  if (!painel) return { fonte: null, versao: null, ancora: null };
  const rodape = Array.from(painel.children).find((c) => c.tagName === "FOOTER");
  const { fonte, versao } = extrairFonteEVersao(rodape?.querySelector("p")?.textContent);
  return { fonte, versao, ancora: painel.id || null };
}

function criarMedidor(): Medidor | undefined {
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return undefined;
    return (texto, tamanho, negrito) => {
      ctx.font = `${negrito ? 700 : 400} ${tamanho}px ${FONTE_SISTEMA}`;
      return ctx.measureText(texto).width;
    };
  } catch {
    return undefined;
  }
}

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image();
    const limite = window.setTimeout(() => falha(new Error("tempo esgotado ao carregar o svg")), 20000);
    img.onload = () => {
      window.clearTimeout(limite);
      ok(img);
    };
    img.onerror = () => {
      window.clearTimeout(limite);
      falha(new Error("o navegador recusou o svg"));
    };
    img.src = url;
  });
}

/** Desenha o svg num canvas em 2x (menos, se a imagem for enorme) e devolve o PNG. Data URL; blob só para svg muito grande. */
async function rasterizar(svg: string, largura: number, altura: number): Promise<Blob> {
  const escala = escalaDoCanvas(largura, altura);
  const grande = svg.length > 1_500_000;
  const url = grande ? URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" })) : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  try {
    const img = await carregarImagem(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(largura * escala);
    canvas.height = Math.round(altura * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("sem canvas 2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error("o canvas não gerou o PNG"))), "image/png"));
  } finally {
    if (grande) URL.revokeObjectURL(url);
  }
}

function baixarArquivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Lê o gráfico do DOM e devolve a entrada de `montarSvgImagem`, ou null quando não há gráfico desenhado. */
function lerEntrada(raiz: HTMLElement, titulo: string, unidade: string): EntradaImagem | null {
  const grafico = lerGrafico(raiz);
  if (!grafico || !grafico.elementos.length) return null;
  const { fonte, versao, ancora } = lerPainel(raiz);
  return {
    titulo,
    unidade,
    legenda: lerLegenda(raiz),
    grafico,
    definicoes: lerDefinicoes(raiz),
    notas: lerNotas(raiz),
    fonte,
    versao,
    endereco: enderecoDaPagina(window.location, ancora),
    geradoEm: dataDoClique(new Date()),
  };
}

/** Valores calculados dos tokens que o svg usa: um svg usado como imagem não enxerga o CSS da página. */
function lerTokens(entrada: EntradaImagem): Record<string, string> {
  const nomes: string[] = Array.from(VARIAVEIS_DA_MOLDURA);
  variaveisUsadas(JSON.stringify(entrada)).forEach((n) => {
    if (!nomes.includes(n)) nomes.push(n);
  });
  const css = getComputedStyle(document.documentElement);
  const tokens: Record<string, string> = {};
  nomes.forEach((n) => {
    const v = css.getPropertyValue(n).trim();
    if (v) tokens[n] = v;
  });
  return tokens;
}

type Aviso = { texto: string; erro: boolean };

export function BaixarImagem({ raiz, titulo, unidade }: { raiz: RefObject<HTMLElement | null>; titulo: string; unidade: string }) {
  const [pronto, setPronto] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const gerando = useRef(false);

  useEffect(() => setPronto(true), []);

  // no servidor e na primeira renderização: só o espaço do botão (mesma altura, largura do texto "Baixar imagem" e linha de base), invisível,
  // sem texto e fora da leitura de tela; o HTML do servidor não tem <button> nem a palavra "Baixar" a mais
  if (!pronto) {
    return (
      <span aria-hidden="true" className={`invisible ml-auto w-[6.3rem] print:hidden ${CLASSE_BOTAO}`}>
        {"\u00a0"}
      </span>
    );
  }

  async function baixar() {
    if (gerando.current) return;
    gerando.current = true;
    setAviso(null);
    try {
      const el = raiz.current;
      const entrada = el ? lerEntrada(el, titulo, unidade) : null;
      if (!entrada) throw new Error("sem gráfico desenhado");
      const { svg, largura, altura } = montarSvgImagem(entrada, { tokens: lerTokens(entrada), medir: criarMedidor() });
      const png = await rasterizar(svg, largura, altura);
      const nome = nomeArquivoImagem(titulo);
      baixarArquivo(png, nome);
      setAviso({ texto: `Imagem baixada: ${nome}.`, erro: false });
    } catch {
      setAviso({ texto: MENSAGEM_ERRO, erro: true });
    } finally {
      gerando.current = false;
    }
  }

  return (
    <span className="ml-auto inline-flex flex-col items-end print:hidden" data-baixar-imagem="">
      <button type="button" onClick={baixar} aria-label={`Baixar imagem do gráfico: ${titulo}`} className={CLASSE_BOTAO}>
        Baixar imagem
      </button>
      {/* região viva presente desde a hidratação; o aviso de sucesso é só para leitor de tela, o de erro também fica visível */}
      <span role="status" aria-live="polite" className={aviso?.erro ? "max-w-[16rem] text-right text-xs text-carvao-muted" : "sr-only"}>
        {aviso?.texto ?? ""}
      </span>
    </span>
  );
}
