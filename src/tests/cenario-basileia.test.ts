/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Cenário → Basileia pós-choque (P1 da auditoria de 12/08). O que se trava:
 * a conta é um PISO declarado (estoque adicional de inadimplência × LGD, RWA
 * constante, sem efeito fiscal) e a página diz isso ANTES da tabela; as
 * premissas são constantes nomeadas, não números soltos; instituições sem
 * RWA/carteira ficam fora e são contadas (ausência ≠ zero); e o Δinad crítico
 * é a razão colchão ÷ (carteira/RWA × LGD) — a métrica slider-independente.
 */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf-8");
const app = read("public/obs/app.js");
const inst = JSON.parse(read("public/obs/data/gold/institutions.json"));

describe("app.js: premissas declaradas e conta honesta", () => {
  it("premissas como constantes nomeadas, com a régua no comentário e no texto", () => {
    expect(app).toContain("const SCN_LGD = 0.5;");
    expect(app).toContain("const SCN_PR_REF = 10.5;");
    expect(app).toMatch(/RWA constante/);
    expect(app).toMatch(/sem efeito fiscal/);
    // o aviso de piso vem como judalerta ANTES da tabela, não nota de rodapé
    const kPiso = app.indexOf("Leia como piso, não como teste de estresse completo");
    const kTbl = app.indexOf("As 15 menores Basileias após o choque");
    expect(kPiso).toBeGreaterThan(-1);
    expect(kTbl).toBeGreaterThan(kPiso);
  });

  it("dedução proporcional ao choque: sem choque, pós-choque == atual", () => {
    // ded = alav × d × LGD — zero quando d é zero, por construção
    expect(app).toContain("const ded = alav * d * SCN_LGD;");
    expect(app).toContain("const bas_pos = x.basileia_pct - ded;");
  });

  it("Δinad crítico = colchão ÷ (carteira/RWA × LGD), e é slider-independente", () => {
    expect(app).toContain("(x.basileia_pct - SCN_PR_REF) / (alav * SCN_LGD)");
    expect(app).toMatch(/slider-independente/);
  });

  it("exclusões contadas e choque favorável com a mesma cautela", () => {
    const kSec = app.indexOf("instituições do top-100 ficam fora por não reportarem RWA/carteira");
    expect(kSec).toBeGreaterThan(-1);
    expect(app.slice(kSec, kSec + 400)).toContain("ausência ≠ zero");
    expect(app.slice(kSec, kSec + 400)).toContain("Fonte do capital: BCB IF.data");
    expect(app).toMatch(/NÃO modela reversão de provisões/);
    expect(app).toContain("window.scnBasCSV");
    expect(app).toMatch(/scenarios: \["scenario", "institutions"\]/);
  });
});

describe("institutions.json: a base da conta existe e é sã", () => {
  const eleg = inst.instituicoes.filter((x: any) =>
    x.rwa_brl && x.basileia_pct != null && x.carteira_brl != null);

  it("cobertura suficiente e exclusões plausíveis (IPs sem RWA)", () => {
    expect(eleg.length).toBeGreaterThanOrEqual(85);
    expect(inst.instituicoes.length - eleg.length).toBeLessThanOrEqual(15);
  });

  it("carteira/RWA em faixa sã (0 ≤ alav < 5) — a alavanca da dedução", () => {
    // carteira 0 com RWA positivo existe (IPs como a Cielo): dedução zero e
    // Δinad crítico nulo — a SPA guarda a divisão com alav > 0
    for (const x of eleg) {
      const alav = x.carteira_brl / x.rwa_brl;
      expect(alav, x.nome).toBeGreaterThanOrEqual(0);
      expect(alav, x.nome).toBeLessThan(5);
    }
  });

  it("a dedução do preset severamente adverso nunca zera um índice", () => {
    const sc = JSON.parse(read("public/obs/data/gold/scenario.json"));
    const p = sc.presets.severamente_adverso;
    const d = Object.entries(p).reduce(
      (s, [k, v]: any) => s + (sc.elasticidades[k]?.value || 0) * v, 0);
    for (const x of eleg) {
      const ded = (x.carteira_brl / x.rwa_brl) * d * 0.5;
      expect(x.basileia_pct - ded, x.nome).toBeGreaterThan(0);
    }
  });
});
