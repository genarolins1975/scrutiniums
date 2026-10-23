import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GRUPOS_CREDITO } from "@/lib/credito/navegacao";
import { navegacaoDaColecao } from "@/lib/observatorios/navegacaoColecao";
import { DESTINO_ABAS_CREDITO } from "@/lib/observatorios/registro";

/**
 * Início do painel (antes "Mapa do Observatório"; o dono renomeou em 23/10/2026) e os grupos do Crédito. O que se trava:
 * - o Início do painel é a rota padrão de /observatorio, a primeira página do primeiro grupo e está registrado em todos os mapas;
 * - os grupos são os oito da jornada (decisão do dono de 18/10/2026, Começar → Referência), lidos de GRUPOS_CREDITO
 *   (src/lib/credito/navegacao.ts) desde que a barra lateral saiu (Iniciativa 2 do parecer de UX de 23/10/2026), e toda aba
 *   estática do ROUTES está em exatamente um grupo (exceto as dinâmicas e as três do fim da página: research, sugestoes, sobre);
 * - cada aba aparece na navegação da coleção dona: as do Crédito nos grupos dele, as das outras coleções na navegação delas;
 * - o ciclo do Início do painel cobre todas as abas temáticas (cada aba aparece em um nó do ciclo ou é de Referência/Começar);
 * - as trilhas só apontam para abas existentes com GUIA.
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
const rotas = mapa("ROUTES");
const vistaDe = Object.fromEntries(Object.entries(rotas).map(([v, r]) => [`/observatorio${r}`, v]));
// as páginas Next do Crédito nos grupos (o Simulador da parcela) não são abas da aplicação
const grupos = GRUPOS_CREDITO.map((g) => ({ rotulo: g.rotulo, vistas: g.paginas.map((h) => vistaDe[h]).filter(Boolean) as string[] }));
const noMenu = grupos.flatMap((g) => g.vistas);
const DINAMICAS = ["inst", "sector", "product", "presmun", "estado"];
const RODAPE = ["research", "sugestoes", "sobre"];

describe("Início do painel: rota padrão e registro", () => {
  it("é a rota padrão, a primeira aba do menu e está em todos os mapas da SPA", () => {
    expect(app).toContain('return nome || "mapa";');
    expect(app).toContain('mapa: "/map"');
    expect(app).toContain('mapa: "renderMapa"');
    expect(app).toContain('mapa: "Início do painel"');
    expect(app).toContain('mapa: "sgs"');
    expect(app).toMatch(/\n  mapa: \{ q: "[^"]+\?"/);
    expect(app).not.toMatch(/CHUNK_OF_VIEW = \{[^}]*mapa:/); // vive no core: é a primeira página
    expect(html).toMatch(/<section class="view active" id="view-mapa">/);
    expect(grupos[0].vistas[0]).toBe("mapa");
    expect(navegacaoDaColecao("credito").itens.find((i) => i.rotulo === "Começar")?.href).toBe("/observatorio/map");
    expect(read("src/lib/data/observatorioAbas.ts")).toContain('caminho: "/map"');
    expect(read("src/lib/telemetry.ts")).toContain('"obs:mapa"');
  });
  it("o ciclo tem sete passos e as trilhas três perfis, todos apontando para abas existentes com guia", () => {
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

describe("Grupos do Crédito", () => {
  it("oito grupos na ordem da jornada, cada aba estática em exatamente um grupo", () => {
    expect(grupos.map((g) => g.rotulo)).toEqual(["Começar", "Ciclo do crédito", "Instituições e funding", "Produtos e preços", "Território e pessoas", "Risco, cobrança e recuperação", "Pagamentos, conduta e fronteiras", "Referência"]);
    const estaticas = Object.keys(rotas).filter((v) => !DINAMICAS.includes(v) && !RODAPE.includes(v));
    for (const v of estaticas) expect(noMenu.filter((x) => x === v).length, v).toBe(1);
    expect(noMenu.length).toBe(estaticas.length);
    // a aplicação não desenha mais menu: nenhum botão de navegação no index.html
    expect(html).not.toMatch(/data-view=/);
  });

  it("cada aba está na navegação da coleção dona: as do Crédito nos grupos dele, as das outras coleções só na delas", () => {
    // páginas da navegação: as da linha 1 e as dos grupos (o grupo leva à primeira página dele, que não conta duas vezes)
    const hrefs = (id: string) => navegacaoDaColecao(id).itens.flatMap((i) => (i.subpaginas ? i.subpaginas.map((s) => s.href) : [i.href]));
    const doCredito = hrefs("credito");
    for (const g of GRUPOS_CREDITO) {
      for (const h of g.paginas) {
        if (!h.startsWith("/observatorio/")) continue;
        const [, colecao] = DESTINO_ABAS_CREDITO[h.slice("/observatorio".length)];
        if (colecao === "credito") expect(doCredito.filter((x) => x === h).length, h).toBe(1);
        else {
          expect(doCredito, h).not.toContain(h);
          expect(hrefs(colecao), `${h} na navegação de ${colecao}`).toContain(h);
        }
      }
    }
  });

  it("rótulos na navegação iguais a VIEW_TITLES e ao catálogo; grupos com no máximo 7 abas", () => {
    const titulos = mapa("VIEW_TITLES");
    const cat = read("src/lib/data/observatorioAbas.ts");
    const nav = navegacaoDaColecao("credito").itens.flatMap((i) => i.subpaginas ?? [i]);
    for (const p of nav) {
      const v = vistaDe[p.href];
      if (!v) continue;
      expect(p.rotulo, v).toBe(titulos[v]);
      expect(cat).toContain(`titulo: "${titulos[v]}"`);
    }
    for (const g of grupos) expect(g.vistas.length).toBeLessThanOrEqual(7);
  });
});
