/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Crédito direcionado e BNDES. O que se trava:
 * - três réguas separadas (saldo SGS, desembolsos BNDES, operações não automáticas), cada uma com sua data;
 * - a janela de desembolsos tem 12 meses fechados no último mês publicado; anual = soma do mensal;
 * - portes, setores, UFs e regiões somam 100 (ou o total) dentro do arredondamento;
 * - a cobertura das tabelas por produto é declarada e menor que 100%;
 * - as operações não automáticas não somam com os desembolsos e o recorte municipal é só delas;
 * - a SPA registra a aba em todos os mapas.
 */
const raiz = process.cwd();
const read = (p: string) => readFileSync(join(raiz, p), "utf-8");
const lerGold = (n: string) => (existsSync(join(raiz, "public/obs/data/gold", n)) ? JSON.parse(read("public/obs/data/gold/" + n)) : null);
const B = lerGold("bndes.json") ?? { disponivel: false };
const app = read("public/obs/app.js");
const html = read("public/obs/index.html");
const comDado = !!B.disponivel && !!B.desembolsos?.disponivel;
const soma = (xs: any[], k: string) => xs.reduce((s, x) => s + (x[k] || 0), 0);

describe.skipIf(!comDado)("bndes.json: desembolsos do Sistema BNDES", () => {
  const D = B.desembolsos;
  it("janela de 12 meses fechada no último mês publicado; KPI = soma da série; anual = soma do mensal", () => {
    expect(D.janela.fim).toBe(D.mes);
    const jan = D.serie_mensal.filter((p: any) => p.mes >= D.janela.ini && p.mes <= D.janela.fim);
    expect(jan.length).toBe(12);
    expect(Math.abs(soma(jan, "total") - D.kpis.desembolsos_12m)).toBeLessThan(0.01);
    expect(D.serie_mensal[D.serie_mensal.length - 1].total_12m).toBeCloseTo(D.kpis.desembolsos_12m, 0);
    for (const a of D.anual.slice(-5)) {
      const meses = D.serie_mensal.filter((p: any) => p.mes.startsWith(a.ano));
      if (meses.length === a.meses) expect(Math.abs(soma(meses, "total") - a.total), a.ano).toBeLessThan(0.01);
    }
  });
  it("portes somam o total; setores, UFs e regiões somam 100; 27 UFs com população", () => {
    expect(Math.abs(soma(D.por_porte, "valor") - D.kpis.desembolsos_12m)).toBeLessThan(0.01);
    expect(soma(D.por_porte, "share")).toBeCloseTo(100, 0);
    expect(soma(D.por_setor, "share")).toBeCloseTo(100, 0);
    expect(D.ufs.length).toBe(27);
    expect(soma(D.ufs, "share")).toBeCloseTo(100, 0);
    expect(soma(D.regioes, "share")).toBeCloseTo(100, 0);
    for (const u of D.ufs) expect(u.pop, u.uf).toBeGreaterThan(400000);
    // os desembolsos por UF fecham com o total por porte (mesma régua, tabelas distintas do BNDES)
    expect(Math.abs(soma(D.ufs, "valor") - D.kpis.desembolsos_12m) / D.kpis.desembolsos_12m).toBeLessThan(0.005);
  });
  it("as tabelas por produto cobrem só parte do desembolso e a cobertura é declarada", () => {
    expect(D.cobertura_produtos.pct).toBeGreaterThan(20);
    expect(D.cobertura_produtos.pct).toBeLessThan(100);
    expect(soma(D.produtos, "share")).toBeCloseTo(100, 0);
    expect(D.nota).toMatch(/indiretas automáticas/);
  });
  it("funil: razões entre 0 e 150 e total coerente; agentes com HHI e ano fechado", () => {
    for (const f of D.funil) {
      expect(f.aprov_sobre_consulta).toBeGreaterThan(0);
      expect(f.desemb_sobre_aprov).toBeLessThan(150);
    }
    expect(D.agentes.hhi).toBeGreaterThan(0);
    expect(D.agentes.hhi).toBeLessThan(10000);
    expect(Number(D.agentes.ano)).toBeLessThanOrEqual(Number(D.mes.slice(0, 4)));
    expect(D.agentes.top.some((a: any) => /SEM AGENTE/i.test(a.nome))).toBe(false);
  });
});

