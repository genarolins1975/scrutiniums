import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { chromium, type Browser } from "playwright";
import { subirServidor, temBuild, exigirBuild, type ServidorProducao } from "./suporte/servidor-producao";
let servidor: ServidorProducao;
let navegador: Browser;
const pendente = "12".repeat(32), revogado = "34".repeat(32), vencido = "56".repeat(32), cacheToken = "78".repeat(32);
beforeAll(async () => {
  if (!temBuild && !exigirBuild) return;
  expect(temBuild).toBe(true);
  servidor = await subirServidor("home-estatica", async (db, schema, id) => {
    const agora = new Date();
    await db.insert(schema.users).values({ id: id + "-pendente", email: "pendente@example.invalid", onboardingStatus: "EMAIL_PENDING", createdAt: agora, updatedAt: agora });
    for (const [nome, token] of [["pendente", pendente], ["revogado", revogado], ["vencido", vencido], ["cache", cacheToken]]) {
      await db.insert(schema.sessions).values({ id: id + nome, userId: nome === "pendente" ? id + "-pendente" : id,
        tokenHash: createHash("sha256").update(token).digest("hex"), createdAt: agora,
        expiresAt: new Date(Date.now() + (nome === "vencido" ? -60000 : 3600000)), revokedAt: nome === "revogado" ? agora : null });
    }
  });
  navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE });
}, 90000);
afterAll(async () => { await navegador?.close(); await servidor?.parar(); });
const obter = (rota: string, cookie?: string) => fetch(servidor.origem + rota, { redirect: "manual", headers: cookie ? { cookie: `scrutiniums_session=${cookie}` } : {} });
describe.skipIf(!temBuild && !exigirBuild)("home pública estática com sessão isolada", () => {
  it.each(["/", "/en"])("%s tem cache estático e preserva redirecionamento, pendência, revogação e expiração", async rota => {
    const publico = await obter(rota);
    const html = await publico.text();
    expect(publico.status).toBe(200);
    expect(publico.headers.get("x-nextjs-cache")).toBe("HIT");
    expect(publico.headers.get("cache-control")).toContain("s-maxage");
    expect(publico.headers.get("set-cookie")).toBeNull();
    expect(html).toContain('id="perguntas-titulo"');
    const logado = await obter(rota, servidor.cookie);
    expect(logado.status).toBe(307);
    expect(new URL(logado.headers.get("location")!, servidor.origem).pathname).toBe("/app/observatorios");
    expect(logado.headers.get("cache-control")).toContain("no-store");
    for (const token of [pendente, revogado, vencido]) {
      const resposta = await obter(rota, servidor.assinar(token));
      expect(resposta.status).toBe(200);
      expect(resposta.headers.get("x-nextjs-cache")).toBe("HIT");
      const corpo = await resposta.text();
      expect(corpo).toContain('id="perguntas-titulo"');
      expect(corpo).toContain(rota === "/en" ? '<html lang="en"' : '<html lang="pt-BR"');
    }
    // Uma resposta personalizada anterior nunca contamina o artefato público.
    expect(await (await obter(rota)).text()).toBe(html);
  }, 60000);
  it("a primeira visita compartilha uma consulta de sessão entre cabeçalho e selos", async () => {
    const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const page = await contexto.newPage();
      const consultas: string[] = [], erros: string[] = [];
      page.on("request", r => { if (new URL(r.url()).pathname === "/api/auth/estado") consultas.push(r.url()); });
      page.on("pageerror", e => erros.push(e.message));
      const estado = page.waitForResponse(r => new URL(r.url()).pathname === "/api/auth/estado");
      await page.goto(servidor.origem);
      await estado;
      await page.waitForTimeout(500);
      expect(consultas).toHaveLength(1);
      expect(erros).toEqual([]);
      expect(await page.locator("#perguntas-titulo").isVisible()).toBe(true);
      consultas.length = 0;
      await contexto.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem }]);
      await page.goto(servidor.origem + "/app/observatorios");
      await page.waitForTimeout(500);
      expect(consultas).toHaveLength(0);
      expect(await page.locator("#mapa-titulo").isVisible()).toBe(true);
    } finally { await contexto.close(); }
  }, 60000);
  it("volta pelo cache de navegação após entrar e revalida a sessão ao retornar à aba", async () => {
    const contexto = await navegador.newContext();
    try {
      const page = await contexto.newPage();
      const estadoInicial = page.waitForResponse(r => new URL(r.url()).pathname === "/api/auth/estado");
      await page.goto(servidor.origem);
      await estadoInicial;
      const estadoPergunta = page.waitForResponse(r => new URL(r.url()).pathname === "/api/auth/estado");
      await page.locator('#perguntas a[href="/perguntas/familias"]').click();
      await page.waitForURL("**/perguntas/familias");
      await page.locator("#porta-titulo").waitFor();
      await estadoPergunta;
      await contexto.addCookies([{ name: "scrutiniums_session", value: servidor.assinar(cacheToken), url: servidor.origem }]);
      await page.goBack();
      await page.waitForURL("**/app/observatorios");
      await page.goto(servidor.origem + "/perguntas/familias");
      await page.locator('header a[href="/app/conta"]').first().waitFor({ state: "visible" });
      await contexto.request.post(servidor.origem + "/api/auth/sair");
      // Representa retorno à aba após sair em outra janela.
      await page.waitForTimeout(1100);
      const estado = page.waitForResponse(r => new URL(r.url()).pathname === "/api/auth/estado");
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      expect(await (await estado).json()).toEqual({ logado: false, completo: false });
      await page.locator('header a[href="/entrar"]').first().waitFor({ state: "visible" });
    } finally { await contexto.close(); }
  }, 60000);
  it("logout revoga o token e a home volta ao estado público sem JavaScript", async () => {
    const contexto = await navegador.newContext({ javaScriptEnabled: false });
    try {
      await contexto.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem }]);
      const page = await contexto.newPage();
      await page.goto(servidor.origem);
      expect(new URL(page.url()).pathname).toBe("/app/observatorios");
      await page.locator('form[action="/api/auth/sair"] button:visible').first().click();
      await page.waitForURL(servidor.origem + "/");
      expect(await page.locator("#perguntas-titulo").isVisible()).toBe(true);
      const antigo = await obter("/", servidor.cookie);
      expect(antigo.status).toBe(200);
      expect(await antigo.text()).toContain('id="perguntas-titulo"');
    } finally { await contexto.close(); }
  }, 60000);
});
