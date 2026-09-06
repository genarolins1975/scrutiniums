/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Captação dos bancos. O que se trava:
 * - sistema (SGS): componentes com share sobre M4 coerente; M2 ≤ M3 ≤ M4; série termina no mês publicado;
 * - bancos (IF.data Passivo): varejo + mercado + repasses = captações (agregado e por instituição);
 *   composição soma as captações; shares por instituição somam ~100; instituições ordenadas por captação;
 *   série trimestral atravessa os planos contábeis sem buraco no total;
 * - fundos (CDA): tipos somam o total; emissores em ordem de valor; LF + CDB + DPGE + outros = valor do emissor;
 *   mês parcial excluído; razão CDA ÷ LF só onde há LF no IF.data;
 * - a SPA registra a aba em todos os mapas e o pipeline registra os dois coletores novos e o gold.
 */
const raiz = process.cwd();
const read = (p: string) => readFileSync(join(raiz, p), "utf-8");
const lerGold = (n: string) => (existsSync(join(raiz, "public/obs/data/gold", n)) ? JSON.parse(read("public/obs/data/gold/" + n)) : null);
const D = lerGold("funding.json") ?? { disponivel: false };
const app = read("public/obs/app.js");
const html = read("public/obs/index.html");
const soma = (xs: any[], k: string) => xs.reduce((s, x) => s + (x[k] || 0), 0);
const decrescente = (xs: any[], k: string) => xs.every((x, i) => i === 0 || x[k] <= xs[i - 1][k]);

describe.skipIf(!D.disponivel || !D.sistema)("funding.json: sistema (SGS)", () => {
  const S = D.sistema;
  it("shares sobre M4 coerentes, agregados encaixados e série no mês publicado", () => {
    const m4 = S.agregados.find((a: any) => a.id === "m4").valor;
    for (const c of S.componentes) if (c.valor != null) expect(c.share_m4).toBeCloseTo((c.valor / m4) * 100, 1);
    const [m2, m3, m4a] = ["m2", "m3", "m4"].map((id) => S.agregados.find((a: any) => a.id === id).valor);
    expect(m2).toBeLessThanOrEqual(m3);
    expect(m3).toBeLessThanOrEqual(m4a);
    expect(S.serie[S.serie.length - 1].ref).toBe(S.mes);
    expect(S.serie[S.serie.length - 1].m4).toBe(m4);
    expect(m4).toBeGreaterThan(5e12); // em R$, não em R$ mil
  });
});

describe.skipIf(!D.disponivel || !D.bancos)("funding.json: bancos (IF.data Passivo)", () => {
  const B = D.bancos;
  it("varejo + mercado + repasses = captações; composição soma as captações; concentração coerente", () => {
    const cap = B.agregado.captacoes;
    expect(soma(B.grupos, "valor")).toBeCloseTo(cap, -6);
    expect(soma(B.composicao, "valor")).toBeCloseTo(cap, -6);
    expect(B.indicadores.soma_grupos_vs_captacoes_pct).toBeCloseTo(100, 0);
    expect(B.indicadores.varejo_share + B.indicadores.mercado_share + B.indicadores.repasses_share).toBeCloseTo(100, 0);
    expect(B.concentracao.top5_share).toBeGreaterThan(30);
    expect(B.concentracao.hhi).toBeGreaterThan(0);
    expect(B.concentracao.hhi).toBeLessThan(10000);
  });
  it("instituições ordenadas por captação, com composição somando ~100 e grupos fechando", () => {
    expect(decrescente(B.instituicoes, "captacoes")).toBe(true);
    for (const i of B.instituicoes) {
      const c = i.composicao;
      const total = Object.values(c).reduce((a: number, v: any) => a + (v || 0), 0);
      expect(total).toBeCloseTo(100, 0);
      expect(i.varejo_share + i.mercado_share + i.repasses_share).toBeCloseTo(100, 0);
      expect(i.share_sfn).toBeGreaterThan(0);
    }
    expect(soma(B.por_segmento, "n")).toBe(B.n_instituicoes);
    expect(soma(B.por_segmento, "captacoes")).toBeCloseTo(B.agregado.captacoes, -6);
  });
  it("série trimestral sem buraco no total e terminando no trimestre publicado", () => {
    expect(B.serie[B.serie.length - 1].anomes).toBe(B.anomes);
    for (const p of B.serie) {
      expect(p.captacoes).toBeGreaterThan(0);
      expect(p.varejo_share + p.mercado_share).toBeLessThanOrEqual(100.5);
    }
    expect(B.serie.length).toBeGreaterThanOrEqual(8);
  });
});

