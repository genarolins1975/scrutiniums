/**
 * Travas do bloco P1 didático da avaliação de 06/09/2026 (docs/AVALIACAO_PAINEIS_2026-09-06.md §14):
 * padrão de abertura (placar de quatro números datados + síntese determinística) nas 13 abas
 * temáticas que abriam sem placar, e glossário por aba com verbete na primeira ocorrência.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(RAIZ, p), "utf8");
const app = read("public/obs/app.js");
const fn = (nome: string) => {
  const i = app.indexOf(`function ${nome}(`);
  expect(i, nome).toBeGreaterThan(0);
  const j = app.indexOf("\nfunction ", i + 10);
  return app.slice(i, j > 0 ? j : undefined);
};

describe("padrão de abertura: placar + síntese logo após o cabeçalho", () => {
  it("abertura() monta placar e síntese determinística e nunca inventa número (v nulo é omitido)", () => {
    expect(app).toMatch(/function abertura\(o\) \{[\s\S]*?filter\(i => i && i\.v != null\)[\s\S]*?class="pan-sintese"/);
    expect(app).toContain("Síntese determinística · ${o.ref}");
  });
  const ABAS: [string, string][] = [
    ["renderOverview", "aberturaHtml"], ["renderPulse", "abertura({"], ["renderSectors", "abertura({"], ["renderRJ", "abertura({"],
    ["renderInstitutions", "abertura({"], ["renderScenarios", "abertura({"], ["renderAlerts", "abertura({"], ["renderRegulacao", "abertura({"],
    ["renderProducts", "abertura({"], ["renderCompare", "cmpAbertura"], ["renderMarket", "mktAbertura"], ["renderLeading", "leadAbertura"],
    ["renderEstados", "abertura({"],
  ];
  for (const [r, marca] of ABAS) {
    it(`${r} abre com placar e síntese`, () => {
      const corpo = fn(r);
      expect(corpo, r).toContain(marca);
      expect(corpo, r).toMatch(/sintese: \[/);
      expect(corpo, r).toMatch(/placar: /);
    });
  }
  it("Comparar coloca a abertura nos dois caminhos (sem seleção e com instituições carregadas)", () => {
    const c = fn("renderCompare");
    expect((c.match(/\$\{cmpAbertura\(/g) || []).length).toBe(2);
  });
  it("a Central de alertas não repete o cartão de situação: os números viveram para o placar", () => {
    expect(app).not.toContain("<h4>Situação nesta execução</h4>");
  });
  it("Cenários distingue 'sem choques' de 'com choques' na síntese", () => {
    const c = fn("renderScenarios");
    expect(c).toContain("Sem choques, a inadimplência segue a projeção-base");
    expect(c).toContain("Com os choques definidos");
  });
});

describe("glossário por aba: verbete na primeira ocorrência", () => {
  it("GLOSSARIO cobre o jargão listado no achado A8", () => {
    const bloco = app.slice(app.indexOf("const GLOSSARIO = ["), app.indexOf("let GLOSS_RE"));
    for (const t of ["SCR", "IF.data", "SGS", "S1 a S5", "DataJud", "IBCC", "p50", "z-score", "txjuros", "PIM", "PMS", "PMC"]) {
      expect(bloco, t).toContain(`t: "${t}"`);
    }
    // toda entrada tem termo, regex e definição com ponto final
    const entradas = bloco.match(/\{ t: "[^"]+", re: "[^"]+", d: "[^"]+\." \}/g) || [];
    expect(entradas.length).toBeGreaterThanOrEqual(30);
    expect(entradas.length).toBe((bloco.match(/\n  \{ t: /g) || []).length);
  });
  it("marcaVerbetes marca uma vez por aba, pula botões, links, selects, títulos, svg e code, e observa re-renderizações", () => {
    const m = fn("marcaVerbetes");
    expect(m).toContain('"A", "BUTTON", "SELECT", "OPTION", "INPUT", "TEXTAREA", "SCRIPT", "STYLE", "CODE", "PRE", "DFN"');
    expect(m).toContain("if (!g || vistos.has(g.t)) continue;");
    expect(m).toContain('d.setAttribute("aria-label"');
    expect(app).toContain('obs.observe(main, { childList: true, subtree: true });');
    expect(app).toContain('document.querySelectorAll("#main section.view.active").forEach(marcaVerbetes);');
  });
  it("o tooltip é único, fixo na viewport e responde a mouse e foco (toque e teclado)", () => {
    expect(app).toContain('tip.id = "verbeteTip"; tip.className = "tooltip"');
    for (const ev of ["mouseover", "mouseout", "focusin", "focusout"]) expect(app).toContain(`document.addEventListener("${ev}", e =>`);
    expect(read("public/obs/styles.css")).toContain("dfn.verbete { font-style: inherit; text-decoration: underline dotted var(--accent)");
  });
  it("Metodologia publica o glossário completo (tabela sem-verbete para não marcar a si mesma) e o coloca na subnav", () => {
    const m = fn("glossarioHtml");
    expect(m).toContain('id="met-glossario"');
    expect(m).toContain('<tbody class="sem-verbete">');
    expect(fn("renderMethod")).toContain('["#met-glossario", "Glossário"]');
  });
});
