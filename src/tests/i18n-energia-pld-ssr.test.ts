import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { describe, expect, it } from "vitest";
import { ArquivoPrevisoes } from "@/components/energia/ArquivoPrevisoes";
import { PldPeriodos, type PeriodoPld } from "@/components/energia/PldPeriodos";
import type { RegistroPrevisao } from "@/lib/energia/tipos";

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
const analisar = (html: string) => elementos(parseFragment(html));
function congelar<T extends object>(valor: T): T {
  for (const filho of Object.values(valor)) if (filho !== null && typeof filho === "object") congelar(filho);
  return Object.freeze(valor);
}
function verificarReferencias(nos: Elemento[]) {
  const ids = nos.flatMap((no) => atributo(no, "id") ? [atributo(no, "id")] : []);
  expect(new Set(ids).size).toBe(ids.length);
  for (const no of nos) for (const nome of ["aria-labelledby", "aria-describedby", "aria-controls"]) {
    const referencia = atributo(no, nome);
    if (referencia) for (const id of referencia.split(" ")) unico(nos, (destino) => atributo(destino, "id") === id);
  }
}
const vinculos = (nos: Elemento[]) => nos.map((no) => ({ tag: no.tagName, atributos: no.attrs.filter((a) =>
  ["id", "for", "aria-labelledby", "aria-describedby", "aria-controls", "aria-selected", "role", "tabindex", "href"].includes(a.name)) }))
  .filter((no) => no.atributos.length);

const registro: RegistroPrevisao = {
  forecast_id: "f1", tipo: "PUBLICACAO", run_id: "r1", origem: "2026-10-14", cutoff: "2026-10-01T02:59:00Z",
  emitido_em: "2026-10-14T12:34:56Z", registrado_no_portal_em: "2026-10-14", frequencia: "W", horizonte: "W1",
  entrega: { id: "W2026-10-17", inicio: "2026-10-17T03:00:00Z", fim: "2026-10-24T03:00:00Z" },
  submercado: "SE", modelo: "C2-P", versao_modelo: "v1", estado_modelo: "PRODUCAO", versao_codigo: "codigo1", snapshot: null,
  previsao: 1234.5678, quantis: null, calibracao: { status: "SEM_AVALIACAO" }, status: "DISPONIVEL", motivo: null,
  alertas: [], sha256: "a".repeat(64), substitui: null, motivo_correcao: null,
};
const registros = congelar<RegistroPrevisao[]>([
  registro,
  { ...registro, forecast_id: "f2", tipo: "RODADA_INTERNA", previsao: 987654.321, registrado_no_portal_em: "2026-10-15" },
  { ...registro, forecast_id: "f3", estado_modelo: "PESQUISA", previsao: 876543.219, registrado_no_portal_em: "2026-10-15" },
  { ...registro, forecast_id: "f4", emitido_em: "captura inválida", previsao: null, registrado_no_portal_em: "2026-10-15" },
]);
const renderArquivo = (props: ComponentProps<typeof ArquivoPrevisoes>) => renderToStaticMarkup(createElement(ArquivoPrevisoes, props));
const renderPeriodo = (props: ComponentProps<typeof PldPeriodos>) => renderToStaticMarkup(createElement(PldPeriodos, props));

