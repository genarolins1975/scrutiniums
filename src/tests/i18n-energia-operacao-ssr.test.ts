import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { describe, expect, it } from "vitest";
import { BarrasMix } from "@/components/energia/BarrasMix";
import { MapaSubmercados } from "@/components/energia/MapaSubmercados";
import { RedeBalanco } from "@/components/energia/RedeBalanco";
import { LaboratorioContratos } from "@/components/energia/ComercializacaoDidatica";
import { ContaReferencias } from "@/components/energia/ContaReferencias";
import type { Idioma } from "@/lib/idioma";

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
const celulas = (linha: Elemento) => elementos(linha).filter((no) => no.tagName === "td").map(texto);
const linhas = (tabela: Elemento) => elementos(tag(elementos(tabela), "tbody")).filter((no) => no.tagName === "tr");
function congelar<T extends object>(valor: T): T {
  for (const filho of Object.values(valor)) if (filho !== null && typeof filho === "object") congelar(filho);
  return Object.freeze(valor);
}
const geometria = (nos: Elemento[]) => nos.filter((no) => ["svg", "path", "rect", "line", "circle", "polygon"].includes(no.tagName))
  .map((no) => ({ tag: no.tagName, atributos: no.attrs.filter((a) => [
    "d", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "width", "height", "viewBox", "points", "stroke-width", "marker-end", "opacity", "transform",
  ].includes(a.name)) }));
const vinculos = (nos: Elemento[]) => nos.map((no) => ({ tag: no.tagName, atributos: no.attrs.filter((a) => [
  "id", "for", "aria-labelledby", "aria-describedby", "aria-controls", "role", "tabindex", "href", "value", "checked", "aria-pressed",
].includes(a.name)) })).filter((no) => no.atributos.length);
function referencias(nos: Elemento[]) {
  const ids = nos.flatMap((no) => atributo(no, "id") ? [atributo(no, "id")] : []);
  expect(new Set(ids).size).toBe(ids.length);
  for (const no of nos) for (const nome of ["for", "aria-labelledby", "aria-describedby"]) {
    const valor = atributo(no, nome);
    if (valor) for (const id of valor.split(" ")) unico(nos, (destino) => atributo(destino, "id") === id);
  }
}

const mix = congelar<ComponentProps<typeof BarrasMix>>({ tabela: true, linhas: [
  { rotulo: "Normal", destaque: true, detalhe: "Fixture", mix: {
    inicio: "2026-10-01", fim: "2026-10-14", total_mwmed: 10000.25, hes: 0,
    mwmed: { hidraulica: 5000.5678, termica: 2000, eolica: 2000, solar: 999.6822 },
    participacao: { hidraulica: 60.25, termica: 29.75, eolica: 5.5, solar: 4.5 },
  } },
  { rotulo: "Zero", mix: { inicio: "2026-10-01", fim: "2026-10-14", total_mwmed: 0, hes: 0,
    mwmed: { hidraulica: 0, termica: 0, eolica: 0, solar: 0 }, participacao: { hidraulica: 6.25, termica: 0, eolica: 93.75, solar: 0 } } },
  { rotulo: "Ausente", mix: null },
] });
const mapa = congelar<ComponentProps<typeof MapaSubmercados>>({
  diaFluxo: "14/10/2026", diaPreco: "13/10/2026", precos: { N: 1234.567, NE: 0, SE: -1234.5, S: null },
  fluxos: [{ de: "N", para: "NE", fluxo: -1234.56 }, { de: "SE", para: "S", fluxo: 2500 },
    { de: "NE", para: "SE", fluxo: 0 }, { de: "N", para: "SE", fluxo: null }],
});

