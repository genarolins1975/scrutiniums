import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Fusão de "Ciclo & Antecedentes" com "Radar de Sinais" numa única página.
 *
 * O risco desta mudança é quebrar links já compartilhados: /leading-indicators
 * deixou de ser uma página e virou a aba "Protocolo & regimes" do radar. Os
 * testes garantem que a rota antiga continua resolvendo — nos dois modos de
 * roteamento — e que o conteúdo do protocolo não se perdeu no caminho.
 */
const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
const html = readFileSync(join(process.cwd(), "public/obs/index.html"), "utf-8");

describe("fusão das páginas de antecedentes", () => {
  it("a página antiga não existe mais como aba ou seção própria", () => {
    expect(html).not.toMatch(/data-view="antecedentes"/);
    expect(html).not.toMatch(/id="view-antecedentes"/);
    expect(app).not.toMatch(/function renderAntecedentes/);
  });

  it("o conteúdo do protocolo virou bloco e é usado como aba", () => {
    expect(app).toMatch(/function blocoProtocolo\(\)/);
    expect(app).toMatch(/\["protocolo", "Protocolo & regimes"\]/);
    expect(app).toMatch(/t === "protocolo"[\s\S]{0,40}body = blocoProtocolo\(\)/);
  });

  it("o protocolo preserva os quatro critérios e a detecção de regimes", () => {
    const i = app.indexOf("function blocoProtocolo()");
    const bloco = app.slice(i, app.indexOf("\nfunction ", i + 10));
    for (const criterio of ["granger_5pct", "ganho_oos", "estavel", "melhor_defasagem_meses"]) {
      expect(bloco, criterio).toContain(criterio);
    }
    expect(bloco).toMatch(/Detecção de regimes/);
    expect(bloco).toMatch(/quebra_estrutural/);
  });

  it("a rota antiga continua resolvendo nos dois modos de roteamento", () => {
    expect(app).toMatch(/ROTAS_APOSENTADAS = \{ "\/leading-indicators": \{ view: "leading", tab: "protocolo" \} \}/);
    // modo caminho (produção) e modo hash (uso local) consultam o alias
    const cv = app.slice(app.indexOf("function currentView()"), app.indexOf("function buildQuery"));
    expect(cv.match(/ROTAS_APOSENTADAS/g)?.length).toBeGreaterThanOrEqual(2);
    // e a aba equivalente é aberta ao chegar por ela
    expect(app).toMatch(/if \(aposentada\) state\.lead\.tab = aposentada\.tab/);
  });

  it("os dados das duas origens são carregados pela página fundida", () => {
    expect(app).toMatch(/leading: \["leading", "antecedentes", "regimes"\]/);
  });

  it("nenhum texto ainda manda o leitor para uma aba que não existe", () => {
    expect(app).not.toMatch(/aba Antecedentes/);
    const gold = readFileSync(join(process.cwd(), "public/obs/data/gold/leading.json"), "utf-8");
    expect(gold).not.toMatch(/aba Antecedentes/);
  });

  it("a navegação passou a ter um item no lugar de dois", () => {
    expect(html).toMatch(/data-view="leading">Sinais Antecedentes</);
    expect(html).not.toMatch(/Ciclo &amp; Antecedentes/);
    expect(html).not.toMatch(/Radar de Sinais/);
  });
});
