import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fmtCurrency, fmtDate, fmtDateTime, fmtMonthYear, fmtNumber, fmtPercent } from "@/lib/format";

const NBSP = "\u00a0";

describe("formatação numérica com idioma explícito", () => {
  it.each([
    [1234567.89, 2, "1.234.567,89", "1,234,567.89"],
    [1234.56, 0, "1.235", "1,235"],
    [-1234.5, 1, "-1.234,5", "-1,234.5"],
    [1.005, 2, "1,01", "1.01"],
    [0, 2, "0,00", "0.00"],
  ] as const)("preserva o valor %s e a precisão %s nos dois idiomas", (valor, casas, pt, en) => {
    expect(fmtNumber(valor, casas)).toBe(pt);
    expect(fmtNumber(valor, casas, "pt")).toBe(pt);
    expect(fmtNumber(valor, casas, "en")).toBe(en);
  });

  it("mantém zero casas como padrão para número e moeda", () => {
    expect(fmtNumber(1234.5)).toBe("1.235");
    expect(fmtNumber(1234.5, undefined, "pt")).toBe("1.235");
    expect(fmtNumber(1234.5, undefined, "en")).toBe("1,235");
    expect(fmtCurrency(1234.5)).toBe(`R$${NBSP}1.235`);
    expect(fmtCurrency(1234.5, undefined, undefined, "pt")).toBe(`R$${NBSP}1.235`);
    expect(fmtCurrency(1234.5, undefined, undefined, "en")).toBe("R$1,235");
  });

  it.each([
    ["BRL", `R$${NBSP}1.234,50`, "R$1,234.50"],
    ["brl", `R$${NBSP}1.234,50`, "R$1,234.50"],
    ["USD", `US$${NBSP}1.234,50`, "$1,234.50"],
    ["CAD", `CA$${NBSP}1.234,50`, "CA$1,234.50"],
    ["EUR", `€${NBSP}1.234,50`, "€1,234.50"],
    ["JPY", `JP¥${NBSP}1.234,50`, "¥1,234.50"],
  ])("preserva o código monetário %s e as casas solicitadas", (moeda, pt, en) => {
    expect(fmtCurrency(1234.5, moeda, 2)).toBe(pt);
    expect(fmtCurrency(1234.5, moeda, 2, "pt")).toBe(pt);
    expect(fmtCurrency(1234.5, moeda, 2, "en")).toBe(en);
  });

  it.each([
    [1, 1, "1,0%", "1.0%"],
    [0.01, 2, "0,01%", "0.01%"],
    [-0.01, 2, "-0,01%", "-0.01%"],
    [100, 0, "100%", "100%"],
  ] as const)("trata %s como percentual já calculado, sem multiplicar por cem", (valor, casas, pt, en) => {
    expect(fmtPercent(valor, casas)).toBe(pt);
    expect(fmtPercent(valor, casas, "pt")).toBe(pt);
    expect(fmtPercent(valor, casas, "en")).toBe(en);
  });

  it("mantém uma casa como padrão do percentual", () => {
    expect(fmtPercent(1)).toBe("1,0%");
    expect(fmtPercent(1, undefined, "pt")).toBe("1,0%");
    expect(fmtPercent(1, undefined, "en")).toBe("1.0%");
  });

  it.each([-0, -0.004])("preserva o sinal de %s mesmo quando arredondado a zero", (valor) => {
    expect([fmtNumber(valor, 2), fmtCurrency(valor, "BRL", 2), fmtPercent(valor, 2)])
      .toEqual(["-0,00", `-R$${NBSP}0,00`, "-0,00%"]);
    expect([fmtNumber(valor, 2, "pt"), fmtCurrency(valor, "BRL", 2, "pt"), fmtPercent(valor, 2, "pt")])
      .toEqual(["-0,00", `-R$${NBSP}0,00`, "-0,00%"]);
    expect([fmtNumber(valor, 2, "en"), fmtCurrency(valor, "BRL", 2, "en"), fmtPercent(valor, 2, "en")])
      .toEqual(["-0.00", "-R$0.00", "-0.00%"]);
  });

  it.each([
    [NaN, "NaN", `R$${NBSP}NaN`, "R$NaN", "NaN%"],
    [Infinity, "∞", `R$${NBSP}∞`, "R$∞", "∞%"],
    [-Infinity, "-∞", `-R$${NBSP}∞`, "-R$∞", "-∞%"],
  ] as const)("não transforma %s em zero ou texto de ausência", (valor, numero, moedaPt, moedaEn, percentual) => {
    expect([fmtNumber(valor), fmtCurrency(valor), fmtPercent(valor)]).toEqual([numero, moedaPt, percentual]);
    expect([fmtNumber(valor, 0, "pt"), fmtCurrency(valor, "BRL", 0, "pt"), fmtPercent(valor, 1, "pt")])
      .toEqual([numero, moedaPt, percentual]);
    expect([fmtNumber(valor, 0, "en"), fmtCurrency(valor, "BRL", 0, "en"), fmtPercent(valor, 1, "en")])
      .toEqual([numero, moedaEn, percentual]);
  });

  it.each(["pt", "en"] as const)("preserva erros de moeda e precisão inválidas em %s", (idioma) => {
    expect(() => fmtCurrency(10, "REAL", 2, idioma)).toThrow(RangeError);
    expect(() => fmtNumber(10, -1, idioma)).toThrow(RangeError);
    expect(() => fmtPercent(1, -1, idioma)).toThrow(RangeError);
  });
});

