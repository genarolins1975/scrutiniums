/**
 * Imagem do gráfico (PNG) com o contexto junto: título, unidade, legenda, o desenho, a fonte, a versão dos dados, o endereço da página e
 * a data em que a imagem foi gerada, tudo desenhado no próprio arquivo, para o gráfico poder ir a um slide ou a uma matéria sem perder
 * de onde veio.
 *
 * Lógica pura (sem React e sem DOM, testável em node). O componente `BaixarImagem` lê o gráfico do DOM, entrega a `montarSvgImagem` os
 * trechos de svg, os textos e as medidas, e rasteriza o svg montado num canvas. Aqui ficam as regras que não dependem do navegador:
 *
 * - nome do arquivo a partir do título (sem acento, minúsculas, hífens, até 80 caracteres);
 * - quebra de texto em linhas por largura (medida real do canvas quando existe, estimada quando não);
 * - troca de `var(--token)` pelos valores já calculados da página (um svg usado como imagem não enxerga o CSS da página: sem a troca,
 *   o preenchimento inválido vira preto, e a hachura de "sem dado" sairia como mancha preta);
 * - escape de XML e montagem do svg final: moldura clara, título em negrito, unidade, legenda com amostras, o(s) svg(s) do gráfico
 *   aninhados com viewBox, notas do estado atual do gráfico e o rodapé.
 *
 * Só fonte do sistema (nenhuma fonte externa, nenhuma imagem externa, nenhuma rede) e nenhuma cor de aprovação ou de julgamento: a
 * moldura usa só os tokens de superfície, texto e linha da página.
 */

/** Pilha de fontes do sistema da imagem. Um svg usado como imagem não carrega as fontes da página. */
export const FONTE_SISTEMA = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Liberation Sans', sans-serif";

/** Identificação impressa no rodapé de toda imagem. */
export const IDENTIFICACAO = "Scrutiniums, Observatório Brasileiro do Setor Elétrico";

/** Largura do svg final: de 720 a 800 px. Com o canvas em 2x, o PNG sai com 1440 a 1600 px (dentro de 720 a 1600 px lido como svg ou como arquivo). */
export const LARGURA_MINIMA = 720;
export const LARGURA_MAXIMA = 800;
/** Escala do canvas (2x: nítida em slide e em tela de alta densidade). */
export const ESCALA_CANVAS = 2;
/** Limite de pixels de um canvas que todo navegador aceita (o do Safari no iPhone é de 16.777.216). */
const LIMITE_PIXELS = 16_000_000;
const LIMITE_LADO = 16_000;

/** Tokens que a moldura usa; o componente os lê da página e o montador os troca por valores. */
export const VARIAVEIS_DA_MOLDURA = ["--cor-superficie", "--cor-carvao", "--cor-carvao-muted", "--cor-mineral", "--cor-linha"] as const;

/** Valores de reserva da moldura, só para quando a página não entrega o token (cores nomeadas do CSS, nunca hexadecimal). */
const MOLDURA_PADRAO: Record<string, string> = {
  "--cor-superficie": "white",
  "--cor-carvao": "black",
  "--cor-carvao-muted": "dimgray",
  "--cor-mineral": "gray",
  "--cor-linha": "lightgray",
};

export type Medidor = (texto: string, tamanho: number, negrito: boolean) => number;

/* ---------- nome do arquivo ---------- */

const MAX_NOME = 80;

