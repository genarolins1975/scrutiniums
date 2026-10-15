import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { describe, expect, it } from "vitest";
import { EmpresasLeitura } from "@/components/energia/EmpresasLeitura";
import { AtlasInvestimento } from "@/components/energia/AtlasInvestimento";
import { LaboratorioEnergia } from "@/components/energia/ExploracaoInicial";
import { LaboratorioFlexibilidade } from "@/components/energia/LaboratorioFlexibilidade";
import type { Idioma } from "@/lib/idioma";
import type { CamadaGeo } from "@/lib/energia/geo";

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
function dd(nos: Elemento[], rotulo: string): string {
  const dt = unico(nos, (no) => no.tagName === "dt" && texto(no) === rotulo);
  if (!dt.parentNode) throw new Error(`Definição sem pai: ${rotulo}`);
  return texto(tag(elementos(dt.parentNode), "dd"));
}
const linhas = (nos: Elemento[]) => elementos(tag(nos, "tbody")).filter((no) => no.tagName === "tr")
  .map((no) => elementos(no).filter((celula) => celula.tagName === "td").map(texto));
function congelar<T extends object>(valor: T): T {
  for (const filho of Object.values(valor)) if (filho !== null && typeof filho === "object") congelar(filho);
  return Object.freeze(valor);
}
const estrutura = (nos: Elemento[]) => nos.map((no) => ({ tag: no.tagName, atributos: no.attrs.filter((a) => [
  "id", "for", "href", "value", "min", "max", "step", "checked", "selected", "aria-pressed", "aria-labelledby", "aria-describedby", "role", "tabindex",
  "d", "x", "y", "x1", "x2", "y1", "y2", "width", "height", "viewBox", "points", "style", "transform",
].includes(a.name)) }));

const empresas = congelar<ComponentProps<typeof EmpresasLeitura>>({ periodoControle: "2026-10-14", empresas: [{
  cnpj: "01083200000118", nome: "Companhia de teste", setor: "Energia elétrica", alerta: [], escala: [], distribuidora: null,
  controladoraAberta: null, controladorDireto: null, motivoControle: null, controladasAbertas: 0,
  series: { ind: [], con: [
    { ano: 2024, valores: { receita: 1000, ebit: 100, lucro_liquido: 125, caixa_operacional: 900, caixa_investimento: -100, divida_bruta: 2000, caixa: 0 } },
    { ano: 2025, valores: { receita: 2000, ebit: null, lucro_liquido: 250, caixa_operacional: 1234.56, caixa_investimento: -234.56, divida_bruta: 0, caixa: 0 } },
  ] },
}] });
const geometria = congelar<CamadaGeo>({
  camada: "uf", titulo: "Geometria sintética", fonte: "Fixture", url: "/fixture", url_nomes: "/fixture-nomes", capturado_em: "2026-10-14T12:00:00Z",
  sha256: "a".repeat(64), sha256_nomes: "b".repeat(64), bronze: "fixture",
  malha: { revisao: null, nota_liberacao: "Fixture", data_nota: null, documentacao: "Fixture", qualidade: "Fixture", formato_original: "Fixture" },
  projecao: { nome: "Fixture", paralelos_padrao: [], meridiano_central: 0, latitude_origem: 0, superficie: "Fixture", unidade_svg_m: 1, origem_m: [0, 0], eixo_y: "para baixo" },
  simplificacao: { metodo: "Fixture", tolerancia_m: 0, arcos_com_tolerancia_reduzida: 0, garantia: "Fixture" },
  viewBox: "0 0 220 100", contagem: { features: 2, poligonos: 2, poligonos_origem: 2, aneis: 2 }, conciliacao: { nomes_sem_geometria: [] },
  features: [{ id: "35", nome: "São Paulo", uf: "SP", d: "M0 0L100 0L100 100L0 100Z" },
    { id: "33", nome: "Rio de Janeiro", uf: "RJ", d: "M120 0L220 0L220 100L120 100Z" }],
});
const atlas = congelar<ComponentProps<typeof AtlasInvestimento>>({ geometria, dataSiga: "2026-10-13", dataMmgd: "2026-10-14", anoPop: 2025,
  linhas: [
    { id: "35", uf: "SP", nome: "São Paulo", operacao: 1000, construcao: 0, mmgd: 2000, whab: 1234.25, parcial: false },
    { id: "33", uf: "RJ", nome: "Rio de Janeiro", operacao: 2000, construcao: null, mmgd: 4000, whab: 2234.25, parcial: true },
  ],
});
const renderEmpresa = (idioma?: Idioma) => renderToStaticMarkup(createElement(EmpresasLeitura, { ...empresas, idioma }));
const renderAtlas = (idioma?: Idioma) => renderToStaticMarkup(createElement(AtlasInvestimento, { ...atlas, idioma }));
const renderEnergia = (idioma?: Idioma) => renderToStaticMarkup(createElement<NonNullable<ComponentProps<typeof LaboratorioEnergia>>>(LaboratorioEnergia, { idioma }));
const renderFlex = (idioma?: Idioma) => renderToStaticMarkup(createElement<NonNullable<ComponentProps<typeof LaboratorioFlexibilidade>>>(LaboratorioFlexibilidade, { idioma }));