describe("datas e meses com idioma explícito", () => {
  it("aceita Date e ISO local, mantendo PT e usando mês curto em EN", () => {
    for (const data of [new Date(2026, 9, 14, 12), "2026-10-14T12:00:00"]) {
      expect(fmtDate(data)).toBe("14/10/2026");
      expect(fmtDate(data, "pt")).toBe("14/10/2026");
      expect(fmtDate(data, "en")).toBe("Oct 14, 2026");
    }
    for (const data of [new Date(2026, 7, 1, 12), "2026-08-01T12:00:00"]) {
      expect(fmtMonthYear(data)).toBe("ago. de 2026");
      expect(fmtMonthYear(data, "pt")).toBe("ago. de 2026");
      expect(fmtMonthYear(data, "en")).toBe("Aug 2026");
    }
  });

  it("mostra o mesmo instante em Brasília e mantém precisão de minutos", () => {
    const iso = "2026-10-14T12:34:56Z";
    for (const data of [iso, new Date(iso)]) {
      expect(fmtDateTime(data)).toBe("14/10/2026, 09:34");
      expect(fmtDateTime(data, "pt")).toBe("14/10/2026, 09:34");
      expect(fmtDateTime(data, "en")).toBe("Oct 14, 2026, 09:34 AM");
    }
  });

  it.each(["data inválida", new Date(NaN)])("mantém Invalid Date para %s, sem lançar exceção", (data) => {
    for (const formatar of [fmtDate, fmtDateTime, fmtMonthYear]) {
      expect(formatar(data)).toBe("Invalid Date");
      expect(formatar(data, "pt")).toBe("Invalid Date");
      expect(formatar(data, "en")).toBe("Invalid Date");
    }
  });
});

describe("contrato de fuso em processos isolados", () => {
  let temporario: string;
  beforeAll(() => {
    temporario = mkdtempSync(join(tmpdir(), "i18n-format-"));
    // Executa a implementação real compilada, sem mudar TZ do processo Vitest.
    const fonte = readFileSync(new URL("../lib/format.ts", import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(fonte, {
      compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
      fileName: "format.ts",
    });
    writeFileSync(join(temporario, "format.mjs"), outputText);
    writeFileSync(join(temporario, "sonda.mjs"), `
      import { fmtDate, fmtDateTime, fmtMonthYear } from "./format.mjs";
      const instantes = ["2026-01-01T02:59:00Z", "2026-01-01T03:00:00Z"];
      const idiomas = [undefined, "pt", "en"];
      console.log(JSON.stringify({
        datas: instantes.map(iso => idiomas.map(idioma => fmtDate(iso, idioma))),
        meses: instantes.map(iso => idiomas.map(idioma => fmtMonthYear(iso, idioma))),
        instantes: instantes.map(iso => idiomas.map(idioma => fmtDateTime(iso, idioma))),
        diaIso: idiomas.map(idioma => fmtDate("2026-01-01", idioma)),
        mesIso: idiomas.map(idioma => fmtMonthYear("2026-01", idioma)),
      }));
    `);
  });
  afterAll(() => { if (temporario) rmSync(temporario, { recursive: true, force: true }); });

  const janeiro = ["01/01/2026", "Jan 1, 2026"];
  const dezembro = ["31/12/2025", "Dec 31, 2025"];
  const mesJaneiro = ["jan. de 2026", "Jan 2026"];
  const mesDezembro = ["dez. de 2025", "Dec 2025"];
  const idiomas = ([pt, en]: string[]) => [pt, pt, en];

  it.each([
    { fuso: "UTC", datas: [janeiro, janeiro], meses: [mesJaneiro, mesJaneiro], diaIso: janeiro, mesIso: mesJaneiro },
    { fuso: "America/Sao_Paulo", datas: [dezembro, janeiro], meses: [mesDezembro, mesJaneiro], diaIso: dezembro, mesIso: mesDezembro },
    { fuso: "America/Los_Angeles", datas: [dezembro, dezembro], meses: [mesDezembro, mesDezembro], diaIso: dezembro, mesIso: mesDezembro },
  ])("preserva data/mês do ambiente $fuso e instante no fuso de Brasília", (caso) => {
    const saida = execFileSync(process.execPath, [join(temporario, "sonda.mjs")], {
      env: { ...process.env, TZ: caso.fuso },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(JSON.parse(saida)).toEqual({
      datas: caso.datas.map(idiomas),
      meses: caso.meses.map(idiomas),
      instantes: [
        ["31/12/2025, 23:59", "31/12/2025, 23:59", "Dec 31, 2025, 11:59 PM"],
        ["01/01/2026, 00:00", "01/01/2026, 00:00", "Jan 1, 2026, 12:00 AM"],
      ],
      diaIso: idiomas(caso.diaIso),
      mesIso: idiomas(caso.mesIso),
    });
  });
});
