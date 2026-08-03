/* eslint-disable @typescript-eslint/no-explicit-any -- leitura do bundle da SPA */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
  return [...trecho.matchAll(/^\s{2}(\w+):\s*\{\s*q:/gm)].map((m) => m[1]);
}

describe("guia didático das páginas", () => {
  it("cada verbete tem pergunta, importância, leitura e limite", () => {
    const i = app.indexOf("const GUIA = {");
    const trecho = app.slice(i, app.indexOf("\nfunction guiaPagina", i));
    const chaves = chavesDoGuia();
    expect(chaves.length).toBeGreaterThanOrEqual(18);
    for (const campo of ["q:", "importa:", "ler:", "nao:"]) {
      const n = [...trecho.matchAll(new RegExp(`\\b${campo}`, "g"))].length;
      expect(n, campo).toBeGreaterThanOrEqual(chaves.length);
    }
  });

  it("toda pergunta termina em interrogação", () => {
    const i = app.indexOf("const GUIA = {");
    const trecho = app.slice(i, app.indexOf("\nfunction guiaPagina", i));
    for (const m of trecho.matchAll(/q:\s*"([^"]+)"/g)) {
      expect(m[1].trim().endsWith("?"), m[1]).toBe(true);
    }
  });

  it("as principais páginas da navegação têm verbete", () => {
    const chaves = new Set(chavesDoGuia());
    const principais = ["overview", "panorama", "pulse", "leading", "trends", "sectors", "rj",
      "institutions", "compare", "products", "juros", "market", "pix", "openfinance",
      "judicial", "scenarios", "alerts", "method"];
    const faltando = principais.filter((v) => !chaves.has(v));
    expect(faltando).toEqual([]);
  });

  it("o guia é renderizado pelo cabeçalho comum e na visão geral", () => {
    expect(app).toMatch(/\$\{filterBar\(currentView\(\)\)\}\$\{guiaPagina\(currentView\(\)\)\}/);
    expect(app).toMatch(/guiaPagina\("overview"\)/);
  });
});

describe("navegação simplificada", () => {
  it("busca de páginas presente e acessível", () => {
    expect(html).toMatch(/id="navQ"/);
    expect(html).toMatch(/aria-label="Buscar página"/);
    expect(app).toMatch(/window\.navFiltra/);
  });

  it("grupos colapsam e o grupo da página ativa abre", () => {
    expect(app).toMatch(/function navSincroniza/);
    expect(app).toMatch(/classList\.toggle\("aberto"/);
  });
});
