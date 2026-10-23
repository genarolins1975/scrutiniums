import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ComponentProps } from "react";
import react from "@vitejs/plugin-react";
import { chromium, type Browser, type ConsoleMessage, type Page, type Request, type Response } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { portaLivre } from "./porta-livre";
import type { PerfilForm } from "@/components/conta/PerfilForm";

const RAIZ = fileURLToPath(new URL("../../../", import.meta.url));
const CAMINHO = "/__teste__/conta-cpf";
const API = "/api/conta/perfil";
export type PropsPerfil = ComponentProps<typeof PerfilForm>;
type JanelaPerfil = Window & {
  __perfilConta?: { montar(props: PropsPerfil): void; desmontar(): void };
};

// Uma montagem por contexto; validação, estado, eventos e fetch são do formulário real.
const ENTRADA = `
import type { ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { PerfilForm } from "@/components/conta/PerfilForm";
const container = document.getElementById("montagem");
if (!container) throw new Error("Container de PerfilForm ausente");
const root = createRoot(container);
let montado = false;
Object.assign(window, { __perfilConta: {
  montar(props: ComponentProps<typeof PerfilForm>) {
    if (montado) throw new Error("PerfilForm já montado neste contexto");
    montado = true;
    flushSync(() => root.render(<PerfilForm {...props}/>));
  },
  desmontar() {
    root.unmount();
    container.remove();
    Reflect.deleteProperty(window, "__perfilConta");
  },
} });
`;

export type PedidoPerfil = {
  metodo: string;
  url: string;
  contentType: string | undefined;
  corpoBruto: string | null;
  corpo: unknown;
};
export type PaginaPerfil = {
  page: Page;
  url: string;
  pedidos: PedidoPerfil[];
  falhas: string[];
  liberarResposta(): void;
  fechar(): Promise<void>;
};
export type NavegadorPerfil = { pagina(props: PropsPerfil): Promise<PaginaPerfil>; fechar(): Promise<void> };