// SSR inicial com hooks, modelos, mapa e Intl reais. Não prova seleção por
// clique, hidratação, URL após eventos ou dicas. Demanda/PUE tem arquivo próprio.
describe("leituras integradas: padrões, dados e estrutura", () => {
  it.each([
    { nome: "EmpresasLeitura", render: renderEmpresa, dados: empresas }, { nome: "AtlasInvestimento", render: renderAtlas, dados: atlas },
    { nome: "LaboratorioEnergia", render: renderEnergia, dados: {} }, { nome: "LaboratorioFlexibilidade", render: renderFlex, dados: {} },
  ])("$nome mantém default PT, geometria, controles, vínculos e dados", ({ render, dados }) => {
    const antes = structuredClone(dados);
    const pt = render();
    expect(render("pt")).toBe(pt);
    const nosPt = analisar(pt), nosEn = analisar(render("en"));
    expect(estrutura(nosEn)).toEqual(estrutura(nosPt));
    for (const nos of [nosPt, nosEn]) {
      const ids = nos.flatMap((no) => atributo(no, "id") ? [atributo(no, "id")] : []);
      expect(new Set(ids).size).toBe(ids.length);
      for (const no of nos) for (const campo of ["for", "aria-labelledby", "aria-describedby"]) {
        const valor = atributo(no, campo);
        if (valor) for (const id of valor.split(" ")) unico(nos, (destino) => atributo(destino, "id") === id);
      }
    }
    expect(dados).toEqual(antes);
  });
});

