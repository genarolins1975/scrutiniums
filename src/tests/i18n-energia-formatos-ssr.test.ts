import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { describe, expect, it } from "vitest";
import { GraficoPontos, type GraficoPontosProps, type ParEntidade } from "@/components/energia/GraficoPontos";
import { TabelaDados } from "@/components/energia/TabelaDados";

type No = DefaultTreeAdapterMap["node"];
type Elemento = DefaultTreeAdapterMap["element"];
const filhos = (no: No): No[] => "childNodes" in no ? no.childNodes : [];
const atributo = (no: Elemento, nome: string) => no.attrs.find((a) => a.name === nome)?.value;
function elementos(no: No): Elemento[] {
  return [...("tagName" in no ? [no] : []), ...filhos(no).flatMap(elementos)];
}
function texto(no: No): string {
  return "value" in no ? no.value : filhos(no).map(texto).join("");
}
function unico(nos: Elemento[], predicado: (no: Elemento) => boolean): Elemento {
  const encontrados = nos.filter(predicado);
  expect(encontrados).toHaveLength(1);
  return encontrados[0];
}
const tag = (nos: Elemento[], nome: string) => unico(nos, (no) => no.tagName === nome);
const celulas = (linha: Elemento) => elementos(linha).filter((no) => no.tagName === "td").map(texto);
const renderTabela = (props: ComponentProps<typeof TabelaDados>) => renderToStaticMarkup(createElement(TabelaDados, props));
const renderGrafico = (props: GraficoPontosProps) => renderToStaticMarkup(createElement(GraficoPontos, props));

const tabela: ComponentProps<typeof TabelaDados> = {
  titulo: "Tabela sintética",
  colunas: ["Variável", "Fixa", "Inteira", "Texto", "Ausência"],
  casas: [null, 2, 0, null, null],
  csv: "/energia/series/fixture.csv",
  linhas: [
    [12, 12, 12, "12,00", null],
    [1234.567, 1234.567, 1234.567, "1.234,567", null],
    [-0, -0, -0, "literal", null],
    [NaN, Infinity, -Infinity, "literal", null],
  ],
};
tabela.linhas.forEach(Object.freeze);
Object.freeze(tabela.linhas);
Object.freeze(tabela.colunas);
Object.freeze(tabela.casas);
Object.freeze(tabela);

describe("TabelaDados: idioma no SSR real", () => {
  it("mantém o mesmo HTML com português omitido ou explícito, sem mutar as props congeladas", () => {
    expect(renderTabela(tabela)).toBe(renderTabela({ ...tabela, idioma: "pt" }));
  });

  it.each(["pt", "en"] as const)("preserva cada célula, precisão variável/fixa e prosa em %s", (idioma) => {
    const nos = elementos(parseFragment(renderTabela({ ...tabela, idioma })));
    const linhas = elementos(tag(nos, "tbody")).filter((no) => no.tagName === "tr");
    expect(linhas.map(celulas)).toEqual(idioma === "pt" ? [
      ["12", "12,00", "12", "12,00", "sem dado"],
      ["1.234,57", "1.234,57", "1.235", "1.234,567", "sem dado"],
      ["\u22120", "\u22120,00", "\u22120", "literal", "sem dado"],
      ["NaN", "∞", "\u2212∞", "literal", "sem dado"],
    ] : [
      ["12", "12.00", "12", "12,00", "sem dado"],
      ["1,234.57", "1,234.57", "1,235", "1.234,567", "sem dado"],
      ["\u22120", "\u22120.00", "\u22120", "literal", "sem dado"],
      ["NaN", "∞", "\u2212∞", "literal", "sem dado"],
    ]);
    for (const linha of linhas) {
      const ausente = tag(elementos(linha), "span");
      expect(texto(ausente)).toBe("sem dado");
      expect(atributo(ausente, "class")).toBe("text-mineral");
    }
    expect(texto(tag(nos, "summary"))).toBe("Resumo em tabela (4 linhas)");
    expect(texto(tag(nos, "caption"))).toBe("Tabela sintética");
    expect(elementos(tag(nos, "thead")).filter((no) => no.tagName === "th").map(texto))
      .toEqual(["Variável", "Fixa", "Inteira", "Texto", "Ausência"]);
    const regiao = unico(nos, (no) => atributo(no, "role") === "region");
    expect(atributo(regiao, "aria-label")).toBe("Tabela sintética (tabela rolável)");
    expect(atributo(regiao, "tabindex")).toBe("0");
    const csv = tag(nos, "a");
    expect([texto(csv), atributo(csv, "href"), atributo(csv, "download")])
      .toEqual(["Baixar série completa (CSV)", "/energia/series/fixture.csv", ""]);
  });

  it.each(["pt", "en"] as const)("casas omitidas não forçam decimais e limite conserva as últimas linhas em %s", (idioma) => {
    const nos = elementos(parseFragment(renderTabela({
      titulo: "Recorte", colunas: ["Inteiro", "Decimal"],
      linhas: [[99, 99.5], [12, 12.5], [13, 13.5]], limite: 2, idioma,
    })));
    expect(elementos(tag(nos, "tbody")).filter((no) => no.tagName === "tr").map(celulas))
      .toEqual(idioma === "pt" ? [["12", "12,5"], ["13", "13,5"]] : [["12", "12.5"], ["13", "13.5"]]);
    expect(texto(tag(nos, "summary"))).toBe("Resumo em tabela (últimas 2 de 3 linhas)");
  });
});

