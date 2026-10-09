"use client";

import { useEffect, useId, useRef, useState } from "react";
import { dominioComZero, empilhar, escalaLinear, formatarDiferenca, formatarValor, pxCaractere12, rotuloTick, ticksQueCabem, valido, type Pilha } from "@/lib/energia/escalas";

/**
 * Gráfico de barras SVG do Setor Elétrico, vertical ou horizontal, simples,
 * agrupado ou empilhado. Por que um componente próprio e não barras soltas em
 * cada página: as regras que tornam uma barra honesta ficam num lugar só.
 *
 * - Toda barra parte de zero (domínio com zero obrigatório, negativos para o
 *   outro lado da linha de base). Empilhar só quando a composição é aditiva
 *   (prop `empilhado`): a pilha soma, e somar partes que não se somam mente.
 * - Ausência nunca é barra zero: vira marca hachurada "sem dado" na linha de
 *   base; zero é dado e aparece como traço fino na base. Pilha com parte
 *   ausente leva a mesma hachura no fim e não exibe total ("incompleto").
 * - Cada categoria é um alvo de foco (tabindex itinerante): Tab entra, setas
 *   percorrem, Home e End vão aos extremos, Enter ou Espaço selecionam, Esc
 *   fecha a dica. A dica aparece no foco, no toque e no hover; o anel de foco
 *   é desenhado no próprio SVG (contorno CSS não é confiável em <g>).
 * - Seleção controlada (`selecionado` + `onSelecionar`) para sincronizar com
 *   mapa e tabela. Tabela equivalente recolhida, já no HTML do servidor (abre
 *   mesmo sem JavaScript), com os mesmos números do gráfico.
 * - Muitas categorias: use a orientação horizontal; cada categoria tem altura
 *   fixa (44 px por padrão) e a área rola na vertical com o eixo fixo acima.
 * - Altura em pixels definida já no servidor (largura padrão 760): o layout
 *   não salta quando a largura real é medida no cliente.
 */
export type SerieBarra = {
  id: string;
  rotulo: string;
  /** Cor da marca, sempre token CSS (ex.: "var(--serie-hidraulica)"). Texto nunca usa esta cor. */
  cor: string;
  /**
   * Série que só existe em parte das categorias por construção (ex.: "ano parcial", que só tem valor no ano em curso). O nulo dela não é
   * lacuna: não vira marca "sem dado", não torna a pilha "incompleta" e aparece como "não se aplica" na dica e na tabela. Ausência de
   * uma série que deveria ter valor continua sendo `null` sem esta marca.
   */
  opcional?: boolean;
};

export type ReferenciaBarra = {
  valor: number;
  /** Ex.: "Limite regulatório", "Média do SIN". */
  rotulo: string;
};

export type LinhaBarras = Record<string, string | number | null | undefined>;

export type GraficoBarrasProps = {
  titulo: string;
  dados: LinhaBarras[];
  /** Identificador estável da categoria (ex.: código da distribuidora), usado na seleção. */
  chaveCategoria: string;
  /** Campo com o nome exibido; padrão: o próprio identificador. */
  chaveRotulo?: string;
  series: SerieBarra[];
  unidade: string;
  casas?: number;
  orientacao?: "vertical" | "horizontal";
  /** Soma as séries numa pilha. Só para composição aditiva (partes de um mesmo total). */
  empilhado?: boolean;
  /** Valor escrito na ponta de cada barra (total, na pilha), quando cabe. */
  rotulosValor?: boolean;
  /** Linhas de referência (limite regulatório, média), com rótulo e valor na legenda. */
  referencias?: ReferenciaBarra[];
  selecionado?: string | null;
  onSelecionar?: (id: string | null) => void;
  /** Vertical: altura total do SVG em px. */
  altura?: number;
  /** Horizontal: altura de cada categoria em px (mínimo recomendado 44, o alvo de toque). */
  alturaCategoria?: number;
  /** Horizontal: acima desta altura a área das barras rola na vertical. */
  alturaMaxima?: number;
  /**
   * Horizontal com muitas categorias (ranking): desenha só as primeiras N, na ordem dos dados, até a pessoa pedir "Mostrar todas" (a tabela
   * equivalente já traz todas, e uma categoria selecionada fora das N faz o gráfico desenhar todas e rolar até ela). Corta o HTML e evita
   * a caixa de rolagem dentro da página.
   */
  limiteInicial?: number;
};

const LARGURA_SSR = 760;
const PX_CARACTERE = 6.2; // largura média de um caractere a 11 px, para decidir se um rótulo cabe
const LARGURA_ESTREITA = 520; // abaixo disto (celular): rótulo da categoria acima da barra, com a largura toda para o texto
const ALTURA_ROTULO = 16; // linha do rótulo acima da barra, em px

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Encurta o texto para caber na largura; "" quando nem três caracteres cabem. `px` é a largura média de um caractere. */
function cabe(texto: string, largura: number, px = PX_CARACTERE): string {
  if (texto.length * px <= largura) return texto;
  const n = Math.floor(largura / px) - 1;
  return n >= 3 ? `${texto.slice(0, n).trimEnd()}…` : "";
}

/** Quebra o rótulo em até duas linhas na última palavra que cabe; a segunda linha encurta com reticências. */
function duasLinhas(texto: string, largura: number, px: number): string[] {
  if (texto.length * px <= largura) return [texto];
  const palavras = texto.split(" ");
  let primeira = "";
  let i = 0;
  while (i < palavras.length - 1 && ((primeira ? `${primeira} ` : "") + palavras[i]).length * px <= largura) {
    primeira = primeira ? `${primeira} ${palavras[i]}` : palavras[i];
    i++;
  }
  const segunda = cabe(palavras.slice(i).join(" "), largura, px);
  return primeira && segunda ? [primeira, segunda] : [cabe(texto, largura, px)];
}