// Uma identidade e dois meses ativam os cinco gráficos. As horas mensais são
// inteiras e cabem no calendário; o eixo de [0, 2] distingue 0,5 de 0.5.
const mensal: ComponentProps<typeof RedeBalanco>["balanco"]["mensal"]["por_sm"]["SIN"] = {
  geracao_mwh: [10000, 14000], carga_mwh: [10000, 10000], intercambio_mwh: [0, 0], residuo_balanco_mwh: [0, 4000],
  intercambio_perimetro_mwh: [0, 0], fronteiras_exterior_mwh: [0, 0], residuo_perimetro_mwh: [0, 0],
  horas: [744, 672], horas_completas: [744, 672], horas_residuo_balanco: [0, 2], horas_perimetro: [744, 672], horas_residuo_perimetro: [0, 0],
};
const paisAusente: ComponentProps<typeof RedeBalanco>["exterior"]["por_pais"]["URUGUAI"] = {
  exportacao_mwh: [null, null], importacao_mwh: [null, null], horas: [null, null], horas_com_fluxo: [null, null],
  programado_liquido_mwh: [null, null], ultima_hora: null, ultima_hora_com_fluxo: null,
};
const resumoAusente: ComponentProps<typeof RedeBalanco>["exterior"]["resumo_12m"]["URUGUAI"] = {
  meses: null, horas: 0, exportacao_mwh: null, importacao_mwh: null, horas_com_fluxo: null,
};
const rede = congelar<ComponentProps<typeof RedeBalanco>>({
  balanco: {
    tolerancia_mwmed: 1234.5678, faixas_mwmed: [1, 10, 100], quebras: [],
    identidades: [{ id: "balanco.SIN", identidade: "balanco", sm: "SIN", descricao: "Fixture", horas: 1416, horas_fecham: 1414,
      horas_entre_0_01_e_tolerancia: 0, horas_residuo: 2, horas_residuo_por_ano: { "2026": 2 }, horas_acima: { "1": 2, "10": 2, "100": 2 },
      horas_residuo_igual_menos_exterior: 0, dias_residuo_igual_menos_exterior: [], maior_residuo_mwmed: 2000,
      maior_residuo_em: "2026-02-01T00:00", periodos: [], n_periodos: 0, primeira_hora_residuo: "2026-02-01T00:00", ultima_hora_residuo: "2026-02-01T01:00" }],
    mensal: { meses: ["2026-01", "2026-02"], mmgd_estimada: ["com", "com"], por_sm: { SIN: mensal, SE: mensal, S: mensal, NE: mensal, N: mensal } },
  },
  exterior: {
    meses: ["2026-01", "2026-02"],
    por_pais: {
      ARGENTINA: { exportacao_mwh: [1000, 2000], importacao_mwh: [0, 1000], horas: [744, 672], horas_com_fluxo: [1, 2],
        programado_liquido_mwh: [null, null], ultima_hora: "2026-02-28T23:00", ultima_hora_com_fluxo: "2026-02-28T22:00" },
      URUGUAI: paisAusente, PARAGUAI: paisAusente,
    },
    resumo_12m: { ARGENTINA: { meses: ["2026-01", "2026-02"], horas: 1416, exportacao_mwh: 3000, importacao_mwh: 1000, horas_com_fluxo: 3 },
      URUGUAI: resumoAusente, PARAGUAI: resumoAusente },
    itaipu: { total_mwh: [1000, 2000], brasil_mwh: [750, 1500], nao_brasil_mwh: [250, 500], horas: [744, 672] },
  },
  periodo: { inicio: "2026-01-01", fim: "2026-02-28" }, fonte: "Fixture", versao: "2026-10-15",
});

