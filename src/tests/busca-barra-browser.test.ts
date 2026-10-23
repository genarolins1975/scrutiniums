import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { navegacaoDaColecao } from "@/lib/observatorios/navegacaoColecao";

/**
 * Busca da plataforma na barra comum (Iniciativa 3 do parecer de UX de 21/10/2026), no build de produção: o campo está em
 * toda superfície com a barra (home, seis portas, 28 entradas de coleção, mapa da conta e a aplicação do Crédito) e não está
 * nas páginas de entrar e de cadastro; o índice só desce no foco; "/" leva ao campo, as setas e o Enter abrem o resultado,
 * Esc devolve o foco; sem sessão, os destinos fechados levam o selo e nenhuma requisição cai no login; no celular, a lupa abre
 * a busca em tela cheia. Sessão de teste local, como ux-orcamentos-cromo.test.ts.
 */
const raiz = process.cwd();
const temBuild = existsSync(join(raiz, ".next/BUILD_ID"));
const exigir = process.env.EXIGIR_BUILD_HTML === "1";

const PORTAS = OBSERVATORIOS.map((o) => `/perguntas/${o.id}`);
const ENTRADAS = OBSERVATORIOS.flatMap((o) => o.colecoes.map((c) => navegacaoDaColecao(c.id).itens[0].href.split(/[?#]/)[0]));
// com sessão, a home leva ao mapa da conta (/app/observatorios); ela é conferida sem sessão, logo abaixo
const COM_BARRA = [...new Set([...PORTAS, ...ENTRADAS, "/app/observatorios"])];
const CAMPO = "[data-barra-plataforma] form[role=search][action='/buscar']";

describe("busca na barra", () => {
  it("o build existe quando o CI exige", () => {
    if (exigir) expect(temBuild, "rodar npm run build antes dos testes").toBe(true);
  });
});

describe.skipIf(!temBuild)("busca na barra no navegador (build de produção)", () => {
  let temporario = "";
  let filho: ChildProcess | undefined;
  let navegador: Browser | undefined;
  let origem = "";
  let cookie = "";

  beforeAll(async () => {
    temporario = await mkdtemp(join(tmpdir(), "scrutiniums-busca-"));
    const segredo = randomBytes(32).toString("hex");
    const token = randomBytes(32).toString("hex");
    const expira = new Date(Date.now() + 3_600_000);
    const exp = Math.floor(expira.getTime() / 1000);
    cookie = `${exp}.${token}.${createHmac("sha256", segredo).update(`${exp}.${token}`).digest("hex")}`;
    process.env.DATABASE_URL = `pglite://${join(temporario, "db")}`;
    const { getDb, schema } = await import("@/lib/db");
    const db = await getDb();
    const agora = new Date();
    await db.insert(schema.users).values({ id: "busca-qa", email: "busca-qa@example.invalid", emailVerifiedAt: agora, phoneVerifiedAt: agora, onboardingStatus: "COMPLETE", createdAt: agora, updatedAt: agora });
    await db.insert(schema.sessions).values({ id: "busca-qa-sessao", userId: "busca-qa", tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: expira, createdAt: agora });
    await (db as unknown as { $client: { close: () => Promise<void> } }).$client.close();
    const ambiente: NodeJS.ProcessEnv = { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: process.env.DATABASE_URL, COOKIE_SECRET: segredo };
    for (const k of ["PATH", "LANG", "LC_ALL", "TZ", "TMPDIR", "TEMP", "TMP", "NODE_EXTRA_CA_CERTS"]) if (process.env[k] !== undefined) ambiente[k] = process.env[k];
    filho = spawn(process.execPath, [join(raiz, "node_modules/next/dist/bin/next"), "start", "--hostname", "localhost", "--port", "0"], { cwd: raiz, env: ambiente, stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    const juntar = (c: Buffer) => { logs = (logs + c.toString()).slice(-64_000); };
    filho.stdout!.on("data", juntar);
    filho.stderr!.on("data", juntar);
    for (let i = 0; i < 150 && !origem; i++) {
      if (filho.exitCode !== null) throw new Error(`Next encerrou: ${logs}`);
      const achado = logs.match(/http:\/\/localhost:\d+/);
      if (achado) {
        try {
          if ((await fetch(`${achado[0]}/api/auth/eu`)).status === 401) origem = achado[0];
        } catch { /* ainda subindo */ }
      }
      if (!origem) await new Promise((r) => setTimeout(r, 300));
    }
    if (!origem) throw new Error(`Next não ficou pronto: ${logs}`);
    navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE || undefined });
  }, 120_000);

  afterAll(async () => {
    await navegador?.close();
    if (filho && filho.exitCode === null) filho.kill("SIGTERM");
    if (temporario) await rm(temporario, { recursive: true, force: true });
  });

  async function contexto(largura: number, comSessao: boolean): Promise<BrowserContext> {
    const ctx = await navegador!.newContext({ viewport: { width: largura, height: largura >= 1024 ? 900 : 844 } });
    if (comSessao) await ctx.addCookies([{ name: "scrutiniums_session", value: cookie, url: origem, httpOnly: true, sameSite: "Lax", secure: false }]);
    return ctx;
  }

  /**
   * Abre a rota e devolve a página, os endereços pedidos e os que responderam com o login (redirecionamento para /entrar):
   * pré-carregar o link "Entrar", que é aberto, não é cair no login.
   */
  async function abrir(ctx: BrowserContext, rota: string): Promise<{ page: Page; pedidos: string[]; noLogin: string[] }> {
    const page = await ctx.newPage();
    const pedidos: string[] = [];
    const noLogin: string[] = [];
    page.on("request", (r) => pedidos.push(new URL(r.url()).pathname));
    page.on("response", (r) => {
      if ((r.headers()["location"] ?? "").includes("/entrar")) noLogin.push(new URL(r.url()).pathname);
    });
    const resp = await page.goto(origem + rota, { waitUntil: "load", timeout: 60_000 });
    expect(resp?.status(), rota).toBe(200);
    return { page, pedidos, noLogin };
  }

  it("com sessão, o campo está na barra das seis portas, das 28 entradas e do mapa da conta, e na aplicação do Crédito", async () => {
    expect(ENTRADAS).toHaveLength(28);
    const ctx = await contexto(1440, true);
    const sem: string[] = [];
    try {
      for (const rota of [...COM_BARRA, "/observatorio/map"]) {
        const { page } = await abrir(ctx, rota);
        expect(new URL(page.url()).pathname, `${rota} não pode cair no login`).toBe(rota);
        const campo = page.locator(`${CAMPO} input[name=q]`);
        if ((await campo.count()) !== 1 || !(await campo.isVisible())) sem.push(rota);
        await page.close();
      }
    } finally {
      await ctx.close();
    }
    expect(sem).toEqual([]);
  }, 600_000);

  it("sem sessão, entrar e cadastro não têm a busca; a home, uma porta e /buscar têm, visível", async () => {
    const ctx = await contexto(1440, false);
    try {
      for (const rota of ["/entrar", "/cadastro"]) {
        const { page } = await abrir(ctx, rota);
        expect(await page.locator("form[role=search]").count(), rota).toBe(0);
        await page.close();
      }
      for (const rota of ["/", "/perguntas/familias", "/buscar"]) {
        const { page } = await abrir(ctx, rota);
        expect(await page.locator(CAMPO).count(), rota).toBe(1);
        expect(await page.locator(`${CAMPO} input[name=q]`).isVisible(), rota).toBe(true);
        await page.close();
      }
    } finally {
      await ctx.close();
    }
  }, 120_000);

  it("teclado, sem sessão: o índice desce no foco, '/' leva ao campo, o selo marca o fechado, Esc devolve o foco e Enter abre o primeiro", async () => {
    const ctx = await contexto(1440, false);
    try {
      const { page, pedidos, noLogin } = await abrir(ctx, "/");
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      expect(pedidos, "o índice não desce antes do foco").not.toContain("/busca/indice.json");
      const campo = page.locator(`${CAMPO} input[name=q]`);
      await page.locator("h1").first().click();
      await page.keyboard.press("/");
      await expect.poll(() => campo.evaluate((el) => el === document.activeElement)).toBe(true);
      await page.keyboard.type("Ideb");
      const lista = page.locator("[data-barra-plataforma] [role=listbox] [role=option]");
      await expect.poll(() => lista.count(), { timeout: 15_000 }).toBeGreaterThan(1);
      expect(pedidos).toContain("/busca/indice.json");
      // o painel das capitais é fechado e leva o selo; o aperitivo da escola é aberto e não leva
      // (a pergunta e a consulta das capitais levam ao mesmo painel: cada uma com o seu selo)
      const fechado = page.locator("[data-barra-plataforma] [role=option]", { has: page.locator("a[href='/eficiencia-estatal/educacao-municipal-capitais']") });
      expect(await fechado.count()).toBeGreaterThan(0);
      await expect.poll(() => fechado.locator("[data-selo-conta]").count()).toBe(await fechado.count());
      const aberto = page.locator("[data-barra-plataforma] [role=option]", { has: page.locator("a[href='/educacao-municipal']") });
      expect(await aberto.locator("[data-selo-conta]").count()).toBe(0);
      // setas: a opção ativa é a apontada pelo campo
      await page.keyboard.press("ArrowDown");
      const ativa = await campo.getAttribute("aria-activedescendant");
      expect(ativa).toBeTruthy();
      expect(await page.locator(`[id="${ativa}"]`).getAttribute("aria-selected")).toBe("true");
      // Esc fecha a lista e devolve o foco a quem o tinha antes do atalho
      await page.keyboard.press("Escape");
      expect(await campo.getAttribute("aria-expanded")).toBe("false");
      expect(await campo.evaluate((el) => el === document.activeElement)).toBe(false);
      // Enter abre o primeiro resultado com página, pelo próprio link (GLP: a consulta aberta do gás de cozinha)
      await campo.click();
      await page.keyboard.press("Control+a");
      await page.keyboard.type("GLP");
      await expect.poll(() => lista.count()).toBeGreaterThan(0);
      await Promise.all([page.waitForURL((u) => u.pathname === "/gas-natural/gas-de-cozinha", { timeout: 30_000 }), page.keyboard.press("Enter")]);
      expect(noLogin).toEqual([]);
      await page.close();
    } finally {
      await ctx.close();
    }
  }, 120_000);

  it("ciclo 2 da busca (23/10/2026): o primeiro resultado vem marcado antes da seta, a correção e o parcial se explicam", async () => {
    const ctx = await contexto(1440, false);
    try {
      const { page, noLogin } = await abrir(ctx, "/");
      const campo = page.locator(`${CAMPO} input[name=q]`);
      const estado = page.locator("[data-barra-plataforma] #bp-busca-estado");
      const opcoes = page.locator("[data-barra-plataforma] [role=option]");
      await campo.click();
      await page.keyboard.type("saneamneto");
      await expect.poll(() => opcoes.count(), { timeout: 15_000 }).toBeGreaterThan(0);
      await expect.poll(() => estado.textContent()).toContain("Mostrando resultados para “saneamento”");
      // a opção que o Enter abre tem a marca antes de qualquer seta, sem virar a opção ativa do leitor de tela
      expect(await opcoes.first().getAttribute("data-ativa")).toBe("");
      expect(await campo.getAttribute("aria-activedescendant")).toBeNull();
      // "mesmo assim": o termo como foi escrito, sem resultado, e o foco continua no campo
      await page.locator("[data-barra-plataforma] button.bp-busca-acao", { hasText: "mesmo assim" }).click();
      await expect.poll(() => opcoes.count()).toBe(0);
      expect(await campo.evaluate((el) => el === document.activeElement)).toBe(true);
      // parcial: nenhuma página tem as duas palavras; o rótulo diz por quais chegou ao mais próximo
      await page.keyboard.press("Control+a");
      await page.keyboard.type("juros do cartão");
      await expect.poll(() => estado.textContent(), { timeout: 15_000 }).toContain("O mais próximo, por “juros” e “cartão”");
      expect(await opcoes.count()).toBeGreaterThan(1);
      expect(noLogin).toEqual([]);
      await page.close();
    } finally {
      await ctx.close();
    }
  }, 120_000);

  it("sem sessão, digitar não dispara requisição a página fechada (nenhum pré-carregamento cai no login)", async () => {
    const ctx = await contexto(1440, false);
    try {
      const { page, noLogin } = await abrir(ctx, "/buscar?q=ideb");
      const campo = page.locator(`${CAMPO} input[name=q]`);
      await campo.click();
      await page.keyboard.type("conta de luz");
      await expect.poll(() => page.locator("[data-barra-plataforma] [role=option]").count(), { timeout: 15_000 }).toBeGreaterThan(0);
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      expect(noLogin).toEqual([]);
      expect(new URL(page.url()).pathname).toBe("/buscar");
      // a página de resultados é servida pelo servidor, com o selo nos fechados
      expect(await page.locator("main [data-selo-conta]").count()).toBeGreaterThan(0);
      await page.close();
    } finally {
      await ctx.close();
    }
  }, 120_000);

  it("390 px: a lupa de 44 px abre a busca em tela cheia, que fecha com Esc devolvendo o foco à lupa", async () => {
    const ctx = await contexto(390, false);
    try {
      const { page } = await abrir(ctx, "/");
      const lupa = page.locator("[data-barra-plataforma] button.bp-busca-lupa");
      const caixa = await lupa.boundingBox();
      expect(caixa && caixa.width >= 44 && caixa.height >= 44).toBe(true);
      expect(await page.locator(`${CAMPO} input[name=q]`).isVisible()).toBe(false);
      await lupa.click();
      const folha = page.locator("[data-barra-plataforma] [role=dialog]");
      await expect.poll(() => folha.isVisible()).toBe(true);
      const area = await folha.boundingBox();
      expect(area && Math.round(area.width) === 390 && area.height >= 800).toBe(true);
      expect(await page.locator(`${CAMPO} input[name=q]`).evaluate((el) => el === document.activeElement)).toBe(true);
      await page.keyboard.press("Escape");
      await expect.poll(() => folha.count()).toBe(0);
      expect(await lupa.evaluate((el) => el === document.activeElement)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.close();
    } finally {
      await ctx.close();
    }
  }, 120_000);
});
