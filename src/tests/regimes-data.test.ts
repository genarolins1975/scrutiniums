/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regimes de resolução do BCB. O coração: fonte publica só o estado ATUAL —
 * o silver acumula memória append-only (regime que sai da lista permanece);
 * lista vazia é tratada como falha de fonte, nunca como "zero regimes";
 * regime em instituição pequena não é sinal sistêmico (cautela publicada);
 * a fronteira do histórico pré-coleta é declarada.
 */

const raiz = process.cwd();
const G = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/regimes.json"), "utf-8"));
const coletorPy = readFileSync(join(raiz, "pipeline/sources/regimes.py"), "utf-8");
const runPy = readFileSync(join(raiz, "pipeline/run.py"), "utf-8");
const goldPy = readFileSync(join(raiz, "pipeline/gold.py"), "utf-8");
const appJs = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");

describe("estático: coletor com memória e salvaguardas", () => {
  it("roda no pipeline diário e no gold", () => {
    expect(runPy).toContain('("regimes", regimes)');
    expect(goldPy).toContain("reg_res_mod.build");
  });

  it("lista vazia é falha de fonte (nunca zero) e a história é append-only", () => {
    expect(coletorPy).toMatch(/espelho anterior preservado/);
    expect(coletorPy).toMatch(/ON CONFLICT\(cnpj, inicio\) DO UPDATE SET ultimo_visto/);
    // o histórico nunca é apagado — não existe DELETE na tabela de memória
    expect(coletorPy).not.toMatch(/DELETE FROM regimes_hist/);
  });

  it("a SPA renderiza a seção com a cautela anti-alarmista", () => {
    expect(appJs).toContain("Sob regime de resolução do BCB");
    expect(appJs).toContain("regimesSecao()");
  });
});

describe("gold regimes.json publicado", () => {
  it("vigentes plausíveis, ordenados e com campos completos", () => {
    expect(G.disponivel).toBe(true);
    expect(G.vigentes.length).toBeGreaterThanOrEqual(5);
    expect(G.vigentes.length).toBeLessThanOrEqual(300);
    for (const v of G.vigentes) {
      expect(v.nome, v.cnpj).toBeTruthy();
      expect(v.tipo, v.nome).toMatch(/LIQUIDAÇÃO|INTERVENÇÃO|RAET|ADMINISTRAÇÃO ESPECIAL/i);
      expect(v.inicio_iso, v.nome).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(v.cnpj8, v.nome).toMatch(/^\d{8}$/);
    }
    for (let k = 1; k < G.vigentes.length; k++) {
      expect(G.vigentes[k - 1].inicio_iso >= G.vigentes[k].inicio_iso).toBe(true);
    }
  });

  it("as cautelas centrais acompanham o dado", () => {
    const c = (G.cautelas || []).join(" ");
    expect(c).toMatch(/NÃO é sinal sistêmico/);
    expect(c).toMatch(/fronteira declarada/);
    expect(G.fonte.url).toMatch(/^https:\/\/dadosabertos\.bcb\.gov\.br\//);
    expect(G.fonte.nivel).toBe("A");
  });
});
