import { describe, expect, it } from "vitest";
import { carimbo, fracPct, normaLegivel, num, pct, plural, reais, sinal } from "@/lib/energia/formato";
import { formatarDiferenca, formatarValor, rotuloTick, sentidoDiferenca } from "@/lib/energia/escalas";

// Expectativas literais: não obter o esperado de Intl nem de outro formatador.
describe("formatação de Energia com idioma", () => {
  it("mantém português quando o argumento novo é omitido", () => {
    expect([
      num(1234.5), reais(-1234.5), pct(1), fracPct(0.01), sinal(1234.5, 1, " MW"),
      plural(1234.5678, "registro", "registros"), rotuloTick(2500, 2.5),
      formatarValor(-1234.5, 1, "MW"), formatarDiferenca(1234.5, 1, "MW"),
    ]).toEqual([
      "1.234,5", "R$\u00a0\u22121.234,50", "1,0%", "1,0%", "+1.234,5 MW",
      "1.234,568 registros", "2.500,0", "\u22121.234,5\u00a0MW", "+1.234,5\u00a0MW",
    ]);
  });

  it.each(["pt", "en"] as const)("preserva precisão, escala percentual e sinais em %s", (idioma) => {
    expect([
      num(1234.5, undefined, idioma), num(12, 2, idioma), num(1234.567, 2, idioma),
      num(-1234.5, 1, idioma), pct(1, 1, idioma), fracPct(0.01, 1, idioma), pct(0.01, 2, idioma),
      sinal(1234.5, 1, " MW", idioma), sinal(-1234.5, 1, " MW", idioma),
    ]).toEqual(idioma === "pt" ? [
      "1.234,5", "12,00", "1.234,57", "\u22121.234,5", "1,0%", "1,0%", "0,01%",
      "+1.234,5 MW", "\u22121.234,5 MW",
    ] : [
      "1,234.5", "12.00", "1,234.57", "\u22121,234.5", "1.0%", "1.0%", "0.01%",
      "+1,234.5 MW", "\u22121,234.5 MW",
    ]);
  });

  it.each(["pt", "en"] as const)("compõe BRL com precisão e posição do sinal próprias de %s", (idioma) => {
    expect([reais(1234.5, undefined, idioma), reais(-1234.5, undefined, idioma), reais(1234.5, 0, idioma)])
      .toEqual(idioma === "pt"
        ? ["R$\u00a01.234,50", "R$\u00a0\u22121.234,50", "R$\u00a01.235"]
        : ["R$1,234.50", "\u2212R$1,234.50", "R$1,235"]);
  });

  it.each(["pt", "en"] as const)("mantém as políticas distintas de zero negativo em %s", (idioma) => {
    for (const valor of [-0, -0.004]) {
      expect([num(valor, 2, idioma), pct(valor, 2, idioma), reais(valor, 2, idioma)])
        .toEqual(idioma === "pt"
          ? ["\u22120,00", "\u22120,00%", "R$\u00a0\u22120,00"]
          : ["\u22120.00", "\u22120.00%", "\u2212R$0.00"]);
    }
    expect([sinal(-0, 2, "", idioma), sinal(-0.004, 2, "", idioma)])
      .toEqual(idioma === "pt" ? ["0,00", "\u22120,00"] : ["0.00", "\u22120.00"]);
  });

  it.each([null, undefined, NaN, Infinity, -Infinity])("não transforma ausência ou não finito (%s) em número", (valor) => {
    for (const idioma of ["pt", "en"] as const) {
      expect([
        num(valor, 2, idioma), reais(valor, 2, idioma), pct(valor, 2, idioma),
        fracPct(valor, 2, idioma), sinal(valor, 2, " MW", idioma),
      ]).toEqual(["\u2013", "\u2013", "\u2013", "\u2013", "\u2013"]);
      expect([formatarValor(valor, 1, "MW", idioma), formatarDiferenca(valor, 1, "MW", idioma)])
        .toEqual(["sem dado", "sem dado"]);
    }
  });

  it.each(["pt", "en"] as const)("plural conserva precisão variável, palavras e não finitos em %s", (idioma) => {
    expect([
      plural(1234.5678, "registro", "registros", idioma), plural(12, "registro", "registros", idioma),
      plural(1, "registro", "registros", idioma), plural(NaN, "registro", "registros", idioma),
      plural(Infinity, "registro", "registros", idioma), plural(-Infinity, "registro", "registros", idioma),
    ]).toEqual(idioma === "pt"
      ? ["1.234,568 registros", "12 registros", "1 registro", "NaN registros", "∞ registros", "-∞ registros"]
      : ["1,234.568 registros", "12 registros", "1 registro", "NaN registros", "∞ registros", "-∞ registros"]);
  });

  it("conserva a identificação normativa em português", () => {
    expect(normaLegivel("LEI-10607-2002-12-19")).toBe("Lei 10.607, de 19/12/2002");
    expect(normaLegivel("ato_sem_numero")).toBe("ato_sem_numero");
  });

  it.each(["pt", "en"] as const)("formata escala, unidade e diferença sem mudar arredondamento em %s", (idioma) => {
    expect([
      rotuloTick(2500, 2.5, idioma), rotuloTick(-1000, 1000, idioma),
      formatarValor(-1234.5, 1, "MW", idioma), formatarValor(12.345, 1, "%", idioma),
      formatarDiferenca(1234.5, 1, "MW", idioma), formatarDiferenca(-1234.5, 1, "MW", idioma),
      formatarValor(-0.04, 1, "MW", idioma), formatarDiferenca(-0.04, 1, "MW", idioma),
    ]).toEqual(idioma === "pt" ? [
      "2.500,0", "\u22121.000", "\u22121.234,5\u00a0MW", "12,3%",
      "+1.234,5\u00a0MW", "\u22121.234,5\u00a0MW", "0,0\u00a0MW", "0,0\u00a0MW",
    ] : [
      "2,500.0", "\u22121,000", "\u22121,234.5\u00a0MW", "12.3%",
      "+1,234.5\u00a0MW", "\u22121,234.5\u00a0MW", "0.0\u00a0MW", "0.0\u00a0MW",
    ]);
    expect(sentidoDiferenca(-0.04, 1)).toBe("igual");
    expect(formatarValor(1, 0, "dias", idioma)).toBe("1\u00a0dia");
  });
});

