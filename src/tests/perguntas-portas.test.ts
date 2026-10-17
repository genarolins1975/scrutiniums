import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { portas } from "@/lib/perguntas/portas";
import { IDS_PORTAS, rotaPorta } from "@/lib/perguntas/rotas";
import { ehRotaPublica } from "@/lib/rotasPublicas";
import { DOMINIOS } from "@/lib/dominios";
import { OBSERVATORIOS, rotasDoObservatorio } from "@/lib/observatorios/registro";
import sitemap from "@/app/sitemap";

/** Uma rota do App Router existe se houver page.tsx no caminho literal, num segmento dinâmico ou num catch-all. */
function rotaExiste(href: string): boolean {
  const caminho = href.split(/[?#]/)[0];
  if (caminho.startsWith("/observatorio/")) return true; // SPA servida por /observatorio/[[...rota]]
  const partes = caminho.split("/").filter(Boolean);
  const raiz = join(process.cwd(), "src", "app");
  const busca = (dir: string, i: number): boolean => {
    if (existsSync(join(dir, "[[...painel]]", "page.tsx"))) return true;
    if (i === partes.length) return existsSync(join(dir, "page.tsx"));
    if (existsSync(join(dir, partes[i])) && busca(join(dir, partes[i]), i + 1)) return true;
    return ["[capitulo]", "[id]"].some((d) => existsSync(join(dir, d)) && busca(join(dir, d), i + 1));
  };
  return busca(raiz, 0);
}

describe("O Brasil em perguntas", () => {
  const todas = portas();

  it("publica uma porta por observatório, na ordem do registro", () => {
    expect(todas.map((p) => p.id)).toEqual([...IDS_PORTAS]);
    expect(todas.map((p) => p.id)).toEqual(OBSERVATORIOS.map((o) => o.id));
    for (const p of todas) expect(p.nome).toBe(OBSERVATORIOS.find((o) => o.id === p.id)?.nomeCurto);
  });

  it("cada porta só leva a painéis do próprio observatório ou a atalhos registrados para ele", () => {
    for (const p of todas) {
      const permitidas = rotasDoObservatorio(p.id);
      for (const href of [...p.numeros.map((n) => n.href), ...p.caminhos.map((c) => c.href)]) {
        expect(permitidas.has(href.split("#")[0]), `${p.id}: ${href} não pertence ao observatório`).toBe(true);
      }
    }
  });

  it("cada número tem valor lido da base, unidade, período e fonte", () => {
    for (const p of todas) {
      expect(p.numeros.length, p.id).toBeGreaterThanOrEqual(2);
      expect(p.numeros.length, p.id).toBeLessThanOrEqual(3);
      for (const n of p.numeros) {
        expect(n.valor, `${p.id}: ${n.rotulo}`).not.toBeNull();
        expect(n.valor, `${p.id}: ${n.rotulo}`).not.toMatch(/NaN|undefined|Infinity/);
        for (const campo of [n.unidade, n.periodo, n.fonte]) expect(campo.trim(), `${p.id}: ${n.rotulo}`).not.toBe("");
        expect(n.periodo, `${p.id}: ${n.rotulo}`).not.toMatch(/indisponível/);
      }
    }
  });

  it("os destinos existem; painéis seguem com conta e métodos são abertos", () => {
    for (const p of todas) {
      for (const href of [...p.numeros.map((n) => n.href), ...p.caminhos.map((c) => c.href)]) {
        expect(rotaExiste(href), `${p.id}: ${href}`).toBe(true);
        expect(ehRotaPublica(href.split("#")[0]), `${p.id}: ${href} não deve abrir sem conta`).toBe(false);
      }
      for (const m of p.metodos) {
        expect(rotaExiste(m.href), m.href).toBe(true);
        expect(ehRotaPublica(m.href), m.href).toBe(true);
      }
    }
  });

  it("todo caminho nomeia o domínio de origem e a coleção do registro", () => {
    const nomes = new Set(DOMINIOS.map((d) => d.nomeCurto));
    const colecoes = new Set(OBSERVATORIOS.flatMap((o) => o.colecoes.map((c) => c.nome)));
    for (const p of todas) for (const c of p.caminhos) {
      expect(nomes.has(c.observatorio), c.observatorio).toBe(true);
      expect(colecoes.has(c.colecao), `${c.href}: ${c.colecao}`).toBe(true);
    }
  });

  it("toda gold lida pelas portas está no pacote do servidor da home", async () => {
    const { readFileSync } = await import("node:fs");
    const fonte = readFileSync(join(process.cwd(), "src", "lib", "perguntas", "portas.ts"), "utf-8");
    const lidas = [...fonte.matchAll(/lerPublico\(((?:"[^"]+",?\s*)+)\)/g)]
      .map((m) => "./public/" + [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).join("/"));
    expect(lidas.length).toBeGreaterThan(5);
    const { default: config } = await import("../../next.config.mjs");
    const includes = (config as { experimental: { outputFileTracingIncludes: Record<string, string[]> } }).experimental.outputFileTracingIncludes;
    for (const arquivo of new Set(lidas)) expect(includes["/"], arquivo).toContain(arquivo);
  });

  it("as páginas abertas são estáticas e o cabeçalho reconhece a sessão no navegador", async () => {
    const { readFileSync } = await import("node:fs");
    const pagina = readFileSync(join(process.cwd(), "src", "app", "perguntas", "[porta]", "page.tsx"), "utf-8");
    expect(pagina).toMatch(/dynamic\s*=\s*"force-static"/);
    expect(pagina).toMatch(/dynamicParams\s*=\s*false/);
    const link = readFileSync(join(process.cwd(), "src", "components", "layout", "LinkConta.tsx"), "utf-8");
    expect(link).toMatch(/^"use client";/);
    expect(link).toContain('fetch("/api/auth/eu"');
    expect(link).toContain("r.status === 204");
    const cabecalho = readFileSync(join(process.cwd(), "src", "components", "layout", "PublicHeader.tsx"), "utf-8");
    expect(cabecalho.match(/<LinkConta/g)).toHaveLength(3);
  });

  it("as páginas das perguntas são públicas e estão no sitemap; o prefixo não abre vizinhos", () => {
    const urls = sitemap().map((u) => new URL(u.url).pathname);
    for (const id of IDS_PORTAS) {
      expect(ehRotaPublica(rotaPorta(id))).toBe(true);
      expect(urls).toContain(rotaPorta(id));
    }
    expect(ehRotaPublica("/perguntasx")).toBe(false);
  });
});
