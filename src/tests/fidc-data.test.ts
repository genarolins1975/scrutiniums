/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * FIDCs por lastro e classe de cota (informes CVM). O que se trava:
 * - lastro: grupos somam a base coberta e os subitens somam o grupo; cobertura declarada abaixo de 100%;
 * - classes: só fundos com 2+ classes, itens somam o PL multiclasse, subordinação = mezanino + subordinada,
 *   fundos de classe única em linha própria (imune à renomeação da CVM de 2025-12);
 * - prazos: faixas somam a vencer; inadimplentes por atraso somam 100%;
 * - inadimplência do sistema é créditos existentes inadimplentes (I.2.a.3 + I.2.b.3), com a medida antiga ao lado;
 * - o coletor lê as quatro tabelas e o sinal do Sinais antecedentes tem o rótulo certo;
 * - SPA e pipeline registrados; renderizador no chunk emergentes.
 */
const raiz = process.cwd();
const read = (p: string) => readFileSync(join(raiz, p), "utf-8");
const lerGold = (n: string) => (existsSync(join(raiz, "public/obs/data/gold", n)) ? JSON.parse(read("public/obs/data/gold/" + n)) : null);
const D = lerGold("fidc.json") ?? { disponivel: false };
const app = read("public/obs/app.js");
const html = read("public/obs/index.html");
const soma = (xs: any[], k: string) => xs.reduce((s, x) => s + (x[k] || 0), 0);

describe.skipIf(!D.disponivel)("fidc.json: sistema, lastro, classes e prazos", () => {
  it("sistema: milhares de fundos, carteira acima de R$ 500 bi, inadimplência entre 0 e 15%, medida antiga ao lado", () => {
    const S = D.sistema;
    expect(S.n_fundos).toBeGreaterThan(2000);
    expect(S.carteira).toBeGreaterThan(5e11);
    expect(S.inad_pct).toBeGreaterThan(0);
    expect(S.inad_pct).toBeLessThan(15);
    expect(S.parcelas_inad_pct).toBeGreaterThan(0);
    expect(D.meses_parciais.every((m: string) => m > D.mes)).toBe(true);
  });
  it("lastro: grupos somam a base coberta, subitens somam o grupo, cobertura declarada e abaixo de 100%", () => {
    const L = D.lastro;
    expect(soma(L.grupos, "valor")).toBeCloseTo(L.base, -6);
    expect(soma(L.grupos, "share_pct")).toBeCloseTo(100, 0);
    for (const g of L.grupos) if (g.sub.length) expect(soma(g.sub, "valor"), g.id).toBeCloseTo(g.valor, -6);
    expect(L.cobertura.n_fundos).toBeLessThan(L.cobertura.n_fundos_total);
    expect(L.cobertura.share_carteira_pct).toBeGreaterThan(50);
    expect(L.cobertura.share_carteira_pct).toBeLessThan(100);
    expect(L.grupos[0].valor).toBeGreaterThanOrEqual(L.grupos[1].valor);
    expect(L.grupos.find((g: any) => g.id === "G").nome).toBe("Cartão de crédito");
  });
  it("classes: itens somam o PL multiclasse, subordinação = mezanino + subordinada, classe única em linha própria", () => {
    const C = D.classes;
    expect(soma(C.itens, "pl")).toBeCloseTo(C.pl_multiclasse, -6);
    const pl = Object.fromEntries(C.itens.map((x: any) => [x.id, x.pl]));
    expect(C.subordinacao_pct).toBeCloseTo(((pl.mezanino || 0) + (pl.subordinada || 0)) / C.pl_multiclasse * 100, 1);
    expect(C.subordinacao_pct).toBeGreaterThan(10);
    expect(C.subordinacao_pct).toBeLessThan(70);
    expect(C.monoclasse.n_fundos).toBeGreaterThan(100);
    expect(C.monoclasse.share_pl_pct).toBeCloseTo(C.monoclasse.pl / C.cobertura.pl_ok * 100, 1);
    expect(C.cobertura.share_pl_pct).toBeGreaterThan(90);
    // a série de subordinação não pode carregar o degrau da renomeação de 2025-12 (mais de 10 p.p. num mês)
    const s = D.serie.filter((p: any) => !p.parcial && p.subordinacao_pct != null);
    for (let i = 1; i < s.length; i++) expect(Math.abs(s[i].subordinacao_pct - s[i - 1].subordinacao_pct), s[i].mes).toBeLessThan(10);
  });
  it("prazos: faixas somam a vencer e as parcelas inadimplentes por atraso somam 100%", () => {
    const P = D.prazo;
    expect(soma(P.faixas, "a_vencer")).toBeCloseTo(P.a_vencer, -6);
    expect(soma(P.faixas, "share_pct")).toBeCloseTo(100, 0);
    expect(soma(P.faixas, "inad_share_pct")).toBeCloseTo(100, 0);
    expect(P.faixas.length).toBe(10);
    expect(P.cobertura.n_fundos).toBeLessThan(P.cobertura.n_fundos_total);
  });
  it("série mensal termina no mês publicado e traz as duas medidas de inadimplência", () => {
    const S = D.serie.filter((p: any) => !p.parcial);
    expect(S[S.length - 1].mes).toBe(D.mes);
    expect(S[S.length - 1].inad_pct).toBe(D.sistema.inad_pct);
    expect(S[S.length - 1].parcelas_inad_pct).toBe(D.sistema.parcelas_inad_pct);
  });
});