// Custos pré-computados de cinco pontos: quartis são os pontos 2 e 4,
// mediana é o ponto 3; tarifa × 200/1000 coincide com cada custo.
const conta = congelar<ComponentProps<typeof ContaReferencias>>({
  referencias: { perfil: 200, n: 5,
    menor: { cnpj: "a", sigla: "Alfa", valor: 1000.25, tarifa: 5001.25, posicao: 1 },
    maior: { cnpj: "e", sigla: "Épsilon", valor: 3000.25, tarifa: 15001.25, posicao: 5 },
    mediana: 2000.25, p25: 1500.25, p75: 2500.25,
    tarifa: { menor: 5001.25, p25: 7501.25, mediana: 10001.25, p75: 12501.25, maior: 15001.25 } },
  destaques: [{ cnpj: "c", sigla: "Gama", valor: 2000.25, tarifa: 10001.25, posicao: 3, n: 5, diferenca: 0 }],
  pontos: [{ id: "a", rotulo: "Alfa", valor: 1000.25 }, { id: "b", rotulo: "Beta", valor: 1500.25 },
    { id: "c", rotulo: "Gama", valor: 2000.25 }, { id: "d", rotulo: "Delta", valor: 2500.25 }, { id: "e", rotulo: "Épsilon", valor: 3000.25 }],
});
const renderMix = (idioma?: Idioma) => renderToStaticMarkup(createElement(BarrasMix, { ...mix, idioma }));
const renderMapa = (idioma?: Idioma) => renderToStaticMarkup(createElement(MapaSubmercados, { ...mapa, idioma }));
const renderRede = (idioma?: Idioma) => renderToStaticMarkup(createElement(RedeBalanco, { ...rede, idioma }));
const renderConta = (idioma?: Idioma) => renderToStaticMarkup(createElement(ContaReferencias, { ...conta, idioma }));
const renderLab = (idioma?: Idioma) => renderToStaticMarkup(createElement<NonNullable<ComponentProps<typeof LaboratorioContratos>>>(LaboratorioContratos, { idioma }));

// Prova do SSR inicial, sem mocks. Não cobre interação, hidratação, URL,
// download, resize ou tooltip. ContaGradeDica tem uma prova DOM separada.
describe("defaults e estrutura dos cinco componentes operacionais", () => {
  it.each([
    { nome: "BarrasMix", render: renderMix, dados: mix }, { nome: "MapaSubmercados", render: renderMapa, dados: mapa },
    { nome: "RedeBalanco", render: renderRede, dados: rede }, { nome: "ContaReferencias", render: renderConta, dados: conta },
    { nome: "LaboratorioContratos", render: renderLab, dados: {} },
  ])("$nome mantém PT omitido/expresso, geometria, controles e dados", ({ render, dados }) => {
    const antes = structuredClone(dados);
    const pt = render();
    expect(render("pt")).toBe(pt);
    const nosPt = analisar(pt);
    const nosEn = analisar(render("en"));
    expect(geometria(nosEn)).toEqual(geometria(nosPt));
    expect(vinculos(nosEn)).toEqual(vinculos(nosPt));
    referencias(nosPt);
    referencias(nosEn);
    expect(dados).toEqual(antes);
  });
});

describe("BarrasMix: participação publicada, razão visual e tabela", () => {
  it.each(["pt", "en"] as const)("mantém as duas origens do percentual e precisão de cada superfície em %s", (idioma) => {
    const nos = analisar(renderMix(idioma));
    const barras = nos.filter((no) => atributo(no, "role") === "img");
    expect(barras).toHaveLength(2);
    expect(atributo(barras[0], "aria-label")).toBe(idioma === "pt"
      ? "Normal: Hidráulica 60,25%, Térmica 29,75%, Eólica 5,5%, Solar 4,5%"
      : "Normal: Hidráulica 60.25%, Térmica 29.75%, Eólica 5.5%, Solar 4.5%");
    const segmentos = filhos(barras[0]).filter((no): no is Elemento => "tagName" in no);
    expect(segmentos.map(texto)).toEqual(["50%", "20%", "", ""]);
    expect(segmentos.map((no) => atributo(no, "style"))).toEqual([
      "width:60.25%;background:var(--serie-hidraulica)", "width:29.75%;background:var(--serie-termica)",
      "width:5.5%;background:var(--serie-eolica)", "width:4.5%;background:var(--serie-solar)",
    ]);
    expect(segmentos.map((no) => atributo(no, "title"))).toEqual(idioma === "pt" ? [
      "Hidráulica: 60,25% · 5.000,568 MWmed", "Térmica: 29,75% · 2.000 MWmed", "Eólica: 5,5% · 2.000 MWmed", "Solar: 4,5% · 999,682 MWmed",
    ] : [
      "Hidráulica: 60.25% · 5,000.568 MWmed", "Térmica: 29.75% · 2,000 MWmed", "Eólica: 5.5% · 2,000 MWmed", "Solar: 4.5% · 999.682 MWmed",
    ]);
    const zero = filhos(barras[1]).filter((no): no is Elemento => "tagName" in no);
    expect(zero.map(texto)).toEqual(["6%", "", "94%", ""]);
    expect(atributo(zero[0], "title")).toBe(idioma === "pt" ? "Hidráulica: 6,25% · 0 MWmed" : "Hidráulica: 6.25% · 0 MWmed");
    expect(linhas(tag(nos, "table")).map(celulas)).toEqual(idioma === "pt" ? [
      ["Normal", "60,3", "29,8", "5,5", "4,5", "10.000"], ["Zero", "6,3", "0,0", "93,8", "0,0", "0"],
      ["Ausente", "sem dado", "sem dado", "sem dado", "sem dado", "sem dado"],
    ] : [
      ["Normal", "60.3", "29.8", "5.5", "4.5", "10,000"], ["Zero", "6.3", "0.0", "93.8", "0.0", "0"],
      ["Ausente", "sem dado", "sem dado", "sem dado", "sem dado", "sem dado"],
    ]);
    expect(texto(unico(nos, (no) => no.tagName === "p" && texto(no) === "sem dado para esta janela"))).toBe("sem dado para esta janela");
  });
});

