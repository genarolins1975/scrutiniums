import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { chromium, type Browser, type ConsoleMessage, type Page, type Request, type Response } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import type { Idioma } from "@/lib/idioma";

const RAIZ = fileURLToPath(new URL("../../../", import.meta.url));
const CAMINHO = "/__teste__/conta-grade";

export const INSTRUCAO_GRADE = "Passe o mouse, toque ou use as setas sobre um mês para ver a bandeira e o adicional dele.";
export type JanelaGrade = Window & {
  __contaGrade?: { renderizar(idioma?: Idioma): void; desmontar(): void };
};

// Apenas montagem e fixture: parser, eventos e efeito vêm do componente real.
const ENTRADA = `
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { ContaGradeDica } from "@/components/energia/ContaGradeDica";

const grade = <table>
  <caption>Fixture de bandeiras</caption>
  <thead><tr><th id="ano">Ano</th>{["janeiro", "fevereiro", "março"].map((mes) =>
    <th key={mes}><span aria-hidden="true">{mes}</span><span className="sr-only">{mes}</span></th>)}</tr></thead>
  <tbody>
    <tr><th>2025</th>
      <td id="a" className="cb-cel"><span data-alvo="">A</span><span className="sr-only">Amarela, 1.234,56 R$/MWh</span></td>
      <td id="vazia" className="cb-vazia"><span className="sr-only">não publicado</span></td>
      <td id="b" className="cb-cel"><span data-alvo="">V2</span><span className="sr-only">Vermelha P2, 1.234.567,89 R$/MWh</span></td>
    </tr>
    <tr><th>2026</th>
      <td id="zero" className="cb-cel"><span data-alvo="">V</span><span className="sr-only">Verde, 0,00 R$/MWh</span></td>
      <td id="ausente" className="cb-cel"><span data-alvo="">?</span><span className="sr-only">sem nome publicado, sem valor publicado</span></td>
      <td id="ultima" className="cb-cel"><span data-alvo="">A</span><span className="sr-only">Amarela, 42,50 R$/MWh</span></td>
    </tr>
  </tbody>
</table>;
const container = document.getElementById("montagem")!;
const root = createRoot(container);
Object.assign(window, { __contaGrade: {
  renderizar(idioma?: "pt" | "en") {
    const props = idioma === undefined ? {} : { idioma };
    flushSync(() => root.render(<ContaGradeDica {...props} instrucao=${JSON.stringify(INSTRUCAO_GRADE)}>{grade}</ContaGradeDica>));
  },
  desmontar() {
    root.unmount();
    container.remove();
    Reflect.deleteProperty(window, "__contaGrade");
  },
} });
`;

export type PaginaGrade = { page: Page; url: string; falhas: string[]; fechar(): Promise<void> };
export type NavegadorGrade = { pagina(idioma?: Idioma): Promise<PaginaGrade>; fechar(): Promise<void> };

