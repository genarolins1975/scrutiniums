import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { describe, expect, it } from "vitest";
import { QualidadeTabela } from "@/components/energia/QualidadeTabela";
import { QualidadeMapa } from "@/components/energia/QualidadeMapa";
import { QualidadeConjuntosDoMunicipio } from "@/components/energia/QualidadeConjuntosDoMunicipio";
import { InclusaoOrcamentoPainel } from "@/components/energia/InclusaoOrcamento";
import { horasEMinutos } from "@/lib/energia/qualidade";
import type { OrcamentoBase } from "@/lib/energia/inclusao";
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
function congelar<T extends object>(valor: T): T {
  for (const filho of Object.values(valor)) if (filho !== null && typeof filho === "object") congelar(filho);
  return Object.freeze(valor);
}
const estrutura = (nos: Elemento[]) => nos.map((no) => ({ tag: no.tagName, atributos: no.attrs.filter((a) => [
  "id", "for", "href", "value", "min", "max", "step", "checked", "selected", "aria-pressed", "aria-labelledby", "aria-describedby", "role", "tabindex",
  "d", "x", "y", "x1", "x2", "y1", "y2", "width", "height", "viewBox", "points", "style", "transform", "data-id", "data-serie", "data-categoria", "data-estado",
].includes(a.name)) }));

const mapa = congelar<ComponentProps<typeof QualidadeMapa>>({ ano: 2025, urlMunicipios: "/fixture/municipios.csv", urlSerie: "/fixture/serie.json",
  distribuidoras: [{ cnpj: "00000000000001", rotulo: "Distribuidora Alfa" }, { cnpj: "00000000000002", rotulo: "Distribuidora Beta" }],
  regra: "Regra sintética de atribuição.", totalMunicipios: 1234, fonte: "Fixture", versao: "2025" });
const conjuntos = congelar<ComponentProps<typeof QualidadeConjuntosDoMunicipio>>({ ano: 2025, codigoMunicipio: "1100001", municipio: "Município Alfa (RO)",
  codigos: Array.from({ length: 1003 }, (_, i) => String(i + 1).padStart(5, "0")), fonte: "Fixture", tamanho: "2 kB" });

// Estimativas sintéticas pré-computadas, tipadas e congeladas; nenhuma gold escrita.
const classes = congelar<OrcamentoBase>({ referencia: "POF sintética", formato_microdados: "Fixture de apresentação",
  classes: [{ codigo: "47558", rotulo: "Até R$ 1.908", inferior: null, superior: 1908 }, { codigo: "7999", rotulo: "Todas as famílias", inferior: null, superior: null }],
  medidas: [{ id: "razao_medias_pct", rotulo: "Razão de médias" }, { id: "media_razoes_desp_pct", rotulo: "Média das participações" }, { id: "mediana_desp_pct", rotulo: "Mediana das participações" }],
  medidas_uf: ["razao_medias_pct"], limiares_pct: [3.25, 5, 10], sensibilidade_media_razoes_renda: {}, regra_precisao: { cautela_cv_pct: 15, suprime_cv_pct: 30 },
  linhas: [
    { territorio: "BR", nome: "Brasil", classe: "47558", classe_rotulo: "Até R$ 1.908", n_amostra: 2, familias: 100,
      sidra: { energia_media: null, despesa_media: null, distribuicao_pct: null, cv_energia_ibge_pct: null },
      microdados: { razao_medias_pct: [1.25, 1, "publicado"], media_razoes_desp_pct: [2.5, 1, "publicado"], mediana_desp_pct: [null, 40, "suprimido"],
        acima_5_renda_pct: [2.54, 1, "publicado"], acima_5_desp_pct: [7.04, 1, "publicado"] } },
    { territorio: "BR", nome: "Brasil", classe: "7999", classe_rotulo: "Todas as famílias", n_amostra: 4, familias: 200,
      sidra: { energia_media: null, despesa_media: null, distribuicao_pct: null, cv_energia_ibge_pct: null },
      microdados: { razao_medias_pct: [2, 1, "publicado"], acima_5_renda_pct: [0, null, "zero_na_amostra"], acima_5_desp_pct: [null, 40, "suprimido"] } },
  ] });