describe.skipIf(!D.disponivel || !D.fundos)("funding.json: fundos (CVM CDA)", () => {
  const U = D.fundos;
  it("tipos somam o total; emissores em ordem; papéis do emissor somam o valor; mês parcial fora", () => {
    expect(soma(U.por_tipo, "valor")).toBeCloseTo(U.total.valor, -3);
    expect(soma(U.por_tipo, "share")).toBeCloseTo(100, 0);
    expect(decrescente(U.emissores, "valor")).toBe(true);
    for (const e of U.emissores) {
      expect(e.lf + e.cdb + e.dpge + e.outros).toBeCloseTo(e.valor, -3);
      expect(e.nome).toBeTruthy();
      if (e.lf_cda_sobre_ifdata_pct != null) expect(e.lf_ifdata).toBeGreaterThan(0);
    }
    const ultimo = U.serie[U.serie.length - 1];
    if (ultimo.parcial) expect(U.mes_parcial_excluido).toBe(ultimo.mes);
    expect(U.serie.find((p: any) => p.mes === U.mes).parcial).toBe(false);
    expect(U.total.n_emissores).toBeGreaterThan(50);
    expect(U.total.share_pl).toBeGreaterThan(0);
    expect(U.total.share_pl).toBeLessThan(100);
  });
});

describe("SPA: aba registrada em todos os mapas", () => {
  it("rota, título, render, dados, vintage, coletores, chunk, guia, estado e HTML", () => {
    expect(app).toContain('funding: "/funding"');
    expect(app).toContain('funding: "Captação dos bancos"');
    expect(app).toContain('funding: "renderFunding"');
    expect(app).toContain('funding: ["funding"]');
    expect(app).toContain('funding: "ifdata"');
    expect(app).toContain('funding: ["bcb_sgs", "ifdata_passivo", "cvm_cda"]');
    expect(app).toContain('funding: "emergentes"');
    expect(app).toMatch(/\n  funding: \{ q: "[^"]+\?"/);
    expect(app).toContain("state.fd = {");
    expect(html).toContain('data-view="funding">Captação dos bancos</button>');
    expect(html).toContain('id="view-funding"');
  });
  it("o renderizador vive no chunk emergentes e o pipeline registra coletores, gold e vintage", () => {
    const k = app.indexOf("function renderFunding(");
    expect(k).toBeGreaterThan(app.indexOf("/* @chunk:emergentes:ini */"));
    expect(k).toBeLessThan(app.indexOf("/* @chunk:emergentes:fim */"));
    expect(read("pipeline/run.py")).toContain('("ifdata_passivo", ifdata_passivo), ("cvm_cda", cvm_cda)');
    const gold = read("pipeline/gold.py");
    expect(gold).toContain('common.write_gold("funding.json", r_fd)');
    expect(gold).toContain('"cda": _vg("SELECT MAX(mes) FROM cda_coleta")');
    expect(read("src/lib/data/observatorioAbas.ts")).toContain('caminho: "/funding"');
    expect(read("scripts/vigilancia.py")).toContain('"cda": 60');
    const cfg = JSON.parse(read("config/config.json"));
    const fd = cfg.sgs_series.filter((s: any) => s.category === "funding");
    expect(fd.length).toBe(16);
    expect(fd.map((s: any) => s.code)).toContain(27815);
  });
});
