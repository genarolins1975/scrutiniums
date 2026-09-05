/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Expectativas de mercado (Focus) na aba Cenários. O que se trava:
 * - o bloco traz a última divulgação, três anos, cinco indicadores com mediana, dp e respondentes;
 * - os presets focus_{ano} existem, têm as quatro chaves dos controles, valores finitos no passo e
 *   dentro da faixa de cada controle, e reconciliam com a derivação (mediana − observado);
 * - a trajetória da Selic por reunião está ordenada; a SPA renderiza o cartão; o pipeline registra o coletor;
 * - a PTC (PDF) está declarada como fora da Fase 0.
 */
const raiz = process.cwd();
const read = (p: string) => readFileSync(join(raiz, p), "utf-8");
const lerGold = (n: string) => (existsSync(join(raiz, "public/obs/data/gold", n)) ? JSON.parse(read("public/obs/data/gold/" + n)) : null);
const S = lerGold("scenario.json") ?? {};
const E = S.expectativas ?? { disponivel: false };
const app = read("public/obs/app.js");
const comDado = !!E.disponivel;
const FAIXAS: Record<string, [number, number, number]> = { selic_pp: [-4, 8, 0.25], desemprego_pp: [-3, 6, 0.25], pib_pp: [-6, 4, 0.25], cambio_pct10: [-3, 6, 0.5] };

describe.skipIf(!comDado)("scenario.json: expectativas do Focus", () => {
  it("última divulgação, três anos, cinco indicadores com mediana, dp e respondentes", () => {
    expect(E.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(E.anos.length).toBe(3);
    expect(Number(E.anos[0])).toBe(Number(E.data.slice(0, 4)));
    for (const ind of ["Selic", "IPCA", "PIB Total", "Câmbio", "Taxa de desocupação"]) {
      const t = E.tabela[ind];
      expect(t, ind).toBeTruthy();
      for (const a of E.anos.slice(0, 2)) {
        expect(typeof t[a].mediana, `${ind} ${a}`).toBe("number");
        expect(t[a].n, `${ind} ${a}`).toBeGreaterThan(20);
        expect(t[a].dp).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it("presets focus_{ano} com as quatro chaves, no passo, na faixa, reconciliando com a derivação", () => {
    const nomes = Object.keys(E.presets);
    expect(nomes.length).toBeGreaterThanOrEqual(1);
    for (const nome of nomes) {
      expect(nome).toMatch(/^focus_\d{4}$/);
      expect(S.presets[nome], `${nome} no dicionário de presets da aba`).toEqual(E.presets[nome]);
      const d = E.derivacao[nome];
      for (const [k, [lo, hi, st]] of Object.entries(FAIXAS)) {
        const v = E.presets[nome][k];
        expect(Number.isFinite(v), `${nome}.${k}`).toBe(true);
        expect(v).toBeGreaterThanOrEqual(lo);
        expect(v).toBeLessThanOrEqual(hi);
        expect(Math.abs(v / st - Math.round(v / st)), `${nome}.${k} no passo ${st}`).toBeLessThan(1e-9);
        const esperado = Math.max(lo, Math.min(hi, Math.round(d.bruto[k] / st) * st));
        expect(Math.abs(v - esperado), `${nome}.${k} = arredondamento do bruto`).toBeLessThan(1e-9);
      }
      // bruto = mediana − observado
      expect(Math.abs(d.bruto.selic_pp - (d.esperado.selic - E.atual.selic_meta.v))).toBeLessThan(0.02);
      expect(Math.abs(d.bruto.desemprego_pp - (d.esperado.desemprego - E.atual.desemprego.v))).toBeLessThan(0.02);
    }
    // os presets originais continuam
    for (const p of ["base", "otimista", "adverso", "severamente_adverso"]) expect(S.presets[p]).toBeTruthy();
  });
  it("Selic por reunião ordenada por ano e número; cautelas declaram consenso ≠ previsão e a PTC em PDF", () => {
    const chaves = E.selic_reunioes.map((r: any) => `${r.reuniao.slice(3)}-${r.reuniao.slice(1, 2)}`);
    expect(chaves).toEqual(chaves.slice().sort());
    expect(E.cautelas.join(" ")).toMatch(/não é previsão/);
    expect(E.cautelas.join(" ")).toMatch(/PTC/);
  });
});

describe("SPA e pipeline: Focus registrado", () => {
  it("o cartão de expectativas entra na aba Cenários e o coletor está no pipeline", () => {
    expect(app).toContain("function scnExpectativas(E)");
    expect(app).toContain("${scnExpectativas(scenario.expectativas)}");
    expect(app).toContain('scenarios: ["bcb_sgs", "focus"]');
    expect(read("pipeline/run.py")).toContain('("focus", focus)');
    expect(read("pipeline/gold.py")).toContain('scenario["expectativas"] = exp');
    expect(read("config/config.json")).toContain('"key": "cambio_ptax"');
    expect(read("config/config.json")).toContain('"key": "desemprego"');
  });
});
