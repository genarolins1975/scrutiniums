import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { describe, expect, it, vi } from "vitest";
import type { DefinirEstadoUrl, OpcoesEstadoUrl } from "@/components/energia/useEstadoUrl";
import type { Esquema, ValoresDe } from "@/lib/energia/estadoUrl";

// Entrada SSR isolada: somente buscaInicial muda. Hook, parser, estado, setter
// e cálculos são reais; isto não prova clique, escrita de URL ou rerender DOM.
vi.mock("@/components/energia/useEstadoUrl", async (original) => {
  const modulo = await original<typeof import("@/components/energia/useEstadoUrl")>();
  function useEstadoUrl<E extends Esquema>(esquema: E, opcoes: OpcoesEstadoUrl = {}): [ValoresDe<E>, DefinirEstadoUrl<ValoresDe<E>>] {
    return modulo.useEstadoUrl(esquema, { ...opcoes, buscaInicial: "?laboratorio=demanda&ti=100&uso=80&pue=1.35" });
  }
  return { ...modulo, useEstadoUrl };
});

import { LaboratorioFlexibilidade } from "@/components/energia/LaboratorioFlexibilidade";

type PropsLaboratorio = NonNullable<ComponentProps<typeof LaboratorioFlexibilidade>>;
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
const analisar = (html: string) => elementos(parseFragment(html));
const renderizar = (props: PropsLaboratorio) => renderToStaticMarkup(createElement<PropsLaboratorio>(LaboratorioFlexibilidade, props));
const propsPt: PropsLaboratorio = Object.freeze({ idioma: "pt" });
const propsEn: PropsLaboratorio = Object.freeze({ idioma: "en" });

describe("LaboratorioFlexibilidade: demanda com busca inicial SSR e cálculo reais", () => {
  it("mantém PT omitido e preserva estrutura e atributos entre idiomas", () => {
    const pt = renderizar(propsPt);
    expect(renderToStaticMarkup(createElement(LaboratorioFlexibilidade))).toBe(pt);
    const estrutura = (html: string) => analisar(html).map((no) => ({
      tag: no.tagName, atributos: no.attrs,
      filhos: filhos(no).filter((filho) => "tagName" in filho).length,
    }));
    expect(estrutura(renderizar(propsEn))).toEqual(estrutura(pt));
    // Demanda não desenha a barra da bateria nem outro gráfico.
    expect(analisar(pt).filter((no) => no.tagName === "svg" || atributo(no, "role") === "img")).toHaveLength(0);
  });

  it.each(["pt", "en"] as const)("formata as três aparições de PUE e a energia em %s", (idioma) => {
    const props = idioma === "pt" ? propsPt : propsEn;
    const antes = structuredClone(props);
    const nos = analisar(renderizar(props));
    const secao = tag(nos, "section");
    expect([atributo(secao, "id"), atributo(secao, "aria-labelledby"), atributo(tag(nos, "h2"), "id")])
      .toEqual(["laboratorio-flexibilidade", "flexibilidade-titulo", "flexibilidade-titulo"]);
    const abas = unico(nos, (no) => atributo(no, "role") === "group" && atributo(no, "aria-label") === "Escolha o laboratório");
    expect(elementos(abas).filter((no) => no.tagName === "button").map((no) => [texto(no), atributo(no, "aria-pressed")]))
      .toEqual([["Bateria e deslocamento de energia", "false"], ["Data center e demanda", "true"]]);
    expect(nos.filter((no) => no.tagName === "input").map((no) => [
      atributo(no, "aria-label"), atributo(no, "type"), atributo(no, "value"),
      atributo(no, "min"), atributo(no, "max"), atributo(no, "step"),
    ])).toEqual([
      ["Potência de TI do data center", "range", "100", "1", "500", undefined],
      ["Utilização média do data center", "range", "80", "10", "100", undefined],
      ["PUE médio do data center", "range", "1.35", "1", "2.5", "0.05"],
    ]);
    expect(nos.filter((no) => no.tagName === "label").map(texto)).toEqual([
      "Potência nominal de TI: 100 MW", "Utilização média: 80%",
      idioma === "pt" ? "PUE médio: 1,35" : "PUE médio: 1.35",
    ]);
    const metricas = filhos(tag(nos, "dl")).filter((no): no is Elemento => "tagName" in no);
    expect(metricas.map((no) => {
      const partes = elementos(no);
      return [texto(tag(partes, "dt")), texto(tag(partes, "dd")), texto(tag(partes, "small"))];
    })).toEqual([
      ["Demanda média da instalação", "108 MW", "TI × utilização × PUE."],
      ["Energia anual total", idioma === "pt" ? "946,1 GWh" : "946.1 GWh", "Demanda média × 8.760 h ÷ 1.000."],
      ["Energia anual de TI", idioma === "pt" ? "700,8 GWh" : "700.8 GWh", "A diferença para o total representa os demais sistemas na hipótese adotada."],
    ]);
    const leituraPue = unico(nos, (no) => no.tagName === "div" && filhos(no).some((filho) => "tagName" in filho && filho.tagName === "strong"));
    expect(texto(leituraPue)).toBe(idioma === "pt"
      ? "PUE = energia total da instalação ÷ energia dos equipamentos de TI. Com PUE 1,35, cada 1 MWh de TI corresponde a 1,35 MWh no total. PUE não mede o trabalho computacional por MWh."
      : "PUE = energia total da instalação ÷ energia dos equipamentos de TI. Com PUE 1.35, cada 1 MWh de TI corresponde a 1.35 MWh no total. PUE não mede o trabalho computacional por MWh.");
    expect(nos.filter((no) => no.tagName === "button").map(texto))
      .toEqual(["Bateria e deslocamento de energia", "Data center e demanda", "Restaurar hipóteses"]);
    expect(props).toEqual(antes);
  });
});
