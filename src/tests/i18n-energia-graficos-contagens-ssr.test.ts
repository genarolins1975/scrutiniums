import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { describe, expect, it } from "vitest";
import { GraficoBarras, type GraficoBarrasProps } from "@/components/energia/GraficoBarras";
import { GraficoLinhas, type GraficoLinhasProps } from "@/components/energia/GraficoLinhas";
import { PequenosMultiplos, type PequenosMultiplosProps } from "@/components/energia/PequenosMultiplos";
import { Cronograma, type CronogramaProps } from "@/components/energia/Cronograma";
import { LinhaDoTempo, type LinhaDoTempoProps } from "@/components/energia/LinhaDoTempo";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import type { Idioma } from "@/lib/idioma";

type No = DefaultTreeAdapterMap["node"];
type Elemento = DefaultTreeAdapterMap["element"];
const atributo = (no: Elemento, nome: string) => no.attrs.find((a) => a.name === nome)?.value;
const filhos = (no: No): No[] => "childNodes" in no ? no.childNodes : [];
function elementos(no: No): Elemento[] {
  const resultado: Elemento[] = [];
  function visitar(atual: No) {
    if ("tagName" in atual) resultado.push(atual);
    filhos(atual).forEach(visitar);
  }
  visitar(no);
  return resultado;
}
const analisar = (html: string) => elementos(parseFragment(html));
function texto(no: No): string {
  return "value" in no ? no.value : filhos(no).map(texto).join("");
}
function unico(nos: Elemento[], predicado: (no: Elemento) => boolean): Elemento {
  const encontrados = nos.filter(predicado);
  expect(encontrados).toHaveLength(1);
  return encontrados[0];
}
const tag = (nos: Elemento[], nome: string) => unico(nos, (no) => no.tagName === nome);
const marcado = (nos: Elemento[], nome: string) => unico(nos, (no) => atributo(no, nome) !== undefined);
const linhasTabela = (nos: Elemento[]) => elementos(tag(nos, "tbody")).filter((no) => no.tagName === "tr");
const celulas = (linha: Elemento) => elementos(linha).filter((no) => no.tagName === "td").map(texto);
function congelar<T extends object>(valor: T): T {
  for (const filho of Object.values(valor)) if (filho !== null && typeof filho === "object") congelar(filho);
  return Object.freeze(valor);
}
function verificarReferencias(nos: Elemento[]) {
  for (const no of nos) {
    for (const nome of ["aria-labelledby", "aria-describedby"]) {
      const ids = atributo(no, nome);
      if (ids) for (const id of ids.split(" ")) unico(nos, (destino) => atributo(destino, "id") === id);
    }
  }
}
const estrutura = (nos: Elemento[]) => nos
  .filter((no) => ["svg", "path", "circle", "polygon", "line", "rect", "pattern", "input", "button", "a", "time"].includes(no.tagName)
    || atributo(no, "id") !== undefined)
  .map((no) => ({ tag: no.tagName, atributos: no.attrs }));
const htmlBarras = (props: GraficoBarrasProps) => renderToStaticMarkup(createElement(GraficoBarras, props));
const htmlLinhas = (props: GraficoLinhasProps) => renderToStaticMarkup(createElement(GraficoLinhas, props));
const htmlPaineis = (props: PequenosMultiplosProps) => renderToStaticMarkup(createElement(PequenosMultiplos, props));
const htmlCronograma = (props: CronogramaProps) => renderToStaticMarkup(createElement(Cronograma, props));
const htmlTempo = (props: LinhaDoTempoProps) => renderToStaticMarkup(createElement(LinhaDoTempo, props));