/** Nome do arquivo: o título sem acento, em minúsculas, com hífens entre as palavras, no máximo 80 caracteres com o ".png". */
export function nomeArquivoImagem(titulo: string): string {
  const base = (titulo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const corte = base.slice(0, MAX_NOME - ".png".length).replace(/-+$/g, "");
  return `${corte || "grafico"}.png`;
}

/* ---------- data ---------- */

/** Data do clique em dd/mm/aaaa, no fuso de quem clica. */
export function dataDoClique(d: Date): string {
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/* ---------- medida e quebra de texto ---------- */

/** Larguras (milésimos de em) de uma fonte sem serifa comum (Helvetica e Arial), por grupo de caracteres. */
const GRUPOS_LARGURA: [string, number][] = [
  ["ijl‘’", 222],
  [" !,./:;Ift[]·|\\", 278],
  ["()-r`{}“”", 333],
  ['"', 355],
  ["'", 191],
  ["*", 389],
  ["cksvxyzJ", 500],
  ["0123456789abdeghnopqu_?#$L–", 556],
  ["+<=>~−^", 584],
  ["FTZ", 611],
  ["ABEKPSVXY&", 667],
  ["CDHNRUw", 722],
  ["GOQ", 778],
  ["Mm", 833],
  ["%", 889],
  ["W", 944],
  ["@…—", 1000],
];
const LARGURA_EM: Record<string, number> = {};
for (const [chars, w] of GRUPOS_LARGURA) for (const c of Array.from(chars)) if (!(c in LARGURA_EM)) LARGURA_EM[c] = w;

/**
 * Largura estimada de um texto, em px, para quando não há canvas (testes, servidor). Segue as larguras de uma fonte sem serifa comum, com
 * folga de 6% para as fontes de sistema mais largas, e 8% a mais no negrito. No navegador, o componente passa a medida real do canvas.
 */
export function larguraTexto(texto: string, tamanho: number, negrito = false): number {
  let soma = 0;
  for (const c of Array.from(texto.normalize("NFC"))) {
    const base = LARGURA_EM[c] ?? LARGURA_EM[c.normalize("NFD").charAt(0)] ?? 556;
    soma += base;
  }
  return (soma / 1000) * tamanho * (negrito ? 1.08 : 1) * 1.06;
}

const SEPARADORES = "/?&=#-_.,;:)";

/** Maior prefixo da palavra que cabe na largura, de preferência cortado depois de um separador (endereço) e nunca vazio. */
function pontoDeCorte(palavra: string, larguraMax: number, mede: (t: string) => number): number {
  let n = 1;
  while (n < palavra.length && mede(palavra.slice(0, n + 1)) <= larguraMax) n++;
  for (let k = n; k > n * 0.5; k--) if (SEPARADORES.includes(palavra.charAt(k - 1))) return k;
  return n;
}

export type OpcoesQuebra = { negrito?: boolean; maxLinhas?: number; medir?: Medidor };

/**
 * Quebra o texto em linhas que cabem em `larguraMax` (px) no tamanho dado: por palavra; a palavra que sozinha não cabe (um endereço)
 * é cortada, de preferência depois de "/", "?", "&" ou "-". Com `maxLinhas`, o que passar da última linha vira reticências.
 */
export function quebrarTexto(texto: string, larguraMax: number, tamanho: number, opcoes: OpcoesQuebra = {}): string[] {
  const negrito = !!opcoes.negrito;
  const medir = opcoes.medir ?? larguraTexto;
  const mede = (t: string) => medir(t, tamanho, negrito);
  const palavras = (texto || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!palavras.length) return [];
  if (!(larguraMax > 0)) return [palavras.join(" ")];
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of palavras) {
    const junta = atual ? `${atual} ${palavra}` : palavra;
    if (mede(junta) <= larguraMax) {
      atual = junta;
      continue;
    }
    if (atual) linhas.push(atual);
    let resto = palavra;
    while (resto.length > 1 && mede(resto) > larguraMax) {
      const corte = pontoDeCorte(resto, larguraMax, mede);
      linhas.push(resto.slice(0, corte));
      resto = resto.slice(corte);
    }
    atual = resto;
  }
  if (atual) linhas.push(atual);
  const max = opcoes.maxLinhas;
  if (max && linhas.length > max) {
    let ultima = linhas.slice(max - 1).join(" ");
    while (ultima.length > 1 && mede(`${ultima}…`) > larguraMax) ultima = ultima.slice(0, -1).trimEnd();
    return [...linhas.slice(0, max - 1), `${ultima}…`];
  }
  return linhas;
}

/* ---------- variáveis CSS e XML ---------- */

const PADRAO_VAR = /var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*))?\)/g;

/** Nomes (sem repetição, na ordem em que aparecem) dos `var(--token)` de um texto, inclusive os que estão na reserva de outro `var()`. */
export function variaveisUsadas(texto: string): string[] {
  const nomes: string[] = [];
  const varre = (t: string) => {
    for (const m of Array.from(t.matchAll(PADRAO_VAR))) {
      if (!nomes.includes(m[1])) nomes.push(m[1]);
      if (m[2]) varre(m[2]);
    }
  };
  varre(texto);
  return nomes;
}