type Lado = "cima" | "baixo" | "direita" | "esquerda" | null;

/** Retângulo com cantos de 4 px só na ponta do dado; a base, junto do zero, fica reta. */
function pathBarra(x: number, y: number, w: number, h: number, lado: Lado): string {
  const vert = lado === "cima" || lado === "baixo";
  const r = lado ? Math.max(0, Math.min(4, vert ? w / 2 : h / 2, vert ? h : w)) : 0;
  const [X, Y, W, H, R] = [x, y, w, h, r].map(r1);
  if (!lado || R < 0.5) return `M${X},${Y}h${W}v${H}h${-W}Z`;
  if (lado === "cima") return `M${X},${Y + H}V${Y + R}Q${X},${Y} ${X + R},${Y}H${X + W - R}Q${X + W},${Y} ${X + W},${Y + R}V${Y + H}Z`;
  if (lado === "baixo") return `M${X},${Y}H${X + W}V${Y + H - R}Q${X + W},${Y + H} ${X + W - R},${Y + H}H${X + R}Q${X},${Y + H} ${X},${Y + H - R}Z`;
  if (lado === "direita") return `M${X},${Y}H${X + W - R}Q${X + W},${Y} ${X + W},${Y + R}V${Y + H - R}Q${X + W},${Y + H} ${X + W - R},${Y + H}H${X}Z`;
  return `M${X + W},${Y}V${Y + H}H${X + R}Q${X},${Y + H} ${X},${Y + H - R}V${Y + R}Q${X},${Y} ${X + R},${Y}Z`;
}

