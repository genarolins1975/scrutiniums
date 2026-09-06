/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Bancos cobrando na Justiça (DataJud, agregação). O que se trava:
 * - janela de 12 meses fecha antes dos 3 meses parciais; série contínua mensal; parciais marcados;
 * - Brasil = soma dos grupos; bancário ≤ todos em todo mês, grupo e UF; share bancário coerente;
 * - grupos: classes TPU declaradas (12154 e 159 somadas; 81; 40; 1117); série por grupo soma a série Brasil;
 * - UFs: só tribunais coletados, cobertura declarada (faltam), posições 1..n, por mil habitantes e por carteira com denominadores;
 * - páginas por UF carregam o bloco; SPA e pipeline registrados.
 */
const raiz = process.cwd();
const read = (p: string) => readFileSync(join(raiz, p), "utf-8");
const lerGold = (n: string) => (existsSync(join(raiz, "public/obs/data/gold", n)) ? JSON.parse(read("public/obs/data/gold/" + n)) : null);
const D = lerGold("cobranca.json") ?? { disponivel: false };
const U = lerGold("ufs.json");
const app = read("public/obs/app.js");
const html = read("public/obs/index.html");
const soma = (xs: any[], k: string) => xs.reduce((s, x) => s + (x[k] || 0), 0);
const mesMais = (m: string, n: number) => { const t = Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1 + n; return `${String(Math.floor(t / 12)).padStart(4, "0")}-${String((t % 12) + 1).padStart(2, "0")}`; };

describe.skipIf(!D.disponivel)("cobranca.json: janela, série e recortes", () => {
  it("a janela de 12 meses fecha antes dos 3 meses parciais e a série é contínua com os parciais marcados", () => {
    expect(D.meses_parciais.length).toBe(3);
    expect(mesMais(D.mes, 1)).toBe(D.meses_parciais[0]);
    expect(D.janela_12m.fim).toBe(D.mes);
    expect(mesMais(D.janela_12m.inicio, 11)).toBe(D.mes);
    const S = D.serie;
    for (let i = 1; i < S.length; i++) expect(S[i].mes).toBe(mesMais(S[i - 1].mes, 1));
    for (const p of S) expect(p.parcial).toBe(D.meses_parciais.includes(p.mes));
    expect(S[0].mes).toBe("2019-01");
  });
  it("bancário nunca excede o total; Brasil = soma dos grupos; série por grupo soma a série Brasil", () => {
    const B = D.brasil;
    expect(B.casos_12m).toBeLessThanOrEqual(B.casos_12m_todos);
    expect(B.casos_12m).toBe(soma(D.grupos.map((g: any) => g.bancario), "casos_12m"));
    expect(B.casos_12m_todos).toBe(soma(D.grupos.map((g: any) => g.todos), "casos_12m"));
    expect(B.bancario_share).toBeCloseTo((B.casos_12m / B.casos_12m_todos) * 100, 1);
    for (const p of D.serie) {
      expect(p.bancario).toBeLessThanOrEqual(p.todos);
      expect(D.grupos.reduce((s: number, g: any) => s + p[g.id], 0)).toBe(p.bancario);
    }
    for (const g of D.grupos) {
      expect(g.bancario.casos_12m).toBeLessThanOrEqual(g.todos.casos_12m);
      const janela = g.serie.filter((p: any) => p.mes >= D.janela_12m.inicio && p.mes <= D.janela_12m.fim);
      expect(janela.length).toBe(12);
      expect(soma(janela, "bancario")).toBe(g.bancario.casos_12m);
    }
  });
  it("classes TPU declaradas e assuntos bancários listados", () => {
    const porId = Object.fromEntries(D.grupos.map((g: any) => [g.id, g]));
    expect(porId.execucao.classes_tpu).toEqual([12154, 159]);
    expect(porId.busca_apreensao.classes_tpu).toEqual([81]);
    expect(porId.monitoria.classes_tpu).toEqual([40]);
    expect(porId.exec_hipotecaria.classes_tpu).toEqual([1117]);
    expect(D.assuntos_bancarios.map((a: any) => a.codigo)).toContain(9607);
    expect(porId.busca_apreensao.bancario_share).toBeGreaterThan(80); // alienação fiduciária é o assunto da classe
  });
});

