import { afterEach, describe, expect, it, vi } from "vitest";
import { pt } from "@/i18n/pt";
import { en } from "@/i18n/en";

const MENSAGENS = [
  {
    idioma: "pt",
    texto: pt["home.hero.introducao"],
    esperado: "{observatorios}, das Famílias aos Serviços Públicos, das Contas Públicas à Energia e Infraestrutura, da Economia ao Território e Clima, construídos sobre bases oficiais. Cada painel informa a fonte, o período de referência e o que o dado não permite afirmar.",
  },
  {
    idioma: "en",
    texto: en["home.hero.introducao"].texto,
    esperado: "{observatorios} on families, public services, public accounts, energy and infrastructure, the economy, and territory and climate, built on official databases. Each dashboard identifies the data source, the reference period and what the data cannot establish.",
  },
] as const;

describe("mensagem completa da introdução da home", () => {
  it.each(MENSAGENS)("preserva o texto literal e um único token inicial em $idioma", ({ texto, esperado }) => {
    expect(texto).toBe(esperado);
    expect(texto.startsWith("{observatorios}")).toBe(true);
    expect(texto.match(/\{[^{}]*\}/g)).toEqual(["{observatorios}"]);
    expect(texto.slice("{observatorios}".length)).not.toMatch(/[{}]/);
  });
});

// São registros exclusivamente sintéticos. Nenhum número publicado ou entrada
// real de DOMINIOS muda; os resultados esperados não vêm do helper sob teste.
const CONTAGENS = [
  { quantidade: 0, pt: "0 observatórios", ptMaiuscula: "0 observatórios", en: "0 observatories", enMaiuscula: "0 observatories" },
  { quantidade: 1, pt: "um observatórios", ptMaiuscula: "Um observatórios", en: "one observatory", enMaiuscula: "One observatory" },
  { quantidade: 6, pt: "seis observatórios", ptMaiuscula: "Seis observatórios", en: "six observatories", enMaiuscula: "Six observatories" },
  { quantidade: 7, pt: "sete observatórios", ptMaiuscula: "Sete observatórios", en: "seven observatories", enMaiuscula: "Seven observatories" },
  { quantidade: 8, pt: "oito observatórios", ptMaiuscula: "Oito observatórios", en: "eight observatories", enMaiuscula: "Eight observatories" },
  { quantidade: 9, pt: "nove observatórios", ptMaiuscula: "Nove observatórios", en: "nine observatories", enMaiuscula: "Nine observatories" },
  { quantidade: 10, pt: "10 observatórios", ptMaiuscula: "10 observatórios", en: "10 observatories", enMaiuscula: "10 observatories" },
  { quantidade: 1000, pt: "1000 observatórios", ptMaiuscula: "1000 observatórios", en: "1,000 observatories", enMaiuscula: "1,000 observatories" },
] as const;

afterEach(() => {
  vi.doUnmock("@/lib/observatorios/lista");
  vi.resetModules();
});

describe("contagem da introdução derivada do registro", () => {
  it.each(CONTAGENS)("localiza $quantidade sem alterar as chamadas portuguesas existentes", async (esperado) => {
    vi.resetModules();
    vi.doMock("@/lib/observatorios/lista", () => ({
      OBSERVATORIOS: Array.from({ length: esperado.quantidade }, (_, indice) => ({
        id: `observatorio-sintetico-${indice}`, nomeCurto: `Observatório sintético ${indice}`,
      })),
    }));
    const { N_OBSERVATORIOS, observatoriosPorExtenso } = await import("@/lib/acesso");

    expect(N_OBSERVATORIOS).toBe(esperado.quantidade);
    expect(observatoriosPorExtenso()).toBe(esperado.pt);
    expect(observatoriosPorExtenso(false)).toBe(esperado.pt);
    expect(observatoriosPorExtenso(true)).toBe(esperado.ptMaiuscula);
    expect(observatoriosPorExtenso(false, "pt")).toBe(esperado.pt);
    expect(observatoriosPorExtenso(true, "pt")).toBe(esperado.ptMaiuscula);
    expect(observatoriosPorExtenso(undefined, "en")).toBe(esperado.en);
    expect(observatoriosPorExtenso(false, "en")).toBe(esperado.en);
    expect(observatoriosPorExtenso(true, "en")).toBe(esperado.enMaiuscula);
  });
});
