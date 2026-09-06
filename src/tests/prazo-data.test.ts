/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Prazo da carteira (SCR.data, seis faixas a vencer). O que se trava:
 * - a vencer = soma das faixas; vencido = carteira ativa menos a vencer; shares somam 100;
 * - curto = duas primeiras faixas, longo = duas últimas; prazo médio pelo ponto médio declarado;
 * - PF mais longa que PJ; série mensal contínua terminando na data-base; 27 UFs com posições 1 a 27;
 * - SPA e pipeline registrados; renderizador no chunk emergentes.
 */
const raiz = process.cwd();
const read = (p: string) => readFileSync(join(raiz, p), "utf-8");
const lerGold = (n: string) => (existsSync(join(raiz, "public/obs/data/gold", n)) ? JSON.parse(read("public/obs/data/gold/" + n)) : null);
const D = lerGold("prazo.json") ?? { disponivel: false };
const app = read("public/obs/app.js");
const html = read("public/obs/index.html");
const soma = (o: Record<string, number>) => Object.values(o).reduce((s, v) => s + (v || 0), 0);

describe.skipIf(!D.disponivel)("prazo.json: Brasil, faixas e aritmética", () => {
  it("a vencer é a soma das faixas, vencido é a diferença para a carteira ativa e os shares somam 100", () => {
    for (const k of ["total", "PF", "PJ"]) {
      const P = D.brasil[k];
      expect(soma(P.faixas)).toBeCloseTo(P.a_vencer, -3);
      expect(P.saldo - P.a_vencer).toBeCloseTo(P.vencido, -3);
      expect(soma(P.shares)).toBeCloseTo(100, 0);
      expect(P.curto_12m_pct).toBeCloseTo(P.shares.ate90 + P.shares.de91a360, 1);
      expect(P.longo_5a_pct).toBeCloseTo(P.shares.de1801a5400 + P.shares.mais5400, 1);
      expect(P.vencido_pct).toBeGreaterThan(0);
      expect(P.vencido_pct).toBeLessThan(15);
    }
    expect(D.brasil.total.a_vencer).toBeCloseTo(D.brasil.PF.a_vencer + D.brasil.PJ.a_vencer, -3);
  });
  it("prazo médio segue o ponto médio declarado das faixas e PF é mais longa que PJ", () => {
    const P = D.brasil.total;
    const pm = D.faixas.reduce((s: number, f: any) => s + P.faixas[f.id] * f.ponto_medio_dias, 0) / P.a_vencer / 365;
    expect(P.prazo_medio_anos).toBeCloseTo(pm, 1);
    expect(D.faixas.find((f: any) => f.id === "mais5400").ponto_medio_dias).toBe(7200);
    expect(D.brasil.PF.prazo_medio_anos).toBeGreaterThan(D.brasil.PJ.prazo_medio_anos);
    expect(D.brasil.PJ.curto_12m_pct).toBeGreaterThan(D.brasil.PF.curto_12m_pct);
  });
  it("série mensal contínua até a data-base, com variações de 12 meses calculadas contra o mês certo", () => {
    const S = D.serie;
    expect(S[S.length - 1].ref).toBe(D.data_base);
    expect(S[S.length - 1].total.curto_12m_pct).toBe(D.brasil.total.curto_12m_pct);
    for (let i = 1; i < S.length; i++) {
      const [y0, m0] = S[i - 1].ref.split("-").map(Number), [y1, m1] = S[i].ref.split("-").map(Number);
      expect(y1 * 12 + m1 - (y0 * 12 + m0)).toBe(1);
    }
    if (D.data_base_12m) {
      const antes = S.find((p: any) => p.ref === D.data_base_12m);
      expect(D.brasil.total.d12.curto_12m_pct).toBeCloseTo(D.brasil.total.curto_12m_pct - antes.total.curto_12m_pct, 1);
    }
  });
  it("27 UFs, shares somam 100, posições de 1 a 27 em cada régua, PF e PJ por UF", () => {
    expect(D.ufs.length).toBe(27);
    expect(D.ufs.reduce((s: number, u: any) => s + u.share_a_vencer, 0)).toBeCloseTo(100, 0);
    for (const k of ["curto_12m_pct", "longo_5a_pct", "prazo_medio_anos", "vencido_pct"]) {
      const pos = D.ufs.map((u: any) => u.posicoes[k]).sort((a: number, b: number) => a - b);
      expect(pos, k).toEqual(Array.from({ length: 27 }, (_, i) => i + 1));
    }
    for (const u of D.ufs) { expect(u.pf.curto_12m_pct, u.uf).toBeGreaterThan(0); expect(u.pj.curto_12m_pct, u.uf).toBeGreaterThan(0); expect(u.nome).toBeTruthy(); }
  });
  it("síntese, método e catálogo declaram a aproximação do prazo médio", () => {
    expect(D.sintese).toMatch(/prazo médio residual aproximado/);
    expect(D.metodo).toMatch(/7\.200 dias/);
    expect(D.catalogo.find((c: any) => c.nome === "Prazo médio residual").limitacoes).toMatch(/aproximação/);
  });
});