describe("coletor e rótulos: as quatro tabelas do informe e a inadimplência com o nome certo", () => {
  it("o coletor lê tab I (com créditos inadimplentes), tab II, tab IV, tab X.2 e tab VI, valida classes contra o PL e separa classe única", () => {
    const c = read("pipeline/sources/fidc.py");
    expect(c).toContain('TAB_I2A3_VL_CRED_INAD');
    expect(c).toContain('ALTER TABLE fidc_agg ADD COLUMN cred_inad REAL');
    for (const t of ['_tab(zf, "II")', '_tab(zf, "IV")', '_tab(zf, "X_2")', '_tab(zf, "VI")']) expect(c).toContain(t);
    expect(c).toContain("TOLERANCIA_PL = 0.20");
    expect(c).toContain('classes["monoclasse"]');
    expect(c).toContain('("G", "TAB_II_G_VL_CREDITO", "Cartão de crédito", None)');
  });
  it("ampliado.serie_fidc publica inad_pct como créditos inadimplentes e a medida antiga como parcelas_inad_pct; o sinal antecedente tem o rótulo certo", () => {
    const a = read("pipeline/ampliado.py");
    expect(a).toContain('"inad_pct": _r(ci / c * 100) if c and ci is not None else None');
    expect(a).toContain('"parcelas_inad_pct": _r(vi / c * 100) if c else None');
    expect(a).not.toContain('"atraso_pct": _r((vi + va) / c * 100)');
    expect(read("pipeline/leading.py")).toContain('"FIDCs — créditos inadimplentes / carteira"');
    expect(app).not.toContain("vencidos inadimplentes (${FI.mes})");
  });
});

describe("SPA: aba FIDCs registrada em todos os mapas", () => {
  it("rota, título, render, dados, vintage, coletores, chunk, guia, estado, mapa e HTML", () => {
    expect(app).toContain('fidc: "/fidc-receivables"');
    expect(app).toContain('fidc: "FIDCs por lastro e cota"');
    expect(app).toContain('fidc: "renderFidc"');
    expect(app).toContain('fidc: ["fidc"]');
    expect(app).toContain('fidc: "fidc"');
    expect(app).toContain('fidc: "emergentes"');
    expect(app).toMatch(/\n  fidc: \{ q: "[^"]+\?"/);
    expect(app).toContain("state.fi = {");
    expect(app).toContain('views: ["funding", "ampliado", "fidc"]');
    expect(html).toContain('data-view="fidc">FIDCs por lastro e cota</button>');
    expect(html).toContain('id="view-fidc"');
  });
  it("o renderizador vive no chunk emergentes, abre com placar e síntese, e o pipeline registra builder e catálogo", () => {
    const k = app.indexOf("function renderFidc(");
    expect(k).toBeGreaterThan(app.indexOf("/* @chunk:emergentes:ini */"));
    expect(k).toBeLessThan(app.indexOf("/* @chunk:emergentes:fim */"));
    const corpo = app.slice(k, app.indexOf("\nwindow.fiCSV", k));
    expect(corpo).toContain("abertura({");
    expect(corpo).toContain("sintese: [D.sintese]");
    const gold = read("pipeline/gold.py");
    expect(gold).toContain('common.write_gold("fidc.json", r_fi)');
    expect(gold).toContain('"fidc": _vg("SELECT MAX(anomes) FROM fidc_agg")');
    expect(read("src/lib/data/observatorioAbas.ts")).toContain('caminho: "/fidc-receivables"');
    expect(read("src/lib/telemetry.ts")).toContain('"obs:fidc"');
    expect(read("scripts/vigilancia.py")).toContain('"fidc": 75');
  });
});
