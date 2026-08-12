/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * HHI setorial como PISO. O coração: o balde residual "outros" da fonte é um
 * AGREGADO de muitos setores — nunca entra ao quadrado (uma carteira 100% em
 * "outros" não é monossetorial, é não classificada). O índice publicado é um
 * limite inferior sobre os setores identificados, com a cobertura declarada;
 * o alerta de concentração só dispara quando os setores identificados já
 * concentram por si sós; e o score só usa a dimensão com cobertura alta.
 */

const raiz = process.cwd();
const appJs = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");
const indPy = readFileSync(join(raiz, "pipeline/indicators.py"), "utf-8");
const ipaPy = readFileSync(join(raiz, "pipeline/inst_pages_all.py"), "utf-8");

describe("estático: o tratamento do resíduo é declarado no código", () => {
  it("o cálculo exclui o residual da soma de quadrados e publica cobertura", () => {
    expect(indPy).toMatch(/CART_RESIDUAL = \{"outros"\}/);
    expect(indPy).toMatch(/NUNCA entra na soma de quadrados/);
    expect(indPy).toMatch(/hhi_cobertura_pct/);
  });

  it("o score só usa a dimensão com cobertura identificada alta", () => {
    expect(indPy).toMatch(/HHI_COBERTURA_SCORE_MIN = 70/);
    expect(indPy).toMatch(/hhi_cobertura_pct", 0\) >= HHI_COBERTURA_SCORE_MIN/);
  });

  it("o alerta e a SPA falam em piso com cobertura, e o verbete ensina o porquê", () => {
    expect(ipaPy).toMatch(/piso sobre os/);
    expect(appJs).toMatch(/HHI setorial"\)\} \(piso\)/);
    expect(appJs).toMatch(/'outros' da fonte NUNCA entra ao quadrado/);
    expect(appJs).toMatch(/100% em 'outros' NÃO é monossetorial/);
  });
});

describe("gated: invariantes do piso no gold publicado", () => {
  const dir = join(raiz, "public/obs/data/gold/inst");
  const arquivos = readdirSync(dir).filter((f) => f.endsWith(".json"));

  it("nenhuma página fabrica concentração a partir do resíduo", () => {
    let comHhi = 0;
    for (const f of arquivos) {
      const d = JSON.parse(readFileSync(join(dir, f), "utf-8"));
      const p = (d.carteira || {}).perfil || {};
      const tc: [string, number][] = p.top_cnae || [];
      if (!tc.length) continue;
      const outros = tc.find(([k]) => k === "outros")?.[1];
      const hhi = p.hhi_setorial;
      if (hhi == null) continue;
      comHhi++;
      // Cauchy: Σ s_i² ≤ (Σ s_i)² — o piso nunca excede o quadrado da cobertura
      if (outros != null) {
        const teto = Math.pow(100 - outros, 2);
        expect(hhi, `${f}: piso ${hhi} > teto ${teto} (outros ${outros}%)`).toBeLessThanOrEqual(teto + 1);
      }
      // o piso cobre ao menos os quadrados dos setores identificados visíveis
      const minimo = tc.filter(([k]) => k !== "outros").reduce((s, [, v]) => s + v * v, 0);
      expect(hhi, `${f}: piso ${hhi} < mínimo visível ${Math.round(minimo)}`).toBeGreaterThanOrEqual(Math.round(minimo) - 1);
      // cobertura viaja junto quando o resíduo é visível
      if (outros != null) expect(p.hhi_cobertura_pct, `${f}: piso sem cobertura`).not.toBeNull();
    }
    expect(comHhi).toBeGreaterThanOrEqual(100);
  });

  it("carteiras dominadas pelo resíduo não carregam HHI (ausência declarada, nunca 'monopólio')", () => {
    for (const f of arquivos) {
      const d = JSON.parse(readFileSync(join(dir, f), "utf-8"));
      const p = (d.carteira || {}).perfil || {};
      const outros = (p.top_cnae || []).find(([k]: [string, number]) => k === "outros")?.[1];
      if (outros != null && outros >= 80) {
        expect(p.hhi_setorial, `${f}: outros ${outros}% mas HHI ${p.hhi_setorial}`).toBeUndefined();
      }
    }
  });

  it("os alertas de concentração remanescentes citam o piso e a cobertura", () => {
    for (const f of arquivos) {
      const d = JSON.parse(readFileSync(join(dir, f), "utf-8"));
      for (const pa of (d.resumo_executivo || {}).pontos_atencao || []) {
        if ((pa.texto || "").includes("Concentração setorial elevada")) {
          expect(pa.texto, f).toMatch(/HHI ≥ \d+, piso sobre os/);
        }
      }
    }
  });
});