const barras = congelar<GraficoBarrasProps>({
  titulo: "Valores sintéticos", chaveCategoria: "id", chaveRotulo: "nome", unidade: "MW", casas: 2, rotulosValor: true,
  series: [{ id: "v", rotulo: "Realizado", cor: "var(--serie-1)" }],
  dados: [{ id: "A", nome: "Alfa", v: 1234.5 }, { id: "B", nome: "Beta", v: -1234.5 },
    { id: "C", nome: "Gama", v: -0.004 }, { id: "D", nome: "Delta", v: null }],
  referencias: [{ valor: 1000, rotulo: "Referência" }],
});
const linhas = congelar<GraficoLinhasProps>({
  titulo: "Série sintética", chaveX: "x", formatoX: "texto", unidade: "MW", casas: 2, tabelaAbertaInicial: true,
  series: [{ id: "v", rotulo: "Valor", cor: "var(--serie-1)" }],
  dados: [{ x: "a", v: 1234.5 }, { x: "b", v: null }, { x: "c", v: -1234.5 }, { x: "d", v: -0 }],
});
const paineis = congelar<PequenosMultiplosProps>({
  titulo: "Painéis sintéticos", chaveX: "x", formatoX: "texto", unidade: "MW", casas: 2, tabelaAbertaInicial: true,
  paineis: [{ id: "A", titulo: "Painel A" }, { id: "B", titulo: "Painel B" }],
  dados: [{ x: "a", A: 1234.5, B: null }, { x: "b", A: -1234.5, B: 0 }],
});
const cronograma = congelar<CronogramaProps>({
  titulo: "Cronograma sintético", dataBase: { data: "1999-06-30", rotulo: "Base" },
  itens: [{ id: "projeto", rotulo: "Projeto A", estado: "Concluído", marcos: [{
    id: "marco", rotulo: "Marco A", previsoes: [{ data: "2000-01", informadaEm: "1999-01-01" }], realizado: "2100-01",
  }] }],
});
const tempo = congelar<LinhaDoTempoProps>({
  titulo: "Eventos sintéticos", categorias: [{ id: "ato", rotulo: "Ato" }], ordem: "cronologica",
  eventos: [
    { id: "A", titulo: "Ato A", categoria: "ato", publicacao: "2000-01", vigencia: "2100-01", fonte: { rotulo: "Documento A", url: "https://example.org/a" } },
    { id: "B", titulo: "Ato B", categoria: "ato", publicacao: "2100-01", vigencia: "2000-01", fonte: null },
    { id: "C", titulo: "Ato C", categoria: "ato", publicacao: null, vigencia: null, fonte: null },
  ],
});

// Prova de SSR inicial, sem mocks: não cobre tooltip, anúncio após evento,
// expansão, resize ou mudança de idioma numa instância montada. Comprimentos
// iguais de separadores não provam passagem do idioma à medição dos ticks.
describe("compatibilidade PT e estrutura dos cinco componentes", () => {
  const casos: { nome: string; render: (idioma?: Idioma) => string }[] = [
    { nome: "Barras", render: (idioma) => htmlBarras({ ...barras, idioma }) },
    { nome: "Linhas", render: (idioma) => htmlLinhas({ ...linhas, idioma }) },
    { nome: "PequenosMultiplos", render: (idioma) => htmlPaineis({ ...paineis, idioma }) },
    { nome: "Cronograma", render: (idioma) => htmlCronograma({ ...cronograma, idioma }) },
    { nome: "LinhaDoTempo", render: (idioma) => htmlTempo({ ...tempo, idioma }) },
  ];
  it.each(casos)("$nome mantém PT omitido/expresso, formas, IDs e referências sem mutar os dados", ({ render }) => {
    const pt = render();
    expect(render("pt")).toBe(pt);
    const nosPt = analisar(pt);
    const nosEn = analisar(render("en"));
    expect(estrutura(nosEn)).toEqual(estrutura(nosPt));
    verificarReferencias(nosPt);
    verificarReferencias(nosEn);
  });
});

