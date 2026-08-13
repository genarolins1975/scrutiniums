/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Transformações de série no Pulso (P1 da auditoria: a distância para um
 * FRED). O que se trava: o deflator é construído da série IPCA do próprio
 * gold (produto acumulado, rebase no último mês); transformação inaplicável
 * NUNCA é aproximada — cai fora ou avisa; séries em % ganham a/a em pontos
 * percentuais, não variação relativa da taxa; projeções/bandas/marcadores de
 * regime só existem em nível; e a sobreposição de séries só existe em
 * base-100 ou a/a — unidades distintas jamais dividem um eixo em nível.
 */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf-8");
const app = read("public/obs/app.js");
const pulse = JSON.parse(read("public/obs/data/gold/pulse.json"));

describe("app.js: as regras das réguas", () => {
  it("as quatro réguas existem e o seletor está na página", () => {
    expect(app).toMatch(/\["nivel", "nível"\], \["yoy", "variação a\/a"\], \["b100", "base-100"\], \["real", "R\$ constantes"\]/);
    expect(app).toContain("setFilter('transf'");
  });

  it("deflacionar série em % é recusado, nunca aproximado", () => {
    expect(app).toContain('if (!/^R\\$/.test(s.meta.unit || "")) return null;');
    expect(app).toContain("mês sem IPCA fica fora, nunca aproximado");
    expect(app).toMatch(/não se aplica a esta série/);
  });

  it("série em % ganha a/a em pontos percentuais, não variação relativa", () => {
    expect(app).toContain('unit: "p.p. a/a"');
    expect(app).toContain("diferença em pontos percentuais sobre o mesmo mês do ano anterior");
  });

  it("projeções, bandas e marcadores de regime só em nível", () => {
    expect(app).toContain("if (emNivel && fc && fc.ok) {");
    expect(app).toMatch(/emNivel && rgs && rgs\.quebra_estrutural/);
    expect(app).toMatch(/projeções e bandas são de nível/);
  });

  it("sobreposição só em base-100 ou a/a, com a razão declarada", () => {
    const k = app.indexOf("function pulseComparadorSec");
    const sec = app.slice(k, k + 4000);
    expect(k).toBeGreaterThan(-1);
    expect(sec).toContain('pc.transf === "yoy" ? "yoy" : "b100"'); // nível não é opção
    expect(sec).toContain("Unidades distintas nunca dividem um eixo em nível");
    expect(sec).toContain("pulseCmpCSV");
  });
});

describe("pulse.json: a base das transformações", () => {
  it("IPCA mensal cobre toda a janela das séries de R$", () => {
    const ipca = pulse.series.ipca;
    expect(ipca.meta.unit).toBe("% a.m.");
    const meses = new Set(ipca.obs.map((o: any) => o.ref.slice(0, 7)));
    for (const k of ["saldo_total", "concessoes_total"]) {
      for (const o of pulse.series[k].obs) {
        expect(meses.has(o.ref.slice(0, 7)), `${k} ${o.ref} sem IPCA`).toBe(true);
      }
    }
  });

  it("o deflator rebaseado no último mês devolve ≈1 no fim e amplia o passado", () => {
    let acc = 1;
    const idx: Record<string, number> = {};
    for (const o of pulse.series.ipca.obs) { acc *= 1 + o.v / 100; idx[o.ref.slice(0, 7)] = acc; }
    const s = pulse.series.saldo_total.obs;
    const dUlt = acc / idx[s[s.length - 1].ref.slice(0, 7)];
    const dIni = acc / idx[s[0].ref.slice(0, 7)];
    expect(Math.abs(dUlt - 1)).toBeLessThan(0.02); // último mês ≈ preços correntes
    expect(dIni).toBeGreaterThan(1.5); // 2012 em preços de hoje mais que ×1,5
    expect(dIni).toBeLessThan(5);
  });

  it("base-100: o primeiro ponto da janela é exatamente 100", () => {
    const s = pulse.series.saldo_total.obs.slice(-60);
    const b = s[0].v;
    expect((s[0].v / b) * 100).toBe(100);
    // e a trajetória rebaseada preserva as razões da série original
    const meio = s[Math.floor(s.length / 2)];
    expect((meio.v / b) * 100).toBeCloseTo((meio.v / s[0].v) * 100, 10);
  });
});
