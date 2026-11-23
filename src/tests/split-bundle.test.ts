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
    // Aposentadas em 10/11/2026 (5 vistas, 3 asserções cada): desenrola, moradia e consignado no pedaço municipal, bets e
    // fraudes no emergentes. As cinco viraram páginas próprias das Famílias e o desenho delas saiu de public/obs/app.js; a
    // garantia que sobra para elas é a contrária, conferida em "as nove vistas reescritas saíram da fonte e dos artefatos".
    const mapa: Record<string, string> = {
      pgfn: "municipal", penetracao: "municipal", rural: "municipal",
      sobre: "emergentes", juros: "emergentes",
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
    // penEscala é compartilhada pelos mapas municipais (penetração e crédito rural): vive no CORE
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
    for (const fn of ["renderPgfn", "renderPenetracao", "renderRural",
      "renderSobre", "renderJuros", "renderMarket", "renderInstitutions", "renderInstPage"]) {
      expect(core.includes(`function ${fn}(`), `${fn} não pode estar no core`).toBe(false);
    }
    const mun = read("public/obs/app-municipal.min.js");
    const eme = read("public/obs/app-emergentes.min.js");
    for (const fn of ["renderPgfn", "renderPenetracao", "renderRural"]) {
      expect(mun.includes(`function ${fn}(`), fn).toBe(true);
    }
    // Bancos na bolsa foi para o chunk emergentes na v0.99.0 (T7): o core ganhou abertura e glossário
    // Instituições (lista e ficha) foi para o chunk emergentes na v0.101.0; histogram e openInstPage ficam no core
    for (const fn of ["renderSobre", "renderJuros", "renderMarket", "mktScreener", "renderInstitutions", "renderInstPageData", "instDetalheHtml"]) {
      expect(eme.includes(`function ${fn}(`), fn).toBe(true);
    }
    for (const fn of ["histogram"]) {
      expect(core.includes(`function ${fn}(`), `${fn} precisa ficar no core`).toBe(true);
    }
    // e o core mantém o que os chunks usam
    expect(core).toContain("function penEscala(");
  });

  it("as nove vistas reescritas saíram da fonte e dos artefatos; a aplicação guarda só o endereço antigo", () => {
    // 10/11/2026: o código que desenhava as nove vistas das Famílias reescritas foi removido de public/obs/app.js. Substitui
    // as asserções aposentadas neste arquivo (renderDesenrola, renderMoradia e renderConsignado no pedaço municipal;
    // renderBets e renderFraudes no emergentes). As páginas novas são conferidas por src/tests/familias-*.test.ts; a saída da
    // aplicação para elas, por src/tests/split-bundle-browser.test.ts e src/tests/familias-paridade-browser.test.ts.
    const reescritas: { abaAntiga: string }[] = JSON.parse(read("src/lib/observatorios/paineis-reescritos.json"));
    const par = (nome: string) => Object.fromEntries(Array.from(app.match(new RegExp(`const ${nome} = \\{([\\s\\S]*?)\\};`))![1].matchAll(/(\w+): "([^"]*)"/g)).map((x) => [x[1], x[2]]));
    const rotas = par("ROUTES"), render = par("RENDER"), pedacos = par("CHUNK_OF_VIEW");
    // toda chave de ROUTES sem render é uma das nove reescritas, e só elas (é o que vistaReescrita() decide na aplicação)
    const semRender = Object.keys(rotas).filter((v) => !render[v]);
    expect(semRender.map((v) => rotas[v]).sort()).toEqual(reescritas.map((r) => r.abaAntiga).sort());
    expect(semRender.length).toBe(9);
    expect(app).toContain("function vistaReescrita(v) { return !!ROUTES[v] && !RENDER[v]; }");
    for (const v of semRender) expect(pedacos[v], v).toBeUndefined();
    const fontes = { "app.js": app, core, municipal: read("public/obs/app-municipal.min.js"), emergentes: read("public/obs/app-emergentes.min.js") };
    for (const fn of ["renderDesenrola", "renderBets", "renderFraudes", "renderJudicial", "renderCobranca", "renderConduta", "renderConsignado", "renderMoradia", "renderEmprego"]) {
      for (const [nome, texto] of Object.entries(fontes)) expect(texto.includes(fn), `${fn} em ${nome}`).toBe(false);
    }
    // os contêineres das nove vistas saíram das duas páginas da aplicação
    for (const arq of ["public/obs/index.html", "public/obs/embed.html"]) {
      for (const v of semRender) expect(read(arq), `${arq}: view-${v}`).not.toContain(`id="view-${v}"`);
    }
    // e toda vista com render tem contêiner no index.html (as dinâmicas e as estáticas)
    for (const v of Object.keys(render)) expect(read("public/obs/index.html"), v).toContain(`id="view-${v}"`);
  });

  it("o core encolheu de verdade (≤ 580 KB desde a v0.101.0; era 744 KB inteiro)", () => {
    expect(statSync(join(process.cwd(), "public/obs/app.min.js")).size).toBeLessThan(580_000);
  });
});