/** Vite/Chromium isolados, sem Next, banco, sessão ou transporte real de API. */
export async function criarNavegadorPerfil(): Promise<NavegadorPerfil> {
  const temporario = await mkdtemp(join(tmpdir(), "scrutiniums-conta-cpf-"));
  let servidor: ViteDevServer | undefined;
  let navegador: Browser | undefined;
  let fechado = false;
  const fechar = async () => {
    if (fechado) return;
    fechado = true;
    const erros: unknown[] = [];
    try { await navegador?.close(); } catch (e) { erros.push(e); }
    try { await servidor?.close(); } catch (e) { erros.push(e); }
    try { await rm(temporario, { recursive: true, force: true }); } catch (e) { erros.push(e); }
    if (erros.length) throw new AggregateError(erros, "Falha ao encerrar o browser do perfil");
  };
  try {
    const entrada = join(temporario, "entrada.tsx");
    await writeFile(entrada, ENTRADA, "utf8");
    const diretorios = [join(RAIZ, "src"), join(RAIZ, "node_modules"), temporario];
    // Disposição mínima para interação, sem alegar validação visual do design system.
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Fixture de PerfilForm</title>
      <link rel="icon" href="data:,"><style>body{margin:24px;font:16px sans-serif}main{max-width:640px}label,input,select{display:block}input,select,button{min-height:32px;margin:8px 0}form>div{margin:12px 0}</style>
      </head><body><main><div id="montagem"></div></main><script type="module" src="/@fs${entrada}"></script></body></html>`;
    const porta = await portaLivre();
    servidor = await createServer({
      root: RAIZ, configFile: false, envFile: false, envPrefix: [], publicDir: false,
      appType: "custom", cacheDir: join(temporario, "cache"), logLevel: "error",
      resolve: { alias: { "@": join(RAIZ, "src") }, dedupe: ["react", "react-dom"] },
      optimizeDeps: { entries: [entrada], noDiscovery: true, include: ["react", "react-dom/client", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"] },
      server: { host: "127.0.0.1", port: porta, strictPort: true, hmr: false, ws: false, watch: null, fs: { strict: true, allow: diretorios } },
      plugins: [react(), {
        name: "fixture-conta-cpf",
        configureServer(vite) {
          vite.middlewares.use((req, res, next) => {
            if (new URL(req.url ?? "/", "http://fixture.local").pathname !== CAMINHO) return next();
            // transformIndexHtml injetaria /@vite/client e tentaria abrir WebSocket.
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(html);
          });
        },
      }],
    });
    await servidor.listen();
    const endereco = servidor.httpServer?.address();
    if (!endereco || typeof endereco === "string") throw new Error("Porta efêmera do perfil indisponível");
    const origem = `http://127.0.0.1:${endereco.port}`;
    navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE || undefined });
    return {
      fechar,
      async pagina(props) {
        const contexto = await navegador!.newContext({ locale: "en-US", viewport: { width: 1000, height: 900 }, serviceWorkers: "block" });
        const falhas: string[] = [], pedidos: PedidoPerfil[] = [];
        let liberarResposta!: () => void;
        const respostaLiberada = new Promise<void>((resolver) => { liberarResposta = resolver; });
        let page: Page | undefined;
        let encerrada = false;
        const erroPagina = (e: Error) => { falhas.push(`JavaScript: ${e.stack ?? e.message}`); };
        const consoleErro = (m: ConsoleMessage) => { if (m.type() === "error") falhas.push(`Console: ${m.text()}`); };
        const erroPedido = (r: Request) => { falhas.push(`Pedido: ${r.url()} ${r.failure()?.errorText}`); };
        const resposta = (r: Response) => { if (r.status() < 200 || r.status() >= 300) falhas.push(`HTTP ${r.status()}: ${r.url()}`); };
        const fecharPagina = async () => {
          if (encerrada) return;
          encerrada = true;
          liberarResposta();
          const erros: unknown[] = [];
          try { if (page && !page.isClosed()) await page.evaluate(() => (window as JanelaPerfil).__perfilConta?.desmontar()); } catch (e) { erros.push(e); }
          try { await contexto.unrouteAll({ behavior: "wait" }); } catch (e) { erros.push(e); }
          try { await contexto.close(); } catch (e) { erros.push(e); }
          page?.off("pageerror", erroPagina); page?.off("console", consoleErro);
          page?.off("requestfailed", erroPedido); page?.off("response", resposta);
          if (erros.length) throw new AggregateError(erros, "Falha ao fechar a página do perfil");
        };
        try {
          await contexto.route("**/*", async (route) => {
            const pedido = route.request(), url = new URL(pedido.url());
            try {
              if (url.origin === origem && url.pathname === API && url.search === "" && pedido.method() === "POST" && pedido.resourceType() === "fetch") {
                pedidos.push({ metodo: pedido.method(), url: pedido.url(), contentType: pedido.headers()["content-type"],
                  corpoBruto: pedido.postData(), corpo: pedido.postDataJSON() });
                await respostaLiberada;
                await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
                return;
              }
              const caminho = decodeURIComponent(url.pathname);
              const arquivo = caminho.startsWith("/@fs/") ? resolve("/", caminho.slice(5)) : null;
              const modulo = caminho.startsWith("/src/") || caminho.startsWith("/node_modules/")
                || (arquivo !== null && diretorios.some((d) => arquivo.startsWith(d + "/")));
              const permitido = url.origin === origem && pedido.method() === "GET"
                && ((pedido.resourceType() === "document" && url.pathname === CAMINHO)
                  || (pedido.resourceType() === "script" && modulo));
              if (!permitido) falhas.push(`Rede inesperada: ${pedido.method()} ${pedido.url()}`);
              if (permitido) await route.continue(); else await route.abort("blockedbyclient");
            } catch (e) {
              falhas.push(`Interceptação: ${String(e)}`);
              try { await route.abort("failed"); } catch (falha) { falhas.push(`Abortar interceptação: ${String(falha)}`); }
            }
          });
          await contexto.routeWebSocket("**/*", async (ws) => {
            falhas.push(`WebSocket inesperado: ${ws.url()}`);
            try { await ws.close(); } catch (e) { falhas.push(`Fecho de WebSocket: ${String(e)}`); }
          });
          page = await contexto.newPage();
          page.setDefaultTimeout(10_000);
          page.on("pageerror", erroPagina); page.on("console", consoleErro);
          page.on("requestfailed", erroPedido); page.on("response", resposta);
          const url = origem + CAMINHO + "?preservar=sim#perfil";
          const inicial = await page.goto(url, { waitUntil: "load", timeout: 30_000 });
          if (inicial?.status() !== 200 || page.url() !== url) throw new Error("Documento do perfil não carregou");
          await page.waitForFunction(() => typeof (window as JanelaPerfil).__perfilConta?.montar === "function");
          await page.evaluate((iniciais) => {
            const ponte = (window as JanelaPerfil).__perfilConta;
            if (!ponte) throw new Error("Bridge de montagem do perfil indisponível");
            ponte.montar(iniciais);
          }, props);
          await page.getByRole("button", { name: "Salvar perfil", exact: true }).waitFor({ state: "visible" });
          return { page, url, pedidos, falhas, liberarResposta, fechar: fecharPagina };
        } catch (e) {
          const erros: unknown[] = [e];
          try { await fecharPagina(); } catch (limpeza) { erros.push(limpeza); }
          erros.push(...falhas.map((falha) => new Error(falha)));
          throw new AggregateError(erros, `Montagem do perfil falhou${falhas.length ? `:\n${falhas.join("\n")}` : ""}`);
        }
      },
    };
  } catch (e) {
    try { await fechar(); } catch (limpeza) { throw new AggregateError([e, limpeza], "Servidor e limpeza do perfil falharam"); }
    throw e;
  }
}
