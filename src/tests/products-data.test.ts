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

describe("dispersão atraso × taxa × carteira por IF", () => {
  it("o builder casa taxa com carteira por cnpj8 ou nome único, nunca por chute", () => {
    expect(productsPy).toContain("def _taxa_por_cod");
    expect(productsPy).toMatch(/ambíguo: fica sem taxa/);
    expect(productsPy).toContain('"taxa_casamento"');
  });

  // A trava nasceu do bug de 19/08: a "taxa do produto" era a MEDIANA entre
  // modalidades da mesma IF — rotativo (~450% a.a.) e parcelado (~180%) do
  // cartão viravam um número sem significado. Cada modalidade é uma entrada
  // própria em taxas_novas; taxa única escalar nunca volta.
  it("o builder publica taxa POR MODALIDADE (taxas_novas), nunca mediana entre modalidades", () => {
    expect(productsPy).toContain('"taxas_novas"');
    expect(productsPy).toMatch(/nunca mediana entre\s+modalidades/);
    expect(productsPy).not.toContain('"taxa_aa": round(');
  });

  it("gold com taxa por IF traz valores plausíveis por modalidade e casamento declarado", () => {
    if (!existsSync(dirProd)) return;
    let verificadas = 0;
    for (const arq of readdirSync(dirProd)) {
      const g = JSON.parse(readFileSync(join(dirProd, arq), "utf-8"));
      for (const r of g.produto?.matriz ?? []) {
        expect(r.taxa_aa, `${arq}:${r.nome} — escalar misturando modalidades não pode voltar`).toBeUndefined();
        if (r.taxas_novas != null) {
          for (const [mod, taxa] of Object.entries(r.taxas_novas) as [string, number][]) {
            // valores verbatim do ranking txjuros: a fonte publica 0% (promocional)
            // e rotativos acima de 1.300% a.a. — a trava pega só aberração de parse
            expect(taxa, `${arq}:${r.nome}:${mod}`).toBeGreaterThanOrEqual(0);
            expect(taxa, `${arq}:${r.nome}:${mod}`).toBeLessThan(3000);
            verificadas++;
          }
          expect(["cnpj8", "nome"], `${arq}:${r.nome}`).toContain(r.taxa_casamento);
        }
      }
    }
    expect(verificadas).toBeGreaterThan(100); // cartão+consignado+giro etc. têm centenas de casamentos
  });

  it("no cartão, rotativo e parcelado seguem separados e em ordens de grandeza distintas", () => {
    const arq = join(dirProd, "cartao-de-credito-pf.json");
    if (!existsSync(arq)) return;
    const g = JSON.parse(readFileSync(arq, "utf-8"));
    const rot: number[] = [], par: number[] = [];
    for (const r of g.produto?.matriz ?? []) {
      const t = r.taxas_novas || {};
      for (const [mod, v] of Object.entries(t) as [string, number][]) {
        if (/rotativo/i.test(mod)) rot.push(v);
        if (/parcelado/i.test(mod)) par.push(v);
      }
    }
    if (!rot.length || !par.length) return; // gold pré-correção regenera no ciclo diário
    const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    expect(med(rot)).toBeGreaterThan(med(par) * 1.5); // misturados, isto seria impossível de afirmar
  });

  it("a SPA usa a modalidade selecionada (taxa_sel) na dispersão e na matriz — nunca uma taxa única", () => {
    expect(appJsPagina()).toContain("r.taxa_sel = txMod && r.taxas_novas");
    expect(appJsPagina()).toMatch(/th\("taxa_sel", `Taxa a\.a\. — \$\{txModCurta\}`/);
    expect(appJsPagina()).toMatch(/y: r\.taxa_sel/);
    expect(appJsPagina()).toMatch(/modalidades nunca se misturam numa média/);
  });

  it("a dispersão tem escala numérica e folga de domínio (bolhas não cortam)", () => {
    expect(appJsPagina()).toMatch(/escala numérica: sem os ticks/);
    expect(appJsPagina()).toMatch(/6% de folga no domínio/);
  });

  it("a SPA declara os dois relógios (estoque de atraso × preço das operações novas)", () => {
    expect(appJsPagina()).toContain("Dois relógios diferentes, de propósito");
    expect(appJsPagina()).toMatch(/não é a taxa da carteira/);
    expect(appJsPagina()).toMatch(/ausência declarada/);
  });
});

function appJsPagina() {
  return readFileSync(join(raiz, "public/obs/app.js"), "utf-8");
}
