/**
 * Um só vocabulário (Iniciativa 1 do parecer de UX de 21/10/2026, docs/observatorios/REAGRUPAMENTO.md): em qualquer tela,
 * Observatório (um dos seis) → Coleção (uma das 28) → Página. Este teste reprova:
 *
 * 1. "Observatório Brasileiro d…" ou "Observatório do Agronegócio Brasileiro" em .tsx de src/components e src/app e em
 *    public/obs/index.html, salvo /sobre, o campo nomeLegado e as exceções listadas abaixo com motivo;
 * 2. seletor da barra sem alguma das 28 coleções (páginas Next e aplicação do Crédito);
 * 3. coluna do rodapé cujo aria-label não seja nome de observatório (a coluna Institucional é a única outra);
 * 4. página de coleção (inventário de src/lib/observatorios/inventario.ts) sem a trilha "Você está em" no HTML do servidor;
 * 5. navegação de módulo sem aria-label "Navegação da coleção X", com X uma das 28 coleções.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { DOMINIOS } from "@/lib/dominios";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { inventario } from "@/lib/observatorios/inventario";
import { indiceCompleto } from "@/lib/observatorios/contexto";
import { resolverContexto } from "@/lib/observatorios/contextoPuro";
import { htmlBarraSpa, htmlTrilhaSpa } from "@/lib/observatorios/barraSpa";
import { SwitcherObservatorio } from "@/components/layout/SwitcherObservatorio";
import { TrilhaCliente } from "@/components/layout/NavegacaoContexto";
import { Footer } from "@/components/layout/Footer";

// o navegador vê o endereço de cada caso (os componentes de cliente resolvem o contexto por ele)
const navegador = vi.hoisted(() => ({ caminho: "/" }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => navegador.caminho,
}));

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
function arquivos(dir: string, ext: RegExp): string[] {
  const abs = join(raiz, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((n) => {
    const p = join(dir, n);
    return statSync(join(raiz, p)).isDirectory() ? arquivos(p, ext) : ext.test(n) ? [p] : [];
  });
}

const COLECOES = OBSERVATORIOS.flatMap((o) => o.colecoes.map((c) => ({ ...c, observatorio: o })));
const NOMES_COLECAO = new Set(COLECOES.map((c) => c.nome));
const NOMES_OBSERVATORIO = OBSERVATORIOS.map((o) => o.nome);

// ------------------------------------------------------------------------------------------------- 1. nomes antigos

const LEGADO = /Observatório Brasileiro d|Observatório do Agronegócio Brasileiro/g;
/**
 * Exceções com motivo: cada uma é um trecho exato, num arquivo exato, e conta uma vez só. Vazia desde o Grupo C da Iniciativa 4
 * (22/10/2026): o H1 da apresentação do Crédito, a única exceção, passou à pergunta aprovada pelo dono.
 */
const EXCECOES: { arquivo: string; trecho: string; motivo: string }[] = [];
const fora = (f: string) => f.startsWith("src/app/sobre/") || /src\/components\/institucional\/Sobre/.test(f);

describe("1. o nome antigo dos domínios não volta à interface", () => {
  it("nenhum .tsx de src/components e src/app nem a SPA do Crédito diz \"Observatório Brasileiro de X\"", () => {
    const achados: string[] = [];
    for (const f of [...arquivos("src/components", /\.tsx$/), ...arquivos("src/app", /\.tsx$/), "public/obs/index.html"]) {
      if (fora(f)) continue;
      let texto = ler(f);
      for (const e of EXCECOES.filter((x) => x.arquivo === f)) {
        expect(texto.split(e.trecho).length - 1, `${f}: ${e.motivo}`).toBe(1);
        texto = texto.replace(e.trecho, "");
      }
      texto.split("\n").forEach((linha, i) => {
        if (LEGADO.test(linha)) achados.push(`${f}:${i + 1}: ${linha.trim().slice(0, 120)}`);
        LEGADO.lastIndex = 0;
      });
    }
    expect(achados).toEqual([]);
  });

  it("os domínios se chamam como a coleção do registro; o nome antigo fica só em nomeLegado", () => {
    for (const d of DOMINIOS) {
      expect(NOMES_COLECAO.has(d.nome), d.id).toBe(true);
      expect(d.nomeLegado, d.id).toMatch(/^Observatório (Brasileiro d|do Agronegócio Brasileiro)/);
      expect(COLECOES.find((c) => c.dominio === d.id)?.nome, d.id).toBe(d.nome);
    }
  });
});