describe("MapaSubmercados: lista, SVG e nome acessível", () => {
  it.each(["pt", "en"] as const)("localiza três superfícies e mantém direção/zero/ausência em %s", (idioma) => {
    const nos = analisar(renderMapa(idioma));
    const svg = tag(nos, "svg");
    expect(atributo(svg, "aria-label")).toBe(idioma === "pt"
      ? "Fluxos médios de 14/10/2026: Nordeste para Norte: 1.235 MWmed; Sudeste/Centro-Oeste para Sul: 2.500 MWmed; Nordeste para Sudeste/Centro-Oeste: 0 MWmed; Norte e Sudeste/Centro-Oeste: sem dado. PLD médio de 13/10/2026: Norte R$ 1.234,57, Nordeste R$ 0,00, Sudeste/Centro-Oeste R$ -1.234,50, Sul R$ sem dado."
      : "Fluxos médios de 14/10/2026: Nordeste para Norte: 1,235 MWmed; Sudeste/Centro-Oeste para Sul: 2,500 MWmed; Nordeste para Sudeste/Centro-Oeste: 0 MWmed; Norte e Sudeste/Centro-Oeste: sem dado. PLD médio de 13/10/2026: Norte R$ 1,234.57, Nordeste R$ 0.00, Sudeste/Centro-Oeste R$ -1,234.50, Sul R$ sem dado.");
    const precos = unico(nos, (no) => no.tagName === "ul" && atributo(no, "aria-label") === "PLD médio de 13/10/2026, R$/MWh");
    expect(elementos(precos).filter((no) => no.tagName === "p" && atributo(no, "class")?.includes("tabular-nums")).map(texto))
      .toEqual(idioma === "pt" ? ["R$\u00a01.234,57", "R$\u00a00,00", "R$\u00a0-1.234,50", "R$\u00a0sem dado"]
        : ["R$\u00a01,234.57", "R$\u00a00.00", "R$\u00a0-1,234.50", "R$\u00a0sem dado"]);
    const fluxos = unico(nos, (no) => no.tagName === "ul" && atributo(no, "aria-label") === "Fluxos médios de 14/10/2026");
    expect(elementos(fluxos).filter((no) => no.tagName === "span" && atributo(no, "class") === "whitespace-nowrap tabular-nums").map(texto))
      .toEqual(idioma === "pt" ? ["1.235 MWmed", "2.500 MWmed", "0 MWmed"] : ["1,235 MWmed", "2,500 MWmed", "0 MWmed"]);
    expect(elementos(svg).filter((no) => no.tagName === "text" && atributo(no, "class") === "tabular-nums").map(texto)).toEqual(idioma === "pt"
      ? ["1.235 MWmed", "2.500 MWmed", "0 MWmed", "sem dado", "R$ 1.234,57", "R$ 0,00", "R$ -1.234,50", "R$ sem dado"]
      : ["1,235 MWmed", "2,500 MWmed", "0 MWmed", "sem dado", "R$ 1,234.57", "R$ 0.00", "R$ -1,234.50", "R$ sem dado"]);
    const setas = elementos(svg).filter((no) => no.tagName === "line");
    expect(setas.map((no) => [atributo(no, "marker-end"), atributo(no, "opacity")])).toEqual([
      ["url(#seta)", "0.9"], ["url(#seta)", "0.9"], ["url(#seta)", "0.9"], [undefined, "0.3"],
    ]);
    expect(Number(atributo(setas[0], "x1"))).toBeGreaterThan(Number(atributo(setas[0], "x2")));
  });

  it("preserva a guarda textual de preços não finitos sem inventar geometria de fluxo inválido", () => {
    for (const idioma of ["pt", "en"] as const) {
      const nos = analisar(renderToStaticMarkup(createElement(MapaSubmercados, { ...mapa, idioma, precos: { N: NaN, NE: Infinity, SE: -Infinity, S: null } })));
      const precos = unico(nos, (no) => no.tagName === "ul" && atributo(no, "aria-label") === "PLD médio de 13/10/2026, R$/MWh");
      expect(elementos(precos).filter((no) => no.tagName === "p" && atributo(no, "class")?.includes("tabular-nums")).map(texto))
        .toEqual(["R$\u00a0sem dado", "R$\u00a0sem dado", "R$\u00a0sem dado", "R$\u00a0sem dado"]);
    }
  });
});