const ufs = congelar<OrcamentoBase>({ ...classes, linhas: [{ ...classes.linhas[1], territorio: "SP", nome: "São Paulo", microdados: { razao_medias_pct: [2.5, 1, "publicado"] } }] });
const slots = { resposta: createElement("p", { "data-slot": "resposta" }, "Resposta 1.234,50"), medidas: createElement("p", { "data-slot": "medidas" }, "Medidas 2.345,60"),
  recorte: createElement("p", { "data-slot": "recorte" }, "Recorte 3.456,70"), notas: createElement("p", { "data-slot": "notas" }, "Notas 4.567,80") };
const renderInclusao = (idioma?: Idioma) => renderToStaticMarkup(createElement(InclusaoOrcamentoPainel, { classes, ufs, fonte: "Fixture", periodo: "2017-2018", unidadeReais: "R$ de referência", ...slots, idioma }));

describe("horas e minutos: arredondamento e formatos", () => {
  it.each([
    { h: 9.33, pt: "9 h 20 min", en: "9 h 20 min" }, { h: 0.75, pt: "45 min", en: "45 min" },
    { h: 0.999, pt: "1 h", en: "1 h" }, { h: 1482, pt: "1.482 h", en: "1,482 h" },
    { h: 1482.5, pt: "1.482 h 30 min", en: "1,482 h 30 min" }, { h: 0, pt: "0 min", en: "0 min" }, { h: -0, pt: "0 min", en: "0 min" },
  ])("preserva a quantidade e o default PT para $h", ({ h, pt, en }) => {
    expect(horasEMinutos(h)).toBe(pt);
    expect(horasEMinutos(h, "pt")).toBe(pt);
    expect(horasEMinutos(h, "en")).toBe(en);
  });
  it.each([null, undefined, NaN, Infinity, -Infinity, -1])("mantém a ausência para %s", (h) => {
    expect(horasEMinutos(h)).toBe("sem dado");
    expect(horasEMinutos(h, "pt")).toBe("sem dado");
    expect(horasEMinutos(h, "en")).toBe("sem dado");
  });
});

