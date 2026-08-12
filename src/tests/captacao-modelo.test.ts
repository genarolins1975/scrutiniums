/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Top-100 IFs + custo de captação + modelo de negócio.
 *
 * Os testes de VALOR são gated pela presença da chave `captacao` nas
 * instituições do gold PUBLICADO (public/obs/data/gold — a lição do
 * consignado): o gold atual foi gerado antes do coletor ifdata_funding,
 * e o pipeline diário o regenera. Quando a chave aparecer, os ranges
 * passam a morder. O que é estático (registro do coletor, config,
 * semântica declarada no código, seções da SPA) morde desde já.
 */

const raiz = process.cwd();
const G = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/institutions.json"), "utf-8"));
const cfg = JSON.parse(readFileSync(join(raiz, "config/config.json"), "utf-8"));
const runPy = readFileSync(join(raiz, "pipeline/run.py"), "utf-8");
const fundingPy = readFileSync(join(raiz, "pipeline/sources/ifdata_funding.py"), "utf-8");
const indicadoresPy = readFileSync(join(raiz, "pipeline/indicators.py"), "utf-8");
const appJs = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");

describe("estático: coletor, config e semântica declarada", () => {
  it("o universo scorado expande para as top 100 por ativo", () => {
    expect(cfg.ifdata.top_n_by_assets).toBe(100);
  });

  it("o coletor ifdata_funding roda no pipeline diário", () => {
    expect(runPy).toContain('("ifdata_funding", ifdata_funding)');
  });

  it("o coletor declara a acumulação semestral da DRE e os dois layouts contábeis", () => {
    // a semântica que quebraria tudo silenciosamente se esquecida:
    expect(fundingPy).toMatch(/POR SEMESTRE/);
    expect(fundingPy).toMatch(/nunca um ×4 cego/);
    // fallback de layout: Res. 4.966 (14xxxx, 2025+) × layout antigo (78xxx)
    expect(fundingPy).toContain("140239");
    expect(fundingPy).toContain("78185");
    expect(fundingPy).toMatch(/lid_novo if novo else lid_velho/);
  });

  it("a anualização declara os meses e o custo absurdo é descartado, nunca publicado", () => {
    expect(indicadoresPy).toMatch(/meses = 3 if mes in \(3, 9\) else 6/);
    expect(indicadoresPy).toMatch(/if not \(0 < custo_aa < 100\)/);
    // serviços só entram com intermediação positiva — omitido, nunca imputado
    expect(indicadoresPy).toMatch(/interm is not None and interm > 0/);
  });

  it("o coletor traz pessoal/admin e o índice de eficiência tem guarda de sanidade", () => {
    // rodada 1 de custos operacionais: as duas linhas de despesa da DRE
    expect(fundingPy).toContain("141858");
    expect(fundingPy).toContain("141859");
    // eficiência absurda (unidade/tradução) é omitida, nunca publicada
    expect(indicadoresPy).toMatch(/if 0 < ef < 300/);
    // numerador e denominador do MESMO período semestral: sem anualização
    expect(indicadoresPy).toMatch(/MESMO período semestral/);
  });

  it("a SPA renderiza as seções com fórmula e ausência declarada", () => {
    expect(appJs).toContain("Custo de captação");
    expect(appJs).toContain("Modelo de negócio");
    expect(appJs).toContain("Mix de depósitos");
    expect(appJs).toContain("Índice de eficiência");
    expect(appJs).toMatch(/ausência declarada, nunca zero/);
  });
});

describe("gated: valores no gold publicado (mordem após o pipeline diário)", () => {
  const insts: any[] = G.instituicoes || [];
  const novo = insts.length > 0 && "captacao" in insts[0];

  it("com o gold novo, o corte vai além das 30 e respeita o teto de 100", () => {
    if (!novo) return; // gold pré-expansão: nada a validar ainda
    expect(insts.length).toBeGreaterThan(30);
    expect(insts.length).toBeLessThanOrEqual(100);
  });

  it("custo de captação, quando presente, é plausível e carrega a fórmula", () => {
    if (!novo) return;
    for (const i of insts) {
      const c = i.captacao;
      if (!c) continue; // ausência declarada: coletor ainda sem o período, nunca zero
      expect(c.tipo, i.nome).toBe("DADO CALCULADO");
      expect(c.custo_aa_pct, i.nome).toBeGreaterThan(0);
      expect(c.custo_aa_pct, i.nome).toBeLessThan(100);
      expect([3, 6], i.nome).toContain(c.meses_dre);
      expect(c.formula, i.nome).toMatch(/12\/[36]/);
      expect(c.limitacoes, i.nome).toBeTruthy();
      if (c.mix_depositos_pct) {
        for (const [k, v] of Object.entries(c.mix_depositos_pct) as [string, number][]) {
          expect(v, `${i.nome}:${k}`).toBeGreaterThanOrEqual(0);
          expect(v, `${i.nome}:${k}`).toBeLessThanOrEqual(100.5);
        }
      }
    }
  });

  it("modelo de negócio, quando presente, fica em ranges sãos", () => {
    if (!novo) return;
    for (const i of insts) {
      const m = i.modelo_negocio;
      if (!m) continue;
      if (m.receita_servicos_pct != null) {
        expect(m.receita_servicos_pct, i.nome).toBeGreaterThanOrEqual(0);
        expect(m.receita_servicos_pct, i.nome).toBeLessThan(100);
        expect(m.receita_servicos_conceito, i.nome).toBeTruthy();
      }
      if (m.credito_ativo_pct != null) {
        expect(m.credito_ativo_pct, i.nome).toBeGreaterThanOrEqual(0);
        expect(m.credito_ativo_pct, i.nome).toBeLessThanOrEqual(110);
      }
      if (m.eficiencia_pct != null) {
        expect(m.eficiencia_pct, i.nome).toBeGreaterThan(0);
        expect(m.eficiencia_pct, i.nome).toBeLessThan(300);
        expect(m.eficiencia_conceito, i.nome).toBeTruthy();
        expect(m.despesas_pessoal_brl, i.nome).not.toBeUndefined();
      }
    }
  });

  it("as limitações do método declaram a natureza estimada do custo", () => {
    if (!novo) return;
    expect(G.limitacoes).toMatch(/Custo de captação é estimativa/);
  });
});
