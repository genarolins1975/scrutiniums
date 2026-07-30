import { describe, expect, it } from "vitest";
import {
  CHART_HIGHLIGHT,
  CHART_SERIES,
  fmtCurrency,
  fmtDate,
  fmtNumber,
  fmtPercent,
} from "@/lib/format";

const NBSP = " ";

describe("format (pt-BR)", () => {
  describe("fmtNumber", () => {
    it("usa ponto como separador de milhar", () => {
      expect(fmtNumber(1234567)).toBe("1.234.567");
    });

    it("usa vírgula como separador decimal e respeita casas", () => {
      expect(fmtNumber(1234.5, 1)).toBe("1.234,5");
      expect(fmtNumber(0.5, 2)).toBe("0,50");
    });

    it("arredonda quando decimals = 0", () => {
      expect(fmtNumber(1234.56)).toBe("1.235");
    });
  });

  describe("fmtPercent", () => {
    it("formata com vírgula decimal e sufixo %", () => {
      expect(fmtPercent(12.3)).toBe("12,3%");
      expect(fmtPercent(0.5)).toBe("0,5%");
      expect(fmtPercent(100, 0)).toBe("100%");
    });
  });

  describe("fmtCurrency", () => {
    it("formata BRL com NBSP entre símbolo e valor", () => {
      expect(fmtCurrency(1234)).toBe(`R$${NBSP}1.234`);
    });

    it("respeita casas decimais com vírgula", () => {
      expect(fmtCurrency(1234.5, "BRL", 2)).toBe(`R$${NBSP}1.234,50`);
    });

    it("o separador após o símbolo é NBSP, não espaço comum", () => {
      const out = fmtCurrency(10);
      expect(out.charCodeAt(2)).toBe(0xa0);
      expect(out).not.toContain("R$ "); // espaço ASCII
    });
  });

  describe("fmtDate", () => {
    it("formata Date como dd/mm/aaaa", () => {
      expect(fmtDate(new Date(2026, 6, 30))).toBe("30/07/2026");
    });

    it("aceita string ISO com horário", () => {
      expect(fmtDate("2026-01-05T12:00:00")).toBe("05/01/2026");
    });
  });

  describe("CHART_SERIES", () => {
    it("não contém a cor de destaque (bronze é só destaque)", () => {
      expect(CHART_SERIES).not.toContain(CHART_HIGHLIGHT);
    });

    it("não tem cores duplicadas", () => {
      expect(new Set(CHART_SERIES).size).toBe(CHART_SERIES.length);
    });
  });
});