describe("RedeBalanco: cinco componentes gráficos reais e estado inicial", () => {
  const grafico = (nos: Elemento[], titulo: string) => unico(nos, (no) => no.tagName === "svg"
    && atributo(no, "data-svg-grafico") !== undefined
    && nos.some((destino) => atributo(destino, "id") === atributo(no, "aria-labelledby")
      && texto(destino) === (atributo(no, "role") === "group" ? titulo : `${titulo}. Use as setas para percorrer os pontos.`)));
  const eixoY = (svg: Elemento) => elementos(svg).filter((no) => no.tagName === "text"
    && atributo(no, "text-anchor") === "end" && atributo(no, "font-size") === "12"
    && atributo(no, "fill") === "var(--cor-mineral)").map(texto);

  it.each(["pt", "en"] as const)("propaga locale aos cinco gráficos, incluindo ticks fracionários de horas em %s", (idioma) => {
    const nos = analisar(renderRede(idioma));
    // Barras horizontal tem dois SVGs: eixo separado e corpo acessível.
    expect(nos.filter((no) => no.tagName === "svg" && atributo(no, "data-svg-grafico") !== undefined)).toHaveLength(6);
    const barras = grafico(nos, "Horas em que cada conta fecha e horas com resíduo, SIN");
    expect(atributo(barras, "role")).toBe("group");
    const barra = unico(elementos(barras), (no) => no.tagName === "g" && atributo(no, "data-id") === "balanco.SIN");
    expect(atributo(barra, "aria-label")).toBe(idioma === "pt"
      ? "Balanço interno: Fecha (até a tolerância) 1.414\u00a0horas; Com resíduo 2\u00a0horas; total 1.416\u00a0horas"
      : "Balanço interno: Fecha (até a tolerância) 1,414\u00a0horas; Com resíduo 2\u00a0horas; total 1,416\u00a0horas");
    const eixoBarras = unico(nos, (no) => no.tagName === "svg" && atributo(no, "data-svg-grafico") !== undefined && atributo(no, "aria-hidden") === "true");
    expect(elementos(eixoBarras).filter((no) => no.tagName === "text").map(texto)).toContain(idioma === "pt" ? "1.000" : "1,000");
    expect(eixoY(grafico(nos, "Resíduo mensal do balanço interno e do perímetro, SIN"))).toEqual(idioma === "pt"
      ? ["0", "1.000", "2.000", "3.000", "4.000"] : ["0", "1,000", "2,000", "3,000", "4,000"]);
    expect(eixoY(grafico(nos, "Horas com resíduo no balanço interno, por mês"))).toEqual(idioma === "pt"
      ? ["0,0", "0,5", "1,0", "1,5", "2,0"] : ["0.0", "0.5", "1.0", "1.5", "2.0"]);
    for (const titulo of ["Exportação e importação mensais com a Argentina", "Geração de Itaipu por mês"]) {
      expect(eixoY(grafico(nos, titulo))).toEqual(idioma === "pt"
        ? ["0", "500", "1.000", "1.500", "2.000"] : ["0", "500", "1,000", "1,500", "2,000"]);
    }
  });

  it.each(["pt", "en"] as const)("mantém duas precisões da tolerância, rádios e a fronteira PT das tabelas em %s", (idioma) => {
    const nos = analisar(renderRede(idioma));
    const explicacao = unico(nos, (no) => no.tagName === "p" && texto(no).startsWith("Há duas contas por região:"));
    expect(texto(explicacao).endsWith(idioma === "pt"
      ? "Resíduo é a diferença maior que 1.234,6 MWmed numa hora, sem causa atribuída."
      : "Resíduo é a diferença maior que 1,234.6 MWmed numa hora, sem causa atribuída.")).toBe(true);
    const unidade = unico(nos, (no) => no.tagName === "dd" && texto(no).startsWith("Horas (contagem por conta conferida,"));
    expect(texto(unidade)).toBe(idioma === "pt"
      ? "Horas (contagem por conta conferida, tolerância de 1.234,568 MWmed por hora); MWh nas somas mensais"
      : "Horas (contagem por conta conferida, tolerância de 1,234.568 MWmed por hora); MWh nas somas mensais");
    expect(nos.filter((no) => no.tagName === "input" && atributo(no, "type") === "radio" && atributo(no, "checked") !== undefined)
      .map((no) => atributo(no, "value"))).toEqual(["SIN", "ARGENTINA"]);
    // Colunas e tabelas de domínio ainda não recebem idioma neste recorte.
    expect(nos.filter((no) => no.tagName === "th").map(texto)).toContain("Horas que fecham (até 1.234,6 MWmed)↕");
    expect(nos.filter((no) => no.tagName === "summary").map(texto)).not.toContain("Ajustar início e fim");
  });
});

