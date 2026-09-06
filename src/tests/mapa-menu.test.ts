import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Mapa do Observatório (página inicial) e menu reorganizado. O que se trava:
 * - o Mapa é a rota padrão de /observatorio, está no menu como primeira aba e registrado em todos os mapas;
 * - o menu tem 8 grupos, na ordem da jornada (Começar → Referência), e toda aba estática do ROUTES está em exatamente um grupo
 *   (exceto as dinâmicas e as duas de rodapé, research e sugestoes);
 * - o ciclo do Mapa cobre todas as abas temáticas do menu (cada aba do menu aparece em um nó do ciclo ou é de Referência/Começar);
 * - as trilhas só apontam para abas existentes com GUIA;
 * - a busca do menu e o acordeão continuam com a mesma estrutura (.navgroup > .navlabel + button[data-view]).
 */
const raiz = process.cwd();
const read = (p: string) => readFileSync(join(raiz, p), "utf-8");
const app = read("public/obs/app.js");
const html = read("public/obs/index.html");
const mapa = (nome: string) => {
  const m = app.match(new RegExp(`const ${nome} = \\{([\\s\\S]*?)\\};`));
  if (!m) throw new Error(nome);
  return Object.fromEntries(Array.from(m[1].matchAll(/(\w+): "([^"]+)"/g)).map((x) => [x[1], x[2]]));
};
const grupos = Array.from(html.matchAll(/<div class="navgroup">\s*<span class="navlabel">([^<]+)<\/span>([\s\S]*?)<\/div>/g)).map((m) => ({
  rotulo: m[1],
  vistas: Array.from(m[2].matchAll(/data-view="(\w+)"/g)).map((x) => x[1]),
}));
const noMenu = grupos.flatMap((g) => g.vistas);
const DINAMICAS = ["inst", "sector", "product", "presmun", "estado"];
const RODAPE = ["research", "sugestoes"];

describe("Mapa do Observatório: rota padrão e registro", () => {
  it("é a rota padrão, a primeira aba do menu e está em todos os mapas da SPA", () => {
    expect(app).toContain('return nome || "mapa";');
    expect(app).toContain('mapa: "/map"');
    expect(app).toContain('mapa: "renderMapa"');
    expect(app).toContain('mapa: "Mapa do Observatório"');
    expect(app).toContain('mapa: "sgs"');
    expect(app).toMatch(/\n  mapa: \{ q: "[^"]+\?"/);
    expect(app).not.toMatch(/CHUNK_OF_VIEW = \{[^}]*mapa:/); // vive no core: é a primeira página
    expect(html).toMatch(/<section class="view active" id="view-mapa">/);
    expect(grupos[0].vistas[0]).toBe("mapa");
    expect(html).toContain('data-view="mapa" class="active"');
    expect(read("src/lib/data/observatorioAbas.ts")).toContain('caminho: "/map"');
    expect(read("src/lib/telemetry.ts")).toContain('"obs:mapa"');
  });
  it("o ciclo tem sete passos e as trilhas três perfis, todos apontando para abas existentes com guia", () => {
    const rotas = mapa("ROUTES");
    const ciclo = app.match(/const MAPA_CICLO = \[([\s\S]*?)\n\];/)![1];
    const nos = Array.from(ciclo.matchAll(/views: \[([^\]]+)\]/g)).map((m) => Array.from(m[1].matchAll(/"(\w+)"/g)).map((x) => x[1]));
    expect(nos.length).toBe(7);
    const noCiclo = nos.flat();
    for (const v of noCiclo) { expect(rotas[v]).toBeTruthy(); expect(app).toMatch(new RegExp(`\\n  ${v}: \\{ q: "`)); }
    expect(new Set(noCiclo).size).toBe(noCiclo.length); // nenhuma aba em dois nós
    const trilhas = app.match(/const MAPA_TRILHAS = \[([\s\S]*?)\n\];/)![1];
    const passos = Array.from(trilhas.matchAll(/passos: \[([^\]]+)\]/g)).map((m) => Array.from(m[1].matchAll(/"(\w+)"/g)).map((x) => x[1]));
    expect(passos.length).toBe(3);
    for (const p of passos.flat()) expect(rotas[p]).toBeTruthy();
    // toda aba temática do menu está no ciclo; as de Começar e Referência ficam fora por desenho
    const tematicas = grupos.filter((g) => !["Começar", "Referência"].includes(g.rotulo)).flatMap((g) => g.vistas);
    for (const v of tematicas) expect(noCiclo).toContain(v);
  });
});

describe("Menu reorganizado", () => {
  it("oito grupos na ordem da jornada, cada aba estática em exatamente um grupo", () => {
    expect(grupos.map((g) => g.rotulo)).toEqual(["Começar", "Ciclo do crédito", "Instituições e funding", "Produtos e preços", "Território e pessoas", "Risco, cobrança e recuperação", "Pagamentos, conduta e fronteiras", "Referência"]);
    const rotas = mapa("ROUTES");
    const estaticas = Object.keys(rotas).filter((v) => !DINAMICAS.includes(v) && !RODAPE.includes(v));
    for (const v of estaticas) expect(noMenu.filter((x) => x === v).length).toBe(1);
    for (const v of noMenu) expect(rotas[v]).toBeTruthy();
    expect(noMenu.length).toBe(estaticas.length);
  });
  it("rótulos do menu iguais a VIEW_TITLES e ao catálogo; grupos com no máximo 7 abas", () => {
    const titulos = mapa("VIEW_TITLES");
    const cat = read("src/lib/data/observatorioAbas.ts");
    for (const m of Array.from(html.matchAll(/data-view="(\w+)"[^>]*>([^<]+)</g))) {
      expect(m[2].trim()).toBe(titulos[m[1]]);
      expect(cat).toContain(`titulo: "${titulos[m[1]]}"`);
    }
    for (const g of grupos) expect(g.vistas.length).toBeLessThanOrEqual(7);
  });
});
