/**
 * Instituições leve (avaliação de 06/09/2026, §3.3 e §16): a lista de 100 conglomerados montava no DOM o
 * detalhe fechado de cada linha (24,6 mil das 32,5 mil palavras da aba). O detalhe passa a ser montado no
 * toggle; a região inteira vive no chunk emergentes; nenhum texto de SVG fica abaixo de 11 px; os chunks
 * são gerados no prebuild e no CI, fora do git.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(RAIZ, p), "utf8");
const app = read("public/obs/app.js");

describe("Instituições: detalhe de linha sob demanda", () => {
  it("as linhas trazem só o gatilho; o corpo vem de instDetalheHtml no toggle, uma vez por linha", () => {
    expect(app).toContain('<td><details class="decomp" data-inst="${i.cod_inst}"><summary>abrir</summary><div class="lazy src">carregando…</div></details></td>');
    expect(app).toMatch(/function instDetalheHtml\(i\) \{[\s\S]*?Condição atual — decomposição/);
    expect(app).toContain('el.querySelectorAll("details[data-inst]").forEach(d => d.addEventListener("toggle"');
    expect(app).toContain('if (!d.open || d.dataset.pronto) return;');
    expect(app).toContain("INST_POR_COD = Object.fromEntries(list.map(i => [i.cod_inst, i]));");
  });
  it("a região Instituições vive no chunk emergentes; histogram e openInstPage ficam no core", () => {
    const ini = app.indexOf("/* @chunk:emergentes:ini */"), fim = app.indexOf("/* @chunk:emergentes:fim */");
    for (const fn of ["renderInstitutions", "renderInstPage", "renderInstPageData", "instDetalheHtml", "guidCicloBloco"]) {
      const k = app.indexOf(`function ${fn}(`);
      expect(k, fn).toBeGreaterThan(ini);
      expect(k, fn).toBeLessThan(fim);
    }
    for (const fn of ["function histogram(", "window.openInstPage = "]) {
      const k = app.indexOf(fn);
      expect(k < ini || k > fim, fn).toBe(true);
    }
    expect(app).toContain('institutions: "emergentes", inst: "emergentes"');
  });
});

describe("eixos e rótulos de SVG a 11 px", () => {
  it("nenhum font-size abaixo de 11 no app.js e o eixo do CSS está em 11 px", () => {
    expect(app).not.toMatch(/font-size="(8|9|10|10\.5)"/);
    expect(read("public/obs/styles.css")).toContain(".axis text { font-size: 11px;");
  });
});

describe("bundles fora do git", () => {
  it("core e os dois chunks estão no .gitignore; CI e Vercel os geram antes de testar e publicar", () => {
    const gi = read(".gitignore");
    for (const f of ["/public/obs/app.min.js", "/public/obs/app-municipal.min.js", "/public/obs/app-emergentes.min.js"]) expect(gi).toContain(f);
    expect(read("package.json")).toContain('"prebuild": "node scripts/minify-obs.mjs"');
    expect(read(".github/workflows/ci.yml")).toContain("run: node scripts/minify-obs.mjs");
  });
});
