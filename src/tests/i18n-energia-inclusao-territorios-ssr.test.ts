import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { describe, expect, it, vi } from "vitest";
import type { DefinirEstadoUrl, OpcoesEstadoUrl } from "@/components/energia/useEstadoUrl";
import type { Esquema, ValoresDe } from "@/lib/energia/estadoUrl";
import type { OrcamentoBase } from "@/lib/energia/inclusao";
import type { EstimativaPof, LinhaPof } from "@/lib/energia/tipos-inclusao";
import type { Idioma } from "@/lib/idioma";

// Entrada SSR injetada e validada pelo parser/hook reais. Não prova clique,
// caller de produção, sincronização de URL, hidratação, zoom, tooltip ou rerender.
vi.mock("@/components/energia/useEstadoUrl", async (original) => {
  const modulo = await original<typeof import("@/components/energia/useEstadoUrl")>();
  function useEstadoUrl<E extends Esquema>(esquema: E, opcoes: OpcoesEstadoUrl = {}): [ValoresDe<E>, DefinirEstadoUrl<ValoresDe<E>>] {
    return modulo.useEstadoUrl(esquema, { ...opcoes, buscaInicial: "?pof.ter=BR,RG-SE" });
  }
  return { ...modulo, useEstadoUrl };
});

import { InclusaoOrcamentoPainel } from "@/components/energia/InclusaoOrcamento";

type Props = ComponentProps<typeof InclusaoOrcamentoPainel>;
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
function congelar<T extends object>(valor: T): T {
  for (const filho of Object.values(valor)) if (filho !== null && typeof filho === "object") congelar(filho);
  return Object.freeze(valor);
}
const estimativa = (valor: number | null): EstimativaPof => valor === null
  ? [null, 40, "suprimido"] : valor === 0 ? [0, 0, "zero_na_amostra"] : [valor, 1, "publicado"];
function linha(territorio: string, nome: string, classe: string, microdados: LinhaPof["microdados"]): LinhaPof {
  return { territorio, nome, classe, classe_rotulo: classe === "7999" ? "Total" : "Até R$ 1.908",
    n_amostra: 100, familias: 1000, microdados,
    sidra: { energia_media: null, despesa_media: null, distribuicao_pct: null, cv_energia_ibge_pct: null } };
}

// Valores de apresentação pré-computados, sem recálculo amostral ou escrita em gold.
const definicao: Omit<OrcamentoBase, "linhas"> = {
  referencia: "POF sintética", formato_microdados: "Fixture de apresentação",
  classes: [{ codigo: "47558", rotulo: "Até R$ 1.908", inferior: null, superior: 1908 },
    { codigo: "7999", rotulo: "Total", inferior: null, superior: null }],
  medidas: [{ id: "razao_medias_pct", rotulo: "Razão de médias" },
    { id: "media_razoes_desp_pct", rotulo: "Média das participações" },
    { id: "mediana_desp_pct", rotulo: "Mediana das participações" },
    { id: "acima_5_renda_pct", rotulo: "Acima de 5% da renda" },
    { id: "acima_5_desp_pct", rotulo: "Acima de 5% da despesa" }],
  medidas_uf: ["razao_medias_pct"], limiares_pct: [3.25, 5, 10],
  regra_precisao: { cautela_cv_pct: 15, suprime_cv_pct: 30 }, sensibilidade_media_razoes_renda: {},
};
const classes = congelar<OrcamentoBase>({ ...definicao, linhas: [
  linha("BR", "Brasil", "47558", { razao_medias_pct: estimativa(1.25), media_razoes_desp_pct: estimativa(2.5),
    mediana_desp_pct: estimativa(null), acima_5_renda_pct: estimativa(2.54), acima_5_desp_pct: estimativa(7.04) }),
  linha("BR", "Brasil", "7999", { razao_medias_pct: estimativa(2), acima_5_renda_pct: estimativa(0), acima_5_desp_pct: estimativa(null) }),
  linha("RG-SE", "Sudeste", "47558", { razao_medias_pct: estimativa(3.75) }),
  linha("RG-SE", "Sudeste", "7999", { razao_medias_pct: estimativa(4) }),
] });
const ufs = congelar<OrcamentoBase>({ ...definicao, classes: [definicao.classes[1]],
  medidas: [definicao.medidas[0]], linhas: [linha("SP", "São Paulo", "7999", { razao_medias_pct: estimativa(2.5) })] });
