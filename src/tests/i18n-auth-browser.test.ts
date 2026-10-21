import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { parse } from "parse5";
import type { BrowserContext, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it, type TestContext } from "vitest";
import { CAMINHOS_AUTH, verificarPaginaAuth, type CaminhoAuth, type EstadoAuth } from "./suporte/i18n-auth";
import { modoDaPagina } from "./suporte/i18n-build";
import { aguardarPagina, capturarAnunciador, criarNavegadorI18n, type NavegadorI18n } from "./suporte/i18n-browser";
import { validarAnunciador, verificarFallbackDinamico } from "./suporte/i18n-dinamico";
import { verificarEntradaTraduzida } from "./suporte/i18n-entrada";

const require = createRequire(import.meta.url);
const APP = join(process.cwd(), ".next", "server", "app");
const EXIGIR = process.env.EXIGIR_BUILD_HTML === "1";
let ambiente: NavegadorI18n | undefined;

function pronto(ctx: TestContext): NavegadorI18n {
  if (!existsSync(APP) && !EXIGIR) ctx.skip("sem build local; rode npm run build para verificar Entrar/Cadastro PT/EN");
  if (!ambiente) throw new Error("Prova obrigatória de autenticação requer build e Chromium disponíveis");
  return ambiente;
}

beforeAll(async () => {
  if (!existsSync(APP) && !EXIGIR) return;
  expect(existsSync(APP), "EXIGIR_BUILD_HTML=1 requer build de produção").toBe(true);
  for (const caminho of CAMINHOS_AUTH) {
    for (const rota of [caminho, "/en" + caminho]) expect(modoDaPagina(rota), rota).toBe("dinamico");
  }
  ambiente = await criarNavegadorI18n();
}, 90_000);
afterAll(async () => { await ambiente?.fechar(); });

/** Falha antes de qualquer chamada de autenticação/envio alcançar o Next. */
async function impedirEnvios(contexto: BrowserContext): Promise<string[]> {
  const tentativas: string[] = [];
  await contexto.route("**/*", async (route) => {
    const request = route.request();
    if (!["GET", "HEAD"].includes(request.method())) {
      tentativas.push(`${request.method()} ${new URL(request.url()).pathname}`);
      await route.abort("blockedbyclient");
    } else await route.continue();
  });
  return tentativas;
}

function observarFalhas(page: Page): string[] {
  const falhas: string[] = [];
  page.on("pageerror", (e) => falhas.push(e.message));
  page.on("console", (m) => { if (/hydration|hydrating|did not match|Minified React error/i.test(m.text())) falhas.push(m.text()); });
  return falhas;
}

/** /entrar tem tradução publicada; o cadastro inglês continua na ilha portuguesa. */
const traduzida = (rota: string) => rota === "/en/entrar";
const ERROS = {
  pt: { email: "Informe um e-mail válido.", senha: "Informe sua senha." },
  en: { email: "Enter a valid email address.", senha: "Enter your password." },
} as const;

async function relacoesNoNavegador(page: Page, idiomaErros: "pt-BR" | "en" = "pt-BR"): Promise<void> {
  const controles = await page.locator("form input").evaluateAll((inputs) => inputs.map((elemento) => {
    const input = elemento as HTMLInputElement;
    return { name: input.name, tipo: input.type, valor: input.value, marcado: input.checked,
      labels: Array.from(input.labels ?? [], (label) => ({ controleCorreto: label.control === input, for: label.htmlFor, texto: label.textContent })),
      descricoes: (input.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean).map((id) => {
        const alvos = Array.from(document.querySelectorAll("[id]")).filter((e) => e.id === id);
        return { quantidade: alvos.length, texto: alvos[0]?.textContent, dentroDoForm: !!alvos[0] && input.form?.contains(alvos[0]),
          idioma: alvos[0]?.closest("[lang]")?.getAttribute("lang") };
      }) };
  }));
  expect(controles.length).toBeGreaterThan(0);
  for (const controle of controles) {
    expect(controle.labels).toHaveLength(1);
    expect(controle.labels[0].controleCorreto).toBe(true);
    if (controle.tipo === "checkbox") expect(controle.marcado).toBe(false);
    else expect(controle.valor).toBe("");
    for (const descricao of controle.descricoes) {
      expect(descricao.quantidade).toBe(1);
      expect(descricao.dentroDoForm).toBe(true);
      expect(descricao.idioma).toBe(idiomaErros);
    }
  }
}