// SSR inicial real: sem mock de hooks/componentes/Intl. Não prova mudança do filtro,
// abas, tooltip, teclado, download CSV ou hidratação; handlers permanecem fora desta prova.
describe("ArquivoPrevisoes: idioma, datas e retenção no SSR", () => {
  it("mantém default PT, vínculos e input ISO sem mutar os registros", () => {
    const antes = structuredClone(registros);
    const pt = renderArquivo({ registros });
    expect(renderArquivo({ registros, idioma: "pt" })).toBe(pt);
    const nosPt = analisar(pt);
    const nosEn = analisar(renderArquivo({ registros, idioma: "en" }));
    expect(vinculos(nosEn)).toEqual(vinculos(nosPt));
    for (const nos of [nosPt, nosEn]) {
      const input = tag(nos, "input");
      expect([atributo(input, "type"), atributo(input, "value"), atributo(input, "min"), atributo(input, "max")])
        .toEqual(["date", "2026-10-15", "2026-10-14", "2026-10-15"]);
      expect(texto(unico(nos, (no) => atributo(no, "aria-live") === "polite")))
        .toBe("4 registros no arquivo ao fim de 15/10/2026: 3 publicações e 1 registros de rodadas internas.");
    }
    expect(registros).toEqual(antes);
  });

  it.each(["pt", "en"] as const)("localiza células permitidas e preserva as duas retenções em %s", (idioma) => {
    const nos = analisar(renderArquivo({ registros, idioma }));
    const linhas = elementos(tag(nos, "tbody")).filter((no) => no.tagName === "tr").map(celulas);
    expect(linhas).toHaveLength(4);
    expect(linhas.map((l) => l[8])).toEqual(idioma === "pt" ? [
      "1.234,568", "número retido: rodada interna de modelo fora de produção", "número retido: rodada interna de modelo fora de produção", "sem número",
    ] : [
      "1,234.568", "número retido: rodada interna de modelo fora de produção", "número retido: rodada interna de modelo fora de produção", "sem número",
    ]);
    expect(linhas.map((l) => [l[2], l[3]])).toEqual(idioma === "pt" ? [
      ["14/10/2026, 09:34", "30/09/2026, 23:59"], ["14/10/2026, 09:34", "30/09/2026, 23:59"],
      ["14/10/2026, 09:34", "30/09/2026, 23:59"], ["Invalid Date", "30/09/2026, 23:59"],
    ] : [
      ["Oct 14, 2026, 09:34 AM", "Sep 30, 2026, 11:59 PM"], ["Oct 14, 2026, 09:34 AM", "Sep 30, 2026, 11:59 PM"],
      ["Oct 14, 2026, 09:34 AM", "Sep 30, 2026, 11:59 PM"], ["Invalid Date", "Sep 30, 2026, 11:59 PM"],
    ]);
    expect(linhas.map((l) => [l[0], l[1], l[4], l[5], l[6], l[7], l[9], l[10]])).toEqual([
      ["publicação", "14/10/2026", "v1 · producao", "W1", "W2026-10-17", "SE/CO", "disponível", "aaaaaaaaaaaaaaaa…"],
      ["rodada interna", "15/10/2026", "v1 · producao", "W1", "W2026-10-17", "SE/CO", "disponível", "aaaaaaaaaaaaaaaa…"],
      ["publicação", "15/10/2026", "v1 · pesquisa", "W1", "W2026-10-17", "SE/CO", "disponível", "aaaaaaaaaaaaaaaa…"],
      ["publicação", "15/10/2026", "v1 · producao", "W1", "W2026-10-17", "SE/CO", "disponível", "aaaaaaaaaaaaaaaa…"],
    ]);
    expect(texto(tag(nos, "tbody"))).not.toMatch(/987[.,]654|876[.,]543/);
  });
});

// Stats são valores recebidos, não recalculados da série de duas amostras.
const stat: PeriodoPld["stats"]["SE"] = {
  media: 1234.567, min: -1234.5, quando_min: "2026-01-01T01:00", max: 1234.5, quando_max: "2026-01-01T00:00",
  desvio_padrao: 12, permanencia: { baixa: 0.125, central: 0.12, alta: 1 }, frac_menor_valor_ano: 0.125,
};
const periodo = congelar<PeriodoPld>({
  id: "fixture", rotulo: "Período sintético", inicio: "2026-01-01T00:00", fim: "2026-01-01T01:00", nHoras: 10000,
  stats: {
    SE: stat,
    S: { ...stat, media: 12, min: -0, max: 1234.51, desvio_padrao: null, frac_menor_valor_ano: 0.12 },
    NE: { ...stat, media: NaN, min: Infinity, max: -Infinity, desvio_padrao: NaN, frac_menor_valor_ano: 0 },
    N: { ...stat, media: -0, min: 0, max: 12, desvio_padrao: Infinity, frac_menor_valor_ano: 1 },
  },
  diferenca: { horas_acima_limiar: 1200, frac_horas_acima_limiar: 0.12, maior: 1234.567, quando_maior: "2026-01-01T00:00" },
  serie: [{ x: "2026-01-01T00:00", SE: 1234.5, S: 1234.51, NE: 0, N: -100 },
    { x: "2026-01-01T01:00", SE: 1234, S: 1234.01, NE: 10, N: -90 }],
  formatoX: "hora", descricaoSerie: "Série sintética",
});
const painel = congelar<ComponentProps<typeof PldPeriodos>>({
  periodos: [periodo], limiar: 1, fonte: "Fixture", versao: "2026-10-14", ponte: { fixture: { horas: 10000, horas_separadas: 1200, frac: 0.12 } },
  regimes: [{ inicio: "2026-01-01", fim: "2026-12-31", pld_min: 1, pld_max_horario: 1234.5, pld_max_estrutural: 1000,
    ato_pld_min: null, ato_pld_max_horario: null, ato_pld_max_estrutural: null }],
});
const tabelaEstatisticas = (nos: Elemento[]) => unico(nos, (no) => no.tagName === "table"
  && elementos(no).some((filho) => filho.tagName === "caption" && texto(filho) === "Estatísticas do PLD no período por submercado"));