const slots = ["resposta", "medidas", "recorte", "notas"] as const;
const sentinela = (nome: string) => createElement("p", { "data-slot": nome }, `${nome}: 1,25`);
const props: Props = Object.freeze({ classes, ufs, fonte: "Fonte sintética", periodo: "2017-2018", unidadeReais: "R$",
  resposta: sentinela("resposta"), medidas: sentinela("medidas"), recorte: sentinela("recorte"), notas: sentinela("notas") });
const renderizar = (idioma?: Idioma) => renderToStaticMarkup(createElement(InclusaoOrcamentoPainel, idioma === undefined ? props : { ...props, idioma }));
const analisar = (html: string) => elementos(parseFragment(html));
const graficos = (nos: Elemento[]) => nos.filter((no) => atributo(no, "data-grafico") === "barras");
const corpo = (grafico: Elemento) => unico(elementos(grafico), (no) => no.tagName === "svg" && atributo(no, "role") === "group" && atributo(no, "data-svg-grafico") !== undefined);
const categorias = (grafico: Elemento) => elementos(corpo(grafico)).filter((no) => no.tagName === "g" && atributo(no, "data-id") !== undefined);
const pontas = (categoria: Elemento) => elementos(categoria).filter((no) => no.tagName === "text" && atributo(no, "class") === "tabular-nums").map(texto);

