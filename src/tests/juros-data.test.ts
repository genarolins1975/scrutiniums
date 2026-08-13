/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isViewSection, sectionLabel } from "@/lib/telemetry";

/**
 * Consistência da aba Taxas de Juros por IF: rankings ordenados, estatísticas
 * coerentes (min ≤ p25 ≤ mediana ≤ p75 ≤ max), conceitos declarados (taxa de
 * novas operações ≠ CET ≠ carteira), séries mensais ordenadas e perfil por IF
 * consistente com os rankings.
 */

function load(rel: string) {
  return JSON.parse(readFileSync(join(process.cwd(), rel), "utf-8"));
}
const J = load("public/obs/data/gold/juros.json");

describe("juros.json: estrutura e conceitos", () => {
  it("20 modalidades PF/PJ com fonte e conceitos declarados", () => {
    expect(J.modalidades.length).toBe(20);
    expect(J.fonte).toMatch(/txjuros/);
    for (const c of ["taxa", "janela", "mediana_vs_media_bc", "spread_selic", "carteira", "persistencia"]) {
      expect(J.conceitos[c], c).toBeTruthy();
    }
    expect(J.conceitos.taxa).toMatch(/NÃO é CET/);
    expect(J.conceitos.spread_selic).toMatch(/APROXIMAÇÃO/i);
    const segs = new Set(J.modalidades.map((m: any) => m.segmento));
    expect(Array.from(segs).sort()).toEqual(["PF", "PJ"]);
  });

  it("modalidades centrais presentes (consignado, pessoal, rotativo, capital de giro)", () => {
    const nomes = J.modalidades.map((m: any) => m.modalidade).join(" | ");
    expect(nomes).toMatch(/consignado INSS/);
    expect(nomes).toMatch(/não consignado/);
    expect(nomes).toMatch(/rotativo/);
    expect(nomes).toMatch(/Capital de giro/);
  });
});

describe("juros.json: coerência estatística por modalidade", () => {
  it("stats ordenadas, ranking crescente com posições corretas e vs_mediana coerente", () => {
    for (const m of J.modalidades) {
      const s = m.stats;
      expect(s.min, m.id).toBeLessThanOrEqual(s.p25);
      expect(s.p25, m.id).toBeLessThanOrEqual(s.mediana);
      expect(s.mediana, m.id).toBeLessThanOrEqual(s.p75);
      expect(s.p75, m.id).toBeLessThanOrEqual(s.max);
      expect(m.ranking.length, m.id).toBe(s.n);
      for (let i = 0; i < m.ranking.length; i++) {
        expect(m.ranking[i].posicao, m.id).toBe(i + 1);
        if (i > 0) expect(m.ranking[i].taxa_aa, m.id).toBeGreaterThanOrEqual(m.ranking[i - 1].taxa_aa);
        expect(m.ranking[i].vs_mediana, m.id).toBeCloseTo(m.ranking[i].taxa_aa - s.mediana, 1);
      }
    }
  });

  it("séries mensais ordenadas e com banda válida (p25 ≤ mediana ≤ p75)", () => {
    for (const m of J.modalidades) {
      const refs = m.serie_mensal.map((o: any) => o.ref);
      expect([...refs].sort(), m.id).toEqual(refs);
      for (const o of m.serie_mensal) {
        expect(o.p25, `${m.id} ${o.ref}`).toBeLessThanOrEqual(o.mediana);
        expect(o.mediana, `${m.id} ${o.ref}`).toBeLessThanOrEqual(o.p75);
        expect(o.min, `${m.id} ${o.ref}`).toBeLessThanOrEqual(o.p25);
      }
    }
  });

  it("coerência econômica: rotativo muito acima do consignado INSS; spread sobre a Selic positivo em modalidades caras", () => {
    const rot = J.modalidades.find((m: any) => m.modalidade.includes("rotativo"));
    const inss = J.modalidades.find((m: any) => m.modalidade.includes("consignado INSS"));
    expect(rot.stats.mediana).toBeGreaterThan(inss.stats.mediana * 3);
    expect(inss.spread_selic).toBeGreaterThan(0);
  });

  it("persistência limitada à janela declarada e carteira SCR com conceito distinto", () => {
    for (const m of J.modalidades) {
      for (const p of m.persistentes) {
        expect(p.vezes, m.id).toBeLessThanOrEqual(p.de);
      }
      if (m.carteira_scr) {
        expect(m.carteira_scr.saldo, m.id).toBeGreaterThan(0);
        expect(m.carteira_scr.inad, m.id).toBeGreaterThanOrEqual(0);
      }
    }
    const inss = J.modalidades.find((m: any) => m.modalidade.includes("consignado INSS"));
    expect(inss.carteira_scr.produto).toBe("Consignado");
  });

  it("perfil por IF consistente com os rankings", () => {
    expect(J.perfis_if.length).toBeGreaterThan(50);
    const bb = J.perfis_if.find((p: any) => /BCO DO BRASIL/.test(p.nome));
    expect(bb).toBeTruthy();
    for (const pm of bb.modalidades.slice(0, 5)) {
      const m = J.modalidades.find((x: any) => x.id === pm.id);
      const r = m.ranking.find((x: any) => x.cnpj8 === bb.cnpj8);
      expect(r.posicao, pm.id).toBe(pm.posicao);
      expect(r.taxa_aa, pm.id).toBe(pm.taxa_aa);
    }
  });
});

describe("juros: integração com a plataforma", () => {
  it("telemetria e registro da view", () => {
    expect(isViewSection("obs:juros")).toBe(true);
    expect(sectionLabel("obs:juros")).toMatch(/Juros/);
    const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
    expect(app).toContain('juros: "/interest-rates"');
    expect(app).toContain('juros: "renderJuros"');
    const html = readFileSync(join(process.cwd(), "public/obs/index.html"), "utf-8");
    expect(html).toContain('data-view="juros"');
    expect(html).toContain('id="view-juros"');
    const bloco = app.slice(app.indexOf("function renderJuros()"), app.indexOf("const RENDER = {"));
    expect(bloco).not.toMatch(/\bdemo\b|DEMONSTRATIVO|placeholder/i);
  });
});
