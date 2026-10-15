import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { parse } from "parse5";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { GLOSSARIO } from "@/lib/data/glossario";
import { cenarioDinamico, validarAnunciador, verificarPaginaConcluida, type CapturaAnunciador } from "./i18n-dinamico";

const PRAZO = 30_000;
const atraso = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function aguardarHome(page: Page): Promise<void> {
  await page.locator("#hero-titulo").waitFor({ state: "visible", timeout: PRAZO });
  await page.waitForFunction(() => document.querySelectorAll("main").length === 1
    && !document.querySelector('main[aria-busy="true"], template[id^="B:"], [hidden][id^="S:"]'), undefined, { timeout: PRAZO });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

export async function aguardarPagina(page: Page, caminho: string): Promise<void> {
  const cenario = cenarioDinamico(caminho);
  if (cenario.pt === "/") await aguardarHome(page);
  else {
    await page.locator("main h1").waitFor({ state: "visible", timeout: PRAZO });
    const ultimo = cenario.pt === "/glossario" ? GLOSSARIO[GLOSSARIO.length - 1].slug + "-titulo"
      : cenario.pt === "/termos" ? "termos-10" : "priv-resumo";
    await page.locator(`#${ultimo}`).waitFor({ state: "visible", timeout: PRAZO });
    await page.locator('nav[aria-label="Navegação principal"]').waitFor({ state: "visible", timeout: PRAZO });
    await page.locator("footer").waitFor({ state: "visible", timeout: PRAZO });
    if (cenario.idioma === "en") {
      await page.locator("[data-i18n-aviso]").waitFor({ state: "visible", timeout: PRAZO });
      await page.locator('[data-i18n-estado="portugues_marcado"]').waitFor({ state: "visible", timeout: PRAZO });
    }
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
  }
  await page.waitForFunction(() => document.querySelectorAll("main").length === 1
    && document.querySelectorAll("h1").length === 1
    && !document.querySelector('main[aria-busy="true"], template[id^="B:"], [hidden][id^="S:"]')
    && document.querySelectorAll("next-route-announcer").length === 1
    && document.querySelector("next-route-announcer")?.shadowRoot?.querySelector("#__next-route-announcer__"), undefined, { timeout: PRAZO });
  // A espera de streaming não substitui a prova de todas as seções e do fecho.
  if (cenario.pt !== "/") verificarPaginaConcluida(parse(await page.content()), caminho);
}

/** page.content() não serializa shadow roots: capturá-los é uma prova separada. */
export async function capturarAnunciador(page: Page): Promise<CapturaAnunciador> {
  const captura = await page.evaluate(() => {
    const hosts = document.querySelectorAll("next-route-announcer");
    const host = hosts[0];
    const no = (node: Node) => ({
      tipo: node.nodeType, nome: node.nodeName.toLowerCase(), filhos: node.childNodes.length, texto: node.textContent ?? "",
      atributos: node instanceof Element ? Array.from(node.attributes, (a): [string, string] => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)) : [],
    });
    return {
      quantidade: hosts.length, filhoDiretoDoBody: host?.parentNode === document.body,
      dentroDaIlha: !!host?.closest("[data-i18n-estado]"), idioma: host?.closest("[lang]")?.getAttribute("lang") ?? null,
      host: host ? no(host) : null,
      sombra: host?.shadowRoot ? { modo: host.shadowRoot.mode, filhos: Array.from(host.shadowRoot.childNodes, no) } : null,
    };
  });
  validarAnunciador(captura);
  return captura;
}

async function encerrarFilho(filho: ChildProcess): Promise<void> {
  if (!filho.pid || filho.exitCode !== null || filho.signalCode !== null) return;
  const saiu = new Promise<void>((resolve) => filho.once("exit", () => resolve()));
  const aguardar = async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([saiu, new Promise<void>((resolve) => { timer = setTimeout(resolve, 5_000); })]); }
    finally { clearTimeout(timer); }
  };
  filho.kill("SIGTERM");
  await aguardar();
  if (filho.exitCode === null && filho.signalCode === null) {
    filho.kill("SIGKILL");
    await aguardar();
    if (filho.exitCode === null && filho.signalCode === null) throw new Error("Next não encerrou após SIGKILL");
  }
}

export type NavegadorI18n = {
  origem: string;
  navegador: Browser;
  contexto(): Promise<BrowserContext>;
  documento(caminho: string): Promise<{ html: string; anunciador: CapturaAnunciador }>;
  fechar(): Promise<void>;
};

