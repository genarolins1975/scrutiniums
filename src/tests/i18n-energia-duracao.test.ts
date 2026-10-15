import { describe, expect, it } from "vitest";
import { textoDiferencaComSinal, textoDuracao } from "@/lib/energia/calendario";
import { rotuloAtraso, textoAtraso, type Atraso, type PrevisaoMarco } from "@/lib/energia/cronograma";
import { textoDefasagem } from "@/lib/energia/linha-do-tempo";

// Expectativas literais, sem Intl ou outro helper para construir o esperado.
// O idioma muda somente os números; unidades, prosa e estados continuam em PT.
describe("duração de Energia com idioma", () => {
  it.each([
    [{ valor: 1234, unidade: "dias" }, ["1.234 dias", "+1.234 dias"], ["1,234 dias", "+1,234 dias"]],
    [{ valor: -1234, unidade: "meses" }, ["1.234 meses", "−1.234 meses"], ["1,234 meses", "−1,234 meses"]],
    [{ valor: 1234.5678, unidade: "dias" }, ["1.234,568 dias", "+1.234,568 dias"], ["1,234.568 dias", "+1,234.568 dias"]],
    [{ valor: 1, unidade: "dias" }, ["1 dia", "+1 dia"], ["1 dia", "+1 dia"]],
    [{ valor: -1, unidade: "meses" }, ["1 mês", "−1 mês"], ["1 mês", "−1 mês"]],
    [{ valor: -0, unidade: "dias" }, ["0 dias", "0 dias"], ["0 dias", "0 dias"]],
  ] as const)("preserva valor absoluto, sinal, unidade e precisão variável de %j", (entrada, pt, en) => {
    expect([textoDuracao(entrada), textoDiferencaComSinal(entrada)]).toEqual(pt);
    expect([textoDuracao(entrada, "pt"), textoDiferencaComSinal(entrada, "pt")]).toEqual(pt);
    expect([textoDuracao(entrada, "en"), textoDiferencaComSinal(entrada, "en")]).toEqual(en);
  });

  it.each([
    [NaN, "NaN dias", "NaN dias"],
    [Infinity, "∞ dias", "+∞ dias"],
    [-Infinity, "∞ dias", "−∞ dias"],
  ] as const)("mantém a política existente de não finitos para %s", (valor, duracao, comSinal) => {
    const entrada = { valor, unidade: "dias" } as const;
    expect([textoDuracao(entrada), textoDiferencaComSinal(entrada)]).toEqual([duracao, comSinal]);
    for (const idioma of ["pt", "en"] as const) {
      expect([textoDuracao(entrada, idioma), textoDiferencaComSinal(entrada, idioma)]).toEqual([duracao, comSinal]);
    }
  });
});

const baseInicial: PrevisaoMarco = Object.freeze({ data: "2000-01", informadaEm: "1999-01-01" });
const baseFinal: PrevisaoMarco = Object.freeze({ data: "2100-01", informadaEm: "1999-01-01" });

type CasoAtraso = {
  nome: string;
  entrada: Atraso;
  pt: readonly [string, string];
  en: readonly [string, string];
};

const casosAtraso: CasoAtraso[] = [
  {
    nome: "realizado positivo",
    entrada: { estado: "realizado", base: baseInicial, comparada: "2100-01", diferenca: { valor: 1200, unidade: "meses" } },
    pt: ["+1.200 meses", "realizado com atraso de 1.200 meses sobre a data-base"],
    en: ["+1,200 meses", "realizado com atraso de 1,200 meses sobre a data-base"],
  },
  {
    nome: "realizado negativo",
    entrada: { estado: "realizado", base: baseFinal, comparada: "2000-01", diferenca: { valor: -1200, unidade: "meses" } },
    pt: ["−1.200 meses", "realizado 1.200 meses antes da data-base"],
    en: ["−1,200 meses", "realizado 1,200 meses antes da data-base"],
  },
  {
    nome: "previsto positivo",
    entrada: {
      estado: "previsto", base: baseInicial,
      comparada: { data: "2100-01", informadaEm: "2000-01-01" }, diferenca: { valor: 1200, unidade: "meses" },
    },
    pt: ["+1.200 meses (prev.)", "ainda não realizado; previsão atual 1.200 meses depois da data-base"],
    en: ["+1,200 meses (prev.)", "ainda não realizado; previsão atual 1,200 meses depois da data-base"],
  },
  {
    nome: "previsto negativo",
    entrada: {
      estado: "previsto", base: baseFinal,
      comparada: { data: "2000-01", informadaEm: "2000-01-01" }, diferenca: { valor: -1200, unidade: "meses" },
    },
    pt: ["−1.200 meses (prev.)", "ainda não realizado; previsão atual 1.200 meses antes da data-base"],
    en: ["−1,200 meses (prev.)", "ainda não realizado; previsão atual 1,200 meses antes da data-base"],
  },
];