describe("GraficoBarras: apresentação numérica", () => {
  it.each(["vertical", "horizontal"] as const)("propaga idioma ao eixo, ARIA, ponta, referência e tabela %s", (orientacao) => {
    for (const idioma of ["pt", "en"] as const) {
      const nos = analisar(htmlBarras({ ...barras, orientacao, idioma }));
      const categorias = nos.filter((no) => no.tagName === "g" && atributo(no, "data-id") !== undefined);
      expect(categorias.map((no) => atributo(no, "data-id"))).toEqual(["A", "B", "C", "D"]);
      expect(categorias.map((no) => atributo(no, "aria-label"))).toEqual(idioma === "pt" ? [
        "Alfa: 1.234,50\u00a0MW", "Beta: \u22121.234,50\u00a0MW", "Gama: 0,00\u00a0MW", "Delta: sem dado",
      ] : ["Alfa: 1,234.50\u00a0MW", "Beta: \u22121,234.50\u00a0MW", "Gama: 0.00\u00a0MW", "Delta: sem dado"]);
      const ponta = unico(elementos(categorias[0]), (no) => no.tagName === "text" && atributo(no, "class") === "tabular-nums");
      expect(texto(ponta)).toBe(idioma === "pt" ? "1.234,50" : "1,234.50");
      expect(elementos(categorias[3]).some((no) => atributo(no, "data-estado") === "sem-dado")).toBe(true);
      expect(elementos(categorias[3]).some((no) => atributo(no, "data-serie") !== undefined)).toBe(false);
      expect(linhasTabela(nos).map(celulas)).toEqual(idioma === "pt"
        ? [["1.234,50"], ["\u22121.234,50"], ["0,00"], ["sem dado"]]
        : [["1,234.50"], ["\u22121,234.50"], ["0.00"], ["sem dado"]]);
      const eixo = unico(nos, (no) => no.tagName === "svg" && atributo(no, "data-svg-grafico") !== undefined
        && (orientacao === "vertical" ? atributo(no, "role") === "group" : atributo(no, "role") === undefined));
      expect(elementos(eixo).filter((no) => no.tagName === "text" && atributo(no, "fill") === "var(--cor-mineral)").map(texto))
        .toEqual(idioma === "pt" ? ["\u22122.000", "\u22121.000", "0", "1.000", "2.000"] : ["\u22122,000", "\u22121,000", "0", "1,000", "2,000"]);
      const legenda = unico(nos, (no) => no.tagName === "ul" && atributo(no, "aria-label") === "Legenda");
      const referencia = unico(elementos(legenda), (no) => no.tagName === "li" && texto(no).startsWith("Referência:"));
      expect(texto(referencia)).toBe(idioma === "pt" ? "Referência: 1.000,00\u00a0MW" : "Referência: 1,000.00\u00a0MW");
      if (orientacao === "vertical") {
        expect(texto(tag(elementos(marcado(nos, "data-referencia")), "text")))
          .toBe(idioma === "pt" ? "Referência: 1.000,00\u00a0MW" : "Referência: 1,000.00\u00a0MW");
      }
    }
  });

  it.each(["pt", "en"] as const)("localiza total da pilha em %s e conserva ausência obrigatória/opcional", (idioma) => {
    const nos = analisar(htmlBarras({
      ...barras, referencias: [], chaveRotulo: undefined, orientacao: "horizontal", empilhado: true, idioma,
      series: [{ id: "a", rotulo: "A", cor: "var(--serie-1)" }, { id: "b", rotulo: "B", cor: "var(--serie-2)" },
        { id: "op", rotulo: "Opcional", cor: "var(--serie-3)", opcional: true }],
      dados: [{ id: "X", a: 1000.25, b: 234.25, op: null }, { id: "Y", a: 1000.25, b: null, op: null }],
    }));
    const categorias = nos.filter((no) => no.tagName === "g" && atributo(no, "data-id") !== undefined);
    expect(categorias.map((no) => atributo(no, "aria-label"))).toEqual(idioma === "pt" ? [
      "X: A 1.000,25\u00a0MW; B 234,25\u00a0MW; total 1.234,50\u00a0MW",
      "Y: A 1.000,25\u00a0MW; B sem dado; total incompleto, há parte sem dado",
    ] : [
      "X: A 1,000.25\u00a0MW; B 234.25\u00a0MW; total 1,234.50\u00a0MW",
      "Y: A 1,000.25\u00a0MW; B sem dado; total incompleto, há parte sem dado",
    ]);
    expect(texto(unico(elementos(categorias[0]), (no) => no.tagName === "text" && atributo(no, "class") === "tabular-nums")))
      .toBe(idioma === "pt" ? "1.234,50" : "1,234.50");
    expect(linhasTabela(nos).map(celulas)).toEqual(idioma === "pt"
      ? [["1.000,25", "234,25", "não se aplica", "1.234,50"], ["1.000,25", "sem dado", "não se aplica", "incompleto"]]
      : [["1,000.25", "234.25", "não se aplica", "1,234.50"], ["1,000.25", "sem dado", "não se aplica", "incompleto"]]);
  });

  it("agrupa mil categorias mantendo só duas desenhadas e a tabela completa", () => {
    const dados = Array.from({ length: 1000 }, (_, i) => ({ id: `e${i}`, v: 1 }));
    for (const idioma of ["pt", "en"] as const) {
      const nos = analisar(htmlBarras({ ...barras, dados, chaveRotulo: undefined, referencias: [], rotulosValor: false, orientacao: "horizontal", limiteInicial: 2, idioma }));
      expect(nos.filter((no) => no.tagName === "g" && atributo(no, "data-id") !== undefined)).toHaveLength(2);
      expect(linhasTabela(nos)).toHaveLength(1000);
      const aviso = elementos(marcado(nos, "data-aviso-rolagem"));
      expect(texto(tag(aviso, "span"))).toBe(idioma === "pt"
        ? "O gráfico mostra as 2 primeiras das 1.000 categorias, na ordem escolhida."
        : "O gráfico mostra as 2 primeiras das 1,000 categorias, na ordem escolhida.");
      expect(texto(tag(aviso, "button"))).toBe(idioma === "pt" ? "Mostrar todas as 1.000" : "Mostrar todas as 1,000");
      expect(texto(tag(nos, "summary"))).toBe(idioma === "pt" ? "Dados do gráfico em tabela (1.000 linhas)" : "Dados do gráfico em tabela (1,000 linhas)");
    }
  });
});