const U = lerGold("ufs.json");
describe.skipIf(!U || !U.disponivel || !D.disponivel || !(U.ufs || []).some((u: any) => u.prazo))("ufs.json: bloco de prazo nas páginas por UF", () => {
  it("cada UF carrega a vencer, curto prazo, prazo médio e posições iguais ao painel", () => {
    const porUF = Object.fromEntries(D.ufs.map((u: any) => [u.uf, u]));
    for (const u of U.ufs) {
      expect(u.prazo, u.uf).toBeTruthy();
      expect(u.prazo.curto_12m_pct).toBe(porUF[u.uf].curto_12m_pct);
      expect(u.prazo.prazo_medio_anos).toBe(porUF[u.uf].prazo_medio_anos);
      expect(u.posicoes["prazo.curto_12m_pct"]).toBe(porUF[u.uf].posicoes.curto_12m_pct);
    }
    expect(U.datas.prazo).toBe(D.data_base);
    expect(U.brasil.prazo_medio_anos).toBe(D.brasil.total.prazo_medio_anos);
  });
});

describe("SPA: aba Prazo da carteira registrada em todos os mapas", () => {
  it("rota, título, render, dados, vintage, coletores, chunk, guia, estado, mapa e HTML", () => {
    expect(app).toContain('prazo: "/loan-maturity"');
    expect(app).toContain('prazo: "Prazo da carteira"');
    expect(app).toContain('prazo: "renderPrazo"');
    expect(app).toContain('prazo: ["prazo"]');
    expect(app).toContain('prazo: "scr"');
    expect(app).toContain('prazo: ["scr_data"]');
    expect(app).toContain('prazo: "emergentes"');
    expect(app).toMatch(/\n  prazo: \{ q: "[^"]+\?"/);
    expect(app).toContain("state.pz = {");
    expect(app).toContain('views: ["products", "prazo", "juros", "rural", "bndes", "consorcios"]');
    expect(html).toContain('data-view="prazo">Prazo da carteira</button>');
    expect(html).toContain('id="view-prazo"');
  });
  it("o renderizador vive no chunk emergentes, abre com placar e síntese, e o pipeline registra builder e catálogo", () => {
    const k = app.indexOf("function renderPrazo(");
    expect(k).toBeGreaterThan(app.indexOf("/* @chunk:emergentes:ini */"));
    expect(k).toBeLessThan(app.indexOf("/* @chunk:emergentes:fim */"));
    const corpo = app.slice(k, app.indexOf("\nwindow.pzCSV", k));
    expect(corpo).toContain("abertura({");
    expect(corpo).toContain("sintese: [D.sintese]");
    const gold = read("pipeline/gold.py");
    expect(gold).toContain('common.write_gold("prazo.json", r_pz)');
    expect(gold.indexOf('common.write_gold("prazo.json", r_pz)')).toBeLessThan(gold.indexOf("ufs_mod.build(con, cfg)"));
    expect(read("pipeline/prazo.py")).toContain("PONTO_MEDIO_ABERTA_DIAS = 7200");
    expect(read("pipeline/sources/scr_data.py")).toContain("pz90 REAL, pz360 REAL, pz1080 REAL, pz1800 REAL, pz5400 REAL, pzmais REAL");
    expect(read("src/lib/data/observatorioAbas.ts")).toContain('caminho: "/loan-maturity"');
    expect(read("src/lib/telemetry.ts")).toContain('"obs:prazo"');
    // páginas por UF: builder lê prazo.json, ranqueia, e a página do estado tem o bloco e a entrada na subnav
    const ufs = read("pipeline/ufs.py");
    expect(ufs).toContain('prz = g("prazo.json")');
    expect(ufs).toContain('("prazo", "curto_12m_pct"), ("prazo", "prazo_medio_anos")');
    expect(app).toContain('bloco("uf-prazo", "Prazo da carteira"');
    expect(app).toContain('["#uf-prazo", "Prazo"]');
  });
});