const casosSemDeslocamento: { nome: string; entrada: Atraso; esperado: readonly [string, string] }[] = [
  {
    nome: "realizado sem deslocamento",
    entrada: { estado: "realizado", base: baseInicial, comparada: "2000-01", diferenca: { valor: 0, unidade: "meses" } },
    esperado: ["0 meses", "realizado na data prevista na data-base"],
  },
  {
    nome: "previsto sem deslocamento",
    entrada: { estado: "previsto", base: baseInicial, comparada: baseInicial, diferenca: { valor: 0, unidade: "meses" } },
    esperado: ["0 meses (prev.)", "ainda não realizado; previsão atual igual à da data-base"],
  },
  {
    nome: "sem data-base",
    entrada: { estado: "sem-data-base" },
    esperado: ["", "atraso não calculado: nenhuma data-base declarada"],
  },
  {
    nome: "sem previsão na base",
    entrada: { estado: "sem-previsao-na-base" },
    esperado: ["sem base", "atraso não calculado: não havia previsão vigente na data-base"],
  },
  {
    nome: "sem comparação",
    entrada: { estado: "sem-comparacao", base: baseInicial },
    esperado: ["sem dado", "atraso não calculado: sem data realizada nem previsão atual"],
  },
];

describe("encaminhamento do idioma no atraso", () => {
  it.each(casosAtraso)("formata rótulo e frase de $nome", ({ entrada, pt, en }) => {
    expect([rotuloAtraso(entrada), textoAtraso(entrada)]).toEqual(pt);
    expect([rotuloAtraso(entrada, "pt"), textoAtraso(entrada, "pt")]).toEqual(pt);
    expect([rotuloAtraso(entrada, "en"), textoAtraso(entrada, "en")]).toEqual(en);
  });

  it.each(casosSemDeslocamento)("preserva $nome em ambos os idiomas", ({ entrada, esperado }) => {
    expect([rotuloAtraso(entrada), textoAtraso(entrada)]).toEqual(esperado);
    for (const idioma of ["pt", "en"] as const) {
      expect([rotuloAtraso(entrada, idioma), textoAtraso(entrada, idioma)]).toEqual(esperado);
    }
  });
});

describe("encaminhamento do idioma na defasagem", () => {
  it.each([
    ["2000-01", "2100-01", "vigência 1.200 meses após a publicação", "vigência 1,200 meses após a publicação"],
    ["2100-01", "2000-01", "vigência retroativa: 1.200 meses antes da publicação", "vigência retroativa: 1,200 meses antes da publicação"],
    ["2024-03-01", "2024-03-04", "vigência 3 dias após a publicação", "vigência 3 dias após a publicação"],
    ["2024-03-04", "2024-03-01", "vigência retroativa: 3 dias antes da publicação", "vigência retroativa: 3 dias antes da publicação"],
    ["2024-03-20", "2024-05", "vigência 2 meses após a publicação", "vigência 2 meses após a publicação"],
    ["2024-03-01", "2024-03-01", "vigência na data da publicação", "vigência na data da publicação"],
    ["2024-03", "2024-03", "vigência no mês da publicação", "vigência no mês da publicação"],
    [null, "2024-03", null, null],
    ["2024-03", undefined, null, null],
    ["2024-02-30", "2024-03-01", null, null],
    ["2024-03", "2024-13", null, null],
  ] as const)("preserva unidade e ausência de %s a %s", (publicacao, vigencia, pt, en) => {
    expect(textoDefasagem(publicacao, vigencia)).toBe(pt);
    expect(textoDefasagem(publicacao, vigencia, "pt")).toBe(pt);
    expect(textoDefasagem(publicacao, vigencia, "en")).toBe(en);
  });
});