/** Servidor e cache temporários; sem Next, banco, configuração de app ou rota pública. */
export async function criarNavegadorGrade(): Promise<NavegadorGrade> {
  const temporario = await mkdtemp(join(tmpdir(), "scrutiniums-conta-grade-"));
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
    if (erros.length) throw new AggregateError(erros, "Falha ao encerrar o browser da grade");
  };
  try {
    const entrada = join(temporario, "entrada.tsx");
    await writeFile(entrada, ENTRADA, "utf8");
    const diretorios = [join(RAIZ, "src"), join(RAIZ, "node_modules"), temporario];
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Teste de ContaGradeDica</title>
      <link rel="icon" href="data:,"><style>body{margin:48px}td,th{padding:12px;min-width:80px}.sr-only{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}</style>
      </head><body><main><div id="montagem"></div></main>
      <table><tbody><tr><td id="fora" class="cb-cel"><span data-alvo="">Fora da ilha</span></td></tr></tbody></table>
      <script type="module" src="/@fs${entrada}"></script></body></html>`;
    servidor = await createServer({
      root: RAIZ, configFile: false, envFile: false, envPrefix: [], publicDir: false,
      appType: "custom", cacheDir: join(temporario, "cache"), logLevel: "error",
      resolve: { alias: { "@": join(RAIZ, "src") }, dedupe: ["react", "react-dom"] },
      optimizeDeps: { entries: [entrada], noDiscovery: true, include: ["react", "react-dom/client", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"] },
      server: { host: "127.0.0.1", port: 0, strictPort: true, hmr: false, ws: false, watch: null, fs: { strict: true, allow: diretorios } },
      plugins: [react(), {
        name: "fixture-conta-grade",
        configureServer(vite) {
          vite.middlewares.use((req, res, next) => {
            if (req.url !== CAMINHO) return next();
            // O transformIndexHtml injeta o cliente HMR mesmo com ws=false.
            // A entrada /@fs continua sendo transformada pelo Vite, sem esse cliente.
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(html);
          });
        },
      }],
    });
    await servidor.listen();
    const endereco = servidor.httpServer?.address();
    if (!endereco || typeof endereco === "string") throw new Error("Porta efêmera da grade indisponível");
    const origem = `http://127.0.0.1:${endereco.port}`;
    navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE || undefined });
    return {
      fechar,
      async pagina(idioma) {
        const contexto = await navegador!.newContext({ locale: "en-US", viewport: { width: 1000, height: 800 }, serviceWorkers: "block" });
        const falhas: string[] = [];
        let page: Page | undefined;
        let encerrada = false;
        const erroPagina = (e: Error) => { falhas.push(`JavaScript: ${e.message}`); };
        const consoleErro = (m: ConsoleMessage) => { if (m.type() === "error") falhas.push(`Console: ${m.text()}`); };
        const erroPedido = (r: Request) => { falhas.push(`Pedido: ${r.url()} ${r.failure()?.errorText}`); };
        const resposta = (r: Response) => { if (r.status() < 200 || r.status() >= 300) falhas.push(`HTTP ${r.status()}: ${r.url()}`); };
        const fecharPagina = async () => {
          if (encerrada) return;
          encerrada = true;
          const erros: unknown[] = [];
          try { if (page && !page.isClosed()) await page.evaluate(() => (window as JanelaGrade).__contaGrade?.desmontar()); } catch (e) { erros.push(e); }
          try { await contexto.unrouteAll({ behavior: "wait" }); } catch (e) { erros.push(e); }
          try { await contexto.close(); } catch (e) { erros.push(e); }
          page?.off("pageerror", erroPagina);
          page?.off("console", consoleErro);
          page?.off("requestfailed", erroPedido);
          page?.off("response", resposta);
          if (erros.length) throw new AggregateError(erros, "Falha ao fechar a página da grade");
        };
        try {
          await contexto.route("**/*", async (route) => {
            const pedido = route.request(), url = new URL(pedido.url()), caminho = decodeURIComponent(url.pathname);
            const arquivo = caminho.startsWith("/@fs/") ? resolve("/", caminho.slice(5)) : null;
            const modulo = caminho.startsWith("/src/") || caminho.startsWith("/node_modules/")
              || (arquivo !== null && diretorios.some((d) => arquivo.startsWith(d + "/")));
            const permitido = url.origin === origem && ["GET", "HEAD"].includes(pedido.method())
              && ((pedido.resourceType() === "document" && caminho === CAMINHO) || (pedido.resourceType() === "script" && modulo));
            if (!permitido) falhas.push(`Rede inesperada: ${pedido.method()} ${pedido.url()}`);
            try { if (permitido) await route.continue(); else await route.abort("blockedbyclient"); }
            catch (e) { falhas.push(`Interceptação: ${String(e)}`); }
          });
          await contexto.routeWebSocket("**/*", async (ws) => {
            falhas.push(`WebSocket inesperado: ${ws.url()}`);
            try { await ws.close(); } catch (e) { falhas.push(`Fecho de WebSocket: ${String(e)}`); }
          });
          page = await contexto.newPage();
          page.setDefaultTimeout(10_000);
          page.on("pageerror", erroPagina);
          page.on("console", consoleErro);
          page.on("requestfailed", erroPedido);
          page.on("response", resposta);
          const url = origem + CAMINHO;
          const inicial = await page.goto(url, { waitUntil: "load", timeout: 30_000 });
          if (inicial?.status() !== 200 || page.url() !== url) throw new Error("Documento de teste da grade não carregou");
          await page.waitForFunction(() => typeof (window as JanelaGrade).__contaGrade?.renderizar === "function");
          await page.evaluate((lang) => {
            const ponte = (window as JanelaGrade).__contaGrade;
            if (!ponte) throw new Error("Bridge de montagem da grade indisponível");
            ponte.renderizar(lang);
          }, idioma);
          await page.waitForFunction(() => document.querySelector("#ultima")?.getAttribute("tabindex") === "0");
          return { page, url, falhas, fechar: fecharPagina };
        } catch (e) {
          try { await fecharPagina(); } catch (limpeza) { throw new AggregateError([e, limpeza], "Montagem e limpeza da grade falharam"); }
          throw e;
        }
      },
    };
  } catch (e) {
    try { await fechar(); } catch (limpeza) { throw new AggregateError([e, limpeza], "Servidor e limpeza da grade falharam"); }
    throw e;
  }
}
