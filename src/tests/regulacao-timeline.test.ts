/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Timeline regulatória transversal. O coração editorial: nenhum link é
 * inferido (só domínios oficiais), a régua se declara editorial (não censo),
 * e os marcadores nas séries nunca atribuem efeito — "coincidência no tempo
 * não é efeito" acompanha a página e os gráficos anotados.
 */

const raiz = process.cwd();
const cur = JSON.parse(readFileSync(join(raiz, "pipeline/curated/timeline_regulatoria.json"), "utf-8"));
const G = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/regulacao.json"), "utf-8"));
const appJs = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");
const indexHtml = readFileSync(join(raiz, "public/obs/index.html"), "utf-8");
const goldPy = readFileSync(join(raiz, "pipeline/gold.py"), "utf-8");
const abasTs = readFileSync(join(raiz, "src/lib/data/observatorioAbas.ts"), "utf-8");

const VIEWS_VALIDAS = new Set([
  "institutions", "pix", "openfinance", "consignado", "desenrola",
  "products", "juros", "bets", "fraudes", "operacional",
]);

describe("curadoria: marcos com norma, data e URL oficial", () => {
  it("todo marco tem evidência oficial e vocabulário válido", () => {
    expect(cur.marcos.length).toBeGreaterThanOrEqual(12);
    for (const m of cur.marcos) {
      expect(String(m.data), m.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(m.ato, m.id).toBeTruthy();
      expect(m.orgao, m.id).toBeTruthy();
      expect(m.resumo, m.id).toBeTruthy();
      // nenhum link inferido: só domínios oficiais dos textos normativos
      expect(m.url, m.id).toMatch(
        /^https:\/\/(www\.planalto\.gov\.br|www\.bcb\.gov\.br|normativos\.bcb\.gov\.br)\//);
      expect(["confirmado", "parcial"], m.id).toContain(m.status);
      expect(m.paineis.length, m.id).toBeGreaterThan(0);
      for (const p of m.paineis) expect(VIEWS_VALIDAS.has(p), `${m.id}: painel ${p}`).toBe(true);
      if (m.serie_x != null) expect(String(m.serie_x), m.id).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it("a régua se declara editorial, nunca censo", () => {
    expect(cur.leitura).toMatch(/não é um censo/);
  });

  it("ids únicos e datas coerentes com a era das normas", () => {
    const ids = cur.marcos.map((m: any) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of cur.marcos) {
      expect(m.data >= "2017-01-01" && m.data <= "2027-12-31", m.id).toBe(true);
    }
  });
});

describe("gold regulacao.json publicado", () => {
  it("reconcilia com a curadoria e ordena do mais recente ao mais antigo", () => {
    expect(G.disponivel).toBe(true);
    expect(G.marcos.length).toBe(cur.marcos.length);
    for (let i = 1; i < G.marcos.length; i++) {
      expect(G.marcos[i - 1].data >= G.marcos[i].data).toBe(true);
    }
    expect(G.fonte.nota).toMatch(/nenhum link é inferido/);
    expect(G.timelines_tematicas.length).toBeGreaterThanOrEqual(2);
  });

  it("o builder roda no gold diário", () => {
    expect(goldPy).toContain("reg_mod.build");
  });
});

describe("SPA e camada indexável", () => {
  it("a aba existe, com filtro por painel e o aviso anticausal", () => {
    expect(indexHtml).toContain('data-view="regulacao"');
    expect(indexHtml).toContain('id="view-regulacao"');
    expect(appJs).toContain("regulacao: renderRegulacao");
    expect(appJs).toMatch(/Coincidência no tempo não é efeito/);
  });

  it("os marcos viram marcadores verticais em pix, consignado e desenrola", () => {
    // 1 definição + pelo menos 3 usos nos gráficos
    const usos = appJs.split("marcosRegulatorios(").length - 1;
    expect(usos).toBeGreaterThanOrEqual(4);
    expect(appJs).toMatch(/marcosRegulatorios\("pix"\)/);
    expect(appJs).toMatch(/marcosRegulatorios\("consignado"\)/);
    expect(appJs).toMatch(/marcosRegulatorios\("desenrola"\)/);
  });

  it("a aba entra no registro indexável (SEO/sitemap)", () => {
    expect(abasTs).toContain('view: "regulacao"');
    expect(abasTs).toContain('caminho: "/regulacao"');
  });
});
