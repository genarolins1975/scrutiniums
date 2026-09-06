/* eslint-disable @typescript-eslint/no-explicit-any -- validação estática do build */
import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Split do bundle por rota (P2 da auditoria: app.js monolítico crescendo).
 * O que se trava: app.js segue como fonte canônica ÚNICA e funcional quando
 * servido inteiro (despacho por presença); os marcadores de chunk são
 * pareados; cada rota do CHUNK_OF_VIEW tem seu renderizador DENTRO da região
 * do chunk certo; e os artefatos do build existem com o conteúdo no lugar
 * certo (core sem os painéis dos chunks, chunks com eles).
 */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf-8");
const app = read("public/obs/app.js");

function regioes(nomeAlvo: string) {
  const re = /\/\* @chunk:(\w+):(ini|fim) \*\//g;
  const abertos: Record<string, number> = {};
  const saida: Array<[number, number]> = [];
  let m;
  while ((m = re.exec(app))) {
    const [, nome, tipo] = m;
    if (tipo === "ini") {
      expect(abertos[nome], `${nome}:ini duplicado`).toBeUndefined();
      abertos[nome] = m.index;
    } else {
      expect(abertos[nome], `${nome}:fim sem ini`).toBeDefined();
      if (nome === nomeAlvo) saida.push([abertos[nome], m.index]);
      delete abertos[nome];
    }
  }
  expect(Object.keys(abertos), "marcadores sem fechamento").toEqual([]);
  return saida;
}

describe("fonte canônica: marcadores e despacho", () => {
  it("marcadores pareados e regiões não vazias", () => {
    expect(regioes("municipal").length).toBe(2);
    expect(regioes("emergentes").length).toBe(1);
  });

  it("RENDER despacha por nome e ensureChunk checa presença antes de buscar", () => {
    expect(app).toMatch(/const RENDER = \{ mapa: "renderMapa", overview: "renderOverview"/);
    expect(app).toContain('function renderView(v) { const f = window[RENDER[v]];');
    expect(app).toContain('typeof window[RENDER[v]] === "function") return Promise.resolve();');
    expect(app).toContain("Promise.all([ensureData(v), ensureChunk(v)])");
  });

  it("cada rota de chunk tem o renderizador dentro da região do chunk certo", () => {
    const mapa: Record<string, string> = {
      desenrola: "municipal", penetracao: "municipal", moradia: "municipal", consignado: "municipal",
      bets: "emergentes", fraudes: "emergentes", juros: "emergentes",
    };
    for (const [view, chunk] of Object.entries(mapa)) {
      expect(app).toContain(`${view}: "${chunk}"`); // no CHUNK_OF_VIEW
      const fn = (app.match(new RegExp(`${view}: "(render\\w+)"`)) || [])[1];
      expect(fn, view).toBeTruthy();
      const dentro = regioes(chunk).some(([a, b]) => {
        const k = app.indexOf(`function ${fn}(`);
        return k > a && k < b;
      });
      expect(dentro, `${fn} fora da região ${chunk}`).toBe(true);
    }
    // penEscala é compartilhada por três painéis municipais: vive no CORE
    const kPen = app.indexOf("function penEscala(");
    const emChunk = ["municipal", "emergentes"].some(c => regioes(c).some(([a, b]) => kPen > a && kPen < b));
    expect(emChunk, "penEscala precisa ficar fora dos chunks").toBe(false);
  });
});

describe("artefatos do build", () => {
  const core = read("public/obs/app.min.js");

  it("core + 2 chunks existem, com os painéis no lugar certo", () => {
    for (const f of ["public/obs/app-municipal.min.js", "public/obs/app-emergentes.min.js"]) {
      expect(statSync(join(process.cwd(), f)).size).toBeGreaterThan(20_000);
    }
    for (const fn of ["renderDesenrola", "renderPenetracao", "renderMoradia", "renderConsignado",
      "renderBets", "renderFraudes", "renderJuros", "renderMarket", "renderInstitutions", "renderInstPage"]) {
      expect(core.includes(`function ${fn}(`), `${fn} não pode estar no core`).toBe(false);
    }
    const mun = read("public/obs/app-municipal.min.js");
    const eme = read("public/obs/app-emergentes.min.js");
    for (const fn of ["renderDesenrola", "renderPenetracao", "renderMoradia", "renderConsignado"]) {
      expect(mun.includes(`function ${fn}(`), fn).toBe(true);
    }
    // Bancos na bolsa foi para o chunk emergentes na v0.99.0 (T7): o core ganhou abertura e glossário
    // Instituições (lista e ficha) foi para o chunk emergentes na v0.101.0; histogram e openInstPage ficam no core
    for (const fn of ["renderBets", "renderFraudes", "renderJuros", "renderMarket", "mktScreener", "renderInstitutions", "renderInstPageData", "instDetalheHtml"]) {
      expect(eme.includes(`function ${fn}(`), fn).toBe(true);
    }
    for (const fn of ["histogram"]) {
      expect(core.includes(`function ${fn}(`), `${fn} precisa ficar no core`).toBe(true);
    }
    // e o core mantém o que os chunks usam
    expect(core).toContain("function penEscala(");
  });

  it("o core encolheu de verdade (≤ 580 KB desde a v0.101.0; era 744 KB inteiro)", () => {
    expect(statSync(join(process.cwd(), "public/obs/app.min.js")).size).toBeLessThan(580_000);
  });
});