async function auditoria(page: Page): Promise<{ violacoes: string[]; inconclusivas: string[] }> {
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  return page.evaluate(async () => {
    type Regra = { id: string; nodes: { html: string; impact: string | null; any: { id: string; data: unknown }[]; all: { id: string; data: unknown }[]; none: { id: string; data: unknown }[] }[] };
    const axe = (window as unknown as { axe: { run(context: Document, options: { runOnly: { type: "tag"; values: string[] } }): Promise<{ violations: Regra[]; incomplete: Regra[] }> } }).axe;
    const resultado = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    const assinar = (regras: Regra[]) => regras.flatMap((r) => r.nodes.map((n) => JSON.stringify({ id: r.id, html: n.html, impact: n.impact,
      checks: [...n.any, ...n.all, ...n.none].map((c) => ({ id: c.id, data: c.data })) })));
    return { violacoes: assinar(resultado.violations), inconclusivas: assinar(resultado.incomplete) };
  });
}

function semNovas(antes: string[], depois: string[], descricao: string): void {
  const restantes = [...antes], novas: string[] = [];
  for (const assinatura of depois) {
    const indice = restantes.indexOf(assinatura);
    if (indice < 0) novas.push(assinatura);
    else restantes.splice(indice, 1);
  }
  expect(novas, descricao).toEqual([]);
}

async function capturar(page: Page, caminho: CaminhoAuth, estado: EstadoAuth, rota: string) {
  const html = await page.content();
  verificarPaginaAuth(parse(html), caminho, estado);
  await relacoesNoNavegador(page, traduzida(rota) ? "en" : "pt-BR");
  return { html, anunciador: await capturarAnunciador(page), axe: await auditoria(page),
    largura: await page.evaluate(() => document.documentElement.scrollWidth),
    foco: await page.evaluate(() => ({ tag: document.activeElement?.tagName, tipo: document.activeElement?.getAttribute("type"), texto: document.activeElement?.textContent })) };
}

describe.each(CAMINHOS_AUTH)("%s: formulário PT/EN no build", (caminho) => {
  it.for([320, 1440])("conserva o formulário e seus erros vazios, sem POST ou regressão WCAG a %i px", { timeout: 60_000 }, async (largura, ctx) => {
    const servidor = pronto(ctx), contexto = await servidor.contexto(), tentativas = await impedirEnvios(contexto);
    const resultados: { inicial: Awaited<ReturnType<typeof capturar>>; vazio: Awaited<ReturnType<typeof capturar>> }[] = [];
    try {
      for (const rota of [caminho, "/en" + caminho]) {
        const page = await contexto.newPage();
        try {
          await page.setViewportSize({ width: largura, height: 1000 });
          const falhas = observarFalhas(page);
          const resposta = await page.goto(servidor.origem + rota, { waitUntil: "load" });
          expect(resposta?.status()).toBe(200);
          expect(page.url()).toBe(servidor.origem + rota);
          expect((await resposta!.allHeaders())["set-cookie"]).toBeUndefined();
          await aguardarPagina(page, rota);
          if (rota.startsWith("/en/") && !traduzida(rota)) {
            expect(await page.locator("[data-i18n-aviso]").isVisible()).toBe(true);
            expect(await page.locator('[data-i18n-estado="portugues_marcado"]').isVisible()).toBe(true);
          } else expect(await page.locator("[data-i18n-aviso], [data-i18n-estado]").count()).toBe(0);
          const erros = ERROS[traduzida(rota) ? "en" : "pt"];
          const inicial = await capturar(page, caminho, "inicial", rota);
          await page.locator('form button[type="submit"]').click();
          await page.getByText(erros.email, { exact: true }).waitFor({ state: "visible" });
          const outra = caminho === "/entrar" ? erros.senha : "É preciso aceitar os termos para continuar.";
          await page.getByText(outra, { exact: true }).waitFor({ state: "visible" });
          const vazio = await capturar(page, caminho, "vazio", rota);
          resultados.push({ inicial, vazio });
          expect(page.url()).toBe(servidor.origem + rota);
          expect(tentativas, "submit inválido não pode alcançar APIs de autenticação/onboarding").toEqual([]);
          expect(falhas).toEqual([]);
        } finally { await page.close(); }
      }
      for (const estado of ["inicial", "vazio"] as const) {
        const pt = resultados[0][estado], en = resultados[1][estado];
        if (caminho === "/entrar") {
          validarAnunciador(pt.anunciador);
          validarAnunciador(en.anunciador);
          expect([pt.anunciador.idioma, en.anunciador.idioma]).toEqual(["pt-BR", "en"]);
          verificarEntradaTraduzida(parse(pt.html), parse(en.html));
        } else verificarFallbackDinamico(parse(pt.html), parse(en.html), pt.anunciador, en.anunciador, { caminho, estado });
        expect(pt.largura, "baseline PT sem overflow horizontal").toBe(largura);
        expect(en.largura).toBeLessThanOrEqual(pt.largura);
        semNovas(pt.axe.violacoes, en.axe.violacoes, `${estado}: nenhuma nova violação WCAG`);
        semNovas(pt.axe.inconclusivas, en.axe.inconclusivas, `${estado}: nenhum novo achado inconclusivo`);
      }
      // Os formulários atuais não prometem foco automático no primeiro erro; o texto do controle focado muda com o idioma.
      const semTexto = ({ tag, tipo }: { tag?: string; tipo?: string | null }) => ({ tag, tipo });
      expect(semTexto(resultados[1].vazio.foco)).toEqual(semTexto(resultados[0].vazio.foco));
    } finally { await contexto.close(); }
  });

  it("preserva o destino sem redirecionar pela preferência; só a entrada traduzida oferece a irmã", async (ctx) => {
    const servidor = pronto(ctx), contexto = await servidor.contexto(), tentativas = await impedirEnvios(contexto);
    try {
      await contexto.addCookies([{ name: "scrutiniums_idioma", value: "en", url: servidor.origem, sameSite: "Lax" }]);
      const page = await contexto.newPage(), falhas = observarFalhas(page);
      const sufixo = "?de=%2Fen%2Fsetor-eletrico%2Fpld%3Fref%3D2026-08%23serie&origem=a+b&origem=a%20b#consulta";
      await page.goto(servidor.origem + caminho + sufixo, { waitUntil: "load" });
      await aguardarPagina(page, caminho);
      expect(page.url()).toBe(servidor.origem + caminho + sufixo);
      await contexto.clearCookies();
      for (const prefixo of ["", "/en"]) {
        await page.goto(servidor.origem + prefixo + caminho + sufixo, { waitUntil: "load" });
        await aguardarPagina(page, prefixo + caminho);
        if (caminho === "/entrar") {
          const grupo = page.getByRole("group", { name: prefixo ? "Language" : "Idioma", exact: true });
          expect(await grupo.count()).toBe(1);
          // a irmã leva o mesmo destino pós-login (?de=...) e o mesmo fragmento
          await page.waitForFunction((esperado) => document.querySelector('a[hreflang="en"]')?.getAttribute("href") === esperado, "/en" + caminho + sufixo);
          expect(await grupo.locator('a[hreflang="pt-BR"]').getAttribute("href")).toBe(caminho + sufixo);
        } else {
          expect(await page.getByRole("group", { name: "Idioma", exact: true }).count()).toBe(0);
          expect(await page.locator('a[hreflang="en"]').count()).toBe(0);
        }
        expect(page.url()).toBe(servidor.origem + prefixo + caminho + sufixo);
      }
      expect(await contexto.cookies()).toEqual([]);
      expect(tentativas).toEqual([]);
      expect(falhas).toEqual([]);
    } finally { await contexto.close(); }
  }, 60_000);
});