describe.skipIf(!D.disponivel)("cobranca.json: UFs e cobertura", () => {
  it("só tribunais coletados, cobertura declarada, posições 1..n, denominadores presentes", () => {
    const C = D.cobertura;
    expect(D.ufs.length).toBe(C.tribunais);
    expect(C.ufs.length + C.faltam.length).toBe(27);
    const pos = D.ufs.map((u: any) => u.posicoes.casos_12m).sort((a: number, b: number) => a - b);
    expect(pos).toEqual(Array.from({ length: D.ufs.length }, (_, i) => i + 1));
    for (const u of D.ufs) {
      expect(u.casos_12m).toBeLessThanOrEqual(u.casos_12m_todos);
      expect(Object.values(u.grupos).reduce((a: number, v: any) => a + v, 0)).toBe(u.casos_12m);
      expect(u.tribunal).toBe("TJ" + (u.uf === "DF" ? "DFT" : u.uf));
      if (u.por_mil_hab != null) expect(u.por_mil_hab).toBeGreaterThan(0);
    }
    expect(soma(D.ufs, "casos_12m")).toBe(D.brasil.casos_12m);
  });
});

describe.skipIf(!U || !U.disponivel || !D.disponivel)("ufs.json: bloco de cobrança nas páginas por UF", () => {
  it("UFs cobertas carregam casos, por mil habitantes e por carteira, com posições", () => {
    const porUF = Object.fromEntries(D.ufs.map((u: any) => [u.uf, u]));
    for (const u of U.ufs) {
      if (!porUF[u.uf]) { expect(u.cobranca).toBeNull(); continue; }
      expect(u.cobranca.casos_12m).toBe(porUF[u.uf].casos_12m);
      expect(u.posicoes["cobranca.por_mil_hab"]).toBe(porUF[u.uf].posicoes.por_mil_hab);
    }
    expect(U.datas.cobranca).toBe(D.mes);
  });
});

describe("SPA: aba registrada em todos os mapas", () => {
  it("rota, título, render, dados, vintage, coletores, chunk, guia, estado e HTML", () => {
    expect(app).toContain('cobranca: "/debt-collection-lawsuits"');
    expect(app).toContain('cobranca: "Bancos cobrando na Justiça"');
    expect(app).toContain('cobranca: "renderCobranca"');
    expect(app).toContain('cobranca: ["cobranca"]');
    expect(app).toContain('cobranca: "cobranca"');
    expect(app).toContain('cobranca: ["datajud_cobranca"]');
    expect(app).toContain('cobranca: "emergentes"');
    expect(app).toMatch(/\n  cobranca: \{ q: "[^"]+\?"/);
    expect(app).toContain("state.cb = {");
    expect(html).toContain('data-view="cobranca">Bancos cobrando na Justiça</button>');
    expect(html).toContain('id="view-cobranca"');
    expect(app).toContain('["cobranca", "Cobrança judicial", "cobranca"]');
    expect(app).toContain('["#uf-cobranca", "Cobrança"]');
  });
  it("o renderizador vive no chunk emergentes e o pipeline registra coletor, gold e vintage antes das páginas por UF", () => {
    const k = app.indexOf("function renderCobranca(");
    expect(k).toBeGreaterThan(app.indexOf("/* @chunk:emergentes:ini */"));
    expect(k).toBeLessThan(app.indexOf("/* @chunk:emergentes:fim */"));
    expect(read("pipeline/run.py")).toContain('("datajud_cobranca", datajud_cobranca)');
    const gold = read("pipeline/gold.py");
    expect(gold).toContain('common.write_gold("cobranca.json", r_cb)');
    expect(gold.indexOf('common.write_gold("cobranca.json", r_cb)')).toBeLessThan(gold.indexOf("ufs_mod.build(con, cfg)"));
    expect(gold).toContain('"cobranca": _vg("SELECT MAX(mes) FROM cobranca_mensal WHERE casos > 0")');
    expect(read("src/lib/data/observatorioAbas.ts")).toContain('caminho: "/debt-collection-lawsuits"');
    expect(read("scripts/vigilancia.py")).toContain('"cobranca": 150');
    const col = read("pipeline/sources/datajud_cobranca.py");
    expect(col).toContain('"date_range"'); // agregação, nunca download de documentos
    expect(col).not.toContain("search_after");
    expect(col).toContain("TRIBUNAIS_POR_EXECUCAO = 9");
  });
});
