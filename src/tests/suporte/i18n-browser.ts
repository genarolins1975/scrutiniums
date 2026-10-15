import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

const PRAZO = 30_000;
const atraso = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function aguardarHome(page: Page): Promise<void> {
  await page.locator("#hero-titulo").waitFor({ state: "visible", timeout: PRAZO });
  await page.waitForFunction(() => document.querySelectorAll("main").length === 1
    && !document.querySelector('main[aria-busy="true"], template[id^="B:"], [hidden][id^="S:"]'), undefined, { timeout: PRAZO });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
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
  documento(caminho: string): Promise<string>;
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
        const resposta = await fetch(origem + caminho, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
        if (resposta.status !== 200 || resposta.headers.has("location") || resposta.headers.has("set-cookie")
          || !resposta.headers.get("content-type")?.includes("text/html")) {
          throw new Error(`Resposta anônima inválida para ${caminho}: ${resposta.status}`);
        }
        const inicial = await resposta.text();
        const lang = caminho === "/en" ? "en" : "pt-BR";
        if (!new RegExp(`<html[^>]*\\blang="${lang}"`).test(inicial)) throw new Error(`Idioma incorreto no HTML inicial de ${caminho}`);
        const ctx = await contexto();
        try {
          const page = await ctx.newPage();
          const falhas: string[] = [];
          page.on("pageerror", (e) => falhas.push(e.message));
          page.on("console", (m) => { if (/hydration|hydrating|did not match|Minified React error/i.test(m.text())) falhas.push(m.text()); });
          const navegacao = await page.goto(origem + caminho, { waitUntil: "load", timeout: PRAZO });
          if (navegacao?.status() !== 200 || page.url() !== origem + caminho) throw new Error(`Navegação não concluiu em ${caminho}`);
          if (caminho === "/" || caminho === "/en") await aguardarHome(page);
          else throw new Error(`Página dinâmica sem contrato de conclusão DOM: ${caminho}`);
          const html = await page.content();
          if (falhas.length) throw new Error(`Falha de JavaScript em ${caminho}: ${falhas.join("\n")}`);
          return html;
        } finally { await ctx.close(); }
      },
    };
  } catch (e) {
    await fechar();
    throw e;
  }
}