it("leva da entrada inglesa ao cadastro português e de volta à entrada portuguesa por navegação cliente", async (ctx) => {
  const servidor = pronto(ctx), contexto = await servidor.contexto(), tentativas = await impedirEnvios(contexto);
  try {
    const page = await contexto.newPage(), falhas = observarFalhas(page), documentos: string[] = [];
    page.on("request", (r) => { if (r.resourceType() === "document" && r.frame() === page.mainFrame()) documentos.push(r.url()); });
    await page.goto(servidor.origem + "/en/entrar", { waitUntil: "load" });
    await aguardarPagina(page, "/en/entrar");
    await page.evaluate(() => { (window as unknown as { __authI18n: string }).__authI18n = "cliente"; });
    for (const caminho of ["/cadastro", "/entrar"] as const) {
      await page.locator(`header a[href="${caminho}"]`).click();
      await page.waitForURL(servidor.origem + caminho);
      await aguardarPagina(page, caminho);
      const titulo = caminho === "/entrar" ? "Entrar · Scrutiniums" : "Crie seu acesso · Scrutiniums";
      await page.waitForFunction((esperado) => document.title === esperado
        && document.querySelector("next-route-announcer")?.shadowRoot?.textContent === esperado, titulo);
      verificarPaginaAuth(parse(await page.content()), caminho);
      await relacoesNoNavegador(page);
      expect(await page.evaluate(() => ({ lang: document.documentElement.lang, navegacoes: performance.getEntriesByType("navigation").length,
        sentinel: (window as unknown as { __authI18n: string }).__authI18n }))).toEqual({ lang: "pt-BR", navegacoes: 1, sentinel: "cliente" });
    }
    expect(documentos).toHaveLength(1);
    expect(tentativas).toEqual([]);
    expect(falhas).toEqual([]);
  } finally { await contexto.close(); }
}, 60_000);
