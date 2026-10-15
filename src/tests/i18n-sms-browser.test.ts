import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { parse } from "parse5";
import type { BrowserContext, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it, type TestContext } from "vitest";
import { modoDaPagina } from "./suporte/i18n-build";
import { aguardarPagina, capturarAnunciador, criarNavegadorI18n, prepararPaginaSms, type NavegadorI18n } from "./suporte/i18n-browser";
import { verificarFallbackDinamico } from "./suporte/i18n-dinamico";
import { attr, elementos, texto } from "./suporte/i18n-dom";
import { CAMINHOS_SMS, verificarPaginaSms, type CaminhoSms, type ComparacaoSms, type EstadoSms } from "./suporte/i18n-sms";

const require = createRequire(import.meta.url);
const APP = join(process.cwd(), ".next", "server", "app");
const EXIGIR = process.env.EXIGIR_BUILD_HTML === "1";
let ambiente: NavegadorI18n | undefined;

function pronto(ctx: TestContext): NavegadorI18n {
  if (!existsSync(APP) && !EXIGIR) ctx.skip("sem build local; rode npm run build para verificar login SMS PT/EN");
  if (!ambiente) throw new Error("Prova obrigatória do login SMS requer build e Chromium disponíveis");
  return ambiente;
}

beforeAll(async () => {
  if (!existsSync(APP) && !EXIGIR) return;
  expect(existsSync(APP), "EXIGIR_BUILD_HTML=1 requer build de produção").toBe(true);
  for (const caminho of CAMINHOS_SMS) {
    for (const rota of [caminho, "/en" + caminho]) expect(modoDaPagina(rota), rota).toBe("dinamico");
  }
  ambiente = await criarNavegadorI18n();
}, 90_000);
afterAll(async () => { await ambiente?.fechar(); });

function comparacao(caminho: CaminhoSms, estado: EstadoSms): ComparacaoSms {
  return caminho === "/entrar/sms" ? { caminho, estado } : { caminho, estado, contador: "liberado" };
}

/** Nenhuma interação desta prova pode solicitar, reenviar ou verificar um SMS. */
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

