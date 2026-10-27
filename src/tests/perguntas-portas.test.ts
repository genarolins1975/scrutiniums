import { existsSync, readFileSync } from "node:fs";
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

  it("os destinos existem; painéis seguem com conta, consultas da leva 1 e métodos são abertos", () => {
    for (const p of todas) {
      // os caminhos de "No painel completo" levam a painéis com conta
      for (const href of p.caminhos.map((c) => c.href)) {
        expect(rotaExiste(href), `${p.id}: ${href}`).toBe(true);
        expect(ehRotaPublica(href.split("#")[0]), `${p.id}: ${href} não deve abrir sem conta`).toBe(false);
      }
      // um número leva ao painel (com conta) ou a uma consulta aberta que a própria porta oferece em "Para o seu caso"
      const consultas = new Set(p.paraOSeuCaso.map((c) => c.href));
      for (const href of p.numeros.map((n) => n.href)) {
        expect(rotaExiste(href), `${p.id}: ${href}`).toBe(true);
        if (ehRotaPublica(href.split("#")[0])) expect(consultas.has(href), `${p.id}: ${href} aberto sem estar em "Para o seu caso"`).toBe(true);
      }
      for (const m of p.metodos) {
        expect(rotaExiste(m.href), m.href).toBe(true);
        expect(ehRotaPublica(m.href), m.href).toBe(true);
      }
    }
  });

  it("\"Para o seu caso\" só leva a consultas abertas (leva 1 e itens aprovados da leva 2), sem repetir os caminhos com conta", () => {
    const comBloco = Object.fromEntries(todas.map((p) => [p.id, p.paraOSeuCaso.map((c) => c.href)]));
    // "Quanto custa encher o tanque no meu estado?" aberta em 20/10/2026 (LEVA_2): entra nas portas das Famílias e da Energia
    expect(comBloco["familias"]).toEqual(["/gas-natural/gas-de-cozinha", "/setor-eletrico/conta-de-luz", "/combustiveis/no-meu-estado"]);
    // "Como está a escola pública da minha cidade?" (painel Educação nos municípios, 20/10/2026) abre o bloco dos Serviços Públicos
    expect(comBloco["servicos-publicos"]).toEqual(["/educacao-municipal", "/eficiencia-estatal"]);
    expect(comBloco["energia-e-infraestrutura"]).toEqual(["/setor-eletrico/conta-de-luz", "/conectividade", "/saneamento/municipio", "/gas-natural/gas-de-cozinha", "/combustiveis/no-meu-estado"]);
    for (const p of todas) {
      for (const c of p.paraOSeuCaso) {
        expect(rotaExiste(c.href), `${p.id}: ${c.href}`).toBe(true);
        expect(ehRotaPublica(c.href), `${p.id}: ${c.href} deve abrir sem conta`).toBe(true);
        expect(c.pergunta.trim().endsWith("?"), c.pergunta).toBe(true);
        expect(c.resumo.trim(), c.href).not.toBe("");
        expect(p.caminhos.map((x) => x.href), `${p.id}: ${c.href} repetido em "No painel completo"`).not.toContain(c.href);
      }
    }
  });

  it("todo caminho nomeia o domínio de origem (ou o observatório que mantém o painel) e a coleção do registro", async () => {
    const { paineis } = await import("@/lib/observatorios/registro");
    // painel sem domínio de origem é mantido pelo próprio observatório (Território e Clima)
    const proprios = new Set(paineis().filter((p) => p.origem === null).map((p) => p.observatorio));
    const nomes = new Set([...DOMINIOS.map((d) => d.nomeCurto), ...OBSERVATORIOS.filter((o) => proprios.has(o.id)).map((o) => o.nomeCurto)]);
    const colecoes = new Set(OBSERVATORIOS.flatMap((o) => o.colecoes.map((c) => c.nome)));
    for (const p of todas) for (const c of p.caminhos) {
      expect(nomes.has(c.observatorio), c.observatorio).toBe(true);
      expect(colecoes.has(c.colecao), `${c.href}: ${c.colecao}`).toBe(true);
    }
  });

  it("a home usa resumos publicados e não inclui golds grandes no servidor", async () => {
    const { default: config } = await import("../../next.config.mjs");
    const includes = (config as { experimental: { outputFileTracingIncludes: Record<string, string[]> } }).experimental.outputFileTracingIncludes;
    expect(includes["/"]).toBeUndefined();
    const home = readFileSync(join(process.cwd(), "src/components/home/Home.tsx"), "utf8");
    expect(home).toContain("portasPublicadas");
    expect(home).not.toContain("getSessionUser");
  });

  it("as páginas abertas são estáticas e o cabeçalho reconhece a sessão no navegador", async () => {
    const { readFileSync } = await import("node:fs");
    const pagina = readFileSync(join(process.cwd(), "src", "app", "perguntas", "[porta]", "page.tsx"), "utf-8");
    expect(pagina).toMatch(/dynamic\s*=\s*"force-static"/);
    expect(pagina).toMatch(/dynamicParams\s*=\s*false/);
    const link = readFileSync(join(process.cwd(), "src", "components", "layout", "LinkConta.tsx"), "utf-8");
    expect(link).toMatch(/^"use client";/);
    expect(link).toContain("useSessaoCompleta(");
    const sessao = readFileSync(join(process.cwd(), "src/components/acesso/sessao.ts"), "utf8");
    expect(sessao).toContain('fetch("/api/auth/estado"');
    expect(sessao).toContain("j.logado === true");
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