// SSR real inicial: sem execução de efeitos/fetch, clique, hidratação ou troca de
// idioma na mesma raiz. Os estados carregados de Qualidade têm prova de browser.
describe("Qualidade: contagens antes do carregamento", () => {
  it.each([{ n: 1234, pt: "1.234 linhas", en: "1,234 linhas" }, { n: 1, pt: "1 linha", en: "1 linha" }, { n: 0, pt: "0 linhas", en: "0 linhas" }])
    ("formata $n linhas sem abrir a tabela", ({ n, pt, en }) => {
      const render = (idioma?: Idioma) => renderToStaticMarkup(createElement(QualidadeTabela, { tabela: "dist-p051", titulo: "Fixture", linhas: n, idioma }));
      expect(render()).toBe(render("pt"));
      for (const idioma of ["pt", "en"] as const) {
        const nos = analisar(render(idioma)), botao = tag(nos, "button");
        expect(atributo(botao, "type")).toBe("button");
        expect(texto(tag(nos, "span"))).toBe("Tabela");
        expect(filhos(botao).filter((no) => no.nodeName === "#text").map(texto).join(""))
          .toBe(`Abrir: Fixture (${idioma === "pt" ? pt : en}, com busca, filtros e exportação)`);
        expect(nos.filter((no) => no.tagName === "table")).toEqual([]);
      }
    });

  it("preserva o mapa adiado, quatro opções e a ausência do total", () => {
    const antes = structuredClone(mapa);
    const render = (idioma?: Idioma, totalMunicipios = mapa.totalMunicipios) => renderToStaticMarkup(createElement(QualidadeMapa, { ...mapa, totalMunicipios, idioma }));
    expect(render()).toBe(render("pt"));
    const pt = analisar(render("pt")), en = analisar(render("en"));
    expect(estrutura(en)).toEqual(estrutura(pt));
    for (const [idioma, nos] of [["pt", pt], ["en", en]] as const) {
      expect(texto(unico(nos, (no) => no.tagName === "p" && texto(no).startsWith("O mapa ")))).toBe(idioma === "pt"
        ? "O mapa dos 1.234 municípios do cadastro do IBGE usa a malha municipal do IBGE e o arquivo de municípios deste painel; os dois só são baixados quando o mapa aparece na tela."
        : "O mapa dos 1,234 municípios do cadastro do IBGE usa a malha municipal do IBGE e o arquivo de municípios deste painel; os dois só são baixados quando o mapa aparece na tela.");
      expect(texto(tag(nos, "button"))).toBe("Carregar o mapa");
      expect(nos.filter((no) => no.tagName === "input").map((no) => [atributo(no, "value"), atributo(no, "checked")]))
        .toEqual([["dec_max", ""], ["dec_min", undefined], ["fec_max", undefined], ["fec_min", undefined]]);
      expect(nos.filter((no) => no.tagName === "svg" || atributo(no, "data-conjuntos-do-municipio") !== undefined)).toEqual([]);
      const semTotal = analisar(render(idioma, null));
      expect(texto(unico(semTotal, (no) => no.tagName === "p" && texto(no).startsWith("O mapa "))))
        .toBe("O mapa usa a malha municipal do IBGE e o arquivo de municípios deste painel; os dois só são baixados quando o mapa aparece na tela.");
    }
    expect(mapa).toEqual(antes);
  });

  it("preserva a contagem dos códigos, singular e vazio, sem alegar resultado do fetch", () => {
    const antes = structuredClone(conjuntos);
    const render = (idioma?: Idioma, codigos = conjuntos.codigos) => renderToStaticMarkup(createElement(QualidadeConjuntosDoMunicipio, { ...conjuntos, codigos, idioma }));
    expect(render()).toBe(render("pt"));
    for (const idioma of ["pt", "en"] as const) {
      const nos = analisar(render(idioma));
      expect(texto(tag(nos, "h5"))).toBe(idioma === "pt" ? "Os 1.003 conjuntos que atendem Município Alfa (RO), com o limite de cada um" : "Os 1,003 conjuntos que atendem Município Alfa (RO), com o limite de cada um");
      expect(texto(unico(nos, (no) => atributo(no, "role") === "status"))).toBe("Carregando os valores dos conjuntos (2 kB, o mesmo do explorador de Analisar)…");
      expect(nos.filter((no) => no.tagName === "table")).toEqual([]);
      const singular = analisar(render(idioma, ["00001"]));
      expect(texto(tag(singular, "h5"))).toBe("O conjunto que atende Município Alfa (RO), com o limite de cada um");
      expect(texto(unico(singular, (no) => atributo(no, "role") === "status"))).toBe("Carregando os valores dos conjunto (2 kB, o mesmo do explorador de Analisar)…");
      expect(render(idioma, [])).toBe("");
    }
    expect(conjuntos).toEqual(antes);
  });
});

