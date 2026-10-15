import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { chromium, type Browser, type ConsoleMessage, type Page, type Request, type Response } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import type { Idioma } from "@/lib/idioma";
import { URLS, MUNICIPIOS_CSV, CONJUNTOS_CSV, GEO, SERIE } from "./i18n-energia-qualidade-fixtures";

const RAIZ = fileURLToPath(new URL("../../../", import.meta.url));
const CAMINHO = "/__teste__/qualidade";
const FLAGS_NEXT = {
  "process.env.__NEXT_ROUTER_BASEPATH": '""',
  "process.env.__NEXT_MANUAL_CLIENT_BASE_PATH": "false",
  "process.env.__NEXT_I18N_SUPPORT": "false",
  "process.env.__NEXT_MANUAL_TRAILING_SLASH": "false",
  "process.env.__NEXT_TRAILING_SLASH": "false",
  "process.env.__NEXT_LINK_NO_TOUCH_START": "false",
};
export type JanelaQualidade = Window & {
  __qualidade?: { renderizar(idioma?: Idioma): void; dados(): string; desmontar(): void };
};

// Uma raiz, um tipo e props de dados constantes. Apenas idioma varia pelo bridge.
const ENTRADA = `
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { QualidadeMapa } from "@/components/energia/QualidadeMapa";
import { PROPS_MAPA, GEO, SERIE, MUNICIPIOS_CSV, CONJUNTOS_CSV } from "@/tests/suporte/i18n-energia-qualidade-fixtures";
const container = document.getElementById("montagem")!;
const root = createRoot(container);
Object.assign(window, { __qualidade: {
  renderizar(idioma?: "pt" | "en") {
    const props = idioma === undefined ? {} : { idioma };
    flushSync(() => root.render(<QualidadeMapa {...PROPS_MAPA} {...props}/>));
  },
  dados() { return JSON.stringify({ PROPS_MAPA, GEO, SERIE, MUNICIPIOS_CSV, CONJUNTOS_CSV }); },
  desmontar() {
    root.unmount();
    container.remove();
    Reflect.deleteProperty(window, "__qualidade");
  },
} });
`;

function portao() {
  let liberar!: () => void;
  const espera = new Promise<void>((resolve) => { liberar = resolve; });
  return { espera, liberar };
}

export type PaginaQualidade = {
  page: Page;
  url: string;
  pedidos: string[];
  falhas: string[];
  liberarMunicipios(): void;
  liberarConjuntos(): void;
  fechar(): Promise<void>;
};
export type NavegadorQualidade = { pagina(idioma?: Idioma): Promise<PaginaQualidade>; fechar(): Promise<void> };

