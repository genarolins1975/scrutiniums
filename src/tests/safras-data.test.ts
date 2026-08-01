/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isViewSection, sectionLabel } from "@/lib/telemetry";

/**
 * Consistência da aba Safras de Crédito: conceito oficial declarado com
 * URLs do BC, status do dado indisponível registrado (sem série sintética
 * de coorte) e proxy de estoque real do SCR.data com conceitos separados.
 */

function load(rel: string) {
  return JSON.parse(readFileSync(join(process.cwd(), rel), "utf-8"));
}
const S = load("public/obs/data/gold/safras.json");

describe("safras.json: conceito e status honestos", () => {
  it("declara a fonte oficial com URLs do BC e as modalidades lembradas (pessoal e consignado)", () => {
    const f = S.conceito.fonte_oficial;
    expect(f.notas_metodologicas).toMatch(/^https:\/\/www\.bcb\.gov\.br\//);
    expect(f.exemplos_graficos).toMatch(/^https:\/\/www\.bcb\.gov\.br\//);
    const mods = f.modalidades.join(" ").toLowerCase();
    expect(mods).toContain("com consignação");
    expect(mods).toContain("sem consignação");
    expect(f.horizonte).toMatch(/90 meses/);
  });

  it("status do dado: indisponível, verificado, com caminho de reativação e política sem sintético", () => {
    const st = S.conceito.status_dado;
    expect(st.situacao).toBe("indisponivel");
    expect(st.verificado_em).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(st.detalhe).toMatch(/dados abertos|CKAN/i);
    expect(st.caminho_reativacao).toMatch(/LAI|Fale Conosco/i);
    expect(st.politica).toMatch(/[Nn]ão digitalizamos|sintética/);
  });

  it("NÃO existe curva de coorte no payload (nenhuma série indexada por meses após contratação)", () => {
    const texto = JSON.stringify(S);
    expect(texto).not.toMatch(/meses_apos|coorte_serie|vintage_curve/);
  });
});

describe("safras.json: proxy de estoque real e conceitualmente separado", () => {
  it("séries por modalidade PF presentes, incluindo crédito pessoal e consignado", () => {
    const keys = Object.keys(S.proxy_series.series);
    expect(keys).toContain("credito_pessoal");
    expect(keys).toContain("consignado");
    expect(keys.length).toBeGreaterThanOrEqual(4);
  });

  it("observações mensais reais: refs ordenadas, taxas em faixa plausível, saldo positivo", () => {
    for (const [k, sr] of Object.entries<any>(S.proxy_series.series)) {
      expect(sr.obs.length, k).toBeGreaterThanOrEqual(12);
      const refs = sr.obs.map((o: any) => o.ref);
      expect([...refs].sort()).toEqual(refs);
      for (const o of sr.obs) {
        expect(o.saldo, `${k} ${o.ref}`).toBeGreaterThan(0);
        expect(o.inad, `${k} ${o.ref}`).toBeGreaterThanOrEqual(0);
        expect(o.inad, `${k} ${o.ref}`).toBeLessThan(60);
        expect(o.atraso15_90, `${k} ${o.ref}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("coerência econômica: consignado com inadimplência bem menor que crédito pessoal", () => {
    const cp = S.proxy_series.series.credito_pessoal.obs.at(-1);
    const cg = S.proxy_series.series.consignado.obs.at(-1);
    expect(cg.inad).toBeLessThan(cp.inad);
  });

  it("conceitos do proxy declarados e distintos de safra", () => {
    expect(S.proxy_series.conceitos.inad).toMatch(/ARRASTADA/);
    expect(S.conceito.proxy.por_que_nao_e_safra).toMatch(/dilui/i);
    expect(S.proxy_series.tipo).toBe("DADO OBSERVADO");
  });
});

describe("safras: integração com a plataforma", () => {
  it("telemetria e registro da view na SPA", () => {
    expect(isViewSection("obs:safras")).toBe(true);
    expect(sectionLabel("obs:safras")).toMatch(/Safras/);
    const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
    expect(app).toContain('safras: "/credit-vintages"');
    expect(app).toContain("safras: renderSafras");
    const html = readFileSync(join(process.cwd(), "public/obs/index.html"), "utf-8");
    expect(html).toContain('data-view="safras"');
    expect(html).toContain('id="view-safras"');
    // sem modo demo/placeholder no bloco da view
    const bloco = app.slice(app.indexOf("function renderSafras()"), app.indexOf("const RENDER = {"));
    expect(bloco).not.toMatch(/\bdemo\b|DEMONSTRATIVO|placeholder/i);
  });
});
