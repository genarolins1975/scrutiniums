/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Consórcios (Panorama do BCB). O que se trava:
 * - conferências aritméticas publicadas fecham (seções = total; UFs = total; carteira; rótulos corrigidos);
 * - segmentos: shares somam ~100 nas cotas; contemplação = contempladas ÷ cotas; sorteio + lance = 100;
 * - série trimestral contínua (4 por ano), termina no trimestre publicado, valores em unidades e R$ (não em mil/bi);
 * - UFs: 27, share soma 100, posições 1 a 27, por mil habitantes com população;
 * - páginas por UF carregam o bloco; SPA e pipeline registrados.
 */
const raiz = process.cwd();
const read = (p: string) => readFileSync(join(raiz, p), "utf-8");
const lerGold = (n: string) => (existsSync(join(raiz, "public/obs/data/gold", n)) ? JSON.parse(read("public/obs/data/gold/" + n)) : null);
const D = lerGold("consorcios.json") ?? { disponivel: false };
const U = lerGold("ufs.json");
const app = read("public/obs/app.js");
const html = read("public/obs/index.html");
const soma = (xs: any[], k: string) => xs.reduce((s, x) => s + (x[k] || 0), 0);

describe.skipIf(!D.disponivel)("consorcios.json: panorama e conferências", () => {
  it("as conferências aritméticas fecham em menos de 0,1% e as unidades corrigidas estão declaradas", () => {
    expect(D.conferencias.length).toBeGreaterThanOrEqual(5);
    for (const c of D.conferencias) expect(Math.abs(c.diferenca_pct)).toBeLessThan(0.1);
    expect(D.unidades_corrigidas).toEqual({ "37": "mil", "68": "R$ bilhões", "77": "R$ milhões" });
    expect(D.metodo).toMatch(/conferência aritmética/);
  });
  it("panorama em unidades e R$: cotas em milhões de unidades, carteira em centenas de R$ bi, recursos a coletar acima da carteira", () => {
    const P = D.panorama;
    expect(P.cotas).toBeGreaterThan(5e6);
    expect(P.carteira).toBeGreaterThan(1e10);
    expect(P.a_coletar).toBeGreaterThan(P.carteira);
    expect(P.sorteio_share + P.lance_share).toBeCloseTo(100, 0);
    expect(P.contemplacao_12m_pct).toBeCloseTo((P.contempladas_12m / P.cotas) * 100, 1);
    expect(P.rnp_devolvido_svr).toBeLessThan(P.rnp_saldo * 10);
    expect(P.taxa_adm_pct).toBeGreaterThan(5);
    expect(P.taxa_adm_pct).toBeLessThan(40);
  });
});

describe.skipIf(!D.disponivel)("consorcios.json: segmentos, série e UFs", () => {
  it("segmentos somam as cotas; contemplação coerente; sorteio + lance = 100 onde publicado", () => {
    expect(soma(D.segmentos, "share_cotas")).toBeCloseTo(100, 0);
    for (const s of D.segmentos) {
      if (s.contempladas_12m != null) {
        expect(s.contemplacao_12m_pct).toBeCloseTo((s.contempladas_12m / s.cotas) * 100, 1);
        expect(s.sorteio_share + s.lance_share).toBeCloseTo(100, 0);
      }
      if (s.id === "pesados") expect(s.carteira).toBeNull(); // não publicada em separado: ausência é nulo
    }
    expect(D.panorama.carteira_pesados_e_comerciais_leves).toBeGreaterThan(0);
  });
  it("série trimestral contínua, terminando no trimestre publicado", () => {
    const S = D.serie;
    expect(S[S.length - 1].ref).toBe(D.trimestre);
    expect(S[S.length - 1].cotas).toBe(D.panorama.cotas);
    for (let i = 1; i < S.length; i++) {
      const [y0, t0] = S[i - 1].ref.split("-T").map(Number), [y1, t1] = S[i].ref.split("-T").map(Number);
      expect(y1 * 4 + t1 - (y0 * 4 + t0)).toBe(1);
    }
    expect(S.length).toBeGreaterThanOrEqual(8);
  });
  it("27 UFs, share soma 100, posições de 1 a 27, por mil habitantes com população", () => {
    expect(D.ufs.length).toBe(27);
    expect(soma(D.ufs, "share")).toBeCloseTo(100, 0);
    const pos = D.ufs.map((u: any) => u.posicoes.cotas).sort((a: number, b: number) => a - b);
    expect(pos).toEqual(Array.from({ length: 27 }, (_, i) => i + 1));
    expect(D.ufs.filter((u: any) => u.por_mil_hab != null).length).toBe(27);
    expect(D.cotas_por_mil_hab_br).toBeGreaterThan(10);
  });
});

describe.skipIf(!U || !U.disponivel || !D.disponivel)("ufs.json: bloco de consórcios nas páginas por UF", () => {
  it("cada UF carrega cotas, share e por mil habitantes do painel, com posições", () => {
    const porUF = Object.fromEntries(D.ufs.map((u: any) => [u.uf, u]));
    for (const u of U.ufs) {
      expect(u.consorcios).toBeTruthy();
      expect(u.consorcios.cotas).toBe(porUF[u.uf].cotas);
      expect(u.posicoes["consorcios.cotas"]).toBe(porUF[u.uf].posicoes.cotas);
    }
    expect(U.datas.consorcios).toBe(D.trimestre);
  });
});

describe("SPA: aba registrada em todos os mapas", () => {
  it("rota, título, render, dados, vintage, coletores, chunk, guia, estado e HTML", () => {
    expect(app).toContain('consorcios: "/consortia"');
    expect(app).toContain('consorcios: "Consórcios"');
    expect(app).toContain('consorcios: "renderConsorcios"');
    expect(app).toContain('consorcios: ["consorcios"]');
    expect(app).toContain('consorcios: "consorcios"');
    expect(app).toContain('consorcios: ["bcb_consorcios"]');
    expect(app).toContain('consorcios: "emergentes"');
    expect(app).toMatch(/\n  consorcios: \{ q: "[^"]+\?"/);
    expect(app).toContain("state.cs = {");
    expect(html).toContain('data-view="consorcios">Consórcios</button>');
    expect(html).toContain('id="view-consorcios"');
    expect(app).toContain('["consorcios", "Consórcios", "consorcios"]');
    expect(app).toContain('["#uf-consorcios", "Consórcios"]');
  });
  it("o renderizador vive no chunk emergentes e o pipeline registra coletor, gold e vintage antes das páginas por UF", () => {
    const k = app.indexOf("function renderConsorcios(");
    expect(k).toBeGreaterThan(app.indexOf("/* @chunk:emergentes:ini */"));
    expect(k).toBeLessThan(app.indexOf("/* @chunk:emergentes:fim */"));
    expect(read("pipeline/run.py")).toContain('("bcb_consorcios", bcb_consorcios)');
    const gold = read("pipeline/gold.py");
    expect(gold).toContain('common.write_gold("consorcios.json", r_cs)');
    expect(gold.indexOf('common.write_gold("consorcios.json", r_cs)')).toBeLessThan(gold.indexOf("ufs_mod.build(con, cfg)"));
    expect(gold).toContain('"consorcios": _vg("SELECT MAX(database) FROM consorcios")');
    expect(read("src/lib/data/observatorioAbas.ts")).toContain('caminho: "/consortia"');
    expect(read("scripts/vigilancia.py")).toContain('"consorcios": 135');
    expect(read("pipeline/sources/bcb_consorcios.py")).toContain("PANORAMA_DE_CONSORCIOS");
  });
});
