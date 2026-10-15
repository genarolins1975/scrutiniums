import { describe, expect, it } from "vitest";
import { n as nHabitacao } from "@/lib/eficiencia/habitacao/modelo";
import { n as nJustica } from "@/lib/eficiencia/justica/modelo";
import { valor as valorMobilidade } from "@/lib/eficiencia/mobilidade/modelo";
import { n as nSaneamento, formatar as formatarSaneamento, type Indicador } from "@/lib/eficiencia/saneamento/modelo";

// Esperados literais: números mudam de apresentação; unidades e ausência seguem PT.
type CasoNumero = { nome: string; valor: number | null; casas?: number; pt: string; en: string };
const CASOS_NUMERO: readonly Readonly<CasoNumero>[] = Object.freeze(([
  { nome: "agrupamento e casas omitidas", valor: 1234.56, pt: "1.235", en: "1,235" },
  { nome: "duas casas fixas", valor: 1234.5, casas: 2, pt: "1.234,50", en: "1,234.50" },
  { nome: "negativo com duas casas", valor: -1234.5, casas: 2, pt: "-1.234,50", en: "-1,234.50" },
  { nome: "três casas sem regra do decimal comum", valor: 1234.5, casas: 3, pt: "1.234,500", en: "1,234.500" },
  { nome: "zero informado", valor: 0, casas: 2, pt: "0,00", en: "0.00" },
  { nome: "zero negativo", valor: -0, casas: 2, pt: "-0,00", en: "-0.00" },
  { nome: "arredondamento nativo sem Math.round", valor: -0.5, pt: "-1", en: "-1" },
  { nome: "ausência", valor: null, casas: 2, pt: "Não informado", en: "Não informado" },
  { nome: "NaN preservado", valor: NaN, casas: 2, pt: "NaN", en: "NaN" },
  { nome: "infinidade positiva", valor: Infinity, casas: 2, pt: "∞", en: "∞" },
  { nome: "infinidade negativa", valor: -Infinity, casas: 2, pt: "-∞", en: "-∞" },
] satisfies CasoNumero[]).map((caso) => Object.freeze(caso)));

const FORMATADORES_NUMERO = Object.freeze([
  Object.freeze({ nome: "Habitação", formatar: nHabitacao }),
  Object.freeze({ nome: "Justiça", formatar: nJustica }),
  Object.freeze({ nome: "Saneamento OBEE", formatar: nSaneamento }),
]);

describe.each(FORMATADORES_NUMERO)("$nome: n com idioma", ({ formatar }) => {
  it.each(CASOS_NUMERO)("$nome", ({ valor, casas, pt, en }) => {
    const implicito = casas === undefined ? formatar(valor) : formatar(valor, casas);
    expect(implicito).toBe(pt);
    expect(formatar(valor, casas, "pt")).toBe(pt);
    expect(formatar(valor, casas, "en")).toBe(en);
  });
});

type CasoMobilidade = { nome: string; valor: number | null; unidade?: string; pt: string; en: string };
const CASOS_MOBILIDADE: readonly Readonly<CasoMobilidade>[] = Object.freeze(([
  { nome: "máximo de duas casas sem unidade", valor: 1234.567, pt: "1.234,57", en: "1,234.57" },
  { nome: "unidade literal sem preencher casas", valor: 1234.5, unidade: "pessoas", pt: "1.234,5 pessoas", en: "1,234.5 pessoas" },
  { nome: "moeda no sufixo com espaço comum", valor: 1234.5, unidade: "R$", pt: "1.234,50 R$", en: "1,234.50 R$" },
  { nome: "moeda negativa", valor: -1234.5, unidade: "R$", pt: "-1.234,50 R$", en: "-1,234.50 R$" },
  { nome: "zero monetário", valor: 0, unidade: "R$", pt: "0,00 R$", en: "0.00 R$" },
  { nome: "zero monetário negativo", valor: -0, unidade: "R$", pt: "-0,00 R$", en: "-0.00 R$" },
  { nome: "percentual sem validar ou limitar a observação", valor: 1234.56, unidade: "%", pt: "1.234,6%", en: "1,234.6%" },
  { nome: "percentual inteiro sem casa mínima", valor: 12, unidade: "%", pt: "12%", en: "12%" },
  { nome: "ausência com unidade vazia explícita", valor: null, unidade: "", pt: "Não disponível", en: "Não disponível" },
  { nome: "ausência monetária", valor: null, unidade: "R$", pt: "Não disponível", en: "Não disponível" },
  { nome: "ausência percentual", valor: null, unidade: "%", pt: "Não disponível", en: "Não disponível" },
  { nome: "NaN monetário preservado", valor: NaN, unidade: "R$", pt: "NaN R$", en: "NaN R$" },
  { nome: "infinidade percentual", valor: Infinity, unidade: "%", pt: "∞%", en: "∞%" },
  { nome: "infinidade negativa sem unidade", valor: -Infinity, pt: "-∞", en: "-∞" },
] satisfies CasoMobilidade[]).map((caso) => Object.freeze(caso)));