describe("LaboratorioContratos: exemplo original com modelo e hooks reais", () => {
  it.each(["pt", "en"] as const)("mantém as quatro linhas, métricas e controles padrão em %s", (idioma) => {
    const nos = analisar(renderLab(idioma));
    expect(linhas(tag(nos, "table")).map(celulas)).toEqual(idioma === "pt" ? [
      ["10", "25", "15", "100", "R$\u00a01.500"], ["30", "25", "-5", "200", "-R$\u00a01.000"],
      ["20", "25", "5", "50", "R$\u00a0250"], ["40", "25", "-15", "400", "-R$\u00a06.000"],
    ] : [
      ["10", "25", "15", "100", "R$1,500"], ["30", "25", "-5", "200", "-R$1,000"],
      ["20", "25", "5", "50", "R$250"], ["40", "25", "-15", "400", "-R$6,000"],
    ]);
    expect(nos.filter((no) => no.tagName === "dd").map(texto)).toEqual(idioma === "pt"
      ? ["0 MWh", "R$\u00a05.250", "R$\u00a023.250"] : ["0 MWh", "R$5,250", "R$23,250"]);
    expect(nos.filter((no) => no.tagName === "label").map(texto)).toEqual(idioma === "pt"
      ? ["Preço do contrato: R$\u00a0180/MWh", "PLD das 18–24h: R$\u00a0400/MWh"]
      : ["Preço do contrato: R$180/MWh", "PLD das 18–24h: R$400/MWh"]);
    expect(nos.filter((no) => no.tagName === "input").map((no) => [atributo(no, "value"), atributo(no, "min"), atributo(no, "max"), atributo(no, "step")]))
      .toEqual([["180", "0", "1000", "10"], ["400", "0", "1000", "10"]]);
    expect(nos.filter((no) => no.tagName === "button" && atributo(no, "aria-pressed") !== undefined).map((no) => atributo(no, "aria-pressed")))
      .toEqual(["true", "false"]);
  });
});