describe("PldPeriodos: números recebidos, gráfico e notas no SSR", () => {
  it("mantém default PT, dados, geometria, seleção e referências ARIA", () => {
    const antes = structuredClone(painel);
    const pt = renderPeriodo(painel);
    expect(renderPeriodo({ ...painel, idioma: "pt" })).toBe(pt);
    const nosPt = analisar(pt);
    const nosEn = analisar(renderPeriodo({ ...painel, idioma: "en" }));
    expect(vinculos(nosEn)).toEqual(vinculos(nosPt));
    expect(nosEn.filter((no) => no.tagName === "path").map((no) => no.attrs))
      .toEqual(nosPt.filter((no) => no.tagName === "path").map((no) => no.attrs));
    for (const nos of [nosPt, nosEn]) {
      verificarReferencias(nos);
      const aba = unico(nos, (no) => atributo(no, "role") === "tab");
      expect([atributo(aba, "id"), atributo(aba, "aria-controls"), atributo(aba, "aria-selected"), atributo(aba, "tabindex")])
        .toEqual(["pld-aba-fixture", "pld-periodo-painel", "true", "0"]);
      expect(texto(aba)).toBe("Período sintético");
      expect(nos.filter((no) => no.tagName === "summary").map(texto)).toEqual(["Dados do gráfico em tabela (2 linhas)"]);
    }
    expect(painel).toEqual(antes);
  });

  it.each(["pt", "en"] as const)("preserva precisão fixa, ASCII, ausência e percentuais variáveis em %s", (idioma) => {
    const nos = analisar(renderPeriodo({ ...painel, idioma }));
    const linhas = elementos(tabelaEstatisticas(nos)).filter((no) => no.tagName === "tbody").flatMap(elementos)
      .filter((no) => no.tagName === "tr").map(celulas);
    expect(linhas).toEqual(idioma === "pt" ? [
      ["R$\u00a01.234,57", "R$\u00a0-1.234,50", "R$\u00a01.234,50", "R$\u00a012,00", "12,5% · 12% · 100%"],
      ["Volatilidade (desvio padrão): R$\u00a012,00. Horas em faixa baixa · central · alta: 12,5% · 12% · 100%."],
      ["R$\u00a012,00", "R$\u00a0-0,00", "R$\u00a01.234,51", "R$\u00a0sem dado", "12,5% · 12% · 100%"],
      ["Volatilidade (desvio padrão): R$\u00a0sem dado. Horas em faixa baixa · central · alta: 12,5% · 12% · 100%."],
      ["R$\u00a0NaN", "R$\u00a0∞", "R$\u00a0-∞", "R$\u00a0NaN", "12,5% · 12% · 100%"],
      ["Volatilidade (desvio padrão): R$\u00a0NaN. Horas em faixa baixa · central · alta: 12,5% · 12% · 100%."],
      ["R$\u00a0-0,00", "R$\u00a00,00", "R$\u00a012,00", "R$\u00a0∞", "12,5% · 12% · 100%"],
      ["Volatilidade (desvio padrão): R$\u00a0∞. Horas em faixa baixa · central · alta: 12,5% · 12% · 100%."],
    ] : [
      ["R$\u00a01,234.57", "R$\u00a0-1,234.50", "R$\u00a01,234.50", "R$\u00a012.00", "12.5% · 12% · 100%"],
      ["Volatilidade (desvio padrão): R$\u00a012.00. Horas em faixa baixa · central · alta: 12.5% · 12% · 100%."],
      ["R$\u00a012.00", "R$\u00a0-0.00", "R$\u00a01,234.51", "R$\u00a0sem dado", "12.5% · 12% · 100%"],
      ["Volatilidade (desvio padrão): R$\u00a0sem dado. Horas em faixa baixa · central · alta: 12.5% · 12% · 100%."],
      ["R$\u00a0NaN", "R$\u00a0∞", "R$\u00a0-∞", "R$\u00a0NaN", "12.5% · 12% · 100%"],
      ["Volatilidade (desvio padrão): R$\u00a0NaN. Horas em faixa baixa · central · alta: 12.5% · 12% · 100%."],
      ["R$\u00a0-0.00", "R$\u00a00.00", "R$\u00a012.00", "R$\u00a0∞", "12.5% · 12% · 100%"],
      ["Volatilidade (desvio padrão): R$\u00a0∞. Horas em faixa baixa · central · alta: 12.5% · 12% · 100%."],
    ]);
  });

  it.each(["pt", "en"] as const)("encaminha contagens, ponte, pico, sobreposição, marco e eixo em %s", (idioma) => {
    const nos = analisar(renderPeriodo({ ...painel, idioma }));
    const painelDom = unico(nos, (no) => atributo(no, "role") === "tabpanel");
    const cabecalho = unico(filhos(painelDom).filter((no): no is Elemento => "tagName" in no),
      (no) => no.tagName === "p" && texto(no).startsWith("01/01/2026"));
    expect(texto(cabecalho)).toBe(idioma === "pt"
      ? "01/01/2026 00h a 01/01/2026 01h · 10.000 horas · Série sintética"
      : "01/01/2026 00h a 01/01/2026 01h · 10,000 horas · Série sintética");
    const respostas = elementos(tag(elementos(painelDom), "dl")).filter((no) => no.tagName === "dd");
    expect(respostas).toHaveLength(3);
    const textoDireto = (no: Elemento) => filhos(no).filter((filho) => !("tagName" in filho)).map(texto).join("");
    expect(textoDireto(respostas[0])).toBe(idioma === "pt"
      ? "Sim, em 1.200 horas (12%) a diferença entre o maior e o menor preço da hora passou de R$\u00a01,00/MWh. Maior diferença: R$\u00a01.234,57/MWh em 01/01/2026 00h."
      : "Sim, em 1,200 horas (12%) a diferença entre o maior e o menor preço da hora passou de R$\u00a01.00/MWh. Maior diferença: R$\u00a01,234.57/MWh em 01/01/2026 00h.");
    expect(textoDireto(respostas[1])).toBe(idioma === "pt"
      ? "SE/CO 12,5% · S 12% · NE 0% · N 100% das 10.000 horas do período."
      : "SE/CO 12.5% · S 12% · NE 0% · N 100% das 10,000 horas do período.");
    expect(texto(respostas[2])).toBe(idioma === "pt"
      ? "Máximo no Sudeste/Centro-Oeste: R$\u00a01.234,50/MWh em 01/01/2026 00h, igual ao teto horário vigente na data (R$\u00a01.234,50/MWh)."
      : "Máximo no Sudeste/Centro-Oeste: R$\u00a01,234.50/MWh em 01/01/2026 00h, igual ao teto horário vigente na data (R$1,234.50/MWh).");
    expect(texto(unico(nos, (no) => atributo(no, "data-texto") === "criterio-da-diferenca"))).toBe(idioma === "pt"
      ? "Aqui conta só a hora em que o maior e o menor preço diferem em mais de R$\u00a01,00/MWh. A página Diferenças regionais conta toda hora com diferença acima de R$\u00a00,01/MWh: neste período, 1.200 horas de 10.000 (12,0%). Abrir Diferenças regionais."
      : "Aqui conta só a hora em que o maior e o menor preço diferem em mais de R$1.00/MWh. A página Diferenças regionais conta toda hora com diferença acima de R$0.01/MWh: neste período, 1,200 horas de 10,000 (12.0%). Abrir Diferenças regionais.");
    expect(texto(unico(nos, (no) => no.tagName === "p" && texto(no).startsWith("Sudeste/Centro-Oeste e Sul")))).toBe(idioma === "pt"
      ? "Sudeste/Centro-Oeste e Sul ficaram a no máximo R$\u00a00,01/MWh um do outro em todos os pontos deste período: no gráfico, as linhas se sobrepõem. Os valores de cada um estão na tabela."
      : "Sudeste/Centro-Oeste e Sul ficaram a no máximo R$\u00a00.01/MWh um do outro em todos os pontos deste período: no gráfico, as linhas se sobrepõem. Os valores de cada um estão na tabela.");
    const svg = unico(nos, (no) => no.tagName === "svg" && atributo(no, "data-svg-grafico") !== undefined);
    const textosSvg = elementos(svg).filter((no) => no.tagName === "text").map(texto);
    expect(textosSvg).toContain(idioma === "pt" ? "1.000" : "1,000");
    expect(textosSvg).toContain(idioma === "pt" ? "máximo horário do SE/CO: 1.234,50" : "máximo horário do SE/CO: 1,234.50");
  });
});
