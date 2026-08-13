/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Backtest publicado (P1 da auditoria: credibilidade dos modelos). O que se
 * trava: a cobertura da banda é medida FORA da própria calibração (split
 * temporal) e publicada mesmo quando desaba; ganho negativo vs. o ingênuo é
 * exibido, não escondido; a trajetória previsto × realizado usa os valores
 * realmente observados da série; e a página declara que o pseudo-backtest do
 * ensemble aplica os pesos finais retroativamente.
 */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf-8");
const app = read("public/obs/app.js");
const pulse = JSON.parse(read("public/obs/data/gold/pulse.json"));

describe("pulse.json: os campos do backtest publicado", () => {
  it("toda previsão ok tem cobertura_banda por horizonte, com n e leitura", () => {
    for (const [k, fc] of Object.entries<any>(pulse.previsoes)) {
      if (!fc.ok) continue;
      for (const [h, dg] of Object.entries<any>(fc.diagnostico)) {
        const cb = dg.cobertura_banda;
        expect(cb, `${k} h=${h}`).toBeTruthy();
        expect(cb.cobertura_oos_pct).toBeGreaterThanOrEqual(0);
        expect(cb.cobertura_oos_pct).toBeLessThanOrEqual(100);
        expect(cb.nominal_pct).toBe(80);
        expect(cb.n_teste).toBeGreaterThanOrEqual(5);
        expect(cb.leitura.length).toBeGreaterThan(20);
        // leitura coerente com o número: cobertura baixa exige o aviso de regime
        if (cb.cobertura_oos_pct < 40) expect(cb.leitura).toMatch(/piso de incerteza/);
      }
    }
  });

  it("a trajetória h=12 existe e o 'realizado' é o valor observado da série", () => {
    let checadas = 0;
    for (const [k, fc] of Object.entries<any>(pulse.previsoes)) {
      if (!fc.ok || !fc.diagnostico["12"] || !fc.diagnostico["12"].trajetoria) continue;
      const obs = new Map(pulse.series[k].obs.map((o: any) => [o.ref, o.v]));
      for (const p of fc.diagnostico["12"].trajetoria) {
        expect(obs.has(p.ref), `${k} ${p.ref}`).toBe(true);
        expect(Math.abs((obs.get(p.ref) as number) - p.realizado), `${k} ${p.ref}`).toBeLessThan(1e-3);
        expect(typeof p.previsto).toBe("number");
      }
      checadas++;
    }
    expect(checadas).toBeGreaterThanOrEqual(10);
  });

  it("há coberturas abaixo do nominal publicadas — o backtest não maquia", () => {
    // se um dia TODAS as coberturas ficarem ≥ 65%, este teste deve ser revisto
    // com os dados na mão, não silenciosamente relaxado
    const todas = Object.values<any>(pulse.previsoes)
      .filter(fc => fc.ok)
      .flatMap(fc => Object.values<any>(fc.diagnostico).map(d => d.cobertura_banda?.cobertura_oos_pct))
      .filter(v => v != null);
    expect(todas.length).toBeGreaterThan(30);
    expect(Math.min(...todas)).toBeLessThan(65);
  });
});

describe("app.js: a seção de validação", () => {
  it("existe, mostra ganho negativo em cor de alerta e explica a cobertura", () => {
    expect(app).toContain("Validação dos modelos: o backtest publicado");
    expect(app).toMatch(/ganho != null && ganho < 0 \? "var\(--c-neg\)"/);
    expect(app).toContain("Ganho negativo significa que o ensemble perdeu do");
    expect(app).toContain("a primeira metade dos erros calibrando a");
  });

  it("o pseudo-backtest do ensemble é declarado como tal", () => {
    expect(app).toMatch(/pesos finais aplicados por origem — pseudo-backtest/);
  });

  it("o cenário condicional declara não ter backtest possível", () => {
    expect(app).toContain("não tem backtest possível — não há histórico de");
    expect(app).toMatch(/SUBESTIMAR a incerteza/);
  });

  it("os cards do Pulso linkam para o backtest completo", () => {
    expect(app).toContain('backtest completo →');
  });
});
