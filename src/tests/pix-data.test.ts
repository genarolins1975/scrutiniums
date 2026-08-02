/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reconciliações do painel Pix e Meios de Pagamento. Os dois universos da fonte
 * (MPV, doc 1201, que inclui liquidação fora do SPI; e a base transacional, que
 * é só o SPI) nunca podem ser misturados sem rótulo — daí os testes de cobertura
 * declarada. Também verificam-se identidades básicas (quantidade × valor =
 * tíquete, participações somando 100%, agregação mensal → trimestral) e os
 * conceitos obrigatórios (contestação ≠ fraude confirmada; chave ≠ usuário).
 */
function load(rel: string) {
  return JSON.parse(readFileSync(join(process.cwd(), rel), "utf-8"));
}
const X = load("public/obs/data/gold/pix.json");

describe("pix.json: estrutura, fontes e conceitos", () => {
  it("disponível, com mês de referência e catálogo completo", () => {
    expect(X.disponivel).toBe(true);
    expect(X.mes).toMatch(/^\d{4}-\d{2}$/);
    expect(X.catalogo.length).toBeGreaterThanOrEqual(9);
    for (const c of X.catalogo) {
      for (const campo of ["id", "nome", "conceito", "formula", "unidade", "periodicidade",
        "fonte", "inicio", "transformacoes", "limitacoes", "versao"]) {
        expect(c[campo], `${c.id}.${campo}`).toBeTruthy();
      }
    }
  });

  it("cautelas metodológicas obrigatórias declaradas", () => {
    const t = X.cautelas.join(" | ");
    expect(t).toMatch(/não é uma categoria homogênea/i);
    expect(t).toMatch(/financiamento/i); // cartão de crédito ≠ substituto perfeito
    expect(t).toMatch(/fraude confirmada/i); // MED
    expect(t).toMatch(/chave ≠ usuário/i);
    expect(t).toMatch(/não é receita/i); // EPAE é fluxo financeiro
  });

  it("cobertura da base transacional declarada e coerente com o gap do SPI", () => {
    expect(X.cobertura_tx_pct).toBeGreaterThan(75);
    expect(X.cobertura_tx_pct).toBeLessThanOrEqual(100);
    expect(X.cautelas.some((c: string) => c.includes(String(X.cobertura_tx_pct)))).toBe(true);
  });
});

describe("pix.json: identidades numéricas", () => {
  it("valor ÷ quantidade = tíquete em todos os meses recentes", () => {
    for (const o of X.series.Pix.slice(-12)) {
      if (o.q && o.v) expect(Math.abs(o.t - o.v / o.q)).toBeLessThan(0.5);
    }
  });

  it("participações por natureza somam 100% em quantidade e valor", () => {
    const q = X.natureza.atual.reduce((s: number, x: any) => s + x.part_q, 0);
    const v = X.natureza.atual.reduce((s: number, x: any) => s + x.part_v, 0);
    expect(Math.abs(q - 100)).toBeLessThan(0.5);
    expect(Math.abs(v - 100)).toBeLessThan(0.5);
  });

  it("soma dos meses do trimestre reconcilia com a série trimestral do MPV", () => {
    const tri0 = X.tri.tri0;
    const m = Number(tri0.slice(5, 7));
    const meses = [m - 2, m - 1, m].map((mm) => `${tri0.slice(0, 4)}-${String(mm).padStart(2, "0")}`);
    const somaMensal = X.series.Pix
      .filter((o: any) => meses.includes(o.p))
      .reduce((s: number, o: any) => s + o.v, 0);
    const vTri = X.tri.dados[tri0].Pix.v;
    expect(Math.abs(somaMensal / vTri - 1)).toBeLessThan(0.02);
  });

  it("participação do Pix no trimestre bate com o KPI publicado", () => {
    const d = X.tri.dados[X.tri.tri0];
    const tot = Object.values(d).reduce((s: number, x: any) => s + (x.q || 0), 0);
    const part = ((d.Pix.q || 0) / (tot as number)) * 100;
    expect(Math.abs(part - X.kpis.part_tri.v)).toBeLessThan(0.2);
  });

  it("usuários do DICT: total = PF + PJ (estoque, não soma temporal)", () => {
    const u = X.kpis.usuarios;
    expect(Math.abs(u.v - (u.pf + u.pj))).toBeLessThan(2);
  });

  it("deflação: valores reais superam os nominais no passado", () => {
    const antigos = X.series.Pix.filter((o: any) => o.vr && o.v && o.p < "2023-01");
    expect(antigos.length).toBeGreaterThan(12);
    for (const o of antigos) expect(o.vr).toBeGreaterThan(o.v);
  });
});

describe("pix.json: MED e geografia", () => {
  it("percentual de devolução do MED dentro de 0–100 em toda a série", () => {
    for (const o of X.med) {
      if (o.pct_devolucao != null) {
        expect(o.pct_devolucao).toBeGreaterThanOrEqual(0);
        expect(o.pct_devolucao).toBeLessThanOrEqual(100);
      }
    }
  });

  it("27 UFs com métrica normalizada por habitante e malha do mapa", () => {
    expect(X.geografia.ufs.length).toBe(27);
    for (const u of X.geografia.ufs) expect(u.q_hab).not.toBeNull();
    expect(Object.keys(X.geografia.geo.paths).length).toBe(27);
    expect(X.geografia.nota_perspectiva).toMatch(/perspectivas distintas/);
  });
});