describe("EmpresasLeitura: casas fixas, contas e ausência", () => {
  it.each(["pt", "en"] as const)("localiza oito usos sem mudar as contas em %s", (idioma) => {
    const nos = analisar(renderEmpresa(idioma));
    expect(dd(nos, "Exercício 2025 · consolidado")).toBe(idioma === "pt"
      ? "Lucro/prejuízo: R$ 250,0 milhões. Caixa operacional: R$ 1.234,6 milhões."
      : "Lucro/prejuízo: R$ 250.0 milhões. Caixa operacional: R$ 1,234.6 milhões.");
    expect(dd(nos, "Operações + atividades de investimento")).toBe(idioma === "pt"
      ? "R$ 1.000,0 milhões, antes das atividades de financiamento. Essa soma não é fluxo de caixa livre padronizado."
      : "R$ 1,000.0 milhões, antes das atividades de financiamento. Essa soma não é fluxo de caixa livre padronizado.");
    expect([dd(nos, "Receita · 2025"), dd(nos, "Lucro / receita · 2025"), dd(nos, "Variação do lucro · 2025 versus 2024")])
      .toEqual(idioma === "pt" ? ["R$ 2.000,0", "12,5%", "R$ 125,0"] : ["R$ 2,000.0", "12.5%", "R$ 125.0"]);
    expect(nos.filter((no) => no.tagName === "small").map(texto)).toContain(idioma === "pt"
      ? "Milhões · 100,0% em relação a 2024." : "Milhões · 100.0% em relação a 2024.");
    expect(linhas(nos)).toEqual(idioma === "pt" ? [
      ["1.000,0", "2.000,0"], ["100,0", "Sem dado"], ["125,0", "250,0"], ["900,0", "1.234,6"],
      ["-100,0", "-234,6"], ["2.000,0", "0,0"], ["0,0", "0,0"],
    ] : [
      ["1,000.0", "2,000.0"], ["100.0", "Sem dado"], ["125.0", "250.0"], ["900.0", "1,234.6"],
      ["-100.0", "-234.6"], ["2,000.0", "0.0"], ["0.0", "0.0"],
    ]);
    expect(nos.filter((no) => no.tagName === "a").map((no) => atributo(no, "href")))
      .toContain("/setor-eletrico/empresas/financas?fin.sel=01083200000118&fin.esc=con");
  });

  it("não acrescenta guarda de finitude nem remove o sinal de zero do formatador privado", () => {
    const fixture = structuredClone(empresas);
    Object.assign(fixture.empresas[0].series.con[1].valores, { ebit: NaN, divida_bruta: Infinity, caixa: -Infinity });
    fixture.empresas[0].series.con[0].valores.caixa = -0;
    const antes = structuredClone(fixture);
    congelar(fixture);
    for (const idioma of ["pt", "en"] as const) {
      const tabela = linhas(analisar(renderToStaticMarkup(createElement(EmpresasLeitura, { ...fixture, idioma }))));
      expect([tabela[1][1], tabela[5][1], tabela[6][1]]).toEqual(["NaN", "∞", "-∞"]);
      expect(tabela[6][0]).toBe(idioma === "pt" ? "-0,0" : "-0.0");
    }
    expect(fixture).toEqual(antes);
  });

  it("preserva a ausência de companhia e de demonstração consolidada", () => {
    for (const idioma of ["pt", "en"] as const) {
      expect(texto(parseFragment(renderToStaticMarkup(createElement(EmpresasLeitura, { empresas: [], periodoControle: "2026-10-14", idioma })))))
        .toBe("Nenhuma companhia ativa disponível nesta publicação.");
      const semSerie = { ...empresas.empresas[0], series: { con: [], ind: empresas.empresas[0].series.con } };
      const nos = analisar(renderToStaticMarkup(createElement(EmpresasLeitura, { ...empresas, empresas: [semSerie], idioma })));
      expect(nos.filter((no) => no.tagName === "table")).toEqual([]);
      expect(nos.filter((no) => no.tagName === "p").map(texto)).toContain("Sem demonstração no perímetro selecionado. Experimente outro perímetro; valores individuais não substituem automaticamente os consolidados.");
    }
  });
});

describe("AtlasInvestimento: leitura local e limite do mapa", () => {
  it.each(["pt", "en"] as const)("localiza ambas as frases da mediana com no máximo uma casa em %s", (idioma) => {
    const nos = analisar(renderAtlas(idioma));
    expect(dd(nos, "Mediana das UFs")).toBe(idioma === "pt" ? "1.734,3" : "1,734.3");
    expect(nos.filter((no) => no.tagName === "p" && texto(no).startsWith("Mediana:")).map(texto)).toEqual([idioma === "pt"
      ? "Mediana: 1.734,3 W/habitante. Cada UF com dado tem o mesmo peso; 2 de 2 disponíveis. A mediana descreve a distribuição, não uma meta. Para MMGD, população de referência: 2025."
      : "Mediana: 1,734.3 W/habitante. Cada UF com dado tem o mesmo peso; 2 de 2 disponíveis. A mediana descreve a distribuição, não uma meta. Para MMGD, população de referência: 2025."]);
    expect(nos.filter((no) => no.tagName === "small").map(texto)).toContain("W/habitante · 14/10/2026");
    // O mapa compartilhado ainda não recebe idioma; sua tabela preserva PT.
    expect(nos.filter((no) => no.tagName === "td").map(texto)).toContain("1.234,3");
  });

  it.each([{ valor: 1000, pt: "1.000", en: "1,000" }, { valor: null, pt: "Sem dado", en: "Sem dado" }])
    ("não acrescenta casas mínimas ou zero à mediana $valor", ({ valor, pt, en }) => {
      const fixture = congelar({ ...atlas, linhas: atlas.linhas.map((linha) => ({ ...linha, whab: valor })) });
      const antes = structuredClone(fixture);
      for (const idioma of ["pt", "en"] as const) {
        const nos = analisar(renderToStaticMarkup(createElement(AtlasInvestimento, { ...fixture, idioma })));
        expect(dd(nos, "Mediana das UFs")).toBe(idioma === "pt" ? pt : en);
      }
      expect(fixture).toEqual(antes);
    });
});