describe("Inclusão: dois gráficos no estado BR padrão, com modelos e hooks reais", () => {
  it("mantém default PT, dados, slots, controles, geometria e referências DOM", () => {
    const antes = structuredClone({ classes, ufs });
    const pt = renderInclusao();
    expect(renderInclusao("pt")).toBe(pt);
    const nosPt = analisar(pt), nosEn = analisar(renderInclusao("en"));
    expect(estrutura(nosEn)).toEqual(estrutura(nosPt));
    for (const nos of [nosPt, nosEn]) {
      expect(nos.filter((no) => atributo(no, "data-slot") !== undefined).map(texto)).toEqual(["Resposta 1.234,50", "Medidas 2.345,60", "Recorte 3.456,70", "Notas 4.567,80"]);
      expect(nos.filter((no) => no.tagName === "input" && atributo(no, "type") === "radio" && atributo(no, "checked") !== undefined).map((no) => atributo(no, "value")))
        .toEqual(["despesa", "5", "razao_medias_pct"]);
      const ids = nos.flatMap((no) => atributo(no, "id") ? [atributo(no, "id")] : []);
      expect(new Set(ids).size).toBe(ids.length);
      for (const no of nos) for (const campo of ["for", "aria-labelledby", "aria-describedby"]) {
        const valor = atributo(no, campo);
        if (valor) for (const id of valor.split(" ")) unico(nos, (destino) => atributo(destino, "id") === id);
      }
    }
    expect({ classes, ufs }).toEqual(antes);
  });

  it.each(["pt", "en"] as const)("propaga %s a classes e limiares com suas precisões, sem habilitar o terceiro gráfico", (idioma) => {
    const nos = analisar(renderInclusao(idioma));
    const graficos = nos.filter((no) => atributo(no, "data-grafico") === "barras");
    expect(graficos).toHaveLength(2);
    const corpos = graficos.map((grafico) => {
      const dentro = elementos(grafico);
      expect(dentro.filter((no) => no.tagName === "svg" && atributo(no, "data-svg-grafico") !== undefined)).toHaveLength(2);
      return unico(dentro, (no) => no.tagName === "svg" && atributo(no, "role") === "group");
    });
    expect(corpos.map((corpo) => texto(tag(elementos(corpo), "title")))).toEqual([
      "Energia elétrica na despesa total por classe de rendimento, Brasil (POF sintética)", "Famílias com energia acima de 5% da renda e da despesa total, Brasil",
    ]);
    const classe = unico(elementos(corpos[0]), (no) => atributo(no, "data-id") === "47558");
    expect(elementos(classe).filter((no) => no.tagName === "text" && atributo(no, "class") === "tabular-nums").map(texto))
      .toEqual(idioma === "pt" ? ["1,25", "2,50", "sem dado"] : ["1.25", "2.50", "sem dado"]);
    expect(atributo(classe, "aria-label")).toBe(idioma === "pt"
      ? "Até R$ 1.908: Razão de médias 1,25%; Média das participações 2,50%; Mediana das participações sem dado"
      : "Até R$ 1.908: Razão de médias 1.25%; Média das participações 2.50%; Mediana das participações sem dado");
    expect(elementos(corpos[0]).filter((no) => atributo(no, "data-referencia") !== undefined).map((no) => atributo(no, "data-referencia")))
      .toEqual(["Razão de médias, todas as famílias (Brasil)"]);
    const grupos = elementos(corpos[1]).filter((no) => atributo(no, "data-id") !== undefined);
    expect(grupos.map((grupo) => elementos(grupo).filter((no) => no.tagName === "text" && atributo(no, "class") === "tabular-nums").map(texto)))
      .toEqual(idioma === "pt" ? [["2,5", "7,0"], ["0,0", "sem dado"]] : [["2.5", "7.0"], ["0.0", "sem dado"]]);
    expect(atributo(grupos[0], "aria-label")).toBe(idioma === "pt"
      ? "Até R$ 1.908: Acima de 5% da renda 2,5\u00a0% das famílias; Acima de 5% da despesa 7,0\u00a0% das famílias"
      : "Até R$ 1.908: Acima de 5% da renda 2.5\u00a0% das famílias; Acima de 5% da despesa 7.0\u00a0% das famílias");
    expect(elementos(grupos[1]).filter((no) => atributo(no, "data-estado") === "zero").map((no) => atributo(no, "data-serie"))).toEqual(["renda"]);
    expect(nos.filter((no) => no.tagName === "p").map(texto)).toContain("Escolha mais um território para ver as classes de rendimento lado a lado, na mesma escala. A figura principal, acima, segue o primeiro território escolhido.");
    expect(texto(unico(nos, (no) => no.tagName === "p" && texto(no).startsWith("Limiares de ")))).toBe(idioma === "pt"
      ? "Limiares de 3,25%, 5%, 10% da renda e da despesa total como análise de sensibilidade, não como definição de pobreza energética: a leitura muda com o limiar, e a tabela mostra quanto. Brasil, famílias de cada classe acima do limiar escolhido."
      : "Limiares de 3.25%, 5%, 10% da renda e da despesa total como análise de sensibilidade, não como definição de pobreza energética: a leitura muda com o limiar, e a tabela mostra quanto. Brasil, famílias de cada classe acima do limiar escolhido.");
  });
});