describe("GraficoLinhas: precisão própria e estado inicial", () => {
  it.each(["pt", "en"] as const)("mantém -0, lacuna, eixo e células em %s", (idioma) => {
    const nos = analisar(htmlLinhas({ ...linhas, idioma }));
    expect(linhasTabela(nos).map(celulas)).toEqual(idioma === "pt"
      ? [["1.234,50"], ["sem dado"], ["\u22121.234,50"], ["\u22120,00"]]
      : [["1,234.50"], ["sem dado"], ["\u22121,234.50"], ["\u22120.00"]]);
    expect(linhasTabela(nos).map((no) => texto(tag(elementos(no), "th")))).toEqual(["a", "b", "c", "d"]);
    const svg = marcado(nos, "data-svg-grafico");
    expect(elementos(svg).filter((no) => no.tagName === "text" && atributo(no, "text-anchor") === "end"
      && atributo(no, "font-size") === "12" && atributo(no, "fill") === "var(--cor-mineral)").map(texto))
      .toEqual(idioma === "pt" ? ["\u22121.000", "0", "1.000"] : ["\u22121,000", "0", "1,000"]);
    const caminho = unico(elementos(svg), (no) => no.tagName === "path" && atributo(no, "stroke") === "var(--serie-1)");
    expect(atributo(caminho, "d")?.match(/M/g)).toHaveLength(2);
    expect(texto(tag(nos, "summary"))).toBe("Dados do gráfico em tabela (4 linhas)");
  });

  it.each(["pt", "en"] as const)("formata os dois limites da banda sem traduzir separador ou ausência em %s", (idioma) => {
    const nos = analisar(htmlLinhas({ ...linhas, idioma, banda: { inferior: "lo", superior: "hi", rotulo: "Faixa" },
      dados: [{ x: "a", v: 1234.5, lo: 1000.25, hi: 2000.5 }, { x: "b", v: null, lo: null, hi: null }],
    }));
    expect(linhasTabela(nos).map(celulas)).toEqual(idioma === "pt"
      ? [["1.234,50", "1.000,25 a 2.000,50"], ["sem dado", "sem dado"]]
      : [["1,234.50", "1,000.25 a 2,000.50"], ["sem dado", "sem dado"]]);
  });

  it.each(["pt", "en"] as const)("mantém espaço comum e limites literais na escala anunciada em %s", (idioma) => {
    const nos = analisar(htmlLinhas({ ...linhas, idioma, casas: 1, legendaInterativa: true, ocultasIniciais: ["grande"],
      series: [{ id: "v", rotulo: "Valor", cor: "var(--serie-1)" }, { id: "grande", rotulo: "Grande", cor: "var(--serie-2)" }],
      dados: [{ x: "a", v: 1000, grande: 10000 }, { x: "b", v: 2000, grande: 20000 }],
    }));
    const estado = marcado(nos, "data-estado-grafico");
    expect(atributo(estado, "aria-live")).toBe("polite");
    expect(texto(estado)).toBe(idioma === "pt"
      ? "Escala ajustada às séries visíveis: eixo de 940,0 a 2.060,0 MW; com todas as séries, \u2212140,0 a 21.140,0 MW."
      : "Escala ajustada às séries visíveis: eixo de 940.0 a 2,060.0 MW; com todas as séries, \u2212140.0 a 21,140.0 MW.");
  });

  it("agrupa numerador e denominador do zoom sem abrir uma tabela de mil linhas", () => {
    const dados = Array.from({ length: 1001 }, (_, i) => ({ x: `ponto-${String(i).padStart(4, "0")}`, v: 1 }));
    for (const idioma of ["pt", "en"] as const) {
      const nos = analisar(htmlLinhas({ ...linhas, dados, idioma, zoom: true, tabelaAbertaInicial: false,
        intervaloInicial: { inicio: "ponto-0000", fim: "ponto-0999" },
      }));
      expect(texto(marcado(nos, "data-estado-grafico"))).toBe(idioma === "pt"
        ? "Intervalo exibido: ponto-0000 a ponto-0999, 1.000 de 1.001 pontos."
        : "Intervalo exibido: ponto-0000 a ponto-0999, 1,000 de 1,001 pontos.");
      expect(nos.filter((no) => no.tagName === "summary").map(texto)).toEqual([
        "Ajustar início e fim",
        idioma === "pt"
          ? "Dados do gráfico em tabela (1.000 de 1.001 linhas, intervalo exibido)"
          : "Dados do gráfico em tabela (1,000 de 1,001 linhas, intervalo exibido)",
      ]);
      expect(nos.some((no) => no.tagName === "tbody")).toBe(false);
    }
  });
});

