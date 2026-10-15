import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { describe, expect, it, vi } from "vitest";
import type { BlocoComercial } from "@/lib/energia/leitura-integrada";

const blocos = vi.hoisted(() => {
  const dados: BlocoComercial[] = [
    { nome: "A", consumo: 1234.56, contrato: 1235.81, pld: 1000 },
    { nome: "B", consumo: 20, contrato: 20, pld: 0 },
    { nome: "C", consumo: 10.5, contrato: 9.25, pld: 2000 },
    { nome: "D", consumo: 0, contrato: 0, pld: 400 },
  ];
  dados.forEach(Object.freeze);
  return Object.freeze(dados);
});

// Substituir somente os dados. Cálculo, estado URL, hooks e formatação são reais.
vi.mock("@/lib/energia/leitura-integrada", async (original) => {
  const modulo = await original<typeof import("@/lib/energia/leitura-integrada")>();
  return { ...modulo, BLOCOS_COMERCIAIS: blocos };
});

import { LaboratorioContratos } from "@/components/energia/ComercializacaoDidatica";

type PropsLaboratorio = NonNullable<ComponentProps<typeof LaboratorioContratos>>;

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

describe("LaboratorioContratos com blocos sintéticos e cálculo real", () => {
  it("mantém o mesmo HTML em português omitido ou explícito sem mutar os blocos", () => {
    const antes = structuredClone(blocos);
    expect(renderToStaticMarkup(createElement(LaboratorioContratos)))
      .toBe(renderToStaticMarkup(createElement<PropsLaboratorio>(LaboratorioContratos, { idioma: "pt" })));
    expect(blocos).toEqual(antes);
  });

  it.each(["pt", "en"] as const)("preserva números, moeda, estado e entradas no SSR em %s", (idioma) => {
    const antes = structuredClone(blocos);
    const nos = elementos(parseFragment(renderToStaticMarkup(createElement<PropsLaboratorio>(LaboratorioContratos, { idioma }))));
    const secao = unico(nos, (no) => atributo(no, "id") === "laboratorio-contratos");
    const titulo = tag(elementos(secao), "h2");
    expect([atributo(secao, "aria-labelledby"), atributo(titulo, "id"), texto(titulo)])
      .toEqual(["laboratorio-contratos-titulo", "laboratorio-contratos-titulo", "Contratar 100 MWh e consumir 100 MWh elimina a exposição?"]);

    const perfil = unico(nos, (no) => atributo(no, "role") === "group" && atributo(no, "aria-label") === "Perfil do volume contratado");
    expect(elementos(perfil).filter((no) => no.tagName === "button").map((no) => [texto(no), atributo(no, "aria-pressed")]))
      .toEqual([["25 MWh em cada bloco", "true"], ["Contrato acompanha o consumo", "false"]]);
    expect(nos.filter((no) => no.tagName === "input").map((no) => [
      atributo(no, "aria-label"), atributo(no, "type"), atributo(no, "value"),
      atributo(no, "min"), atributo(no, "max"), atributo(no, "step"),
    ])).toEqual([
      ["Preço hipotético do contrato", "range", "180", "0", "1000", "10"],
      ["PLD hipotético das 18 às 24 horas", "range", "400", "0", "1000", "10"],
    ]);
    expect(nos.filter((no) => no.tagName === "label").map(texto)).toEqual(idioma === "pt" ? [
      "Preço do contrato: R$\u00a0180/MWh", "PLD das 18–24h: R$\u00a0400/MWh",
    ] : [
      "Preço do contrato: R$180/MWh", "PLD das 18–24h: R$400/MWh",
    ]);

    const metricas = filhos(tag(nos, "dl")).filter((no): no is Elemento => "tagName" in no);
    expect(metricas.map((no) => {
      const partes = elementos(no);
      return [texto(tag(partes, "dt")), texto(tag(partes, "dd")), texto(tag(partes, "small"))];
    })).toEqual(idioma === "pt" ? [
      ["Saldo de energia do dia", "0 MWh", "1.265,1 contratados − 1.265,1 consumidos."],
      ["Débito ilustrativo no curto prazo", "R$\u00a01.250", "Soma das diferenças de cada bloco × seu PLD."],
      ["Contrato + ajuste de energia", "R$\u00a0228.961", "R$\u00a0227.711 pelo contrato; acrescenta R$\u00a01.250 no ajuste."],
    ] : [
      ["Saldo de energia do dia", "0 MWh", "1,265.1 contratados − 1,265.1 consumidos."],
      ["Débito ilustrativo no curto prazo", "R$1,250", "Soma das diferenças de cada bloco × seu PLD."],
      ["Contrato + ajuste de energia", "R$228,961", "R$227,711 pelo contrato; acrescenta R$1,250 no ajuste."],
    ]);

    const regiao = unico(nos, (no) => atributo(no, "role") === "region" && atributo(no, "aria-label") === "Cálculo por bloco, tabela com rolagem horizontal");
    expect(atributo(regiao, "tabindex")).toBe("0");
    const tabela = elementos(tag(elementos(regiao), "table"));
    expect(texto(tag(tabela, "caption"))).toBe("Cada linha reúne seis horas com PLD constante dentro do bloco. MWh são volumes do bloco, não MW. Sinal positivo no resultado = crédito do comprador.");
    expect(elementos(tag(tabela, "thead")).filter((no) => no.tagName === "th").map(texto))
      .toEqual(["Horário", "Consumo · MWh", "Contrato · MWh", "Saldo · MWh", "PLD · R$/MWh", "Resultado · R$"]);
    const linhas = elementos(tag(tabela, "tbody")).filter((no) => no.tagName === "tr");
    expect(linhas.map((linha) => elementos(linha).filter((no) => no.tagName === "th" || no.tagName === "td").map(texto)))
      .toEqual(idioma === "pt" ? [
        ["A", "1.234,6", "1.235,8", "1,3", "1.000", "R$\u00a01.250"],
        ["B", "20", "20", "0", "0", "R$\u00a00"],
        ["C", "10,5", "9,3", "-1,3", "2.000", "-R$\u00a02.500"],
        ["D", "0", "0", "0", "400", "R$\u00a00"],
      ] : [
        ["A", "1,234.6", "1,235.8", "1.3", "1,000", "R$1,250"],
        ["B", "20", "20", "0", "0", "R$0"],
        ["C", "10.5", "9.3", "-1.3", "2,000", "-R$2,500"],
        ["D", "0", "0", "0", "400", "R$0"],
      ]);
    expect(blocos).toEqual(antes);
  });
});