/** Vite apenas transforma módulos reais; nenhum Next/DB, mock de hook, Link ou Intl. */
export async function criarNavegadorQualidade(): Promise<NavegadorQualidade> {
  const temporario = await mkdtemp(join(tmpdir(), "scrutiniums-qualidade-"));
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
    if (erros.length) throw new AggregateError(erros, "Falha ao encerrar o browser de Qualidade");
  };
  try {
    const entrada = join(temporario, "entrada.tsx");
    await writeFile(entrada, ENTRADA, "utf8");
    const diretorios = [join(RAIZ, "src"), join(RAIZ, "node_modules"), temporario];
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Fixture de Qualidade</title>
      <link rel="icon" href="data:,"><style>
      :root{--cor-energia:#286c79;--cor-superficie:#fff;--cor-carvao:#222;--cor-mineral:#555;--serie-referencia:#777}
      body{margin:24px;font:16px sans-serif}main{width:1040px;max-width:100%}button,input{min-height:32px}
      [style*="--mapa-h"]{height:440px;position:relative;overflow:hidden}
      .pointer-events-none{pointer-events:none}.absolute{position:absolute}.relative{position:relative}
      .sr-only{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
      .tabela-scroll{overflow:auto;max-width:100%}td,th{padding:6px;white-space:nowrap}summary{cursor:pointer;padding:8px}
      [data-recolhivel="fechada"]{display:none}[data-grafico="pequenos-multiplos"]{margin:24px 0}
      [data-grafico="pequenos-multiplos"]>ul[aria-label]{display:grid;grid-template-columns:1fr 1fr;padding:0;list-style:none}
      [data-painel]{min-width:0}[hidden]{display:none!important}
      </style></head><body><main><div id="montagem"></div></main><script type="module" src="/@fs${entrada}"></script></body></html>`;
    servidor = await createServer({
      root: RAIZ, configFile: false, envFile: false, envPrefix: [], publicDir: false,
      appType: "custom", cacheDir: join(temporario, "cache"), logLevel: "error",
      resolve: { alias: { "@": join(RAIZ, "src") }, dedupe: ["react", "react-dom"] },
      // Flags de compilação lidas pelo next/link instalado, sem expor process/env global.
      define: FLAGS_NEXT,
      optimizeDeps: {
        entries: [entrada], noDiscovery: true,
        include: ["react", "react-dom/client", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "next/link"],
        // Vite 8 não herda config.define ao pré-compilar dependências.
        rolldownOptions: { transform: { define: FLAGS_NEXT } },
      },
      server: { host: "127.0.0.1", port: 0, strictPort: true, hmr: false, ws: false, watch: null, fs: { strict: true, allow: diretorios } },
      plugins: [react(), {
        name: "fixture-qualidade",
        configureServer(vite) {
          vite.middlewares.use((req, res, next) => {
            if (new URL(req.url ?? "/", "http://fixture.local").pathname !== CAMINHO) return next();
            // transformIndexHtml adicionaria /@vite/client, que abre WebSocket.
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(html);
          });
        },
      }],
    });
    await servidor.listen();
    const endereco = servidor.httpServer?.address();
    if (!endereco || typeof endereco === "string") throw new Error("Porta efêmera de Qualidade indisponível");
    const origem = `http://127.0.0.1:${endereco.port}`;
    navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE || undefined });
    return {
      fechar,
      async pagina(idioma) {
        const contexto = await navegador!.newContext({ locale: "en-US", viewport: { width: 1120, height: 900 }, serviceWorkers: "block" });
        const falhas: string[] = [], pedidos: string[] = [];
        const municipios = portao(), conjuntos = portao();
        let page: Page | undefined;
        let encerrada = false;
        const erroPagina = (e: Error) => { falhas.push(`JavaScript: ${e.stack ?? e.message}`); };
        const consoleErro = (m: ConsoleMessage) => { if (m.type() === "error") falhas.push(`Console: ${m.text()}`); };
        const erroPedido = (r: Request) => { falhas.push(`Pedido: ${r.url()} ${r.failure()?.errorText}`); };
        const resposta = (r: Response) => { if (r.status() < 200 || r.status() >= 300) falhas.push(`HTTP ${r.status()}: ${r.url()}`); };
        const fecharPagina = async () => {
          if (encerrada) return;
          encerrada = true;
          // Resolver gates e concluir respostas antes de aguardar handlers, inclusive em falha.
          municipios.liberar(); conjuntos.liberar();
          const erros: unknown[] = [];
          try { if (page && !page.isClosed()) await page.evaluate(() => (window as JanelaQualidade).__qualidade?.desmontar()); } catch (e) { erros.push(e); }
          try { await contexto.unrouteAll({ behavior: "wait" }); } catch (e) { erros.push(e); }
          try { await contexto.close(); } catch (e) { erros.push(e); }
          page?.off("pageerror", erroPagina); page?.off("console", consoleErro);
          page?.off("requestfailed", erroPedido); page?.off("response", resposta);
          if (erros.length) throw new AggregateError(erros, "Falha ao fechar a página de Qualidade");
        };
        try {
          const respostas = new Map<string, { body: string; contentType: string; gate: Promise<void> }>([
            [URLS.municipios, { body: MUNICIPIOS_CSV, contentType: "text/csv; charset=utf-8", gate: municipios.espera }],
            [URLS.geo, { body: JSON.stringify(GEO), contentType: "application/json", gate: Promise.resolve() }],
            [URLS.serie, { body: JSON.stringify(SERIE), contentType: "application/json", gate: Promise.resolve() }],
            [URLS.conjuntos, { body: CONJUNTOS_CSV, contentType: "text/csv; charset=utf-8", gate: conjuntos.espera }],
          ]);
          await contexto.route("**/*", async (route) => {
            const pedido = route.request(), url = new URL(pedido.url()), caminho = decodeURIComponent(url.pathname);
            const dados = respostas.get(caminho);
            try {
              if (dados && url.origin === origem && url.search === "" && pedido.method() === "GET" && pedido.resourceType() === "fetch") {
                pedidos.push(`GET ${caminho}`);
                await dados.gate;
                await route.fulfill({ status: 200, body: dados.body, contentType: dados.contentType });
                return;
              }
              const arquivo = caminho.startsWith("/@fs/") ? resolve("/", caminho.slice(5)) : null;
              const modulo = caminho.startsWith("/src/") || caminho.startsWith("/node_modules/")
                || (arquivo !== null && diretorios.some((d) => arquivo.startsWith(d + "/")));
              const permitido = url.origin === origem && pedido.method() === "GET"
                && ((pedido.resourceType() === "document" && caminho === CAMINHO)
                  || (pedido.resourceType() === "script" && modulo));
              if (!permitido) falhas.push(`Rede inesperada: ${pedido.method()} ${pedido.url()}`);
              if (permitido) await route.continue(); else await route.abort("blockedbyclient");
            } catch (e) { falhas.push(`Interceptação: ${String(e)}`); }
          });
          await contexto.routeWebSocket("**/*", async (ws) => {
            falhas.push(`WebSocket inesperado: ${ws.url()}`);
            try { await ws.close(); } catch (e) { falhas.push(`Fecho de WebSocket: ${String(e)}`); }
          });
          page = await contexto.newPage();
          page.setDefaultTimeout(15_000);
          page.on("pageerror", erroPagina); page.on("console", consoleErro);
          page.on("requestfailed", erroPedido); page.on("response", resposta);
          const url = origem + CAMINHO + "?preservar=sim#painel";
          const inicial = await page.goto(url, { waitUntil: "load", timeout: 30_000 });
          if (inicial?.status() !== 200 || page.url() !== url) throw new Error("Documento de Qualidade não carregou");
          await page.waitForFunction(() => typeof (window as JanelaQualidade).__qualidade?.renderizar === "function");
          await page.evaluate((lang) => {
            const ponte = (window as JanelaQualidade).__qualidade;
            if (!ponte) throw new Error("Bridge de montagem de Qualidade indisponível");
            ponte.renderizar(lang);
          }, idioma);
          return { page, url, pedidos, falhas, liberarMunicipios: municipios.liberar, liberarConjuntos: conjuntos.liberar, fechar: fecharPagina };
        } catch (e) {
          const erros: unknown[] = [e];
          try { await fecharPagina(); } catch (limpeza) { erros.push(limpeza); }
          // A montagem pode falhar antes de devolver pagina/falhas ao teste. Ler a
          // lista depois do cleanup conserva também os eventos registrados no fecho.
          erros.push(...falhas.map((falha) => new Error(falha)));
          throw new AggregateError(erros, `Montagem de Qualidade falhou${falhas.length ? `:\n${falhas.join("\n")}` : ""}`);
        }
      },
    };
  } catch (e) {
    try { await fechar(); } catch (limpeza) { throw new AggregateError([e, limpeza], "Servidor e limpeza de Qualidade falharam"); }
    throw e;
  }
}