describe("Inclusão: três gráficos com territórios definidos na entrada SSR", () => {
  it("mantém PT omitido e preserva geometria, controles, IDs e dados entre idiomas", () => {
    const antes = structuredClone({ classes, ufs });
    const pt = renderizar("pt");
    expect(renderizar()).toBe(pt);
    const nosPt = analisar(pt), nosEn = analisar(renderizar("en"));
    const geometria = (nos: Elemento[]) => graficos(nos).map((grafico) => elementos(grafico)
      .filter((no) => ["svg", "path", "rect", "line", "circle", "polygon", "polyline", "text", "tspan"].includes(no.tagName))
      .map((no) => ({ tag: no.tagName, atributos: no.attrs.filter((a) => [
        "viewBox", "d", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "points", "width", "height",
        "transform", "fill", "stroke", "stroke-width", "stroke-dasharray", "text-anchor", "font-size",
      ].includes(a.name)) })));
    expect(graficos(nosPt)).toHaveLength(3);
    expect(geometria(nosEn)).toEqual(geometria(nosPt));
    const controles = (nos: Elemento[]) => nos.filter((no) => ["input", "button", "select", "option"].includes(no.tagName))
      .map((no) => ({ tag: no.tagName, atributos: no.attrs, texto: texto(no) }));
    expect(controles(nosEn)).toEqual(controles(nosPt));
    const vinculos = (nos: Elemento[]) => nos.map((no) => ({ tag: no.tagName, atributos: no.attrs
      .filter((a) => ["id", "for", "aria-labelledby", "aria-describedby", "aria-controls"].includes(a.name)) }))
      .filter((no) => no.atributos.length > 0);
    expect(vinculos(nosEn)).toEqual(vinculos(nosPt));
    expect({ classes, ufs }).toEqual(antes);
  });

  it.each(["pt", "en"] as const)("encaminha %s às pontas e ao ARIA dos três corpos reais", (idioma) => {
    const antes = structuredClone({ classes, ufs });
    const nos = analisar(renderizar(idioma));
    const figuras = graficos(nos);
    expect(figuras).toHaveLength(3);
    const [classesGrafico, territoriosGrafico, limiaresGrafico] = figuras;
    expect(figuras.map((grafico) => {
      const svg = corpo(grafico);
      const titulo = unico(elementos(svg), (no) => no.tagName === "title");
      expect(atributo(svg, "aria-labelledby")).toBe(atributo(titulo, "id"));
      expect(elementos(grafico).filter((no) => atributo(no, "id") === atributo(svg, "aria-describedby"))).toHaveLength(1);
      const marcados = elementos(grafico).filter((no) => no.tagName === "svg" && atributo(no, "data-svg-grafico") !== undefined);
      expect(marcados).toHaveLength(2);
      expect(marcados.filter((no) => atributo(no, "aria-hidden") === "true")).toHaveLength(1);
      return texto(titulo);
    })).toEqual([
      "Energia elétrica na despesa total por classe de rendimento, Brasil (POF sintética)",
      "Razão de médias na despesa total por classe: Brasil, Sudeste",
      "Famílias com energia acima de 5% da renda e da despesa total, Brasil",
    ]);
    for (const [id, grafico] of [["territorios", territoriosGrafico], ["limiares", limiaresGrafico]] as const) {
      const secao = unico(nos, (no) => atributo(no, "id") === id);
      expect(unico(elementos(secao), (no) => atributo(no, "data-grafico") === "barras")).toBe(grafico);
    }
    expect(figuras.map((grafico) => categorias(grafico).map((no) => atributo(no, "data-id"))))
      .toEqual([["47558"], ["47558"], ["47558", "7999"]]);
    expect(figuras.map((grafico) => categorias(grafico).map((no) => atributo(no, "aria-label")))).toEqual(idioma === "pt" ? [
      ["Até R$ 1.908: Razão de médias 1,25%; Média das participações 2,50%; Mediana das participações sem dado"],
      ["Até R$ 1.908: Brasil 1,25%; Sudeste 3,75%"],
      ["Até R$ 1.908: Acima de 5% da renda 2,5\u00a0% das famílias; Acima de 5% da despesa 7,0\u00a0% das famílias",
        "Total: Acima de 5% da renda 0,0\u00a0% das famílias; Acima de 5% da despesa sem dado"],
    ] : [
      ["Até R$ 1.908: Razão de médias 1.25%; Média das participações 2.50%; Mediana das participações sem dado"],
      ["Até R$ 1.908: Brasil 1.25%; Sudeste 3.75%"],
      ["Até R$ 1.908: Acima de 5% da renda 2.5\u00a0% das famílias; Acima de 5% da despesa 7.0\u00a0% das famílias",
        "Total: Acima de 5% da renda 0.0\u00a0% das famílias; Acima de 5% da despesa sem dado"],
    ]);
    expect(figuras.map((grafico) => categorias(grafico).map(pontas))).toEqual(idioma === "pt"
      ? [[["1,25", "2,50", "sem dado"]], [["1,25", "3,75"]], [["2,5", "7,0"], ["0,0", "sem dado"]]]
      : [[["1.25", "2.50", "sem dado"]], [["1.25", "3.75"]], [["2.5", "7.0"], ["0.0", "sem dado"]]]);
    const legendaClasses = unico(elementos(classesGrafico), (no) => no.tagName === "ul" && atributo(no, "aria-label") === "Legenda");
    expect(elementos(legendaClasses).filter((no) => no.tagName === "li").map(texto)).toEqual([
      "Razão de médias", "Média das participações", "Mediana das participações",
      idioma === "pt" ? "Razão de médias, todas as famílias (Brasil): 2,00%" : "Razão de médias, todas as famílias (Brasil): 2.00%",
      "sem dado (ausência, não zero)", "Valores em %",
    ]);
    expect(elementos(corpo(classesGrafico)).filter((no) => atributo(no, "data-estado") === "sem-dado")).toHaveLength(1);
    const totalLimiar = categorias(limiaresGrafico)[1];
    expect(elementos(totalLimiar).filter((no) => atributo(no, "data-estado") === "sem-dado")).toHaveLength(1);
    expect(atributo(unico(elementos(totalLimiar), (no) => atributo(no, "data-estado") === "zero"), "data-serie")).toBe("renda");
    const selecionadas = unico(nos, (no) => no.tagName === "ul" && atributo(no, "aria-label") === "Selecionadas para comparação");
    expect(elementos(selecionadas).filter((no) => no.tagName === "li").map((no) => atributo(no, "data-id"))).toEqual(["BR", "RG-SE"]);
    for (const [nome, valores] of [["inclusao-pof-base", [["despesa", ""], ["renda", undefined]]],
      ["inclusao-pof-lim", [["3", undefined], ["5", ""], ["10", undefined]]]] as const) {
      expect(nos.filter((no) => no.tagName === "input" && atributo(no, "name") === nome)
        .map((no) => [atributo(no, "value"), atributo(no, "checked")])).toEqual(valores);
    }
    expect(nos.filter((no) => atributo(no, "data-slot") !== undefined).map((no) => [atributo(no, "data-slot"), texto(no)]))
      .toEqual(slots.map((nome) => [nome, `${nome}: 1,25`]));
    expect({ classes, ufs }).toEqual(antes);
    expect(props.classes).toBe(classes);
    expect(props.ufs).toBe(ufs);
  });
});