describe("ContaReferencias: callback real, quartis e limites de propagação", () => {
  const pontosSvg = (nos: Elemento[]) => tag(elementos(unico(nos, (no) => atributo(no, "data-grafico") === "pontos")), "svg");
  const descricaoPt = "Custo de 200 kWh por mês, só pela tarifa B1 residencial: menor R$\u00a01.000,25 (Alfa), mediana R$\u00a02.000,25 e maior R$\u00a03.000,25 (Épsilon), entre 5 distribuidoras; a metade central das distribuidoras fica entre R$\u00a01.500,25 e R$\u00a02.500,25. Cada ponto é uma distribuidora.";

  it.each(["pt", "en"] as const)("localiza títulos reais dos pontos, marca, faixa, legenda e tabela em %s", (idioma) => {
    const nos = analisar(renderConta(idioma));
    const svg = pontosSvg(nos);
    expect(texto(unico(nos, (no) => atributo(no, "data-titulo-grafico") === "true"))).toBe("As 5 distribuidoras para 200 kWh/mês, em R$/mês");
    const pontos = elementos(svg).filter((no) => no.tagName === "g" && atributo(no, "data-id") !== undefined);
    expect(pontos.map((no) => [atributo(no, "data-id"), atributo(no, "data-ponto")])).toEqual([
      ["a", "extremo"], ["b", "ponto"], ["c", "losango"], ["d", "ponto"], ["e", "extremo"],
    ]);
    expect(pontos.map((no) => texto(tag(elementos(no), "title")))).toEqual(idioma === "pt" ? [
      "Alfa: R$\u00a01.000,25", "Beta: R$\u00a01.500,25", "Gama: R$\u00a02.000,25", "Delta: R$\u00a02.500,25", "Épsilon: R$\u00a03.000,25",
    ] : ["Alfa: R$1,000.25", "Beta: R$1,500.25", "Gama: R$2,000.25", "Delta: R$2,500.25", "Épsilon: R$3,000.25"]);
    const faixa = unico(elementos(svg), (no) => no.tagName === "rect" && elementos(no).some((filho) => filho.tagName === "title"));
    expect(texto(tag(elementos(faixa), "title"))).toBe(idioma === "pt"
      ? "Do 1º ao 3º quartil: R$\u00a01.500,25 a R$\u00a02.500,25" : "Do 1º ao 3º quartil: R$1,500.25 a R$2,500.25");
    expect(elementos(svg).filter((no) => no.tagName === "text").map(texto)).toContain(idioma === "pt" ? "Mediana R$\u00a02.000,25" : "Mediana R$2,000.25");
    const legenda = unico(nos, (no) => no.tagName === "ul" && atributo(no, "aria-label") === "Legenda");
    expect(texto(unico(elementos(legenda), (no) => no.tagName === "li" && texto(no).includes("a metade central")))).toBe(idioma === "pt"
      ? "do 1º ao 3º quartil, a metade central (R$\u00a01.500,25 a R$\u00a02.500,25)"
      : "do 1º ao 3º quartil, a metade central (R$1,500.25 a R$2,500.25)");
    expect(linhas(tag(nos, "table")).map(celulas)).toEqual(idioma === "pt" ? [
      ["1.000,25", "5.001,25"], ["1.500,25", "7.501,25"], ["2.000,25", "10.001,25"],
      ["2.500,25", "12.501,25"], ["3.000,25", "15.001,25"], ["2.000,25", "10.001,25"],
    ] : [
      ["1,000.25", "5,001.25"], ["1,500.25", "7,501.25"], ["2,000.25", "10,001.25"],
      ["2,500.25", "12,501.25"], ["3,000.25", "15,001.25"], ["2,000.25", "10,001.25"],
    ]);
    // Estes três consumidores ainda têm contrato PT, inclusive no render EN.
    expect(atributo(svg, "aria-label")).toBe(descricaoPt);
    expect(elementos(svg).filter((no) => no.tagName === "text" && atributo(no, "class") === "tabular-nums").map(texto)).toContain("1.000");
    expect(texto(unico(nos, (no) => atributo(no, "data-destaques-perfil") !== undefined)))
      .toBe("Gama: R$\u00a02.000,25, posição 3 de 5 (1 é a menor tarifa); igual à mediana.");
    expect(texto(tag(nos, "summary"))).toBe("Dados do gráfico em tabela (6 linhas)");
  });

  it.each(["menor", "maior", "mediana"] as const)("preserva guarda de %s ausente, controle e resposta sem criar gráfico", (ausente) => {
    for (const idioma of ["pt", "en"] as const) {
      const nos = analisar(renderToStaticMarkup(createElement(ContaReferencias, { ...conta, idioma,
        referencias: { ...conta.referencias, [ausente]: null }, controle: createElement("span", { "data-sentinela": "controle" }, "Controle recebido"),
        resposta: createElement("span", { "data-sentinela": "resposta" }, "Resposta recebida"),
      })));
      expect(texto(unico(nos, (no) => atributo(no, "role") === "status")))
        .toBe("Sem referências do custo de 200 kWh por mês nesta publicação: nenhuma distribuidora tem tarifa B1 residencial vigente na data.");
      expect(nos.filter((no) => atributo(no, "data-sentinela") !== undefined).map(texto)).toEqual(["Controle recebido", "Resposta recebida"]);
      expect(nos.some((no) => atributo(no, "data-grafico") === "pontos" || no.tagName === "table")).toBe(false);
    }
  });

  it("mantém quartis ausentes como sem dado e preserva os ReactNodes fornecidos", () => {
    for (const idioma of ["pt", "en"] as const) {
      const nos = analisar(renderToStaticMarkup(createElement(ContaReferencias, { ...conta, idioma,
        referencias: { ...conta.referencias, p25: null, p75: null, tarifa: { ...conta.referencias.tarifa, p25: null, p75: null } },
        controle: createElement("span", { "data-sentinela": "controle" }, "Controle"), resposta: createElement("span", { "data-sentinela": "resposta" }, "Resposta"),
        seletor: createElement("span", { "data-sentinela": "seletor" }, "Seletor"), selecionadas: createElement("span", { "data-sentinela": "selecionadas" }, "Selecionadas"),
      })));
      expect(nos.filter((no) => atributo(no, "data-sentinela") !== undefined).map(texto)).toEqual(["Controle", "Resposta", "Seletor", "Selecionadas"]);
      expect(elementos(pontosSvg(nos)).some((no) => no.tagName === "title" && texto(no).startsWith("Do 1º ao 3º quartil"))).toBe(false);
      const dados = linhas(tag(nos, "table")).map(celulas);
      expect([dados[1], dados[3]]).toEqual([["sem dado", "sem dado"], ["sem dado", "sem dado"]]);
    }
  });

  it("agrupa mil linhas numa fixture só de contagem, separada da geometria e do ranking", () => {
    // Não representa um ranking nem uma seleção real: isola 5 referências +
    // 995 linhas adicionais. A fixture curta acima prova a relação dos pontos.
    const destaques = congelar(Array.from({ length: 995 }, (_, i) => ({ ...conta.destaques[0], cnpj: `d${i}`, sigla: `D${i}` })));
    for (const idioma of ["pt", "en"] as const) {
      const nos = analisar(renderToStaticMarkup(createElement(ContaReferencias, { ...conta, idioma, destaques, pontos: [] })));
      expect(texto(tag(nos, "summary"))).toBe(idioma === "pt" ? "Dados do gráfico em tabela (1.000 linhas)" : "Dados do gráfico em tabela (1,000 linhas)");
      expect(linhas(tag(nos, "table"))).toHaveLength(1000);
    }
    expect(destaques).toHaveLength(995);
    expect(destaques.every((d) => d.valor === 2000.25 && d.tarifa === 10001.25)).toBe(true);
  });
});