describe("laboratórios iniciais com modelos e hooks reais", () => {
  it.each(["pt", "en"] as const)("preserva potência, energia, ARIA e os literais PT fora do recorte em %s", (idioma) => {
    const nos = analisar(renderEnergia(idioma));
    expect(nos.filter((no) => no.tagName === "output").map(texto)).toEqual(idioma === "pt" ? ["1.500 W", "3 h", "30 dias"] : ["1,500 W", "3 h", "30 dias"]);
    expect(atributo(tag(nos, "svg"), "aria-label")).toBe(idioma === "pt"
      ? "Potência de 1,5 kW por 3 horas: 4,5 kWh por dia. Escalas fixas: zero a seis kW e zero a vinte e quatro horas."
      : "Potência de 1.5 kW por 3 horas: 4.5 kWh por dia. Escalas fixas: zero a seis kW e zero a vinte e quatro horas.");
    const resultado = elementos(unico(nos, (no) => atributo(no, "aria-live") === "polite"));
    expect(texto(tag(resultado, "strong"))).toBe("135 kWh");
    expect(resultado.filter((no) => no.tagName === "p").map(texto)).toEqual(idioma === "pt"
      ? ["1,5 kW × 3 h/dia × 30 dias", "0 kWh em relação à referência de 135 kWh."]
      : ["1.5 kW × 3 h/dia × 30 dias", "0 kWh em relação à referência de 135 kWh."]);
    expect(nos.filter((no) => no.tagName === "span").map(texto)).toContain(idioma === "pt" ? "Área = 4,5 kWh/dia" : "Área = 4.5 kWh/dia");
    expect(nos.filter((no) => no.tagName === "input").map((no) => [atributo(no, "value"), atributo(no, "min"), atributo(no, "max"), atributo(no, "step")]))
      .toEqual([["1500", "100", "6000", "100"], ["3", "0.5", "24", "0.5"], ["30", "1", "31", "1"]]);
    expect(nos.filter((no) => no.tagName === "button").map(texto)).toEqual(["Restaurar referência", "Testar 1,5 h/dia"]);
    expect(nos.filter((no) => no.tagName === "p").some((no) => texto(no).includes("Referência: 1.500 W, 3 h/dia e 30 dias."))).toBe(true);
  });

  it.each(["pt", "en"] as const)("preserva balanço e cálculo da bateria, sem impor casas fixas em %s", (idioma) => {
    const nos = analisar(renderFlex(idioma));
    expect(nos.filter((no) => no.tagName === "dd").map(texto)).toEqual(idioma === "pt"
      ? ["4 horas", "235,3 MWh", "35,3 MWh"] : ["4 horas", "235.3 MWh", "35.3 MWh"]);
    const margem = unico(nos, (no) => no.tagName === "div" && filhos(no).some((filho) => "tagName" in filho && filho.tagName === "strong"));
    expect(texto(margem)).toBe(idioma === "pt"
      ? "Margem bruta de energia por ciclo: R$ 36.470,6. Receita = 200 × 300; compra = 235,3 × 100 (cálculo sem arredondar). O preço de venda que cobre somente a energia de entrada é R$ 117,6/MWh."
      : "Margem bruta de energia por ciclo: R$ 36,470.6. Receita = 200 × 300; compra = 235.3 × 100 (cálculo sem arredondar). O preço de venda que cobre somente a energia de entrada é R$ 117.6/MWh.");
    const barra = unico(nos, (no) => atributo(no, "role") === "img");
    expect(atributo(barra, "aria-label")).toBe("De toda a energia de entrada, 85% volta como energia útil e 15% se perde no ciclo.");
    expect(atributo(tag(elementos(barra), "span"), "style")).toBe("width:85%");
    expect(nos.filter((no) => no.tagName === "input").map((no) => atributo(no, "value"))).toEqual(["50", "200", "85", "100", "300"]);
    expect(nos.filter((no) => no.tagName === "button" && atributo(no, "aria-pressed") !== undefined).map((no) => atributo(no, "aria-pressed")))
      .toEqual(["true", "false"]);
  });
});
