import { describe, expect, it } from "vitest";
import { formatadorDataHora, formatadorNumero } from "@/lib/format";

describe("fábricas de formatação com opções explícitas", () => {
  it("preserva até três casas decimais por padrão, sem fixar a precisão", () => {
    const valores = [1234.56789, 12, 12.5];
    const pt = formatadorNumero("pt", {});
    const en = formatadorNumero("en", {});

    expect(valores.map(pt.format)).toEqual(["1.234,568", "12", "12,5"]);
    expect(valores.map(en.format)).toEqual(["1,234.568", "12", "12.5"]);
  });

  it("distingue limite de casas de precisão fixa e respeita opções numéricas", () => {
    const valores = [12, 12.56];
    expect(valores.map(formatadorNumero("pt", { maximumFractionDigits: 1 }).format))
      .toEqual(["12", "12,6"]);
    expect(valores.map(formatadorNumero("en", { maximumFractionDigits: 1 }).format))
      .toEqual(["12", "12.6"]);

    const fixas = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    expect(formatadorNumero("pt", fixas).format(12)).toBe("12,00");
    expect(formatadorNumero("en", fixas).format(12)).toBe("12.00");
    expect(formatadorNumero("pt", { useGrouping: false }).format(12345.6)).toBe("12345,6");
    expect(formatadorNumero("en", { useGrouping: false }).format(12345.6)).toBe("12345.6");
  });

  it.each(["BRL", "brl"])("mantém R$ em inglês para %s, sem alterar as opções recebidas", (currency) => {
    const opcoes = Object.freeze({ style: "currency", currency, currencyDisplay: "code" } as const);

    expect(formatadorNumero("en", opcoes).format(1234.5)).toBe("R$1,234.50");
    expect(formatadorNumero("pt", opcoes).format(1234.5)).toBe("BRL\u00a01.234,50");
    expect(opcoes.currencyDisplay).toBe("code");
  });

  it("preserva símbolos e opções das demais moedas", () => {
    expect(formatadorNumero("en", { style: "currency", currency: "CAD" }).format(1234.5))
      .toBe("CA$1,234.50");
    expect(formatadorNumero("en", { style: "currency", currency: "CAD", currencyDisplay: "narrowSymbol" }).format(1234.5))
      .toBe("$1,234.50");
    expect(formatadorNumero("en", { style: "currency", currency: "JPY" }).format(1234.5))
      .toBe("¥1,235");
  });

  it("respeita o fuso explícito e as opções de cada rótulo de data", () => {
    const instante = new Date("2026-10-14T02:59:59Z");
    const pt = { day: "2-digit", month: "2-digit" } as const;
    const en = { day: "numeric", month: "short" } as const;

    expect(formatadorDataHora("pt", { ...pt, timeZone: "America/Sao_Paulo" }).format(instante)).toBe("13/10");
    expect(formatadorDataHora("en", { ...en, timeZone: "America/Sao_Paulo" }).format(instante)).toBe("Oct 13");
    expect(formatadorDataHora("pt", { ...pt, timeZone: "UTC" }).format(instante)).toBe("14/10");
    expect(formatadorDataHora("en", { ...en, timeZone: "UTC" }).format(instante)).toBe("Oct 14");
  });

  it("mantém os defaults nativos de data quando as opções estão vazias", () => {
    const dataLocal = new Date(2026, 2, 5, 12);

    expect(formatadorDataHora("pt", {}).format(dataLocal)).toBe("05/03/2026");
    expect(formatadorDataHora("en", {}).format(dataLocal)).toBe("3/5/2026");
  });
});