describe("PequenosMultiplos: pai, filho e cursor inicial real", () => {
  it.each(["pt", "en"] as const)("propaga %s ao aviso, aos eixos, à tabela e à leitura do Painel", (idioma) => {
    const nos = analisar(renderToStaticMarkup(createElement(CursorSincronizado, { inicial: { grupo: "x", valor: "a" } },
      createElement(PequenosMultiplos, { ...paineis, idioma }))));
    expect(texto(marcado(nos, "data-aviso"))).toBe(idioma === "pt"
      ? "Escala compartilhada: a mesma régua vertical em todos os painéis, de \u22122.000 a 2.000 MW."
      : "Escala compartilhada: a mesma régua vertical em todos os painéis, de \u22122,000 a 2,000 MW.");
    const pain = nos.filter((no) => atributo(no, "data-painel") !== undefined);
    expect(pain.map((no) => atributo(no, "data-painel"))).toEqual(["A", "B"]);
    for (const painel of pain) {
      const filhosPainel = elementos(painel);
      expect(filhosPainel.filter((no) => no.tagName === "text" && atributo(no, "class") === "tabular-nums").map(texto))
        .toEqual(idioma === "pt" ? ["\u22122.000", "\u22121.000", "0", "1.000", "2.000"] : ["\u22122,000", "\u22121,000", "0", "1,000", "2,000"]);
      marcado(filhosPainel, "data-cursor");
    }
    expect(pain.map((no) => texto(marcado(elementos(no), "data-leitura"))))
      .toEqual(idioma === "pt" ? ["a: 1.234,50\u00a0MW", "a: sem dado"] : ["a: 1,234.50\u00a0MW", "a: sem dado"]);
    expect(linhasTabela(nos).map(celulas)).toEqual(idioma === "pt"
      ? [["1.234,50", "sem dado"], ["\u22121.234,50", "0,00"]]
      : [["1,234.50", "sem dado"], ["\u22121,234.50", "0.00"]]);
    verificarReferencias(nos);
    // Cursor externo preenche a leitura do filho, não o anúncio ativo do pai.
    expect(texto(unico(nos, (no) => atributo(no, "aria-live") === "polite"))).toBe("");
  });

  it("agrupa mil linhas com um único painel e tabela fechada", () => {
    const dados = Array.from({ length: 1000 }, (_, i) => ({ x: `ponto-${i}`, A: 1 }));
    for (const idioma of ["pt", "en"] as const) {
      const nos = analisar(htmlPaineis({ ...paineis, dados, idioma, paineis: [{ id: "A", titulo: "Painel A" }], tabelaAbertaInicial: false }));
      expect(texto(tag(nos, "summary"))).toBe(idioma === "pt"
        ? "Dados dos painéis em tabela (1.000 linhas, 1 painel)" : "Dados dos painéis em tabela (1,000 linhas, 1 painel)");
      expect(nos.some((no) => no.tagName === "tbody")).toBe(false);
    }
  });
});