export function GraficoBarras({
  titulo,
  dados: dadosTodos,
  chaveCategoria,
  chaveRotulo,
  series,
  unidade,
  casas = 1,
  orientacao = "vertical",
  empilhado = false,
  rotulosValor = false,
  referencias = [],
  selecionado = null,
  onSelecionar,
  altura = 300,
  alturaCategoria,
  alturaMaxima = 480,
  limiteInicial,
}: GraficoBarrasProps) {
  const uid = useId().replace(/:/g, "");
  const [largura, setLargura] = useState(LARGURA_SSR);
  const [todas, setTodas] = useState(false);
  const [ativo, setAtivo] = useState<number | null>(null);
  const [focoVisivel, setFocoVisivel] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);
  const [anuncio, setAnuncio] = useState("");
  const raiz = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const hcRef = useRef(0);
  const alvos = useRef<(SVGGElement | null)[]>([]);

  // com `limiteInicial` o gráfico desenha só as primeiras categorias; a escala, a tabela e a seleção seguem as do conjunto inteiro
  const nTotal = dadosTodos.length;
  const idsTodos = dadosTodos.map((d) => String(d[chaveCategoria] ?? ""));
  const nomesTodos = dadosTodos.map((d) => String(d[chaveRotulo ?? chaveCategoria] ?? ""));
  const iSelTodos = selecionado === null ? -1 : idsTodos.indexOf(selecionado);
  const comLimite = orientacao === "horizontal" && !!limiteInicial && limiteInicial > 0 && nTotal > limiteInicial;
  const selecaoForaDoLimite = comLimite && iSelTodos >= (limiteInicial ?? 0);
  const corta = comLimite && !todas && !selecaoForaDoLimite;
  const n = corta ? (limiteInicial as number) : nTotal;
  const dados = corta ? dadosTodos.slice(0, n) : dadosTodos;
  const ids = corta ? idsTodos.slice(0, n) : idsTodos;
  const nomes = corta ? nomesTodos.slice(0, n) : nomesTodos;
  const iSel = iSelTodos < n ? iSelTodos : -1;

  useEffect(() => {
    const el = raiz.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setLargura(Math.max(280, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // a seleção vinda de fora (mapa, tabela) passa a ser o ponto de entrada do teclado
  useEffect(() => {
    if (iSel >= 0) setCursor(iSel);
  }, [iSel]);

  // e a caixa de rolagem das barras horizontais leva a categoria escolhida para dentro da janela (a rolagem é só da caixa, nunca da página)
  useEffect(() => {
    const el = caixa.current;
    const alt = hcRef.current;
    if (!el || iSel < 0 || !alt) return;
    const topo = iSel * alt;
    if (topo < el.scrollTop || topo + alt > el.scrollTop + el.clientHeight) el.scrollTop = Math.max(0, topo - (el.clientHeight - alt) / 2);
  }, [iSel, todas]);

  // toque fora do gráfico fecha a dica (no toque não há pointerleave útil)
  useEffect(() => {
    if (ativo === null) return;
    const fora = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAtivo(null);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [ativo]);

  if (!n || !series.length) {
    return (
      <div ref={raiz} className="flex items-center border border-dashed border-linha px-4 text-sm text-carvao-muted" style={{ height: orientacao === "vertical" ? altura : 88 }}>
        Nenhuma categoria com dados para exibir.
      </div>
    );
  }

  // celular: coluna com rótulo longo (faixas de renda, "2013 (11 meses)") não cabe sob a barra e saía truncada; vira barra horizontal,
  // com o rótulo acima. Rótulos curtos (meses, anos) e séries longas seguem em colunas.
  const maiorRotulo = Math.max(0, ...nomes.map((t) => t.length));
  const virouHorizontal = orientacao === "vertical" && largura < LARGURA_ESTREITA && maiorRotulo > 9 && n <= 16;
  const vertical = orientacao === "vertical" && !virouHorizontal;
  const valorDe = (linha: LinhaBarras, s: SerieBarra): number | null => {
    const v = linha[s.id];
    return valido(v) ? v : null;
  };
  const valor = (i: number, s: SerieBarra): number | null => valorDe(dados[i], s);
  /** Nulo de série `opcional` é ausência por construção (não se aplica), não lacuna. */
  const naoSeAplica = (v: number | null, s: SerieBarra) => v === null && !!s.opcional;
  const pilhaDe = (linha: LinhaBarras): Pilha =>
    empilhar(
      series.map((s) => {
        const v = valorDe(linha, s);
        return naoSeAplica(v, s) ? 0 : v;
      }),
    );
  // a escala e a tabela são do conjunto inteiro, mesmo quando o gráfico desenha só as primeiras categorias
  const pilhasTodas: Pilha[] | null = empilhado ? dadosTodos.map(pilhaDe) : null;
  const pilhas: Pilha[] | null = pilhasTodas && corta ? pilhasTodas.slice(0, n) : pilhasTodas;
  const semDado = dados.some((linha) => series.some((s) => valorDe(linha, s) === null && !s.opcional));

  const valoresDominio: number[] = referencias.map((r) => r.valor);
  dadosTodos.forEach((linha, i) => {
    if (pilhasTodas) valoresDominio.push(pilhasTodas[i].positivo, pilhasTodas[i].negativo);
    else for (const s of series) valoresDominio.push(valorDe(linha, s) ?? 0); // nulo não estende o domínio além do zero
  });
  const dom = dominioComZero(valoresDominio);
  const temNeg = dom.min < 0;
  const k = empilhado ? 1 : series.length;
  const w = largura;
  // abaixo de 640 px o texto do gráfico tem 12 px (11 px ficava abaixo do que as demais figuras da página usam); pxc é a largura média de um caractere nesse tamanho
  const FS = w < 640 ? 12 : 11;
  const pxc = w < 640 ? 6.7 : PX_CARACTERE;

  // ---------- geometria ----------
  let h: number; // altura do SVG das barras
  let escala: (v: number) => number;
  let banda: (i: number) => { x: number; y: number; w: number; h: number };
  let barra: (i: number, j: number) => { pos: number; esp: number }; // posição e espessura no eixo das categorias
  let plot: { x0: number; x1: number; y0: number; y1: number };
  let colunaRotulo = 0;
  let hc = 0;
  let rotuloEmCima = false;
  if (vertical) {
    // o rótulo do eixo cabe inteiro: "100.000" passava 10 px da borda esquerda com a margem fixa de 44 px
    const larguraEixo = Math.max(...dom.ticks.map((t) => rotuloTick(t, dom.passo).length)) * 6.4 + 14;
    const L = Math.max(w < LARGURA_ESTREITA ? 44 : 56, Math.ceil(larguraEixo));
    const R = 12;
    const T = rotulosValor ? 22 : 12;
    const B = 32;
    const padNeg = rotulosValor && temNeg ? 16 : 0;
    h = altura;
    plot = { x0: L, x1: w - R, y0: T, y1: h - B };
    escala = escalaLinear([dom.min, dom.max], [h - B - padNeg, T]);
    const slot = (w - L - R) / n;
    const grupo = Math.min(slot * 0.72, k * 24 + (k - 1) * 2);
    const esp = Math.max(2, (grupo - (k - 1) * 2) / k);
    banda = (i) => ({ x: L + i * slot, y: 2, w: slot, h: h - 4 });
    barra = (i, j) => ({ pos: L + i * slot + (slot - grupo) / 2 + j * (esp + 2), esp });
  } else {
    // celular: o rótulo da categoria vai numa linha acima da barra e usa a largura toda; a coluna lateral de 30% cortava o nome
    // ("Recebimento p…" duas vezes) e deixava barras indistinguíveis
    rotuloEmCima = w < LARGURA_ESTREITA;
    const topo = rotuloEmCima ? ALTURA_ROTULO : 0;
    hc = rotuloEmCima
      ? Math.max(alturaCategoria ?? 0, 44, topo + k * 14 + (k - 1) * 2 + 10)
      : (alturaCategoria ?? Math.max(44, k * 14 + (k - 1) * 2 + 16));
    // coluna lateral do tamanho do maior nome (até 42% da largura e 260 px); o que ainda passar quebra em duas linhas
    const larguraMaiorNome = Math.max(0, ...nomes.map((t) => t.length * pxCaractere12(t)));
    colunaRotulo = rotuloEmCima ? 0 : Math.round(Math.min(Math.max(88, w * 0.42), 260, Math.max(88, larguraMaiorNome + 12)));
    const R = rotulosValor ? (w < LARGURA_ESTREITA ? 64 : 80) : 16;
    const padNeg = rotulosValor && temNeg ? 56 : 0;
    h = n * hc;
    plot = { x0: colunaRotulo + 8, x1: w - R, y0: 0, y1: h };
    escala = escalaLinear([dom.min, dom.max], [colunaRotulo + 8 + padNeg, w - R]);
    const interno = hc - topo;
    const grupo = Math.min(interno * (rotuloEmCima ? 0.8 : 0.64), k * 20 + (k - 1) * 2);
    const esp = Math.max(2, Math.min(24, (grupo - (k - 1) * 2) / k));
    banda = (i) => ({ x: 0, y: i * hc, w, h: hc });
    barra = (i, j) => ({ pos: i * hc + topo + (interno - grupo) / 2 + j * (esp + 2), esp });
  }
  const zero = escala(0);
  hcRef.current = vertical ? 0 : hc;
  // barras que viraram horizontais no celular aparecem inteiras (até 16 categorias): rolar dentro de uma caixa de 480 px escondia categorias
  const limiteAltura = virouHorizontal ? Math.max(alturaMaxima, h) : alturaMaxima;
  // a caixa só limita quando esconde mais que uma categoria: sobrando menos que isso (11 categorias de 44 px contra 480 px), o gráfico inteiro cabe, e o
  // aviso "mostra só parte" com o botão "Mostrar todas" que quase não muda nada seria falso
  const limiteEfetivo = !vertical && h > limiteAltura && h <= limiteAltura + hc ? h : limiteAltura;

  /** Retângulo de um intervalo de valores [a, b] na barra j da categoria i. */
  const ret = (i: number, j: number, a: number, b: number) => {
    const { pos, esp } = barra(i, j);
    const p = escala(a);
    const q = escala(b);
    return vertical ? { x: pos, y: Math.min(p, q), w: esp, h: Math.abs(p - q) } : { x: Math.min(p, q), y: pos, w: Math.abs(p - q), h: esp };
  };
  const ladoDado = (v: number): Lado => (vertical ? (v >= 0 ? "cima" : "baixo") : v >= 0 ? "direita" : "esquerda");

  /**
   * Marca "sem dado": caixa hachurada curta encostada na base (ou na ponta da
   * pilha incompleta), apontando para `sentido` (+1: lado dos positivos).
   * Nunca é uma barra de valor: tem tamanho fixo e padrão próprio.
   */
  const TAM_SEM_DADO = 12;
  const marcaSemDado = (i: number, j: number, apoio: number, sentido: 1 | -1, chave: string, partes?: number) => {
    const { pos, esp } = barra(i, j);
    const t = TAM_SEM_DADO;
    const base = escala(apoio);
    const folga = apoio !== 0 ? 2 : 0;
    const r = vertical
      ? { x: pos, y: sentido > 0 ? base - folga - t : base + folga, w: esp, h: t }
      : { x: sentido > 0 ? base + folga : base - folga - t, y: pos, w: t, h: esp };
    return (
      <rect
        key={chave}
        data-estado="sem-dado"
        data-categoria={ids[i]}
        data-partes={partes}
        x={r1(r.x)}
        y={r1(r.y)}
        width={r1(r.w)}
        height={r1(r.h)}
        fill={`url(#${uid}-hachura)`}
        stroke="var(--cor-mineral)"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
    );
  };
  /** Posição em px logo depois da marca "sem dado" (para o texto que a acompanha). */
  const depoisDaMarca = (apoio: number, sentido: 1 | -1) => {
    const passo = (apoio !== 0 ? 2 : 0) + TAM_SEM_DADO;
    // no SVG vertical os positivos sobem (y diminui); no horizontal vão para a direita
    return escala(apoio) + (vertical ? -sentido : sentido) * passo;
  };
  const sentidoBase: 1 | -1 = dom.max > 0 ? 1 : -1;

  // ---------- textos ----------
  const leitura = (i: number): string => {
    const partes = series.flatMap((s) => {
      const v = valor(i, s);
      if (naoSeAplica(v, s)) return [];
      const t = formatarValor(v, casas, unidade);
      return [series.length > 1 ? `${s.rotulo} ${t}` : t];
    });
    const total = pilhas && series.length > 1 ? `; total ${pilhas[i].completo ? formatarValor(pilhas[i].total, casas, unidade) : "incompleto, há parte sem dado"}` : "";
    return `${nomes[i]}: ${partes.join("; ")}${total}`;
  };

  function selecionar(i: number) {
    if (!onSelecionar) return;
    const novo = selecionado === ids[i] ? null : ids[i];
    onSelecionar(novo);
    setAnuncio(novo === null ? `Seleção de ${nomes[i]} removida` : `Selecionada: ${nomes[i]}`);
  }

  function irPara(j: number) {
    const alvo = Math.max(0, Math.min(n - 1, j));
    setCursor(alvo);
    alvos.current[alvo]?.focus();
  }

  function teclado(ev: React.KeyboardEvent<SVGGElement>, i: number) {
    const tecla = ev.key;
    if (tecla === "ArrowRight" || tecla === "ArrowDown") irPara(i + 1);
    else if (tecla === "ArrowLeft" || tecla === "ArrowUp") irPara(i - 1);
    else if (tecla === "Home") irPara(0);
    else if (tecla === "End") irPara(n - 1);
    else if ((tecla === "Enter" || tecla === " ") && onSelecionar) selecionar(i);
    else if (tecla === "Escape") setAtivo(null);
    else return;
    ev.preventDefault();
  }

  const cursorEfetivo = Math.min(cursor, n - 1);
  // largura do maior rótulo curto (até 9 caracteres: "set/26", "2026-S1"): o passo é o menor que o mostra inteiro;
  // rótulos mais longos seguem encurtados com reticências, mas com mais espaço por rótulo
  const larguraRotulo = vertical ? Math.min(Math.max(0, ...nomes.map((t) => t.length)), 9) * pxc + 4 : 0;
  const passoRotulo = vertical ? Math.max(1, Math.ceil(Math.max(36, larguraRotulo) / ((plot.x1 - plot.x0) / n))) : 1;

  // retângulos dos rótulos de valor: a base e as linhas de referência passam ao largo deles
  const ocupados: { x0: number; x1: number; y0: number; y1: number }[] = [];

  // ---------- desenho das categorias ----------
  const categorias = dados.map((_, i) => {
    const b = banda(i);
    const sel = i === iSel;
    const marcas: React.ReactNode[] = [];
    const textos: React.ReactNode[] = [];

    if (pilhas) {
      const p = pilhas[i];
      const ultimoPos = p.segmentos.reduce((u, s, j) => (s && s.fim > s.inicio ? j : u), -1);
      const ultimoNeg = p.segmentos.reduce((u, s, j) => (s && s.fim < s.inicio ? j : u), -1);
      p.segmentos.forEach((s, j) => {
        if (!s || s.fim === s.inicio) return;
        const r = ret(i, 0, s.inicio, s.fim);
        // 2 px de superfície entre segmentos: recua a ponta do lado da base, exceto no primeiro de cada lado
        if (s.inicio !== 0) {
          if (vertical) {
            if (s.fim > 0) r.h -= 2;
            else {
              r.y += 2;
              r.h -= 2;
            }
          } else if (s.fim > 0) {
            r.x += 2;
            r.w -= 2;
          } else r.w -= 2;
        }
        if (r.w < 0.5 || r.h < 0.5) return;
        const lado = j === ultimoPos || j === ultimoNeg ? ladoDado(s.fim) : null;
        marcas.push(
          <path key={series[j].id} data-serie={series[j].id} data-categoria={ids[i]} d={pathBarra(r.x, r.y, r.w, r.h, lado)} fill={series[j].cor} />,
        );
      });
      const faltam = p.segmentos.filter((s) => s === null).length;
      // ponta dominante da pilha: a positiva, salvo quando só há parte negativa
      const pontaPos = p.positivo > 0 || p.negativo === 0;
      const apoio = pontaPos ? p.positivo : p.negativo;
      const sentido: 1 | -1 = pontaPos ? 1 : -1;
      if (faltam) marcas.push(marcaSemDado(i, 0, apoio, sentido, "sd", faltam));
      if (rotulosValor) {
        if (p.completo) textos.push(rotuloPonta(i, 0, formatarValor(p.total, casas), pontaPos, escala(apoio), "total"));
        else if (!vertical) textos.push(rotuloPonta(i, 0, "incompleto", pontaPos, depoisDaMarca(apoio, sentido), "total", true));
      }
    } else {
      series.forEach((s, j) => {
        const v = valor(i, s);
        if (v === null) {
          if (s.opcional) return;
          marcas.push(marcaSemDado(i, j, 0, sentidoBase, s.id));
          if (rotulosValor && !vertical) textos.push(rotuloPonta(i, j, "sem dado", sentidoBase > 0, depoisDaMarca(0, sentidoBase), s.id, true));
          return;
        }
        if (v === 0) {
          // zero é dado: traço fino sobre a base, distinto da hachura de ausência
          const { pos, esp } = barra(i, j);
          marcas.push(
            vertical ? (
              <rect key={s.id} data-estado="zero" data-serie={s.id} data-categoria={ids[i]} x={r1(pos)} y={r1(zero - 1)} width={r1(esp)} height="2" fill={s.cor} />
            ) : (
              <rect key={s.id} data-estado="zero" data-serie={s.id} data-categoria={ids[i]} x={r1(zero - 1)} y={r1(pos)} width="2" height={r1(esp)} fill={s.cor} />
            ),
          );
        } else {
          const r = ret(i, j, 0, v);
          marcas.push(<path key={s.id} data-serie={s.id} data-categoria={ids[i]} d={pathBarra(r.x, r.y, r.w, r.h, ladoDado(v))} fill={s.cor} />);
        }
        if (rotulosValor) textos.push(rotuloPonta(i, j, formatarValor(v, casas), v >= 0, escala(v), s.id));
      });
    }

    return (
      <g
        key={ids[i] || i}
        ref={(el) => {
          alvos.current[i] = el;
        }}
        role={onSelecionar ? "button" : "img"}
        aria-label={leitura(i)}
        aria-pressed={onSelecionar ? sel : undefined}
        tabIndex={i === cursorEfetivo ? 0 : -1}
        data-id={ids[i]}
        className={`outline-none focus:outline-none ${onSelecionar ? "cursor-pointer" : "cursor-default"}`}
        onKeyDown={(e) => teclado(e, i)}
        onFocus={(e) => {
          setCursor(i);
          setAtivo(i);
          let visivel = true;
          try {
            visivel = e.currentTarget.matches(":focus-visible");
          } catch {
            /* navegador sem :focus-visible: mostra o anel */
          }
          setFocoVisivel(visivel ? i : null);
        }}
        onBlur={() => {
          setFocoVisivel(null);
          setAtivo((a) => (a === i ? null : a));
        }}
        onPointerEnter={() => setAtivo(i)}
        onPointerDown={() => {
          setAtivo(i);
          setAnuncio(leitura(i));
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" && ativo !== i) {
            setAtivo(i);
            setAnuncio(leitura(i));
          }
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setAtivo((a) => (a === i ? null : a));
        }}
        onClick={() => selecionar(i)}
      >
        {/* alvo de ponteiro e toque: a faixa inteira da categoria, maior que a barra */}
        <rect x={r1(b.x)} y={r1(b.y)} width={r1(b.w)} height={r1(b.h)} fill="transparent" />
        {marcas}
        {textos}
        {vertical
          ? i % passoRotulo === 0 &&
            (() => {
              const texto = cabe(nomes[i], b.w * passoRotulo - 4, pxc);
              const centro = b.x + b.w / 2;
              const meia = (texto.length * pxc) / 2;
              // o último rótulo (por exemplo "set/2026") não passa da borda do gráfico: ancora na borda quando o centro não deixa espaço
              const ancora = centro + meia > w - 2 ? "end" : centro - meia < 2 ? "start" : "middle";
              return (
                <text
                  x={r1(ancora === "end" ? w - 2 : ancora === "start" ? 2 : centro)}
                  y={h - 12}
                  textAnchor={ancora}
                  fontSize={FS}
                  fontWeight={sel ? 600 : 400}
                  fill={sel ? "var(--cor-carvao)" : "var(--cor-carvao-muted)"}
                >
                  {texto}
                </text>
              );
            })()
          : (() => {
              const linhas = rotuloEmCima ? [cabe(nomes[i], w - 8, pxCaractere12(nomes[i]))] : duasLinhas(nomes[i], colunaRotulo - 8, pxCaractere12(nomes[i]));
              return (
              <text
                x="4"
                y={r1(rotuloEmCima ? b.y + 12 : b.y + hc / 2 + 4 - (linhas.length - 1) * 7)}
                fontSize="12"
                fontWeight={sel ? 600 : 400}
                fill={sel ? "var(--cor-carvao)" : "var(--cor-carvao-muted)"}
                // acima da barra o texto atravessa a grade e a linha de referência: um halo na cor do fundo mantém o nome legível
                stroke={rotuloEmCima ? (sel ? "var(--cor-energia-fundo)" : "var(--cor-superficie)") : undefined}
                strokeWidth={rotuloEmCima ? 3 : undefined}
                paintOrder={rotuloEmCima ? "stroke" : undefined}
                data-rotulo-categoria="true"
              >
                {linhas.length > 1
                  ? linhas.map((l, q) => (
                      <tspan key={q} x="4" dy={q ? 14 : 0}>
                        {l}
                      </tspan>
                    ))
                  : linhas[0]}
              </text>
              );
            })()}
        {focoVisivel === i && (
          <rect x={r1(b.x + 1)} y={r1(b.y + 1)} width={r1(Math.max(0, b.w - 2))} height={r1(Math.max(0, b.h - 2))} fill="none" stroke="var(--cor-energia)" strokeWidth="2" rx="2" />
        )}
      </g>
    );
  });

  /** Rótulo de valor na ponta da barra; omitido quando não cabe (a dica e a tabela o carregam). */
  function rotuloPonta(i: number, j: number, texto: string, positivo: boolean, ponta: number, chave: string, suave = false) {
    const { pos, esp } = barra(i, j);
    const tw = texto.length * pxc;
    if (vertical) {
      const disponivel = k === 1 ? banda(i).w - 4 : esp + 4;
      if (tw > disponivel) return null;
      const cx = pos + esp / 2;
      const yv = positivo ? ponta - 5 : ponta + 13;
      ocupados.push({ x0: cx - tw / 2, x1: cx + tw / 2, y0: yv - FS, y1: yv + 3 });
      return (
        <text key={`v-${chave}`} x={r1(cx)} y={r1(yv)} textAnchor="middle" fontSize={FS} fill="var(--cor-carvao)" className="tabular-nums">
          {texto}
        </text>
      );
    }
    const x = positivo ? ponta + 4 : ponta - 4;
    if (positivo ? x + tw > w - 2 : x - tw < colunaRotulo + 4) return null;
    const yv = pos + esp / 2 + 4;
    ocupados.push({ x0: positivo ? x : x - tw, x1: positivo ? x + tw : x, y0: yv - FS, y1: yv + 3 });
    return (
      <text
        key={`v-${chave}`}
        x={r1(x)}
        y={r1(pos + esp / 2 + 4)}
        textAnchor={positivo ? "start" : "end"}
        fontSize={FS}
        fill={suave ? "var(--cor-carvao-muted)" : "var(--cor-carvao)"}
        className="tabular-nums"
      >
        {texto}
      </text>
    );
  }

  // ---------- grade, base e referências ----------
  // marcas do eixo de valores: só as que cabem sem encostar na vizinha (a 390 px "25.000", "50.000" e "75.000" saíam coladas)
  const ticksEixo = vertical
    ? ticksQueCabem(dom.ticks, escala, () => 12, 6)
    : ticksQueCabem(dom.ticks, escala, (t) => rotuloTick(t, dom.passo).length * pxc, 10);
  const grade = ticksEixo.map((t) =>
    t === 0 ? null : vertical ? (
      <line key={t} x1={plot.x0} x2={plot.x1} y1={r1(escala(t))} y2={r1(escala(t))} stroke="var(--cor-grade)" strokeWidth="1" />
    ) : (
      <line key={t} x1={r1(escala(t))} x2={r1(escala(t))} y1={0} y2={h} stroke="var(--cor-grade)" strokeWidth="1" />
    ),
  );
  /**
   * Caminho de uma linha reta (a base ou uma referência) em `p`: horizontal nas colunas, vertical nas barras horizontais. Ela passa ao largo dos
   * textos: no celular, da faixa do rótulo de cada categoria (a linha cortava a primeira letra e riscava o nome), e sempre, dos rótulos de valor
   * que cruzaria. A grade fica por baixo dos textos e dispensa o corte.
   */
  const traco = (p: number): string => {
    const [ini, fim] = vertical ? [plot.x0, plot.x1] : [0, h];
    const cortes: [number, number][] = [];
    if (!vertical && rotuloEmCima) for (let i = 0; i < n; i++) cortes.push([i * hc, i * hc + ALTURA_ROTULO]);
    for (const o of ocupados) {
      if (vertical ? p >= o.y0 - 2 && p <= o.y1 + 2 : p >= o.x0 - 3 && p <= o.x1 + 3) cortes.push(vertical ? [o.x0 - 2, o.x1 + 2] : [o.y0 - 1, o.y1 + 1]);
    }
    cortes.sort((a, b) => a[0] - b[0]);
    const seg = (a: number, b: number) => (vertical ? `M${r1(a)},${p}H${r1(b)}` : `M${p},${r1(a)}V${r1(b)}`);
    let d = "";
    let cursor = ini;
    for (const [a, b] of cortes) {
      if (a > cursor) d += seg(cursor, a);
      cursor = Math.max(cursor, b);
    }
    if (cursor < fim) d += seg(cursor, fim);
    return d;
  };
  const base = <path d={traco(r1(zero))} fill="none" stroke="var(--cor-carvao-muted)" strokeWidth="1" />;
  const linhasRef = referencias.map((r, k) => {
    const p = r1(escala(r.valor));
    const texto = `${r.rotulo}: ${formatarValor(r.valor, casas, unidade)}`;
    return (
      <g key={`${k}-${r.rotulo}`} pointerEvents="none" data-referencia={r.rotulo}>
        {vertical ? (
          <>
            <path d={traco(p)} fill="none" stroke="var(--cor-carvao-muted)" strokeWidth="1.5" strokeDasharray="5 4" />
            {texto.length * pxc < plot.x1 - plot.x0 && (
              <text
                x={plot.x1}
                y={p - 5 < plot.y0 + 8 ? p + 14 : p - 5}
                textAnchor="end"
                fontSize={FS}
                fill="var(--cor-carvao-muted)"
                stroke="var(--cor-superficie)"
                strokeWidth="3"
                paintOrder="stroke"
              >
                {texto}
              </text>
            )}
          </>
        ) : (
          <path d={traco(p)} fill="none" stroke="var(--cor-carvao-muted)" strokeWidth="1.5" strokeDasharray="5 4" />
        )}
      </g>
    );
  });

  // ---------- dica ----------
  // sem w-max: a largura da dica se ajusta ao espaço entre left e a borda do gráfico, então ela nunca cria rolagem horizontal na página
  const dica =
    ativo !== null && ativo < n ? (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-20 min-w-[11rem] max-w-[16rem] border border-linha bg-superficie px-3 py-2 text-xs shadow-[0_6px_20px_rgba(26,29,33,0.12)]"
        style={
          vertical
            ? { top: 8, left: `min(max(0px, calc(${((banda(ativo).x + banda(ativo).w / 2) / w) * 100}% - 5.5rem)), calc(100% - 12rem))` }
            : (() => {
                const est = 30 + (series.length + (pilhas && series.length > 1 ? 1 : 0)) * 18;
                const y0 = banda(ativo).y;
                const acima = y0 + hc + est > h && y0 - est >= 0;
                return { top: acima ? y0 : y0 + hc, transform: acima ? "translateY(-100%)" : undefined, left: `min(${colunaRotulo}px, calc(100% - 12rem))` };
              })()
        }
      >
        <p className="font-medium text-carvao">{nomes[ativo]}</p>
        <ul className="mt-1 space-y-0.5">
          {series
            .filter((s) => !naoSeAplica(valor(ativo, s), s))
            .map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-carvao-muted">
                <span aria-hidden="true" className="inline-block h-0.5 w-3" style={{ background: s.cor }} />
                {s.rotulo}
              </span>
              <span className={`tabular-nums ${valor(ativo, s) === null ? "italic text-carvao-muted" : "font-medium text-carvao"}`}>
                {formatarValor(valor(ativo, s), casas, unidade)}
              </span>
            </li>
            ))}
          {pilhas && series.length > 1 && (
            <li className="flex justify-between gap-3 border-t border-linha pt-0.5">
              <span className="text-carvao-muted">Total</span>
              <span className="font-medium tabular-nums text-carvao">
                {pilhas[ativo].completo ? formatarValor(pilhas[ativo].total, casas, unidade) : "incompleto"}
              </span>
            </li>
          )}
          {referencias.map((r, k) => {
            const tot = pilhas ? (pilhas[ativo].completo ? pilhas[ativo].total : null) : series.length === 1 ? valor(ativo, series[0]) : null;
            return tot === null ? null : (
              <li key={`${k}-${r.rotulo}`} className="flex justify-between gap-3 text-carvao-muted">
                <span>Diferença ({r.rotulo})</span>
                <span className="tabular-nums">{formatarDiferenca(tot - r.valor, casas, unidade === "%" ? "p.p." : unidade)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    ) : null;

  // ---------- montagem ----------
  const instrucoes = `${nTotal} ${nTotal === 1 ? "categoria" : "categorias"}${corta ? `, as primeiras ${n} desenhadas` : ""}${empilhado ? ", barras empilhadas" : ""}. Use Tab para entrar no gráfico, as setas para percorrer as categorias, Home e End para ir ao início e ao fim${onSelecionar ? " e Enter ou Espaço para selecionar" : ""}. A tabela com os mesmos dados está logo abaixo.`;

  const svgBarras = (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="group"
      aria-labelledby={`${uid}-t`}
      aria-describedby={`${uid}-i`}
      className="block overflow-visible"
    >
      <title id={`${uid}-t`}>{titulo}</title>
      {vertical &&
        ticksEixo.map((t) => (
          <text key={t} x={plot.x0 - 8} y={r1(escala(t) + 4)} textAnchor="end" fontSize={FS} fill="var(--cor-mineral)" className="tabular-nums" aria-hidden="true">
            {rotuloTick(t, dom.passo)}
          </text>
        ))}
      {/* fundo das categorias selecionada e ativa, sob a grade para não escondê-la */}
      <g aria-hidden="true">
        {dados.map((_, i) => {
          if (i !== iSel && i !== ativo) return null;
          const b = banda(i);
          return i === iSel ? (
            <rect key={i} data-selecionada={ids[i]} x={r1(b.x)} y={r1(b.y)} width={r1(b.w)} height={r1(b.h)} fill="var(--cor-energia-fundo)" />
          ) : (
            <rect key={i} x={r1(b.x)} y={r1(b.y)} width={r1(b.w)} height={r1(b.h)} fill="var(--cor-grade)" opacity="0.55" />
          );
        })}
      </g>
      <g aria-hidden="true">{grade}</g>
      {categorias}
      <g aria-hidden="true">
        {base}
        {linhasRef}
      </g>
    </svg>
  );

  return (
    <div ref={raiz} className="relative w-full" data-grafico="barras" data-orientacao={vertical ? "vertical" : "horizontal"} data-rotulos={vertical ? undefined : rotuloEmCima ? "acima" : "lateral"} data-parcial={corta ? "sim" : undefined}>
      <p className="mb-1 text-sm font-medium text-carvao" data-titulo-grafico="true">
        {titulo}
        {unidade.length > 1 && <span className="font-normal text-mineral">, em {unidade}</span>}
      </p>
      {/* hachura de ausência definida uma vez e usada pelo gráfico e pela legenda */}
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <defs>
          <pattern id={`${uid}-hachura`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" fill="var(--cor-superficie)" />
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--cor-mineral)" strokeWidth="1.5" />
          </pattern>
        </defs>
      </svg>
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 px-1 text-xs text-carvao-muted" aria-label="Legenda">
        {(series.length > 1 || empilhado) &&
          series.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: s.cor }} />
              {s.rotulo}
            </li>
          ))}
        {referencias.map((r, k) => (
          <li key={`${k}-${r.rotulo}`} className="flex items-center gap-1.5">
            <svg width="18" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="18" y2="4" stroke="var(--cor-carvao-muted)" strokeWidth="1.5" strokeDasharray="5 4" />
            </svg>
            {r.rotulo}: {formatarValor(r.valor, casas, unidade)}
          </li>
        ))}
        {semDado && (
          <li className="flex items-center gap-1.5" data-legenda="sem-dado">
            <svg width="12" height="12" aria-hidden="true">
              <rect x="0.5" y="0.5" width="11" height="11" fill={`url(#${uid}-hachura)`} stroke="var(--cor-mineral)" strokeDasharray="2 2" />
            </svg>
            sem dado (ausência, não zero)
          </li>
        )}
        <li className="text-mineral">Valores em {unidade}</li>
      </ul>
      <p id={`${uid}-i`} className="sr-only">
        {instrucoes}
      </p>
      {vertical ? (
        <div className="relative">
          {svgBarras}
          {dica}
        </div>
      ) : (
        <>
          {/* eixo de valores fora da área rolável: continua visível com muitas categorias */}
          <svg width="100%" height="22" viewBox={`0 0 ${w} 22`} aria-hidden="true" className="block overflow-visible">
            {ticksEixo.map((t) => {
              const x = escala(t);
              const rotulo = rotuloTick(t, dom.passo);
              const meia = (rotulo.length * pxc) / 2;
              // o rótulo não passa da borda do gráfico: ancora na ponta quando o centro da marca não deixa espaço
              return (
                <text key={t} x={r1(x)} y="14" textAnchor={x - meia < 0 ? "start" : x + meia > w ? "end" : "middle"} fontSize={FS} fill="var(--cor-mineral)" className="tabular-nums">
                  {rotulo}
                </text>
              );
            })}
            {referencias.map((r, k) => (
              <line key={`${k}-${r.rotulo}`} x1={r1(escala(r.valor))} x2={r1(escala(r.valor))} y1="17" y2="22" stroke="var(--cor-carvao-muted)" strokeWidth="1.5" />
            ))}
          </svg>
          <div ref={caixa} className="overflow-y-auto overflow-x-hidden" style={todas ? undefined : { maxHeight: limiteEfetivo }} data-rolagem={h > limiteEfetivo && !todas ? "sim" : "nao"}>
            <div className="relative">
              {svgBarras}
              {dica}
            </div>
          </div>
          {(h > limiteEfetivo || comLimite) && (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-mineral" data-aviso-rolagem="true">
              <span>
                {selecaoForaDoLimite && !todas
                  ? `Todas as ${nTotal.toLocaleString("pt-BR")} categorias, porque a escolhida está depois das primeiras ${(limiteInicial ?? 0).toLocaleString("pt-BR")}.`
                  : todas
                    ? `Todas as ${nTotal.toLocaleString("pt-BR")} categorias.`
                    : corta
                      ? `O gráfico mostra as ${n.toLocaleString("pt-BR")} primeiras das ${nTotal.toLocaleString("pt-BR")} categorias, na ordem escolhida.`
                      : `O gráfico mostra só parte das ${nTotal.toLocaleString("pt-BR")} categorias, na ordem escolhida.`}
              </span>
              {!(selecaoForaDoLimite && !todas) && (
                <button
                  type="button"
                  aria-expanded={todas}
                  onClick={() => setTodas((t) => !t)}
                  className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao"
                >
                  {todas ? "Mostrar só o início" : `Mostrar todas as ${nTotal.toLocaleString("pt-BR")}`}
                </button>
              )}
            </p>
          )}
        </>
      )}
      {/* leitura para leitor de tela do que o ponteiro ou o toque ativou e da seleção; o foco já lê o rótulo da barra */}
      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>
      <details className="mt-3 text-xs">
        <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
          Dados do gráfico em tabela ({nTotal.toLocaleString("pt-BR")} {nTotal === 1 ? "linha" : "linhas"})
        </summary>
        <div className="tabela-scroll mt-2 max-h-80 overflow-y-auto" tabIndex={0} role="region" aria-label={`${titulo}: dados em tabela (rolável)`}>
          <table className="w-full border-collapse tabular-nums">
            <caption className="sr-only">{`${titulo}, em ${unidade}`}</caption>
            <thead className="sticky top-0 bg-superficie">
              <tr className="text-left text-mineral">
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">
                  Categoria
                </th>
                {series.map((s) => (
                  <th key={s.id} scope="col" className="border-b border-linha px-2 py-1.5 text-right font-medium">
                    {s.rotulo} ({unidade})
                  </th>
                ))}
                {pilhasTodas && series.length > 1 && (
                  <th scope="col" className="border-b border-linha px-2 py-1.5 text-right font-medium">
                    Total ({unidade})
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {dadosTodos.map((linha, i) => {
                const sel = i === iSelTodos;
                const ausente = sel ? "italic text-carvao-muted" : "italic text-mineral";
                return (
                  <tr key={idsTodos[i] || i} className={`border-b border-linha ${sel ? "bg-energia-fundo" : ""}`} data-id={idsTodos[i]}>
                    <th scope="row" className={`px-2 py-1 text-left text-carvao ${sel ? "font-semibold" : "font-normal"}`}>
                      {nomesTodos[i]}
                      {sel && <span className="sr-only"> (selecionada)</span>}
                    </th>
                    {series.map((s) => {
                      const v = valorDe(linha, s);
                      return (
                        <td key={s.id} className={`px-2 py-1 text-right ${v === null ? ausente : "text-carvao"}`}>
                          {naoSeAplica(v, s) ? "não se aplica" : formatarValor(v, casas)}
                        </td>
                      );
                    })}
                    {pilhasTodas && series.length > 1 && (
                      <td className={`px-2 py-1 text-right ${pilhasTodas[i].completo ? "text-carvao" : ausente}`}>
                        {pilhasTodas[i].completo ? formatarValor(pilhasTodas[i].total, casas) : "incompleto"}
                      </td>
                    )}
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