async function relacoesNoNavegador(page: Page, caminho: CaminhoSms, estado: EstadoSms): Promise<void> {
  const controles = await page.locator("form select, form input").evaluateAll((nodes) => nodes.map((elemento) => {
    const controle = elemento as HTMLInputElement | HTMLSelectElement;
    return {
      tag: controle.tagName, tipo: controle.getAttribute("type"), valor: controle.value,
      selecionadas: controle instanceof HTMLSelectElement ? Array.from(controle.selectedOptions, (opcao) => opcao.value) : null,
      labels: Array.from(controle.labels ?? [], (label) => ({ controleCorreto: label.control === controle, texto: label.textContent })),
      invalido: controle.getAttribute("aria-invalid"),
      descricoes: (controle.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean).map((id) => {
        const alvos = Array.from(document.querySelectorAll("[id]")).filter((e) => e.id === id);
        return { quantidade: alvos.length, texto: alvos[0]?.textContent, dentroDoForm: !!alvos[0] && controle.form?.contains(alvos[0]),
          idioma: alvos[0]?.closest("[lang]")?.getAttribute("lang") };
      }),
    };
  }));
  expect(controles.map((c) => [c.tag, c.tipo, c.labels.map((label) => label.texto)]), "identidade por tipo e label, sem depender de name").toEqual(
    caminho === "/entrar/sms"
      ? [["SELECT", null, ["País"]], ["INPUT", "tel", ["Telefone celular"]]]
      : [["INPUT", "text", ["Código recebido por SMS"]]],
  );
  for (const controle of controles) {
    expect(controle.labels).toHaveLength(1);
    expect(controle.labels[0].controleCorreto).toBe(true);
    if (controle.tag === "SELECT") {
      expect(controle.valor).toBe("BR");
      expect(controle.selecionadas).toEqual(["BR"]);
      expect(controle.invalido).toBeNull();
      expect(controle.descricoes).toEqual([]);
    } else {
      expect(controle.valor).toBe("");
      expect(controle.invalido).toBe(estado === "vazio" ? "true" : null);
      expect(controle.descricoes).toHaveLength(estado === "vazio" ? 1 : 0);
      for (const descricao of controle.descricoes) {
        expect(descricao.quantidade).toBe(1);
        expect(descricao.dentroDoForm).toBe(true);
        expect(descricao.idioma).toBe("pt-BR");
        expect(descricao.texto).toBe(caminho === "/entrar/sms" ? "Informe um telefone válido com DDD." : "Informe o código de 6 dígitos.");
      }
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

async function capturar(page: Page, caminho: CaminhoSms, estado: EstadoSms) {
  const html = await page.content();
  verificarPaginaSms(parse(html), comparacao(caminho, estado));
  await relacoesNoNavegador(page, caminho, estado);
  return { html, anunciador: await capturarAnunciador(page), axe: await auditoria(page),
    largura: await page.evaluate(() => document.documentElement.scrollWidth),
    foco: await page.evaluate(() => ({ tag: document.activeElement?.tagName, tipo: document.activeElement?.getAttribute("type"), texto: document.activeElement?.textContent })) };
}

function verificarOtpBruto(html: string, idioma: "pt-BR" | "en"): void {
  const nodes = elementos(parse(html));
  expect(attr(nodes.find((e) => e.tagName === "html")!, "lang")).toBe(idioma);
  const reenvios = nodes.filter((e) => e.tagName === "button" && attr(e, "type") === "button");
  expect(reenvios).toHaveLength(1);
  expect(texto(reenvios[0])).toBe("Reenviar código em 30s");
  expect(attr(reenvios[0], "disabled")).toBe("");
  expect(nodes.filter((e) => e.tagName === "span" && texto(e) === "+55 •• •••••-5678")).toHaveLength(1);
}

describe.each(CAMINHOS_SMS)("%s: fallback PT integral no browser", (caminho) => {
  it.for([320, 1440])("preserva formulário, submit vazio, foco e WCAG sem enviar SMS a %i px", { timeout: 60_000 }, async (largura, ctx) => {
    const servidor = pronto(ctx);
    const resultados: { inicial: Awaited<ReturnType<typeof capturar>>; vazio: Awaited<ReturnType<typeof capturar>> }[] = [];
    for (const rota of [caminho, "/en" + caminho]) {
      // O relógio do Playwright pertence ao contexto: cada idioma começa isolado.
      const contexto = await servidor.contexto(caminho === "/entrar/sms/verificar" ? { loginSms: "valido" } : undefined);
      const tentativas = await impedirEnvios(contexto);
      try {
        const page = await contexto.newPage(), falhas = observarFalhas(page);
        await page.setViewportSize({ width: largura, height: 1000 });
        await prepararPaginaSms(page, rota);
        const resposta = await page.goto(servidor.origem + rota, { waitUntil: "load" });
        expect(resposta?.status()).toBe(200);
        expect(page.url()).toBe(servidor.origem + rota);
        const headers = await resposta!.allHeaders();
        expect(headers.location).toBeUndefined();
        expect(headers["set-cookie"] === undefined, "GET não emite cookie").toBe(true);
        await aguardarPagina(page, rota);
        if (rota.startsWith("/en/")) {
          expect(await page.locator("[data-i18n-aviso]").isVisible()).toBe(true);
          expect(await page.locator('[data-i18n-estado="portugues_marcado"]').isVisible()).toBe(true);
        }
        if (caminho === "/entrar/sms/verificar") {
          expect(await page.getByLabel("Código recebido por SMS", { exact: true }).evaluate((e) => e === document.activeElement)).toBe(true);
          expect(await page.getByRole("button", { name: "Reenviar código", exact: true }).isEnabled()).toBe(true);
        }
        const inicial = await capturar(page, caminho, "inicial");
        await page.locator('form button[type="submit"]').click();
        const erro = caminho === "/entrar/sms" ? "Informe um telefone válido com DDD." : "Informe o código de 6 dígitos.";
        await page.getByText(erro, { exact: true }).waitFor({ state: "visible" });
        const vazio = await capturar(page, caminho, "vazio");
        resultados.push({ inicial, vazio });
        expect(page.url()).toBe(servidor.origem + rota);
        expect(tentativas, "montagem e submit incompleto não alcançam APIs").toEqual([]);
        expect(falhas).toEqual([]);
      } finally { await contexto.close(); }
    }
    for (const estado of ["inicial", "vazio"] as const) {
      const pt = resultados[0][estado], en = resultados[1][estado];
      verificarFallbackDinamico(parse(pt.html), parse(en.html), pt.anunciador, en.anunciador, comparacao(caminho, estado));
      expect(pt.largura, "baseline PT sem overflow horizontal").toBe(largura);
      expect(en.largura).toBeLessThanOrEqual(pt.largura);
      semNovas(pt.axe.violacoes, en.axe.violacoes, `${estado}: nenhuma nova violação WCAG`);
      semNovas(pt.axe.inconclusivas, en.axe.inconclusivas, `${estado}: nenhum novo achado inconclusivo`);
      // Só o OTP promete foco automático; no telefone comparamos o foco após submit.
      if (estado === "vazio" || caminho === "/entrar/sms/verificar") expect(en.foco).toEqual(pt.foco);
    }
  });

  it("preserva query, fragmento e cookie de fluxo sem oferecer inglês no fallback", async (ctx) => {
    const servidor = pronto(ctx);
    const contexto = await servidor.contexto(caminho === "/entrar/sms/verificar" ? { loginSms: "valido" } : undefined);
    const tentativas = await impedirEnvios(contexto);
    try {
      const cookieFluxo = (await contexto.cookies()).find((cookie) => cookie.name === "login_phone");
      expect(!!cookieFluxo).toBe(caminho === "/entrar/sms/verificar");
      await contexto.addCookies([{ name: "scrutiniums_idioma", value: "en", url: servidor.origem, sameSite: "Lax" }]);
      const page = await contexto.newPage(), falhas = observarFalhas(page);
      const sufixo = "?de=%2Fen%2Fsetor-eletrico%2Fpld%3Fref%3D2026-08%23serie&origem=a+b&origem=a%20b#consulta";
      await prepararPaginaSms(page, caminho);
      await page.goto(servidor.origem + caminho + sufixo, { waitUntil: "load" });
      await aguardarPagina(page, caminho);
      expect(page.url()).toBe(servidor.origem + caminho + sufixo);
      await contexto.clearCookies({ name: "scrutiniums_idioma" });
      for (const prefixo of ["", "/en"]) {
        await page.goto(servidor.origem + prefixo + caminho + sufixo, { waitUntil: "load" });
        await aguardarPagina(page, prefixo + caminho);
        expect(await page.getByRole("group", { name: "Idioma", exact: true }).count()).toBe(0);
        expect(await page.locator('a[hreflang="en"]').count()).toBe(0);
        expect(page.url()).toBe(servidor.origem + prefixo + caminho + sufixo);
        verificarPaginaSms(parse(await page.content()), comparacao(caminho, "inicial"));
        expect((await contexto.cookies()).find((cookie) => cookie.name === "login_phone")?.value === cookieFluxo?.value).toBe(true);
      }
      expect((await contexto.cookies()).some((cookie) => cookie.name === "scrutiniums_idioma")).toBe(false);
      expect(tentativas).toEqual([]);
      expect(falhas).toEqual([]);
    } finally { await contexto.close(); }
  }, 60_000);
});

it("aceita somente o cookie de fluxo válido, preserva o redirect em streaming e não cria sessão", async (ctx) => {
  const servidor = pronto(ctx);
  for (const rota of ["/entrar/sms/verificar", "/en/entrar/sms/verificar"]) {
    for (const cenario of ["valido", "ausente", "adulterado"] as const) {
      const contexto = await servidor.contexto(cenario === "ausente" ? undefined : { loginSms: cenario });
      const tentativas = await impedirEnvios(contexto);
      try {
        const cookie = (await contexto.cookies()).find((c) => c.name === "login_phone");
        expect(!!cookie, "fixture presente nos cenários assinado e adulterado").toBe(cenario !== "ausente");
        if (cookie) {
          expect(cookie.httpOnly).toBe(true);
          expect(cookie.path).toBe("/");
          expect(cookie.sameSite).toBe("Lax");
        }
        const bruto = await contexto.request.get(servidor.origem + rota, { maxRedirects: 0 });
        expect(bruto.status()).toBe(200);
        expect(bruto.headers().location).toBeUndefined();
        expect(bruto.headers()["set-cookie"] === undefined, "GET não emite nem renova cookie").toBe(true);
        const html = await bruto.text();
        if (cenario === "valido") verificarOtpBruto(html, rota.startsWith("/en/") ? "en" : "pt-BR");
        else {
          const nodes = elementos(parse(html));
          const redirects = nodes.filter((e) => e.tagName === "meta" && attr(e, "http-equiv") === "refresh");
          expect(redirects).toHaveLength(1);
          expect(attr(redirects[0], "content")).toBe("1;url=/entrar/sms");
          expect(nodes.filter((e) => e.tagName === "input" && attr(e, "autocomplete") === "one-time-code")).toHaveLength(0);
        }
        const eu = await contexto.request.get(servidor.origem + "/api/auth/eu", { maxRedirects: 0 });
        expect(eu.status(), "login_phone não é sessão nem conta autenticada").toBe(401);
        expect(eu.headers()["set-cookie"] === undefined).toBe(true);
        const page = await contexto.newPage(), falhas = observarFalhas(page);
        if (cenario === "valido") await prepararPaginaSms(page, rota);
        await page.goto(servidor.origem + rota, { waitUntil: "load" });
        const destino = cenario === "valido" ? rota : "/entrar/sms";
        await page.waitForURL(servidor.origem + destino);
        await aguardarPagina(page, destino);
        verificarPaginaSms(parse(await page.content()), comparacao(cenario === "valido" ? "/entrar/sms/verificar" : "/entrar/sms", "inicial"));
        expect(await page.evaluate(() => document.cookie.includes("login_phone=")), "cookie HttpOnly não é legível pelo JavaScript da página").toBe(false);
        expect(tentativas).toEqual([]);
        expect(falhas).toEqual([]);
      } finally { await contexto.close(); }
    }
  }
}, 60_000);