// ------------------------------------------------------------------------------------------------------ 2. seletor

describe("2. o seletor da barra lista as 28 coleções", () => {
  it("nas páginas Next, agrupadas pelos seis observatórios, com a coleção dona do endereço marcada", () => {
    expect(COLECOES).toHaveLength(28);
    for (const c of COLECOES) {
      navegador.caminho = c.href;
      const html = renderToStaticMarkup(createElement(SwitcherObservatorio, { caminho: c.href }));
      for (const x of COLECOES) expect(html, `${c.href} → ${x.id}`).toContain(`href="${x.href}"`);
      for (const x of COLECOES) expect(html, `${c.href} → ${x.nome}`).toContain(`>${x.nome}<`);
      expect(html.match(/aria-current="true"/g), c.href).toHaveLength(1);
      expect(html, c.href).toContain(`aria-label="Coleção atual: ${c.nome}.`);
    }
  });

  it("na aplicação do Crédito, a barra gerada do registro, igual à publicada", () => {
    const spa = ler("public/obs/index.html");
    expect(spa).toContain(htmlBarraSpa());
    const menu = spa.slice(spa.indexOf('class="obs-trocar"'), spa.indexOf("</details>", spa.indexOf('class="obs-trocar"')));
    for (const c of COLECOES) expect(menu, c.id).toMatch(new RegExp(`<a href="${c.href}"[^>]*>${c.nome}<`));
  });
});

// ------------------------------------------------------------------------------------------------------- 3. rodapé

describe("3. o rodapé tem uma coluna por observatório", () => {
  const rotulos = (html: string) => [...html.matchAll(/<nav[^>]*aria-label="([^"]+)"/g)].map((m) => m[1]);
  it.each([
    ["completo", createElement(Footer)],
    ["compacto", createElement(Footer, { compacto: true })],
    ["inglês", createElement(Footer, { idioma: "en" })],
  ] as const)("rodapé %s: seis colunas com o nome dos observatórios, na ordem do registro, e a Institucional", (_nome, elemento) => {
    const r = rotulos(renderToStaticMarkup(elemento));
    expect(r.filter((x) => NOMES_OBSERVATORIO.includes(x))).toEqual(NOMES_OBSERVATORIO);
    expect(r.filter((x) => !NOMES_OBSERVATORIO.includes(x))).toEqual([r.includes("Institutional") ? "Institutional" : "Institucional"]);
  });

  it("cada coluna leva às coleções do observatório, pelo nome do registro", () => {
    const html = renderToStaticMarkup(createElement(Footer));
    for (const o of OBSERVATORIOS) {
      const coluna = html.slice(html.indexOf(`aria-label="${o.nome}"`), html.indexOf("</nav>", html.indexOf(`aria-label="${o.nome}"`)));
      for (const c of o.colecoes) expect(coluna, `${o.id}/${c.id}`).toContain(`href="${c.href}"`);
      for (const c of o.colecoes) expect(coluna, `${o.id}/${c.id}`).toContain(`>${c.nome}<`);
    }
  });
});

// ------------------------------------------------------------------------------------------------------- 4. trilha