/**
 * Troca cada `var(--token)` pelo valor do mapa. Token ausente usa o valor de reserva do próprio `var(--token, reserva)` e, sem ele,
 * `currentColor`: nenhum `var(` sobra no resultado, porque um svg usado como imagem não resolve variável e o preenchimento inválido sai
 * preto. O valor do mapa pode ter outro `var()` (resolvido na volta seguinte).
 */
export function resolverVariaveis(texto: string, mapa: Record<string, string>): string {
  let saida = texto;
  for (let volta = 0; volta < 6 && saida.includes("var("); volta++) {
    saida = saida.replace(PADRAO_VAR, (_inteiro, nome: string, reserva?: string) => {
      const v = mapa[nome]?.trim();
      if (v) return v;
      return reserva?.trim() ? reserva.trim() : "currentColor";
    });
  }
  return saida.replace(/var\([^)]*\)/g, "currentColor");
}

/** Escapa texto para XML e tira os caracteres de controle que o XML 1.0 não aceita (um deles basta para o navegador recusar o svg). */
export function escaparXml(texto: string): string {
  let limpo = "";
  for (const c of Array.from(texto)) {
    const k = c.codePointAt(0) ?? 0;
    if (k === 9 || k === 10 || k === 13 || (k >= 32 && k !== 0xfffe && k !== 0xffff)) limpo += c;
  }
  return limpo.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/* ---------- fonte e versão do painel ---------- */

/**
 * Separa, do parágrafo "Fonte: ..." do rodapé de um painel, o texto da fonte e a versão dos dados. A versão vem de "Versão dos dados: X"
 * quando o parágrafo a traz (rodapé das tabelas) e, nos painéis, das datas de "(referência até X)". O texto da fonte é o do próprio
 * painel; nada é inventado: sem parágrafo, os dois voltam nulos.
 */
export function extrairFonteEVersao(paragrafo: string | null | undefined): { fonte: string | null; versao: string | null } {
  const limpo = (paragrafo || "").replace(/\s+/g, " ").trim();
  if (!limpo) return { fonte: null, versao: null };
  const m = limpo.match(/Vers[ãa]o dos dados:\s*(.+?)\.(?=\s|$)/i);
  let corpo = limpo;
  let versao: string | null = null;
  if (m && m.index !== undefined) {
    versao = m[1].trim();
    corpo = limpo.slice(0, m.index).trim();
  } else {
    const datas: string[] = [];
    for (const r of Array.from(limpo.matchAll(/referência até ([0-9/]+(?: [0-9:]+)?)/gi))) if (!datas.includes(r[1])) datas.push(r[1]);
    // "A", "A e B", "A, B e C"
    const lista = datas.length < 2 ? datas.join("") : `${datas.slice(0, -1).join(", ")} e ${datas[datas.length - 1]}`;
    if (datas.length) versao = `referência até ${lista}`;
  }
  if (!corpo) return { fonte: null, versao };
  const fonte = /^Fontes?:/i.test(corpo) ? corpo : `Fonte: ${corpo}`;
  return { fonte, versao };
}

/** Endereço da página com o recorte da URL e a âncora do painel, como o "Copiar link deste painel" faz. */
export function enderecoDaPagina(local: { origin: string; pathname: string; search: string }, ancora?: string | null): string {
  return `${local.origin}${local.pathname}${local.search}${ancora ? `#${ancora}` : ""}`;
}

/* ---------- escala do canvas ---------- */

/** Escala do canvas: 2x, menor quando a imagem é tão grande que passaria do limite de pixels dos navegadores. */
export function escalaDoCanvas(largura: number, altura: number, preferida = ESCALA_CANVAS): number {
  const area = Math.max(1, largura * altura);
  const porArea = Math.sqrt(LIMITE_PIXELS / area);
  const porLado = LIMITE_LADO / Math.max(1, largura, altura);
  return Math.max(0.5, Math.min(preferida, porArea, porLado));
}

/* ---------- montagem do svg ---------- */

/** Amostra da legenda: um trecho de svg desenhado no retângulo `largura` por `altura` (px). */
export type AmostraImagem = { largura: number; altura: number; interno: string };
export type ItemLegendaImagem = { texto: string; amostra?: AmostraImagem | null };

/** Elementos do desenho do gráfico, em px do layout da página, com a origem no canto da área do gráfico. */
export type ElementoImagem =
  | { tipo: "svg"; x: number; y: number; largura: number; altura: number; viewBox?: string; interno: string }
  | { tipo: "texto"; x: number; y: number; texto: string; tamanho: number; peso?: number; cor?: string; ancora?: "start" | "middle" | "end"; larguraMax?: number; maxLinhas?: number }
  | { tipo: "linha"; x1: number; y1: number; x2: number; y2: number; traco?: string };

export type EntradaImagem = {
  titulo: string;
  unidade?: string | null;
  legenda?: ItemLegendaImagem[];
  /** Área do gráfico: tamanho que ela tem na página e os elementos dentro dela. */
  grafico: { largura: number; altura: number; elementos: ElementoImagem[] };
  /** Definições (padrões de hachura) que os svgs do gráfico e as amostras da legenda usam, já serializadas. */
  definicoes?: string;
  /** Notas sobre o estado do gráfico no momento do clique (recorte parcial, intervalo, escala). */
  notas?: string[];
  fonte?: string | null;
  versao?: string | null;
  endereco: string;
  /** dd/mm/aaaa */
  geradoEm: string;
};

export type OpcoesMontagem = {
  /** Valores já calculados dos tokens da página (`--cor-carvao` e demais). */
  tokens?: Record<string, string>;
  medir?: Medidor;
};

export type ImagemMontada = { svg: string; largura: number; altura: number };

type Fonte = { tam: number; ent: number };
type Tipografia = { pad: number; titulo: Fonte; unidade: Fonte; legenda: Fonte; nota: Fonte; rodape: Fonte };

/** Moldura para gráfico largo (desktop): textos maiores, porque a imagem final é reduzida até 800 px. */
const TIPO_LARGO: Tipografia = {
  pad: 28,
  titulo: { tam: 26, ent: 32 },
  unidade: { tam: 16, ent: 23 },
  legenda: { tam: 14.5, ent: 21 },
  nota: { tam: 13.5, ent: 19 },
  rodape: { tam: 13, ent: 19 },
};
/** Moldura para gráfico estreito (celular): textos de 12 px como os da própria página, que a imagem final amplia até 720 px. */
const TIPO_ESTREITO: Tipografia = {
  pad: 16,
  titulo: { tam: 19, ent: 25 },
  unidade: { tam: 13, ent: 19 },
  legenda: { tam: 12, ent: 17 },
  nota: { tam: 12, ent: 17 },
  rodape: { tam: 12, ent: 17 },
};
const AMPLIACAO_MAXIMA = 2;

const r2 = (n: number) => Math.round(n * 100) / 100;
const limitar = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/**
 * Monta o svg da imagem. O desenho todo (moldura, textos e gráfico) é composto na largura do gráfico na página, com a tipografia da
 * moldura própria para gráfico largo ou estreito, e o `viewBox` o ajusta à largura final: de 720 a 800 px, o que dá, com o canvas em 2x,
 * um PNG de 1440 a 1600 px (dentro de 720 a 1600 px também lido como largura do svg). Gráfico de celular é ampliado (até o dobro) e o de
 * desktop é reduzido, sempre com texto e desenho na mesma proporção. Nenhum `var(` sobra no resultado.
 */
export function montarSvgImagem(entrada: EntradaImagem, opcoes: OpcoesMontagem = {}): ImagemMontada {
  const medir = opcoes.medir ?? larguraTexto;
  const g = entrada.grafico;
  const gl = Math.max(1, g.largura);
  const ga = Math.max(1, g.altura);
  const T = gl + 2 * TIPO_LARGO.pad < LARGURA_MINIMA ? TIPO_ESTREITO : TIPO_LARGO;
  const PAD = T.pad;
  // largura do desenho (px do layout da página) e largura final do svg; z é a razão entre as duas
  const Wd = Math.max(gl + 2 * PAD, LARGURA_MINIMA / AMPLIACAO_MAXIMA);
  const W = Math.round(limitar(Wd, LARGURA_MINIMA, LARGURA_MAXIMA));
  const z = W / Wd;
  const util = Wd - 2 * PAD;
  const quebra = (t: string, tam: number, larg: number, negrito = false, maxLinhas?: number) => quebrarTexto(t, larg, tam, { negrito, maxLinhas, medir });

  const partes: string[] = [];
  const linhaDeTexto = (t: string, x: number, topo: number, f: Fonte, cor: string, o: { peso?: number; ancora?: string } = {}) =>
    `<text x="${r2(x)}" y="${r2(topo + f.ent / 2 + f.tam * 0.34)}" font-size="${f.tam}"${o.peso ? ` font-weight="${o.peso}"` : ""}${o.ancora ? ` text-anchor="${o.ancora}"` : ""} fill="${cor}">${escaparXml(t)}</text>`;
  const bloco = (linhas: string[], x: number, topo: number, f: Fonte, cor: string, o: { peso?: number; ancora?: string } = {}) =>
    linhas.map((l, i) => linhaDeTexto(l, x, topo + i * f.ent, f, cor, o)).join("");

  let y = PAD;

  // título e unidade
  const linhasTitulo = quebra(entrada.titulo, T.titulo.tam, util, true);
  partes.push(bloco(linhasTitulo, PAD, y, T.titulo, "var(--cor-carvao)", { peso: 700 }));
  y += linhasTitulo.length * T.titulo.ent;
  const unidade = (entrada.unidade || "").trim();
  if (unidade) {
    const linhasUnidade = quebra(`Valores em ${unidade}`, T.unidade.tam, util);
    y += 2;
    partes.push(bloco(linhasUnidade, PAD, y, T.unidade, "var(--cor-carvao-muted)"));
    y += linhasUnidade.length * T.unidade.ent;
  }
  y += 14;

  // legenda: amostra de cor ou de traço e o rótulo, em linhas que quebram pela largura
  const itens = (entrada.legenda || []).filter((i) => i.texto.trim() || i.amostra);
  if (itens.length) {
    const L = T.legenda;
    let x = PAD;
    let topoLinha = y;
    let alturaLinha = 0;
    for (const item of itens) {
      const am = item.amostra;
      const larguraAmostra = am ? am.largura : 0;
      const folga = am ? 8 : 0;
      const linhas = quebra(item.texto, L.tam, util - larguraAmostra - folga);
      const larguraTextoItem = Math.max(0, ...linhas.map((l) => medir(l, L.tam, false)));
      const larguraItem = larguraAmostra + folga + larguraTextoItem;
      if (x > PAD && x + larguraItem > PAD + util) {
        x = PAD;
        topoLinha += alturaLinha + 4;
        alturaLinha = 0;
      }
      if (am) {
        const topoAmostra = topoLinha + Math.max(0, (L.ent - am.altura) / 2);
        partes.push(`<svg x="${r2(x)}" y="${r2(topoAmostra)}" width="${r2(am.largura)}" height="${r2(am.altura)}" overflow="visible">${am.interno}</svg>`);
      }
      partes.push(bloco(linhas, x + larguraAmostra + folga, topoLinha, L, "var(--cor-carvao-muted)"));
      x += larguraItem + 22;
      alturaLinha = Math.max(alturaLinha, Math.max(1, linhas.length) * L.ent);
    }
    y = topoLinha + alturaLinha + 12;
  }

  // desenho do gráfico, em tamanho natural e centrado quando a moldura é mais larga que ele
  const x0 = PAD + (util - gl) / 2;
  const elementos = g.elementos.map((e) => {
    if (e.tipo === "svg") {
      const vb = e.viewBox && e.viewBox.trim() ? e.viewBox : `0 0 ${r2(e.largura)} ${r2(e.altura)}`;
      return `<svg x="${r2(e.x)}" y="${r2(e.y)}" width="${r2(e.largura)}" height="${r2(e.altura)}" viewBox="${escaparXml(vb)}" overflow="visible">${e.interno}</svg>`;
    }
    if (e.tipo === "linha") {
      return `<line x1="${r2(e.x1)}" y1="${r2(e.y1)}" x2="${r2(e.x2)}" y2="${r2(e.y2)}" stroke="${e.traco ?? "var(--cor-linha)"}" stroke-width="1" shape-rendering="crispEdges"/>`;
    }
    const f = { tam: e.tamanho, ent: Math.round(e.tamanho * 1.25) };
    const linhas = e.larguraMax ? quebra(e.texto, e.tamanho, e.larguraMax, (e.peso ?? 400) >= 600, e.maxLinhas) : [e.texto];
    return bloco(linhas, e.x, e.y, f, e.cor ?? "var(--cor-carvao)", { peso: e.peso, ancora: e.ancora });
  });
  partes.push(`<g transform="translate(${r2(x0)} ${r2(y)})">${elementos.join("")}</g>`);
  y += ga + 12;

  // notas do estado do gráfico no momento do clique
  const notas = (entrada.notas || []).map((n) => n.trim()).filter(Boolean);
  for (const nota of notas) {
    const linhas = quebra(nota, T.nota.tam, util);
    partes.push(bloco(linhas, PAD, y, T.nota, "var(--cor-carvao-muted)"));
    y += linhas.length * T.nota.ent + 4;
  }
  if (notas.length) y += 4;

  // rodapé: fonte, versão, endereço, data e identificação
  y += 4;
  partes.push(`<line x1="${PAD}" y1="${r2(y)}" x2="${r2(Wd - PAD)}" y2="${r2(y)}" stroke="var(--cor-linha)" stroke-width="1" shape-rendering="crispEdges"/>`);
  y += 12;
  const rodape = (texto: string) => {
    const linhas = quebra(texto, T.rodape.tam, util);
    partes.push(bloco(linhas, PAD, y, T.rodape, "var(--cor-carvao-muted)"));
    y += Math.max(1, linhas.length) * T.rodape.ent;
  };
  if (entrada.fonte) rodape(entrada.fonte);
  if (entrada.versao) rodape(`Versão dos dados: ${entrada.versao}`);
  rodape(`Endereço da página: ${entrada.endereco}`);
  y += 6;
  // identificação à esquerda e data à direita; se as duas não cabem lado a lado (celular), a data vai na linha de baixo
  const dataTexto = `Gerado em ${entrada.geradoEm}`;
  const linhasMarca = quebra(IDENTIFICACAO, T.rodape.tam, util, true);
  const lado = linhasMarca.length === 1 && medir(IDENTIFICACAO, T.rodape.tam, true) + medir(dataTexto, T.rodape.tam, false) + 16 <= util;
  partes.push(bloco(linhasMarca, PAD, y, T.rodape, "var(--cor-carvao)", { peso: 700 }));
  if (lado) {
    partes.push(linhaDeTexto(dataTexto, Wd - PAD, y, T.rodape, "var(--cor-carvao-muted)", { ancora: "end" }));
    y += T.rodape.ent;
  } else {
    y += linhasMarca.length * T.rodape.ent;
    partes.push(linhaDeTexto(dataTexto, PAD, y, T.rodape, "var(--cor-carvao-muted)"));
    y += T.rodape.ent;
  }

  // altura final em px inteiros; o viewBox cobre exatamente esse retângulo, na mesma razão z da largura
  const H = Math.ceil((y + PAD) * z);
  const Hd = H / z;
  const descricao = [entrada.fonte, entrada.versao ? `Versão dos dados: ${entrada.versao}` : null, `Endereço da página: ${entrada.endereco}`, dataTexto, IDENTIFICACAO]
    .filter(Boolean)
    .join(". ");
  const corpo = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${r2(Wd)} ${r2(Hd)}" font-family="${FONTE_SISTEMA}" color="var(--cor-carvao)">`,
    `<title>${escaparXml(entrada.titulo)}</title>`,
    `<desc>${escaparXml(descricao)}</desc>`,
    `<style>.tabular-nums{font-variant-numeric:tabular-nums}</style>`,
    entrada.definicoes ? `<defs>${entrada.definicoes}</defs>` : "",
    `<rect width="${r2(Wd)}" height="${r2(Hd)}" fill="var(--cor-superficie)"/>`,
    `<rect x="${r2(0.5 / z)}" y="${r2(0.5 / z)}" width="${r2(Wd - 1 / z)}" height="${r2(Hd - 1 / z)}" fill="none" stroke="var(--cor-linha)" stroke-width="${r2(1 / z)}"/>`,
    ...partes,
    `</svg>`,
  ].join("");

  const tokens = { ...MOLDURA_PADRAO, ...(opcoes.tokens || {}) };
  return { svg: resolverVariaveis(corpo, tokens), largura: W, altura: H };
}