describe("Mobilidade OBEE: precisão variável e unidade literal", () => {
  it.each(CASOS_MOBILIDADE)("$nome", ({ valor, unidade, pt, en }) => {
    const implicito = unidade === undefined ? valorMobilidade(valor) : valorMobilidade(valor, unidade);
    expect(implicito).toBe(pt);
    expect(valorMobilidade(valor, unidade, "pt")).toBe(pt);
    expect(valorMobilidade(valor, unidade, "en")).toBe(en);
  });
});

const percentual = Object.freeze({
  id: "fixture.percentual", grupo: "agua", nome: "Indicador sintético de teste",
  unidade: "%", casas: 2, formula: "Valor sintético sem cálculo adicional",
  base: "Base sintética de teste", nota: "Não representa dado publicado",
  regras: "Preservar o valor recebido", fonte: "fixture.local",
} satisfies Indicador);
const domicilios = Object.freeze({ ...percentual, id: "fixture.domicilios", unidade: "domicílios", casas: 3 } satisfies Indicador);
const municipios = Object.freeze({ ...percentual, id: "fixture.municipios", unidade: "municípios", casas: 3 } satisfies Indicador);
const monetario = Object.freeze({ ...percentual, id: "fixture.monetario", unidade: "R$/hab.", casas: 3 } satisfies Indicador);
const INDICADORES = Object.freeze({ percentual, domicilios, municipios, monetario });

type CasoIndicador = { nome: string; valor: number | null; indicador: Readonly<Indicador>; pt: string; en: string };
const CASOS_INDICADOR: readonly Readonly<CasoIndicador>[] = Object.freeze(([
  { nome: "percentual com casas do indicador", valor: 1234.5, indicador: INDICADORES.percentual, pt: "1.234,50%", en: "1,234.50%" },
  { nome: "percentual zero informado", valor: 0, indicador: INDICADORES.percentual, pt: "0,00%", en: "0.00%" },
  { nome: "percentual zero negativo", valor: -0, indicador: INDICADORES.percentual, pt: "-0,00%", en: "-0.00%" },
  { nome: "domicílios ignoram casas três", valor: 1234.5, indicador: INDICADORES.domicilios, pt: "1.235 domicílios", en: "1,235 domicílios" },
  { nome: "municípios ignoram casas três", valor: 1234.5, indicador: INDICADORES.municipios, pt: "1.235 municípios", en: "1,235 municípios" },
  { nome: "outra unidade mantém sinal e três casas", valor: -1234.5, indicador: INDICADORES.monetario, pt: "-1.234,500 R$/hab.", en: "-1,234.500 R$/hab." },
  { nome: "ausência sem percentual", valor: null, indicador: INDICADORES.percentual, pt: "Não informado", en: "Não informado" },
  { nome: "ausência sem domicílios", valor: null, indicador: INDICADORES.domicilios, pt: "Não informado", en: "Não informado" },
  { nome: "ausência sem municípios", valor: null, indicador: INDICADORES.municipios, pt: "Não informado", en: "Não informado" },
  { nome: "ausência sem unidade monetária", valor: null, indicador: INDICADORES.monetario, pt: "Não informado", en: "Não informado" },
  { nome: "NaN com unidade preservada", valor: NaN, indicador: INDICADORES.percentual, pt: "NaN%", en: "NaN%" },
  { nome: "infinidade com unidade preservada", valor: Infinity, indicador: INDICADORES.monetario, pt: "∞ R$/hab.", en: "∞ R$/hab." },
] satisfies CasoIndicador[]).map((caso) => Object.freeze(caso)));

describe("Saneamento OBEE: wrapper encaminha idioma sem alterar o indicador", () => {
  it.each(CASOS_INDICADOR)("$nome", ({ valor, indicador, pt, en }) => {
    // Os dez campos são primitivos; esta cópia não compartilha estado mutável.
    const antes = { ...indicador };
    expect(formatarSaneamento(valor, indicador)).toBe(pt);
    expect(formatarSaneamento(valor, indicador, "pt")).toBe(pt);
    expect(formatarSaneamento(valor, indicador, "en")).toBe(en);
    expect(indicador).toEqual(antes);
    expect(Object.isFrozen(indicador)).toBe(true);
    expect(Object.isFrozen(INDICADORES)).toBe(true);
  });
});