/** Arquivo do App Router que serve um endereço: page.tsx (segmentos dinâmicos e catch-all opcional) ou route.ts. */
function arquivoDaRota(rota: string): string | null {
  let dir = "src/app";
  const partes = rota.split("/").filter(Boolean);
  for (let i = 0; i < partes.length; i++) {
    const filhos = readdirSync(join(raiz, dir));
    const exato = filhos.find((n) => n === partes[i]);
    if (exato) { dir = join(dir, exato); continue; }
    const pega = filhos.find((n) => /^\[\[?\.\.\./.test(n));
    if (pega) { dir = join(dir, pega); break; }
    const dinamico = filhos.find((n) => /^\[[^.]/.test(n));
    if (!dinamico) return null;
    dir = join(dir, dinamico);
  }
  const opcional = existsSync(join(raiz, dir)) ? readdirSync(join(raiz, dir)).find((n) => n.startsWith("[[...")) : undefined;
  for (const d of [dir, ...(opcional ? [join(dir, opcional)] : [])]) {
    for (const n of ["page.tsx", "route.ts"]) if (existsSync(join(raiz, d, n))) return join(d, n);
  }
  return null;
}

/** O arquivo, os layouts acima dele e o que eles importam (até seis níveis) chegam ao cabeçalho com trilha ou à Trilha? */
function chegaNaTrilha(arquivo: string): boolean {
  const inicio = [arquivo];
  for (let d = dirname(arquivo); d.startsWith("src/app"); d = dirname(d)) if (existsSync(join(raiz, d, "layout.tsx"))) inicio.push(join(d, "layout.tsx"));
  const alvo = /src\/components\/layout\/(CabecalhoPlataforma|Trilha)\.tsx$/;
  const vistos = new Set<string>();
  let fila = inicio;
  for (let nivel = 0; nivel < 7 && fila.length; nivel++) {
    const proxima: string[] = [];
    for (const f of fila) {
      if (vistos.has(f)) continue;
      vistos.add(f);
      if (alvo.test(f)) return true;
      const fonte = ler(f);
      if (/<nav aria-label="Você está em"/.test(fonte)) return true;
      for (const m of fonte.matchAll(/from\s+["']([^"']+)["']/g)) {
        const esp = m[1];
        const base = esp.startsWith("@/") ? join("src", esp.slice(2)) : esp.startsWith(".") ? join(dirname(f), esp) : null;
        if (!base) continue;
        const achado = [`${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")].find((c) => existsSync(join(raiz, c)));
        if (achado) proxima.push(relative(raiz, join(raiz, achado)));
      }
    }
    fila = proxima;
  }
  return false;
}

describe("4. toda página de coleção traz a trilha \"Você está em\"", () => {
  const rotas = Array.from(new Set(inventario().flatMap((o) => o.colecoes.flatMap((c) => [c.href, ...c.paginas.flatMap((p) => (p.rota ? [p.rota] : []))]))));
  const indice = indiceCompleto();

  it("o inventário tem as 28 coleções e cada endereço resolve no registro", () => {
    expect(inventario().flatMap((o) => o.colecoes)).toHaveLength(28);
    for (const r of rotas) expect(resolverContexto(r, indice), r).not.toBeNull();
  });

  it.each(rotas)("%s", (rota) => {
    const ctx = resolverContexto(rota, indice)!;
    // a trilha que o servidor desenha para o endereço: raiz, observatório e coleção do registro
    const esperado = ["Observatórios", ctx.observatorio.nomeCurto, ...(ctx.colecao ? [ctx.colecao.nome] : [])];
    const texto = (html: string) => html.replace(/<[^>]+>/g, "|").split("|").map((x) => x.trim()).filter((x) => x && x !== "/");
    if (rota === "/observatorio" || rota.startsWith("/observatorio/")) {
      // aplicação do Crédito: o route handler troca a trilha do index.html pela da aba (observatorioHead.ts)
      expect(ler("public/obs/index.html")).toContain('<nav aria-label="Você está em"');
      expect(texto(htmlTrilhaSpa(rota)).slice(0, esperado.length), rota).toEqual(esperado);
      return;
    }
    const arquivo = arquivoDaRota(rota);
    expect(arquivo, `${rota}: arquivo da rota`).not.toBeNull();
    expect(chegaNaTrilha(arquivo!), `${rota}: ${arquivo} não chega à trilha`).toBe(true);
    navegador.caminho = rota;
    const html = renderToStaticMarkup(createElement(TrilhaCliente, { indice, caminho: rota, idioma: "pt" }));
    expect(html, rota).toContain('aria-label="Você está em"');
    expect(texto(html).slice(0, esperado.length), rota).toEqual(esperado);
  });

  it("não há trilha na home, em /entrar, /cadastro e na conta", () => {
    for (const r of ["/", "/entrar", "/cadastro", "/app/observatorios", "/app/conta"]) {
      navegador.caminho = r;
      expect(renderToStaticMarkup(createElement(TrilhaCliente, { indice, caminho: r, idioma: "pt" })), r).toBe("");
    }
  });

  it("as trilhas antigas saíram: um só aria-label, sem \"Trilha\" nem \"Caminho da página\"", () => {
    const achados: string[] = [];
    for (const f of [...arquivos("src/components", /\.tsx$/), ...arquivos("src/app", /\.tsx$/)]) {
      if (/aria-label=\{?["'`](Trilha|Caminho da página)["'`]|className="(edm-trilha|tr-breadcrumb)"/.test(ler(f))) achados.push(f);
    }
    expect(achados).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------- 5. navegação de módulo

/** Navegações de módulo: as dos cabeçalhos e navegações de domínio, as das casas das Contas e a barra lateral do Crédito. */
const NAVS_DE_MODULO = [
  ...arquivos("src/components", /^(Cabecalho|Navegacao)[A-Za-z]*\.tsx$/).filter(
    (f) => !f.startsWith("src/components/layout/") && !/NavegacaoObservatorios|NavegacaoLocal/.test(f),
  ),
  "src/app/contas-publicas/layout.tsx",
  "src/app/contas-publicas-estaduais/layout.tsx",
];

describe("5. toda navegação de módulo se chama \"Navegação da coleção X\"", () => {
  it("cabeçalhos e navegações de domínio, com X uma das 28 coleções", () => {
    // Iniciativa 2: as navegações de domínio deram lugar à navegação da coleção, que monta o rótulo com o nome do registro;
    // a lista abaixo fica com o que restar de navegação própria (hoje, as casas das Contas, que já usam a navegação comum)
    expect(ler("src/components/layout/NavegacaoColecaoCliente.tsx")).toContain("tx(`Navegação da coleção ${nav.nome}`");
    expect(NAVS_DE_MODULO.length).toBeGreaterThanOrEqual(2);
    const achados: string[] = [];
    for (const f of NAVS_DE_MODULO) {
      for (const m of ler(f).matchAll(/<nav\b[^>]*?aria-label=(\{?)(?:tx\()?["'`]([^"'`]+)["'`]/g)) {
        const r = /^Navegação da coleção (.+)$/.exec(m[2]);
        const x = r?.[1];
        if (!x || !(NOMES_COLECAO.has(x) || x === "${colecao ?? nome}")) achados.push(`${f}: ${m[2]}`);
      }
    }
    expect(achados).toEqual([]);
  });

  // desde a Iniciativa 2 do parecer de UX de 23/10/2026 a aplicação não tem barra lateral: a navegação é a da plataforma, da
  // coleção dona do endereço (Consignado mostra a de "Dívida e crédito das famílias"; teste credito-casca)
  it("na aplicação do Crédito, a navegação é a da coleção Crédito e sistema financeiro", () => {
    expect(ler("public/obs/index.html")).toContain('<nav aria-label="Navegação da coleção Crédito e sistema financeiro" class="nav-colecao');
  });
});
