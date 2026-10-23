/* eslint-disable @typescript-eslint/no-explicit-any -- leitura do bundle da SPA */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { montarHtml, resolverMeta } from "@/lib/observatorioHead";

/**
 * Guia didático por página: toda página listada na navegação principal precisa
 * declarar a pergunta que responde, por que importa, como ler e — sobretudo — o
 * que os dados NÃO permitem concluir. É o contrato didático da plataforma.
 */
const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
const html = readFileSync(join(process.cwd(), "public/obs/index.html"), "utf-8");

function chavesDoGuia(): string[] {
  const i = app.indexOf("const GUIA = {");
  const trecho = app.slice(i, app.indexOf("\nfunction guiaPagina", i));
  return (trecho.match(/^\s{2}\w+:\s*\{\s*q:/gm) ?? []).map((l) => l.trim().split(":")[0]);
}

describe("guia didático das páginas", () => {
  it("cada verbete tem pergunta, importância, leitura e limite", () => {
    const i = app.indexOf("const GUIA = {");
    const trecho = app.slice(i, app.indexOf("\nfunction guiaPagina", i));
    const chaves = chavesDoGuia();
    expect(chaves.length).toBeGreaterThanOrEqual(18);
    for (const campo of ["q:", "importa:", "ler:", "nao:"]) {
      const n = (trecho.match(new RegExp(`\\b${campo}`, "g")) ?? []).length;
      expect(n, campo).toBeGreaterThanOrEqual(chaves.length);
    }
  });

  it("toda pergunta termina em interrogação", () => {
    const i = app.indexOf("const GUIA = {");
    const trecho = app.slice(i, app.indexOf("\nfunction guiaPagina", i));
    for (const bruto of trecho.match(/q:\s*"[^"]+"/g) ?? []) {
      const texto = bruto.replace(/^q:\s*"/, "").replace(/"$/, "");
      expect(texto.trim().endsWith("?"), texto).toBe(true);
    }
  });

  it("as principais páginas da navegação têm verbete", () => {
    const chaves = new Set(chavesDoGuia());
    const principais = ["overview", "panorama", "pulse", "leading", "trends", "sectors", "rj",
      "institutions", "compare", "products", "juros", "market", "pix", "openfinance",
      "judicial", "scenarios", "alerts", "method",
      // avaliação de 05/09: as abas que renderizavam sem guia e as rotas dinâmicas
      "bets", "fraudes", "regulacao", "pgfn", "desenrola", "penetracao", "moradia",
      "consignado", "operacional", "inst", "product", "sector", "presmun"];
    const faltando = principais.filter((v) => !chaves.has(v));
    expect(faltando).toEqual([]);
  });

  it("o guia é renderizado pelo cabeçalho comum e na visão geral", () => {
    expect(app).toMatch(/\$\{filterBar\(currentView\(\)\)\}\$\{guiaPagina\(currentView\(\)\)\}/);
    expect(app).toMatch(/guiaPagina\("overview"\)/);
  });
});

describe("navegação simplificada", () => {
  it("a busca é a da plataforma, na barra (Iniciativa 3 do parecer de UX): formulário GET para /buscar; o filtro local da barra lateral saiu", () => {
    expect(html).toMatch(/<form class="bp-busca" action="\/buscar" method="get" role="search" aria-label="Buscar na Scrutiniums">/);
    expect(html).toMatch(/<input id="bpBuscaQ" class="bp-busca-campo" name="q" type="search"/);
    expect(html).not.toMatch(/id="navQ"/);
    expect(app).not.toMatch(/window\.navFiltra/);
  });

  // até 23/10/2026 os grupos da barra lateral colapsavam e o da página ativa abria; com a navegação da plataforma (Iniciativa 2
  // do parecer de UX de 23/10/2026), a linha 2 mostra as páginas do grupo atual, e só dele
  it("a linha 2 mostra as páginas do grupo atual", () => {
    const h = montarHtml(resolverMeta("/leading-signals"));
    const linha2 = h.slice(h.indexOf('id="nav-colecao-credito-paginas"'));
    expect(h).toContain('id="nav-colecao-credito-paginas" aria-label="Páginas de Ciclo do crédito"');
    const paginas = Array.from(linha2.slice(0, linha2.indexOf("</ul>")).matchAll(/href="([^"]+)"/g)).map((m) => m[1]);
    expect(paginas).toEqual(["/observatorio/credit", "/observatorio/leading-signals", "/observatorio/scenarios", "/observatorio/search-trends"]);
    expect(h.match(/nav-colecao-credito-paginas/g)).toHaveLength(1);
    expect(app).not.toMatch(/function navSincroniza/);
  });
});