describe("duração nos componentes e contagem filtrada", () => {
  it.each(["pt", "en"] as const)("Cronograma encaminha %s ao rótulo, à ARIA e à tabela, preservando datas", (idioma) => {
    const nos = analisar(htmlCronograma({ ...cronograma, idioma }));
    const marco = unico(nos, (no) => no.tagName === "g" && atributo(no, "data-marco") === "projeto::marco");
    expect(atributo(marco, "aria-label")).toBe(idioma === "pt"
      ? "Projeto A, Marco A: previsão mais recente 01/2000, informada em 01/01/1999; 1 previsão registrada; realizado em 01/2100; realizado com atraso de 1.200 meses sobre a data-base"
      : "Projeto A, Marco A: previsão mais recente 01/2000, informada em 01/01/1999; 1 previsão registrada; realizado em 01/2100; realizado com atraso de 1,200 meses sobre a data-base");
    expect(texto(marcado(elementos(marco), "data-atraso"))).toBe(idioma === "pt" ? "+1.200 meses" : "+1,200 meses");
    expect(linhasTabela(nos).map(celulas)).toEqual(idioma === "pt" ? [[
      "Concluído", "Marco A", "01/2000, informada em 01/01/1999", "01/2100", "01/2000, informada em 01/01/1999",
      "realizado com atraso de 1.200 meses sobre a data-base",
    ]] : [[
      "Concluído", "Marco A", "01/2000, informada em 01/01/1999", "01/2100", "01/2000, informada em 01/01/1999",
      "realizado com atraso de 1,200 meses sobre a data-base",
    ]]);
    expect(texto(tag(nos, "summary"))).toBe("Cronograma em tabela (1 marco)");
    // O summary de mil marcos não é exercitado; esta fixture testa a cadeia de duração.
  });

  it.each(["pt", "en"] as const)("LinhaDoTempo encaminha %s aos dois sentidos de defasagem, mantendo fontes e datas", (idioma) => {
    const nos = analisar(htmlTempo({ ...tempo, idioma }));
    const eventos = nos.filter((no) => no.tagName === "li" && atributo(no, "data-id") !== undefined);
    expect(eventos.map((no) => atributo(no, "data-id"))).toEqual(["A", "B", "C"]);
    expect(eventos.map((no) => elementos(no).filter((e) => e.tagName === "span" && atributo(e, "class") === "block text-xs text-carvao-muted").map(texto)))
      .toEqual(idioma === "pt" ? [["vigência 1.200 meses após a publicação"], ["vigência retroativa: 1.200 meses antes da publicação"], []]
        : [["vigência 1,200 meses após a publicação"], ["vigência retroativa: 1,200 meses antes da publicação"], []]);
    expect(nos.filter((no) => no.tagName === "time").map((no) => [atributo(no, "datetime"), texto(no)]))
      .toEqual([["2000-01", "01/2000"], ["2100-01", "01/2100"], ["2100-01", "01/2100"], ["2000-01", "01/2000"]]);
    const fonte = tag(nos, "a");
    expect([atributo(fonte, "href"), atributo(fonte, "target"), atributo(fonte, "rel"), texto(fonte)])
      .toEqual(["https://example.org/a", "_blank", "noopener noreferrer", "Fonte primária: Documento A (abre em nova aba)"]);
    expect(elementos(eventos[2]).filter((no) => no.tagName === "span" && texto(no) === "não informada")).toHaveLength(2);
  });

  it("agrupa total e exclusões de mil eventos sem renderizar mil cartões", () => {
    const eventos: LinhaDoTempoProps["eventos"] = [
      { id: "valido", titulo: "Dentro", categoria: "ato", publicacao: "2000-06-01", vigencia: "2000-06-01", fonte: null },
      ...Array.from({ length: 1000 }, (_, i) => ({ id: `ausente-${i}`, titulo: "Sem vigência", categoria: "ato", publicacao: "2000-06-01", vigencia: null, fonte: null })),
    ];
    for (const idioma of ["pt", "en"] as const) {
      const nos = analisar(htmlTempo({ ...tempo, eventos, idioma,
        filtro: { categorias: null, inicio: "2000-01-01", fim: "2000-12-31", base: "vigencia" },
      }));
      expect(nos.filter((no) => no.tagName === "article")).toHaveLength(1);
      expect(texto(marcado(nos, "data-estado-filtro"))).toBe(idioma === "pt"
        ? "Mostrando 1 de 1.001 eventos; vigência de 01/01/2000 a 31/12/2000. 1.000 eventos sem data de vigência ficam fora do recorte por período."
        : "Mostrando 1 de 1,001 eventos; vigência de 01/01/2000 a 31/12/2000. 1,000 eventos sem data de vigência ficam fora do recorte por período.");
    }
  });
});