/** Browser e Next pertencem ao teste; nenhum cookie, banco ou serviço de produção. */
export async function criarNavegadorI18n(): Promise<NavegadorI18n> {
  const temporario = await mkdtemp(join(tmpdir(), "scrutiniums-i18n-browser-"));
  let navegador: Browser | undefined;
  let filho: ChildProcess | undefined;
  let fechado = false;
  const fechar = async () => {
    if (fechado) return;
    fechado = true;
    try { await navegador?.close(); }
    finally {
      try { if (filho) await encerrarFilho(filho); }
      finally { await rm(temporario, { recursive: true, force: true }); }
    }
  };
  try {
    let logs = "";
    let erro: Error | undefined;
    const ambiente: NodeJS.ProcessEnv = { NODE_ENV: "production" };
    for (const nome of ["PATH", "LANG", "LC_ALL", "TZ", "TMPDIR", "TEMP", "TMP", "NODE_EXTRA_CA_CERTS"]) {
      if (process.env[nome] !== undefined) ambiente[nome] = process.env[nome];
    }
    filho = spawn(process.execPath, [join(process.cwd(), "node_modules/next/dist/bin/next"),
      "start", "--hostname", "127.0.0.1", "--port", "0", "--keepAliveTimeout", "1000"], {
      cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"],
      env: { ...ambiente, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", PGSSL: "",
        DATABASE_URL: `pglite://${join(temporario, "db")}`, COOKIE_SECRET: randomBytes(32).toString("hex"),
        TWILIO_ACCOUNT_SID: "", TWILIO_AUTH_TOKEN: "", TWILIO_VERIFY_SERVICE_SID: "",
        RESEND_API_KEY: "", MAIL_FROM: "", ADMIN_EMAILS: "" },
    });
    filho.once("error", (e) => { erro = e; });
    const registrar = (chunk: Buffer) => { logs = (logs + chunk.toString("utf8")).slice(-65_536); };
    filho.stdout!.on("data", registrar);
    filho.stderr!.on("data", registrar);
    const limite = Date.now() + 45_000;
    let origem = "";
    while (Date.now() < limite) {
      if (erro) throw erro;
      if (filho.exitCode !== null || filho.signalCode !== null) throw new Error(`Next encerrou antes da prontidão: ${logs}`);
      const encontrado = stripVTControlCharacters(logs).match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (encontrado && Number(encontrado[1]) > 0 && Number(encontrado[1]) <= 65_535) {
        origem = encontrado[0];
        try {
          const resposta = await fetch(`${origem}/api/auth/eu`, { redirect: "manual", signal: AbortSignal.timeout(1_000) });
          if (resposta.status === 401 && !resposta.headers.has("set-cookie")) break;
          throw new Error(`Prontidão anônima inválida: /api/auth/eu respondeu ${resposta.status}`);
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("Prontidão")) throw e;
        }
      }
      await atraso(50);
    }
    if (!origem || Date.now() >= limite) throw new Error(`Next não ficou pronto em 45 s: ${logs}`);
    // O override local é explícito. Sem ele, falta do Chromium instalado é erro.
    navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE || undefined });
    const contexto = () => navegador!.newContext({ viewport: { width: 1440, height: 1000 }, locale: "en-US" });
    return {
      origem, navegador, contexto, fechar,
      async documento(caminho) {
        const cenario = cenarioDinamico(caminho);
        const resposta = await fetch(origem + caminho, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
        if (resposta.status !== 200 || resposta.headers.has("location") || resposta.headers.has("set-cookie")
          || !resposta.headers.get("content-type")?.includes("text/html")) {
          throw new Error(`Resposta anônima inválida para ${caminho}: ${resposta.status}`);
        }
        const inicial = await resposta.text();
        const lang = cenario.idioma;
        if (!new RegExp(`<html[^>]*\\blang="${lang}"`).test(inicial)) throw new Error(`Idioma incorreto no HTML inicial de ${caminho}`);
        const ctx = await contexto();
        try {
          const page = await ctx.newPage();
          const falhas: string[] = [];
          page.on("pageerror", (e) => falhas.push(e.message));
          page.on("console", (m) => { if (/hydration|hydrating|did not match|Minified React error/i.test(m.text())) falhas.push(m.text()); });
          const navegacao = await page.goto(origem + caminho, { waitUntil: "load", timeout: PRAZO });
          if (navegacao?.status() !== 200 || page.url() !== origem + caminho) throw new Error(`Navegação não concluiu em ${caminho}`);
          await aguardarPagina(page, caminho);
          const html = await page.content();
          const anunciador = await capturarAnunciador(page);
          if (falhas.length) throw new Error(`Falha de JavaScript em ${caminho}: ${falhas.join("\n")}`);
          return { html, anunciador };
        } finally { await ctx.close(); }
      },
    };
  } catch (e) {
    await fechar();
    throw e;
  }
}
