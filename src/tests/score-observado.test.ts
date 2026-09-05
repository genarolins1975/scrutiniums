/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * P0 da auditoria de 12/08: nenhum número composto publicado contém
 * componente não-observado com peso — demonstrativos são visíveis, com
 * peso ZERO, como "em construção". Invariante transversal permanente
 * (mesma família do HHI-resíduo e do Desenrola duplicado).
 */

const raiz = process.cwd();
const indPy = readFileSync(join(raiz, "pipeline/indicators.py"), "utf-8");
const S = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/sectors.json"), "utf-8"));

describe("score setorial 100% observado", () => {
  it("o pipeline soma apenas componentes observados e declara a renormalização", () => {
    expect(indPy).toMatch(/APENAS componentes observados/);
    expect(indPy).toMatch(/if c\["status"\] == "observado"/);
    // pesos originais declarados e renormalizados sobre os observados (0,45/0,20/0,15 → 0,56/0,25/0,19 com o Caged; 0,69/0,31 sem ele)
    expect(indPy).toMatch(/PESOS_SCORE = \{"atividade": 0\.45, "condicoes_credito": 0\.20, "capacidade_financeira": 0\.15\}/);
    expect(indPy).toMatch(/peso = \{k: round\(PESOS_SCORE\[k\] \/ soma_pesos, 4\) for k in observados\}/);
  });

  it("no gold, todo componente demonstrativo tem peso zero e contribuição zero", () => {
    expect(S.tipo).toMatch(/100% observado/);
    for (const s of S.setores || []) {
      let somaObs = 0;
      for (const [k, c] of Object.entries(s.componentes || {}) as [string, any][]) {
        if (c.status === "demonstrativo") {
          expect(c.peso, `${s.nome}:${k}`).toBe(0);
          expect(Math.abs(s.contribuicoes?.[k] ?? 0), `${s.nome}:${k}`).toBe(0);
        } else {
          somaObs += c.peso;
        }
      }
      expect(Math.abs(somaObs - 1.0), s.nome).toBeLessThan(0.011);
      // o score confere com a soma das contribuições observadas
      const score = 50 + Object.entries(s.componentes as Record<string, any>)
        .filter(([, c]) => c.status === "observado")
        .reduce((acc, [, c]) => acc + 20 * c.z * c.peso, 0);
      expect(Math.abs(Math.max(0, Math.min(100, score)) - s.score), s.nome).toBeLessThan(0.11);
    }
  });
});

describe("fichas: cnpj e copy corrigidos (P0)", () => {
  it("as fichas dos grandes carregam o CNPJ da holding, nunca 'não disponível'", () => {
    for (const cod of ["C0010069", "C0049906", "C0030379"]) {
      const d = JSON.parse(readFileSync(join(raiz, `public/obs/data/gold/inst/${cod}.json`), "utf-8"));
      expect(d.cabecalho.cnpj, cod).not.toMatch(/não disponível/);
    }
  });

  it("nenhuma ficha diz mais 'corte dos 30 maiores'", () => {
    const ipa = readFileSync(join(raiz, "pipeline/inst_pages_all.py"), "utf-8");
    expect(ipa).not.toMatch(/30 maiores/);
    expect(ipa).toMatch(/100 maiores IFs por ativo/);
  });

  it("a evolução usa o histórico longo com a fronteira da 4.966 declarada", () => {
    const ipa = readFileSync(join(raiz, "pipeline/inst_pages_all.py"), "utf-8");
    expect(ipa).toMatch(/periods_hist = /);
    expect(ipa).toMatch(/mudança de régua, não de negócio/);
  });
});
