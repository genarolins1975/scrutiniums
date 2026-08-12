/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Pilar 3 (KM1) via DASFN. O coração: fonte federada com escalas
 * heterogêneas — a normalização tem régua declarada e valor fora de régua
 * é omitido, nunca publicado; ausência (Bradesco, Caixa) é declarada,
 * nunca silenciosa; LCR/NSFR ausente não é descumprimento.
 */

const raiz = process.cwd();
const G = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/pilar3.json"), "utf-8"));
const coletorPy = readFileSync(join(raiz, "pipeline/sources/pilar3.py"), "utf-8");
const runPy = readFileSync(join(raiz, "pipeline/run.py"), "utf-8");
const goldPy = readFileSync(join(raiz, "pipeline/gold.py"), "utf-8");
const appJs = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");

describe("estático: coletor federado com salvaguardas", () => {
  it("roda no pipeline diário e no gold", () => {
    expect(runPy).toContain('("pilar3", pilar3)');
    expect(goldPy).toContain("p3_mod.build");
  });

  it("a normalização tem régua declarada e as falhas consomem o cap", () => {
    expect(coletorPy).toMatch(/régua de plausibilidade/);
    expect(coletorPy).toMatch(/omitido, nunca publicado/);
    expect(coletorPy).toMatch(/falha consome o cap/);
    // sistêmicos primeiro: o cap nunca deixa os S1/S2 para depois
    expect(coletorPy).toMatch(/PRIORIDADE/);
  });

  it("a SPA renderiza o card na página da IF com join por CNPJ do líder", () => {
    expect(appJs).toContain('Liquidez e capital — ${termo("pilar-3","Pilar 3")} (KM1)');
    expect(appJs).toMatch(/x\.cnpj8 === cnpj8pg/);
  });
});

describe("gold pilar3.json publicado", () => {
  it("disponível, com cobertura e ausências declaradas", () => {
    expect(G.disponivel).toBe(true);
    expect(G.cobertura.com_dados).toBeGreaterThanOrEqual(20);
    const aus = (G.cobertura.ausencias_notaveis || []).join(" ");
    expect(aus).toMatch(/Bradesco/);
    expect(aus).toMatch(/Caixa/);
    const cautelas = (G.cautelas || []).join(" ");
    expect(cautelas).toMatch(/não está 'descumprindo'/);
    expect(cautelas).toMatch(/Ausência não é zero/);
  });

  it("todos os valores publicados estão nas réguas de plausibilidade", () => {
    for (const i of G.instituicoes) {
      expect(i.cnpj8, i.nome).toMatch(/^\d{8}$/);
      expect(i.periodo_ultimo, i.nome).toMatch(/^\d{4}-\d$/);
      for (const [met, serie] of Object.entries(i.series) as [string, any[]][]) {
        for (const pt of serie) {
          expect(pt.p, `${i.nome}:${met}`).toMatch(/^\d{4}-\d$/);
          if (met === "lcr_pct" || met === "nsfr_pct") {
            expect(pt.v, `${i.nome}:${met}@${pt.p}`).toBeGreaterThanOrEqual(20);
            expect(pt.v, `${i.nome}:${met}@${pt.p}`).toBeLessThanOrEqual(2000);
          } else {
            expect(pt.v, `${i.nome}:${met}@${pt.p}`).toBeGreaterThanOrEqual(0);
            expect(pt.v, `${i.nome}:${met}@${pt.p}`).toBeLessThanOrEqual(60);
          }
        }
        // série ordenada por período
        for (let k = 1; k < serie.length; k++) {
          expect(serie[k].p > serie[k - 1].p, `${i.nome}:${met}: série fora de ordem`).toBe(true);
        }
      }
    }
  });

  it("os sistêmicos com registro chegam com LCR e NSFR atuais", () => {
    const nomes = G.instituicoes.map((i: any) => i.nome.toUpperCase());
    for (const alvo of ["BCO DO BRASIL", "ITAU UNIBANCO", "SANTANDER"]) {
      const i = G.instituicoes[nomes.findIndex((n: string) => n.includes(alvo))];
      expect(i, alvo).toBeTruthy();
      expect(i.ultimo.lcr_pct, alvo).toBeGreaterThan(100);
      expect(i.ultimo.nsfr_pct, alvo).toBeGreaterThan(100);
    }
  });

  it("mínimos regulatórios anotados por métrica, nunca ranking no gold", () => {
    expect(G.metricas.lcr_pct.minimo).toBe(100);
    expect(G.metricas.nsfr_pct.minimo).toBe(100);
    expect(G.metricas.basileia_pct.minimo).toBe(8);
    for (const chave of Object.keys(G)) expect(chave).not.toMatch(/ranking/);
  });
});
