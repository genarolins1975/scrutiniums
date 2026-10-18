import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SETORES, lerEmissoes } from "@/lib/territorio/emissoes";
import { donoDaRota } from "@/lib/observatorios/registro";
import { ehRotaPublica } from "@/lib/rotasPublicas";
import { frentesTerritorio } from "@/lib/observatorios/entradas/territorio";

describe("emissões do Território e Clima", () => {
  const g = lerEmissoes();

  it("inventário oficial desde 1990, com 2005, setores que somam o total e métrica declarada", () => {
    expect(g.anoInicial).toBe(1990);
    expect(g.anos.map((a) => a.ano)).toContain(2005);
    expect(g.metrica).toMatch(/GWP AR5/);
    for (const a of g.anos) {
      const soma = SETORES.reduce((s, k) => s + a.setores[k], 0);
      expect(Math.abs(soma - a.totalLiquido), String(a.ano)).toBeLessThan(1);
      expect(Math.abs(a.totalLiquido - a.setores.lulucf - a.totalSemLulucf), String(a.ano)).toBeLessThan(1);
    }
    for (const o of g.originais) expect(o.sha256, o.setor).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a variação desde 2005 é a calculada da própria série", () => {
    const u = g.anos.at(-1)!;
    const r = g.anos.find((a) => a.ano === 2005)!;
    expect(g.derivados.variacaoDesde2005Pct.totalLiquido).toBeCloseTo(100 * (u.totalLiquido / r.totalLiquido - 1), 1);
  });

  it("o painel é fechado, fica na coleção Desmatamento e emissões e declara a defasagem e o SEEG à parte", () => {
    expect(ehRotaPublica("/territorio/emissoes")).toBe(false);
    expect(donoDaRota("/territorio/emissoes")).toMatchObject({ observatorio: "territorio-e-clima", colecao: "desmatamento", origem: null });
    const fonte = readFileSync(join(process.cwd(), "src", "app", "territorio", "emissoes", "page.tsx"), "utf-8");
    expect(fonte).toContain("O inventário oficial vai até");
    expect(fonte).toContain("não se mistura com esta série");
    expect(frentesTerritorio().find((f) => f.id === "floresta")!.paineis.map((p) => p.href)).toContain("/territorio/emissoes");
  });
});
