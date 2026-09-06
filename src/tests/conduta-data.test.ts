/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Sanções e reclamações. O que se trava:
 * - BCB: janela de 12 meses coerente (multas ≤ decisões, PJ + PF ≤ decisões), penalidades somam as decisões,
 *   cobrança das multas soma 100, ano corrente marcado como parcial, lista recente em ordem cronológica;
 * - CVM: fases somam os processos, em curso + finalizados = processos, lista recente cronológica;
 * - regra editorial: sem ranking por instituição (cautela declarada, listas cronológicas, sem ordenação por nome);
 * - a SPA registra a aba em todos os mapas e o pipeline registra os dois coletores.
 */
const raiz = process.cwd();
const read = (p: string) => readFileSync(join(raiz, p), "utf-8");
const lerGold = (n: string) => (existsSync(join(raiz, "public/obs/data/gold", n)) ? JSON.parse(read("public/obs/data/gold/" + n)) : null);
const D = lerGold("conduta.json") ?? { disponivel: false };
const app = read("public/obs/app.js");
const html = read("public/obs/index.html");
const comBcb = !!D.disponivel && !!D.bcb?.disponivel;
const comCvm = !!D.disponivel && !!D.cvm?.disponivel;
const soma = (xs: any[], k: string) => xs.reduce((s, x) => s + (x[k] || 0), 0);
const cronologica = (xs: any[], k: string) => xs.every((x, i) => i === 0 || x[k] <= xs[i - 1][k]);

describe.skipIf(!comBcb)("conduta.json: PAS do BCB", () => {
  const B = D.bcb;
  it("janela de 12 meses coerente e penalidades somam as decisões", () => {
    const j = B.janela_12m;
    expect(j.decisoes).toBeGreaterThan(0);
    expect(j.processos).toBeLessThanOrEqual(j.decisoes);
    expect(j.multas_n).toBeLessThanOrEqual(j.decisoes);
    expect(j.pj + j.pf).toBeLessThanOrEqual(j.decisoes);
    expect(soma(B.penas_12m, "n")).toBe(j.decisoes);
    expect(soma(B.cobranca_multas, "share")).toBeCloseTo(100, 0);
    expect(j.multa_mediana).toBeGreaterThan(0);
  });
  it("ano a ano: corrente marcado como parcial; multas ≤ decisões; a lista recente é cronológica", () => {
    const ult = B.anual[B.anual.length - 1];
    expect(ult.incompleto).toBe(ult.ano === B.ultima_decisao.slice(0, 4));
    for (const a of B.anual) {
      expect(a.multas_n, a.ano).toBeLessThanOrEqual(a.decisoes);
      expect(a.processos, a.ano).toBeLessThanOrEqual(a.decisoes);
    }
    expect(cronologica(B.recentes, "decisao")).toBe(true);
    expect(B.recentes[0].decisao).toBe(B.ultima_decisao);
    expect(B.inabilitados.vigentes).toBe(soma(B.inabilitados.por_prazo, "n"));
  });
});

describe.skipIf(!comCvm)("conduta.json: PAS da CVM", () => {
  const C = D.cvm;
  it("fases somam os processos; em curso + finalizados = processos; lista recente cronológica", () => {
    expect(soma(C.fases, "n")).toBe(C.acervo.processos);
    expect(C.acervo.em_curso + C.acervo.finalizados).toBe(C.acervo.processos);
    expect(soma(C.anual, "processos")).toBeLessThanOrEqual(C.acervo.processos);
    expect(cronologica(C.recentes, "abertura")).toBe(true);
    expect(C.duracao_finalizados_meses.mediana).toBeGreaterThan(0);
    expect(C.nota).toMatch(/não traz o resultado/);
  });
});

describe.skipIf(!D.disponivel)("regra editorial: sem ranking por instituição", () => {
  it("cautelas declaram a regra; as listas nominais são cronológicas; a SPA não ordena por nome ou valor", () => {
    expect(D.cautelas.join(" ")).toMatch(/não ordena instituições/);
    expect(app).toContain("ordem cronológica, nunca por valor ou por nome");
    expect(app).not.toMatch(/recentes\.sort\(/);
    expect(app).not.toMatch(/sort\(\(a, b\) => b\.multa/);
  });
});

describe("SPA: aba registrada em todos os mapas", () => {
  it("rota, título, render, dados, vintage, coletores, chunk, guia, estado e HTML", () => {
    expect(app).toContain('conduta: "/conduct-enforcement"');
    expect(app).toContain('conduta: "Sanções e reclamações"');
    expect(app).toContain('conduta: "renderConduta"');
    expect(app).toContain('conduta: ["conduta"]');
    expect(app).toContain('conduta: "bcb_pas"');
    expect(app).toContain('conduta: ["bcb_pas", "cvm_pas", "reclamacoes"]');
    expect(app).toContain('conduta: "emergentes"');
    expect(app).toMatch(/\n  conduta: \{ q: "[^"]+\?"/);
    expect(app).toContain("state.cd = {");
    expect(html).toContain('data-view="conduta">Sanções e reclamações</button>');
    expect(html).toContain('id="view-conduta"');
  });
  it("o renderizador vive no chunk emergentes e o pipeline registra coletores e gold", () => {
    const k = app.indexOf("function renderConduta(");
    expect(k).toBeGreaterThan(app.indexOf("/* @chunk:emergentes:ini */"));
    expect(k).toBeLessThan(app.indexOf("/* @chunk:emergentes:fim */"));
    expect(read("pipeline/run.py")).toContain('("bcb_pas", bcb_pas), ("cvm_pas", cvm_pas)');
    expect(read("pipeline/gold.py")).toContain('common.write_gold("conduta.json", r_cd)');
    expect(read("src/lib/data/observatorioAbas.ts")).toContain('caminho: "/conduct-enforcement"');
  });
});
