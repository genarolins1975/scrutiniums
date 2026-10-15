import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { parse } from "parse5";
import type { Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it, type TestContext } from "vitest";
import { modoDaPagina } from "./suporte/i18n-build";
import { aguardarPagina, capturarAnunciador, criarNavegadorI18n, type NavegadorI18n } from "./suporte/i18n-browser";
import { verificarFallbackDinamico } from "./suporte/i18n-dinamico";

const require = createRequire(import.meta.url);
const APP = join(process.cwd(), ".next", "server", "app");
const EXIGIR = process.env.EXIGIR_BUILD_HTML === "1";
const CAMINHOS = ["/glossario", "/termos", "/privacidade"] as const;
let ambiente: NavegadorI18n | undefined;

function pronto(ctx: TestContext): NavegadorI18n {
  if (!existsSync(APP) && !EXIGIR) ctx.skip("sem build local; rode npm run build para verificar as páginas públicas dinâmicas PT/EN");
  if (!ambiente) throw new Error("Prova obrigatória das páginas públicas dinâmicas requer o build e Chromium disponíveis");
  return ambiente;
}

beforeAll(async () => {
  if (!existsSync(APP) && !EXIGIR) return;
  expect(existsSync(APP), "EXIGIR_BUILD_HTML=1 requer o build de produção").toBe(true);
  for (const caminho of CAMINHOS) {
    for (const rota of [caminho, "/en" + caminho]) expect(modoDaPagina(rota), rota).toBe("dinamico");
  }
  ambiente = await criarNavegadorI18n();
}, 90_000);
afterAll(async () => { await ambiente?.fechar(); });

type Violacao = { id: string; nodes: { html: string }[] };
type Resultado = {
  html: string;
  anunciador: Awaited<ReturnType<typeof capturarAnunciador>>;
  violacoes: Violacao[];
  larguraDocumento: number;
};

function observarFalhas(page: Page): string[] {
  const falhas: string[] = [];
  page.on("pageerror", (e) => falhas.push(e.message));
  page.on("console", (m) => { if (/hydration|hydrating|did not match|Minified React error/i.test(m.text())) falhas.push(m.text()); });
  return falhas;
}

function assinaturas(violacoes: Violacao[]): string[] {
  // Sem exceções por alvo: o corpo português deve ser conservado integralmente.
  return violacoes.flatMap((v) => v.nodes.map((node) => `${v.id}: ${node.html}`));
}

describe.each(CAMINHOS)("%s PT/EN: navegador do build de produção", (caminho) => {
  it.for([320, 1440])("conserva o fallback e não acrescenta violações WCAG 2/2.1 A/AA a %i px", { timeout: 60_000 }, async (largura, ctx) => {
    const servidor = pronto(ctx);
    const contexto = await servidor.contexto();
    const resultados: Resultado[] = [];
    try {
      for (const rota of [caminho, "/en" + caminho]) {
        const page = await contexto.newPage();
        try {
          await page.setViewportSize({ width: largura, height: 1000 });
          const falhas = observarFalhas(page);
          const resposta = await page.goto(servidor.origem + rota, { waitUntil: "load" });
          expect(resposta?.status(), rota).toBe(200);
          expect(page.url()).toBe(servidor.origem + rota);
          await aguardarPagina(page, rota);
          const ingles = rota.startsWith("/en/");
          expect(await page.locator("html").getAttribute("lang")).toBe(ingles ? "en" : "pt-BR");
          expect(await page.locator("[data-i18n-aviso]").count()).toBe(ingles ? 1 : 0);
          expect(await page.locator('[data-i18n-estado="portugues_marcado"]').count()).toBe(ingles ? 1 : 0);
          if (ingles) {
            const aviso = page.locator("[data-i18n-aviso]");
            expect(await aviso.isVisible()).toBe(true);
            expect(await aviso.getAttribute("lang")).toBe("en");
            expect(await aviso.textContent()).toBe("Portuguese only");
            const regiao = page.locator('[data-i18n-estado="portugues_marcado"]');
            expect(await regiao.isVisible()).toBe(true);
            expect(await regiao.getAttribute("lang")).toBe("pt-BR");
          }
          await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
          const violacoes = await page.evaluate(async () => {
            const axe = (window as unknown as { axe: { run(context: Document, options: { runOnly: { type: "tag"; values: string[] } }): Promise<{ violations: { id: string; nodes: { html: string }[] }[] }> } }).axe;
            const auditoria = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
            return auditoria.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => ({ html: n.html })) }));
          });
          resultados.push({ html: await page.content(), anunciador: await capturarAnunciador(page), violacoes,
            larguraDocumento: await page.evaluate(() => document.documentElement.scrollWidth) });
          expect(falhas, rota).toEqual([]);
        } finally { await page.close(); }
      }
      verificarFallbackDinamico(parse(resultados[0].html), parse(resultados[1].html), resultados[0].anunciador, resultados[1].anunciador);
      expect(resultados[1].larguraDocumento, "sem regressão da largura horizontal").toBeLessThanOrEqual(Math.max(largura, resultados[0].larguraDocumento));
      const anteriores = assinaturas(resultados[0].violacoes);
      const novas: string[] = [];
      for (const assinatura of assinaturas(resultados[1].violacoes)) {
        const indice = anteriores.indexOf(assinatura);
        if (indice < 0) novas.push(assinatura);
        else anteriores.splice(indice, 1);
      }
      expect(novas, "violações WCAG 2/2.1 A/AA adicionais em inglês; o PT desta execução é a comparação").toEqual([]);
    } finally { await contexto.close(); }
  });

  it("não oferece inglês enquanto o conteúdo inteiro permanece em português", async (ctx) => {
    const servidor = pronto(ctx);
    const contexto = await servidor.contexto();
    try {
      const page = await contexto.newPage();
      const falhas = observarFalhas(page);
      const sufixo = "?origem=a%2Fb&repetido=1&repetido=2#conteudo";
      for (const prefixo of ["", "/en"]) {
        const destino = prefixo + caminho;
        const resposta = await page.goto(servidor.origem + destino + sufixo, { waitUntil: "load" });
        expect(resposta?.status()).toBe(200);
        await aguardarPagina(page, destino);
        expect(await page.getByRole("group", { name: "Idioma", exact: true }).count()).toBe(0);
        expect(await page.locator('a[hreflang="en"]').count()).toBe(0);
        expect(await page.locator('link[rel="alternate"][hreflang]').count()).toBe(0);
        if (prefixo) expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
        expect(page.url()).toBe(servidor.origem + destino + sufixo);
      }
      expect((await contexto.cookies()).some((c) => c.name === "scrutiniums_idioma")).toBe(false);
      expect(falhas).toEqual([]);
    } finally { await contexto.close(); }
  }, 60_000);
});