describe.skipIf(!comDado)("bndes.json: operações não automáticas", () => {
  const O = B.operacoes;
  it("janela fechada antes do último mês da base; recortes somam o total; município nulo declarado", () => {
    expect(O.disponivel).toBe(true);
    expect(O.janela.fim < O.ultimo_mes).toBe(true);
    for (const k of ["por_natureza", "por_forma", "por_modalidade"]) expect(soma(O[k], "share"), k).toBeCloseTo(100, 0);
    expect(O.top_municipios.some((m: any) => /SEM MUNIC/i.test(m.nome))).toBe(false);
    expect(O.kpis.sem_municipio_share).toBeGreaterThanOrEqual(0);
    expect(O.nota).toMatch(/NÃO automáticas/);
    expect(O.kpis.juros_medio).toBeGreaterThan(0);
    expect(O.kpis.juros_medio).toBeLessThan(20);
  });
  it("as três réguas não se somam: a cautela diz isso", () => {
    expect(B.cautelas.join(" ")).toMatch(/três réguas/);
    expect(B.cautelas.join(" ")).toMatch(/deflacionar/);
  });
});

describe.skipIf(!(comDado && B.saldo?.disponivel))("bndes.json: saldo direcionado (SGS)", () => {
  const S = B.saldo;
  it("participações entre 0 e 100, BNDES é subconjunto do direcionado PJ", () => {
    expect(S.kpis.share_direcionado).toBeGreaterThan(20);
    expect(S.kpis.share_direcionado).toBeLessThan(60);
    expect(S.kpis.pj.bndes).toBeLessThanOrEqual(S.kpis.pj.saldo);
    expect(S.kpis.pj.bndes_share_total_pj).toBeLessThan(S.kpis.pj.share_no_pj);
    expect(S.serie[0].mes < "2013-01").toBe(true);
  });
});

describe("SPA: aba registrada em todos os mapas", () => {
  it("rota, título, render, dados, vintage, coletores, chunk, guia, estado e HTML", () => {
    expect(app).toContain('bndes: "/directed-credit-bndes"');
    expect(app).toContain('bndes: "Crédito direcionado e BNDES"');
    expect(app).toContain('bndes: "renderBndes"');
    expect(app).toContain('bndes: ["bndes"]');
    expect(app).toContain('bndes: "bndes"');
    expect(app).toContain('bndes: ["bndes", "bcb_sgs"]');
    expect(app).toContain('bndes: "emergentes"');
    expect(app).toMatch(/\n  bndes: \{ q: "[^"]+\?"/);
    expect(app).toContain("state.bn = {");
    expect(html).toContain('data-view="bndes">Crédito direcionado e BNDES</button>');
    expect(html).toContain('id="view-bndes"');
  });
  it("o renderizador vive no chunk emergentes e o pipeline registra coletor, gold e séries", () => {
    const k = app.indexOf("function renderBndes(");
    expect(k).toBeGreaterThan(app.indexOf("/* @chunk:emergentes:ini */"));
    expect(k).toBeLessThan(app.indexOf("/* @chunk:emergentes:fim */"));
    expect(read("pipeline/run.py")).toContain('("bndes", bndes)');
    expect(read("pipeline/gold.py")).toContain('common.write_gold("bndes.json", r_bn)');
    expect(read("config/config.json")).toContain('"key": "dir_saldo_pj_bndes"');
    expect(read("src/lib/data/observatorioAbas.ts")).toContain('caminho: "/directed-credit-bndes"');
  });
});
