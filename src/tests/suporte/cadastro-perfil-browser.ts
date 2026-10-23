import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { chromium, type Browser, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { portaLivre } from "./porta-livre";

/**
 * Monta o PerfilForm real da etapa 3 do cadastro num Chromium, servido pelo
 * Vite sem Next: validação, estado, eventos e fetch são do formulário; o
 * roteador do Next vira um registro de navegação e o POST é interceptado.
 * Sessão, banco e regra do servidor ficam com cadastro-perfil-uso.test.ts.
 */
const RAIZ = fileURLToPath(new URL("../../../", import.meta.url));
const CAMINHO = "/__teste__/cadastro-perfil";
export const API_PERFIL = "/api/onboarding/profile";

type Janela = Window & {
  __perfilCadastro?: { montar(props: { exigeCpf: boolean }): void };
  __navegacoes?: string[];
};

const ROTEADOR = `
export function useRouter() {
  return { push(destino) { (window.__navegacoes ??= []).push(destino); } };
}
`;

const ENTRADA = `
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { PerfilForm } from "@/components/onboarding/PerfilForm";
const root = createRoot(document.getElementById("montagem"));
Object.assign(window, { __perfilCadastro: {
  montar(props) { flushSync(() => root.render(<PerfilForm {...props}/>)); },
} });
`;

export type PedidoCadastro = { corpoBruto: string | null; corpo: unknown };
export type PaginaCadastro = { page: Page; pedidos: PedidoCadastro[]; falhas: string[]; navegacoes(): Promise<string[]>; fechar(): Promise<void> };
export type NavegadorCadastro = { pagina(props: { exigeCpf: boolean }, largura?: number): Promise<PaginaCadastro>; fechar(): Promise<void> };

export async function criarNavegadorCadastro(): Promise<NavegadorCadastro> {
  const temporario = await mkdtemp(join(tmpdir(), "scrutiniums-cadastro-perfil-"));
  let servidor: ViteDevServer | undefined;
  let navegador: Browser | undefined;
  const fechar = async () => {
    const erros: unknown[] = [];
    try { await navegador?.close(); } catch (e) { erros.push(e); }
    try { await servidor?.close(); } catch (e) { erros.push(e); }
    try { await rm(temporario, { recursive: true, force: true }); } catch (e) { erros.push(e); }
    if (erros.length) throw new AggregateError(erros, "Falha ao encerrar o navegador do cadastro");
  };
  try {
    const entrada = join(temporario, "entrada.tsx");
    const roteador = join(temporario, "roteador.js");
    await writeFile(entrada, ENTRADA, "utf8");
    await writeFile(roteador, ROTEADOR, "utf8");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Fixture do cadastro</title>
      <link rel="icon" href="data:,"><style>body{margin:16px;font:16px sans-serif}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}</style>
      </head><body><main><div id="montagem"></div></main><script type="module" src="/@fs${entrada}"></script></body></html>`;
    const porta = await portaLivre();
    servidor = await createServer({
      root: RAIZ, configFile: false, envFile: false, envPrefix: [], publicDir: false,
      appType: "custom", cacheDir: join(temporario, "cache"), logLevel: "error",
      resolve: { alias: { "@": join(RAIZ, "src"), "next/navigation": roteador }, dedupe: ["react", "react-dom"] },
      optimizeDeps: { entries: [entrada], noDiscovery: true, include: ["react", "react-dom/client", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"] },
      server: { host: "127.0.0.1", port: porta, strictPort: true, hmr: false, ws: false, watch: null,
        fs: { strict: true, allow: [join(RAIZ, "src"), join(RAIZ, "node_modules"), temporario] } },
      plugins: [react(), {
        name: "fixture-cadastro-perfil",
        configureServer(vite) {
          vite.middlewares.use((req, res, next) => {
            if (new URL(req.url ?? "/", "http://fixture.local").pathname !== CAMINHO) return next();
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(html);
          });
        },
      }],
    });
    await servidor.listen();
    const endereco = servidor.httpServer?.address();
    if (!endereco || typeof endereco === "string") throw new Error("Porta efêmera do cadastro indisponível");
    const origem = `http://127.0.0.1:${endereco.port}`;
    navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE || undefined });
    return {
      fechar,
      async pagina(props, largura = 1000) {
        const contexto = await navegador!.newContext({ locale: "pt-BR", viewport: { width: largura, height: 900 }, serviceWorkers: "block" });
        const pedidos: PedidoCadastro[] = [], falhas: string[] = [];
        await contexto.route("**/*", async (route) => {
          const pedido = route.request(), url = new URL(pedido.url());
          if (url.origin !== origem) {
            falhas.push(`Rede inesperada: ${pedido.url()}`);
            await route.abort("blockedbyclient");
            return;
          }
          if (url.pathname === API_PERFIL) {
            pedidos.push({ corpoBruto: pedido.postData(), corpo: pedido.postDataJSON() });
            await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true,"next":"/setor-eletrico/conta-de-luz"}' });
            return;
          }
          await route.continue();
        });
        const page = await contexto.newPage();
        page.setDefaultTimeout(10_000);
        page.on("pageerror", (e) => falhas.push(`JavaScript: ${e.message}`));
        page.on("console", (m) => { if (m.type() === "error") falhas.push(`Console: ${m.text()}`); });
        await page.goto(origem + CAMINHO, { waitUntil: "load", timeout: 30_000 });
        await page.waitForFunction(() => typeof (window as Janela).__perfilCadastro?.montar === "function");
        await page.evaluate((p) => (window as Janela).__perfilCadastro!.montar(p), props);
        await page.getByRole("button", { name: "Concluir cadastro", exact: true }).waitFor({ state: "visible" });
        return {
          page, pedidos, falhas,
          navegacoes: () => page.evaluate(() => (window as Janela).__navegacoes ?? []),
          fechar: () => contexto.close(),
        };
      },
    };
  } catch (e) {
    try { await fechar(); } catch (limpeza) { throw new AggregateError([e, limpeza], "Servidor e limpeza do cadastro falharam"); }
    throw e;
  }
}
