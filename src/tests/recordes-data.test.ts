/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Recordes automáticos. O coração: régua declarada (janela mínima, séries
 * nominais e índices de nível excluídos — recorde trivial), posição
 * aritmética sem juízo de mérito, e recálculo do zero (sem memória que
 * sobreviva a revisões da fonte).
 */

const raiz = process.cwd();
const G = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/recordes.json"), "utf-8"));
const builderPy = readFileSync(join(raiz, "pipeline/recordes.py"), "utf-8");
const goldPy = readFileSync(join(raiz, "pipeline/gold.py"), "utf-8");
const appJs = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");

describe("estático: builder e réguas", () => {
  it("roda no gold diário e exclui séries trending", () => {
    expect(goldPy).toContain("rec_mod.build");
    expect(builderPy).toMatch(/R\$.*recorde trivial|recorde trivial, fora/);
    expect(builderPy).toMatch(/MIN_MESES = 24/);
  });

  it("a SPA tem o bloco na Visão geral e o kit de imprensa no Sobre", () => {
    expect(appJs).toContain('"recordes", "Recordes nas séries"');
    expect(appJs).toContain("recordes: secRecordes");
    expect(appJs).toContain("Para a imprensa");
    expect(appJs).toMatch(/Como citar:/);
  });
});

describe("gold recordes.json publicado", () => {
  it("todo recorde respeita a janela mínima e sai de série elegível", () => {
    expect(G.disponivel).toBe(true);
    expect(G.janela_minima_meses).toBe(24);
    expect(G.recordes.length).toBeGreaterThanOrEqual(1);
    for (const r of G.recordes) {
      expect(r.meses, r.serie).toBeGreaterThanOrEqual(G.janela_minima_meses);
      expect(["maximo_historico", "minimo_historico", "maior_desde", "menor_desde"], r.serie).toContain(r.tipo);
      // séries nominais e índices de nível nunca entram
      expect(String(r.unidade), r.serie).not.toMatch(/R\$|índice/);
      expect(r.rotulo, r.serie).toMatch(/desde \d{4}-\d{2}/);
      expect(r.valor, r.serie).not.toBeNull();
    }
    // ordenado do recorde mais longo para o mais curto
    for (let k = 1; k < G.recordes.length; k++) {
      expect(G.recordes[k - 1].meses >= G.recordes[k].meses).toBe(true);
    }
  });

  it("método e cautelas viajam com o dado", () => {
    expect(G.metodo).toMatch(/recorde trivial/);
    const c = (G.cautelas || []).join(" ");
    expect(c).toMatch(/nunca juízo de mérito/);
    expect(c).toMatch(/revisáveis/);
  });
});
