/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Matriz produto × instituição. O teste central nasceu de um caso real
 * (11/08/2026): "% da carteira da IF" chegava a 155% (Nubank) porque o
 * numerador vinha dos relatórios de modalidade (123/128, com cartão à
 * vista) e o denominador da "Carteira de Crédito" do Resumo — universos
 * diferentes. O denominador passou a ser o total PF+PJ dos MESMOS
 * relatórios; o gold carrega o marcador `pct_carteira_conceito` e o teste
 * só cobra ≤100% de gold gerado com o conceito novo (o publicado anterior
 * à correção passa vazio até o pipeline regenerar).
 */

const raiz = process.cwd();
const productsPy = readFileSync(join(raiz, "pipeline/products.py"), "utf-8");
const dirProd = join(raiz, "public/obs/data/gold/prod");

describe("% da carteira da IF: numerador e denominador do mesmo universo", () => {
  it("o builder usa o total PF+PJ dos relatórios de modalidade, não o Resumo", () => {
    expect(productsPy).toContain('tot_pf = piv[SEG_TOTALS["pf"]]');
    expect(productsPy).toContain('tot_pj = piv[SEG_TOTALS["pj"]]');
    expect(productsPy).not.toContain('cart_total_inst = piv["carteira_credito"]');
    expect(productsPy).toContain('"pct_carteira_conceito": "modalidades_123_128"');
  });

  it("gold com o conceito novo nunca publica produto acima de 100% da carteira da IF", () => {
    if (!existsSync(dirProd)) return; // sem páginas de produto publicadas
    let verificadas = 0;
    for (const arq of readdirSync(dirProd)) {
      const g = JSON.parse(readFileSync(join(dirProd, arq), "utf-8"));
      if (g.pct_carteira_conceito !== "modalidades_123_128") continue; // gold pré-correção: regenera no ciclo diário
      expect(g.pct_carteira_nota, arq).toMatch(/MESMO universo/i);
      for (const r of g.produto?.matriz ?? []) {
        if (r.pct_carteira_inst != null) {
          // uma modalidade não excede o total da própria IF no mesmo universo
          // (100.5 acomoda só arredondamento de uma casa)
          expect(r.pct_carteira_inst, `${arq}:${r.nome}`).toBeLessThanOrEqual(100.5);
          verificadas++;
        }
      }
    }
    // quando o gold novo existir, a verificação tem de ter mordido algo
    if (readdirSync(dirProd).some((a) => JSON.parse(readFileSync(join(dirProd, a), "utf-8")).pct_carteira_conceito === "modalidades_123_128")) {
      expect(verificadas).toBeGreaterThan(0);
    }
  });

  it("o tooltip da coluna explica o denominador na própria tabela", () => {
    const appJs = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");
    expect(appJs).toMatch(/mesmo universo; a Carteira de Crédito do Resumo é outro conceito/);
  });
});