describe("carimbo de Energia: idioma, parser existente e Brasília", () => {
  it.each([
    ["2026-10-14T12:34:56Z", "14/10/2026, 09:34 (Brasília)", "Oct 14, 2026, 09:34 AM (Brasília)"],
    ["2027-01-01T02:00:00Z", "31/12/2026, 23:00 (Brasília)", "Dec 31, 2026, 11:00 PM (Brasília)"],
    ["2027-01-01T02:00:00", "31/12/2026, 23:00 (Brasília)", "Dec 31, 2026, 11:00 PM (Brasília)"],
    ["2027-01-01T02:00:00+02:00", "31/12/2026, 21:00 (Brasília)", "Dec 31, 2026, 09:00 PM (Brasília)"],
    // O parser atual acrescenta Z a offset negativo e devolve a entrada inválida intacta.
    ["2027-01-01T02:00:00-03:00", "2027-01-01T02:00:00-03:00", "2027-01-01T02:00:00-03:00"],
    ["captura inválida", "captura inválida", "captura inválida"],
    [null, "\u2013", "\u2013"], [undefined, "\u2013", "\u2013"], ["", "\u2013", "\u2013"],
  ] as const)("preserva a entrada %s sem depender do fuso do processo", (entrada, pt, en) => {
    expect(carimbo(entrada)).toBe(pt);
    expect(carimbo(entrada, "pt")).toBe(pt);
    expect(carimbo(entrada, "en")).toBe(en);
  });
});