describe("glossário PT/EN: âncoras do índice", () => {
  it.for(["/glossario", "/en/glossario"])("mantém o segmento de idioma e a query ao percorrer cada verbete em %s", { timeout: 60_000 }, async (caminho, ctx) => {
    const servidor = pronto(ctx);
    const contexto = await servidor.contexto();
    try {
      const page = await contexto.newPage();
      const falhas = observarFalhas(page);
      const query = "?origem=indice%2Fglossario&repetido=1&repetido=2";
      const resposta = await page.goto(servidor.origem + caminho + query, { waitUntil: "load" });
      expect(resposta?.status()).toBe(200);
      await aguardarPagina(page, caminho);
      const indice = page.getByRole("navigation", { name: "Índice do glossário", exact: true }).locator('a[href^="#"]');
      const destinos = await indice.evaluateAll((links) => links.map((a) => a.getAttribute("href")!));
      const secoes = await page.locator("main section[id]").evaluateAll((elementos) => elementos.map((e) => "#" + e.id));
      expect(destinos.length).toBeGreaterThan(0);
      expect(destinos).toEqual(secoes);
      expect(new Set(destinos).size).toBe(destinos.length);
      const identidade = await page.evaluate(() => {
        const prova = window as unknown as { __provaAncoraI18n: string };
        prova.__provaAncoraI18n = crypto.randomUUID();
        return { sentinel: prova.__provaAncoraI18n, navegacoes: performance.getEntriesByType("navigation").length };
      });
      expect(identidade.navegacoes).toBe(1);
      for (const [i, destino] of destinos.entries()) {
        await indice.nth(i).click();
        await page.waitForURL(servidor.origem + caminho + query + destino);
        expect(await page.locator("html").getAttribute("lang")).toBe(caminho.startsWith("/en/") ? "en" : "pt-BR");
        expect(await page.evaluate(() => {
          const prova = window as unknown as { __provaAncoraI18n: string };
          return { sentinel: prova.__provaAncoraI18n, navegacoes: performance.getEntriesByType("navigation").length };
        })).toEqual(identidade);
        await expect.poll(() => page.evaluate((fragmento) => {
          const alvo = document.getElementById(fragmento.slice(1));
          if (!alvo) return false;
          const caixa = alvo.getBoundingClientRect();
          return caixa.top < innerHeight && caixa.bottom > 0;
        }, destino), { message: destino, timeout: 5_000 }).toBe(true);
        expect(await page.locator('a[hreflang="en"]').count()).toBe(0);
      }
      expect(falhas).toEqual([]);
    } finally { await contexto.close(); }
  });
});