const itens: ParEntidade[] = [
  { id: "A", rotulo: "Alfa", valor: 1234.5, referencia: 1000 },
  { id: "B", rotulo: "Beta", valor: -1234.5, referencia: -1000 },
  { id: "C", rotulo: "Gama", valor: 0, referencia: null },
];
itens.forEach(Object.freeze);
Object.freeze(itens);
const grafico: GraficoPontosProps = Object.freeze({
  titulo: "Comparação sintética", unidade: "MW", casas: 1,
  rotuloValor: "Realizado", rotuloReferencia: "Referência", itens,
});

// SSR não abre tooltip, não expande "todas" e não executa ResizeObserver.
// Coordenadas iguais não provam passagem do idioma à medição dos ticks: os
// separadores PT/EN têm o mesmo comprimento. Esses argumentos exigem revisão do diff.
describe("GraficoPontos: idioma no SSR real", () => {
  it("mantém HTML PT, IDs, formas, geometria e controles entre idiomas sem mutar a entrada", () => {
    const pt = renderGrafico(grafico);
    const en = renderGrafico({ ...grafico, idioma: "en" });
    expect(renderGrafico({ ...grafico, idioma: "pt" })).toBe(pt);
    const estrutura = (html: string) => elementos(parseFragment(html))
      .filter((no) => ["svg", "circle", "polygon", "line", "rect", "input", "button"].includes(no.tagName)
        || atributo(no, "id") !== undefined)
      .map((no) => ({ tag: no.tagName, atributos: no.attrs }));
    expect(estrutura(en)).toEqual(estrutura(pt));
    for (const html of [pt, en]) {
      const nos = elementos(parseFragment(html));
      const desenho = unico(nos, (no) => no.tagName === "svg" && atributo(no, "role") === "group");
      expect([atributo(desenho, "viewBox"), atributo(desenho, "height")]).toEqual(["0 0 760 132", "132"]);
      for (const referencia of ["aria-labelledby", "aria-describedby"]) {
        const destino = atributo(desenho, referencia);
        expect(destino).toBeTruthy();
        unico(nos, (no) => atributo(no, "id") === destino);
      }
      const linhas = elementos(desenho).filter((no) => no.tagName === "g" && atributo(no, "data-id") !== undefined);
      expect(linhas.map((no) => [atributo(no, "data-id"), atributo(no, "role"), atributo(no, "tabindex")]))
        .toEqual([["A", "img", "0"], ["C", "img", "-1"], ["B", "img", "-1"]]);
      expect(linhas.map((no) => {
        const circulo = tag(elementos(no), "circle");
        return [atributo(circulo, "cx"), atributo(circulo, "cy")];
      })).toEqual([["561.3", "22"], ["428", "66"], ["294.7", "110"]]);
      expect(linhas.flatMap(elementos).filter((no) => no.tagName === "polygon")).toHaveLength(2);
      expect(linhas.flatMap(elementos).filter((no) => no.tagName === "line")).toHaveLength(2);
    }
  });

  it.each(["pt", "en"] as const)("propaga %s ao eixo, leitura acessível, diferenças e tabela", (idioma) => {
    const nos = elementos(parseFragment(renderGrafico({ ...grafico, idioma })));
    const eixo = unico(nos, (no) => no.tagName === "svg"
      && atributo(no, "data-svg-grafico") !== undefined && atributo(no, "role") === undefined);
    const rotulos = elementos(eixo).filter((no) => no.tagName === "text");
    expect(rotulos.map(texto)).toEqual(idioma === "pt"
      ? ["Diferença", "\u22122.000", "\u22121.000", "0", "1.000", "2.000"]
      : ["Diferença", "\u22122,000", "\u22121,000", "0", "1,000", "2,000"]);
    expect(rotulos.slice(1).map((no) => atributo(no, "x"))).toEqual(["212", "320", "428", "536", "644"]);
    const linhas = nos.filter((no) => no.tagName === "g" && atributo(no, "data-id") !== undefined);
    expect(linhas.map((no) => atributo(no, "aria-label"))).toEqual(idioma === "pt" ? [
      "Alfa: Realizado 1.234,5\u00a0MW; Referência 1.000,0\u00a0MW; diferença +234,5\u00a0MW, acima da referência",
      "Gama: Realizado 0,0\u00a0MW; Referência sem dado; diferença sem dado",
      "Beta: Realizado \u22121.234,5\u00a0MW; Referência \u22121.000,0\u00a0MW; diferença \u2212234,5\u00a0MW, abaixo da referência",
    ] : [
      "Alfa: Realizado 1,234.5\u00a0MW; Referência 1,000.0\u00a0MW; diferença +234.5\u00a0MW, acima da referência",
      "Gama: Realizado 0.0\u00a0MW; Referência sem dado; diferença sem dado",
      "Beta: Realizado \u22121,234.5\u00a0MW; Referência \u22121,000.0\u00a0MW; diferença \u2212234.5\u00a0MW, abaixo da referência",
    ]);
    const diferencas = linhas.map((linha) => unico(elementos(linha), (no) => atributo(no, "data-diferenca") !== undefined));
    expect(diferencas.map((no) => atributo(no, "data-diferenca"))).toEqual(["234.5", "sem-dado", "-234.5"]);
    expect(diferencas.map(texto)).toEqual(idioma === "pt"
      ? ["+234,5\u00a0MW", "sem dado", "\u2212234,5\u00a0MW"]
      : ["+234.5\u00a0MW", "sem dado", "\u2212234.5\u00a0MW"]);
    const linhasTabela = nos.filter((no) => no.tagName === "tr" && atributo(no, "data-id") !== undefined);
    expect(linhasTabela.map((no) => atributo(no, "data-id"))).toEqual(["A", "C", "B"]);
    expect(linhasTabela.map(celulas)).toEqual(idioma === "pt"
      ? [["1.234,5", "1.000,0", "+234,5"], ["0,0", "sem dado", "sem dado"], ["\u22121.234,5", "\u22121.000,0", "\u2212234,5"]]
      : [["1,234.5", "1,000.0", "+234.5"], ["0.0", "sem dado", "sem dado"], ["\u22121,234.5", "\u22121,000.0", "\u2212234.5"]]);
  });

  it("agrupa a contagem real de 1000 itens nos três nós visíveis, uma renderização por idioma", () => {
    const muitos: ParEntidade[] = Array.from({ length: 1000 }, (_, i) => ({ id: `e${i}`, rotulo: `Entidade ${i}`, valor: 1, referencia: 0 }));
    for (const idioma of ["pt", "en"] as const) {
      const nos = elementos(parseFragment(renderGrafico({ ...grafico, itens: muitos, idioma })));
      const aviso = unico(nos, (no) => atributo(no, "data-aviso-rolagem") === "true");
      const partes = elementos(aviso);
      expect(texto(tag(partes, "span"))).toBe(idioma === "pt"
        ? "O gráfico mostra só parte das 1.000 entidades, na ordem escolhida."
        : "O gráfico mostra só parte das 1,000 entidades, na ordem escolhida.");
      const botao = tag(partes, "button");
      expect(texto(botao)).toBe(idioma === "pt" ? "Mostrar todas as 1.000" : "Mostrar todas as 1,000");
      expect(atributo(botao, "aria-expanded")).toBe("false");
      expect(texto(tag(nos, "summary"))).toBe(idioma === "pt"
        ? "Dados do gráfico em tabela (1.000 linhas)" : "Dados do gráfico em tabela (1,000 linhas)");
    }
  });
});
