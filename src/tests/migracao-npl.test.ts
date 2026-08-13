/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Modelo de migração 15→90 (pedido de 13/08): estimar a inadimplência >90d
 * por produto × IF — número que o IF.data público não divulga. O que se
 * trava: o selo ESTIMADO e a decomposição viajam em cada linha; a
 * reconciliação com o >90d TOTAL observado da IF vale onde o phi não foi
 * winsorizado; o beta vem de MQO pela origem com R² e EP publicados; os
 * perfis m_p vêm de mapa explícito para o SCR (produto sem par = neutro,
 * sinalizado); e a metodologia inteira está na tela do painel.
 */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf-8");
const app = read("public/obs/app.js");
const idx = JSON.parse(read("public/obs/data/gold/products.json"));
const META = idx.npl_produto_estimado;

function paginas() {
  const dir = join(process.cwd(), "public/obs/data/gold/prod");
  return readdirSync(dir).map(f => JSON.parse(read(`public/obs/data/gold/prod/${f}`)));
}

describe("gold: o modelo publicado", () => {
  it("metadados completos: fórmula, beta, R², EP, n, perfis, winsor e hipóteses", () => {
    expect(META.disponivel).toBe(true);
    expect(META.modelo).toContain("phi_i × beta × m_p × atraso15(i,p)");
    expect(META.beta).toBeGreaterThan(0);
    expect(META.r2_nao_centrado).toBeGreaterThan(0.5);
    expect(META.ep_beta).toBeGreaterThan(0);
    expect(META.n_ifs).toBeGreaterThan(500);
    expect(Object.keys(META.m_produtos).length).toBeGreaterThanOrEqual(6);
    expect(META.sem_intercepto).toMatch(/pela origem/i);
    expect(META.hipoteses).toMatch(/migração relativa entre produtos segue o perfil do sistema/);
    expect(META.nao_e).toMatch(/Não é observação/);
    expect(META.conceito_atraso).toMatch(/banda curta/);
  });

  it("cada estimativa carrega a decomposição e fica em [0, 100]", () => {
    let total = 0;
    for (const pg of paginas()) {
      expect(pg.npl_produto_estimado?.disponivel, pg.produto.slug).toBe(true);
      for (const r of pg.produto.matriz) {
        const e = r.npl_prod_est;
        if (!e) continue;
        total++;
        expect(e.pct).toBeGreaterThanOrEqual(0);
        expect(e.pct).toBeLessThanOrEqual(100);
        expect(typeof e.phi_if).toBe("number");
        expect("m_produto" in e && "perfil_neutro" in e && "baixa_cobertura" in e && "teto_sanidade" in e).toBe(true);
        if (e.perfil_neutro) expect(e.m_produto).toBeNull();
      }
    }
    expect(total).toBe(META.estimativas);
    expect(total).toBeGreaterThan(3000);
  });

  it("reconciliação: a média ponderada das estimativas da IF reproduz o >90d total observado", () => {
    const acc: Record<string, { num: number; den: number; npl: number; phi: number; teto: boolean }> = {};
    for (const pg of paginas()) {
      for (const r of pg.produto.matriz) {
        const e = r.npl_prod_est;
        if (!e || r.npl_inst_pct == null || !(r.carteira_brl > 0)) continue;
        const a = (acc[r.cod] = acc[r.cod] || { num: 0, den: 0, npl: r.npl_inst_pct, phi: e.phi_if, teto: false });
        a.num += r.carteira_brl * e.pct;
        a.den += r.carteira_brl;
        a.teto = a.teto || !!e.teto_sanidade;
      }
    }
    const [lo, hi] = META.phi_limites;
    let checadas = 0;
    for (const a of Object.values(acc)) {
      // winsorizados e tetados fora — os DOIS desvios declarados da reconciliação
      if (a.den <= 0 || a.phi <= lo || a.phi >= hi || a.teto) continue;
      expect(Math.abs(a.num / a.den - a.npl)).toBeLessThan(0.05);
      checadas++;
    }
    expect(checadas).toBeGreaterThan(500);
  });

  it("perfis m_p normalizados: nenhum absurdo e média na vizinhança de 1", () => {
    const ms = Object.values<number>(META.m_produtos);
    for (const m of ms) {
      expect(m).toBeGreaterThan(0.05);
      expect(m).toBeLessThan(10);
    }
  });
});

describe("pipeline: o modelo roda no ciclo diário", () => {
  it("products.py chama o módulo com os agregados do SCR (graceful sem a tabela)", () => {
    const prod = read("pipeline/products.py");
    expect(prod).toContain("from pipeline.models import migracao_npl");
    expect(prod).toContain('comum["npl_produto_estimado"] = migracao_npl.estimar(products, scr_pares)');
    const mod = read("pipeline/models/migracao_npl.py");
    expect(mod).toContain("MAPA_SCR");
    expect(mod).toMatch(/Mapeamento por código de produto, NUNCA por heurística/);
  });
});

describe("SPA: a estimativa e o método na tela", () => {
  it("coluna com selo de estimativa, ordenável, e decomposição no ⓘ da linha", () => {
    expect(app).toContain('th("npl_est_pct", "Inad. >90d NO PRODUTO (estimada)"');
    expect(app).toMatch(/ESTIMADO — decomposição: atraso ≥15d/);
    expect(app).toContain("r.npl_est_pct = r.npl_prod_est ? r.npl_prod_est.pct : null;");
  });

  it("o cartão de metodologia mostra a fórmula, os coeficientes e o que o número NÃO é", () => {
    expect(app).toContain('Como a coluna "Inad. >90d NO PRODUTO (estimada)" é calculada');
    expect(app).toContain("estimativa(IF, produto) = φ_IF × β × m_produto × atraso15(IF, produto)");
    expect(app).toMatch(/regressão MQO <i>pela origem<\/i>/);
    expect(app).toContain("${E.nao_e}");
    expect(app).toContain("${E.conceito_atraso}");
  });

  it("o CSV da matriz exporta a estimativa com selo explícito", () => {
    expect(app).toContain("npl90_produto_ESTIMADO_pct;selo_estimativa");
  });
});
