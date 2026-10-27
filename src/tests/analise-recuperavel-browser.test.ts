import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Componentes e hook reais, duas ilhas por consulta. A fixture não representa o layout da página.
const entrada = `
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useEstadoUrl } from '@/components/painel/useEstadoUrl';
import { campo, tiposUrl as t } from '@/lib/painel/estadoUrl';
import { prepararEnderecoAnalise } from '@/lib/painel/enderecoAnalise';
import { useLitrosTanque } from '@/components/combustiveis/useLitrosTanque';
import { CopiarLinkRecorte } from '@/components/conta/CopiarLinkRecorte';
import { LaboratorioIdeb } from '@/components/educacao/LaboratorioIdeb';
const busca = { q: campo(t.texto(), '', { historico: 'replace' }) };
const periodo = { ano: campo(t.inteiro({min:2000,max:2030}), 2026) };
function Busca({nome='Busca'}) { const [v,set] = useEstadoUrl(busca,{atraso:2000}); return <label>{nome}<input value={v.q} onChange={e=>set({q:e.target.value})}/></label>; }
function Periodo() { const [v,set] = useEstadoUrl(periodo); return <label>Ano<select aria-label="Ano" value={v.ano} onChange={e=>set({ano:Number(e.target.value)})}><option>2025</option><option>2026</option></select></label>; }
function Tanque() {const [n,set]=useLitrosTanque();return <label>Litros<input type="number" value={Number.isFinite(n)?n:''} onChange={e=>set(e.target.value===''?NaN:Number(e.target.value))}/></label>;}
function Resultado() {const [n]=useLitrosTanque();return <output aria-label="Custo">{Number.isFinite(n)&&n>0&&n<=1000?(6*n).toFixed(2):'Sem cálculo'}</output>;}
function App() {const [link,set]=useState('');return <><Busca/><Busca nome="Busca secundária"/><Periodo/><Tanque/><Resultado/><button onClick={()=>set(prepararEnderecoAnalise())}>Capturar</button><output aria-label="Recorte">{link}</output><CopiarLinkRecorte classe="" caminho={prepararEnderecoAnalise}/><section aria-label="Ideb nacional"><LaboratorioIdeb chaveUrl="ideb_br" n={6} p={.9} ideb={5.4} rede="Brasil" ano={2023}/></section><section aria-label="Ideb municipal"><LaboratorioIdeb chaveUrl="ideb_mun" n={5} p={.8} ideb={4} rede="município" ano={2023}/></section></>;}
createRoot(document.getElementById('app')).render(<App/>);
`;

describe("Recuperar análise: estado, histórico e cópia no navegador", () => {
  let pasta: string;
  let servidor: ViteDevServer;
  let navegador: Browser;
  let origem: string;
  beforeAll(async () => {
    pasta = await mkdtemp(join(tmpdir(), "scrutiniums-analise-"));
    const arquivo = join(pasta, "entrada.tsx");
    await writeFile(arquivo, entrada);
    // Fora do Next, somente a leitura de idioma recebe o pathname da fixture.
    const roteador = join(pasta, "roteador.ts");
    await writeFile(roteador, "export const usePathname = () => window.location.pathname;");
    const raiz = process.cwd();
    servidor = await createServer({
      root: raiz, configFile: false, envFile: false, envPrefix: [], publicDir: false, appType: "custom", cacheDir: join(pasta, "cache"), logLevel: "error",
      resolve: { alias: { "@": join(raiz, "src"), "next/navigation": roteador }, dedupe: ["react", "react-dom"] },
      optimizeDeps: { entries: [arquivo], noDiscovery: true, include: ["react", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "next/dist/client/components/static-generation-async-storage.external"] },
      server: { host: "127.0.0.1", port: 0, hmr: false, ws: false, watch: null, fs: { allow: [join(raiz, "src"), join(raiz, "node_modules"), pasta] } },
      plugins: [react(), { name: "fixture-analise", configureServer(vite) { vite.middlewares.use((req, res, next) => {
        if (new URL(req.url ?? "/", "http://local").pathname !== "/analise") return next();
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Análise sintética</title><link rel="icon" href="data:,"></head><body><main id="app"></main><script type="module" src="/@fs${arquivo}"></script></body></html>`);
      }); } }],
    });
    await servidor.listen();
    const endereco = servidor.httpServer?.address();
    if (!endereco || typeof endereco === "string") throw new Error("Servidor de teste sem porta");
    origem = `http://127.0.0.1:${endereco.port}`;
    navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE || undefined });
  }, 60_000);
  afterAll(async () => { await navegador?.close(); await servidor?.close(); if (pasta) await rm(pasta, { recursive: true, force: true }); });

  async function comPagina(verificar: (page: Page) => Promise<void>) {
    const contexto = await navegador.newContext();
    const page = await contexto.newPage();
    page.setDefaultTimeout(8_000);
    const erros: string[] = [];
    page.on("pageerror", (e) => erros.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
    try {
      await page.goto(`${origem}/analise?utm_origem=pesquisa#resultado`);
      await page.getByLabel("Litros", { exact: true }).waitFor();
      await verificar(page);
      expect(erros).toEqual([]);
    } catch (erro) { throw new Error(`${String(erro)}\nErros do navegador: ${erros.join("\n")}`); }
    finally { await contexto.close(); }
  }

  it("a busca pendente sobrevive à seleção em outra ilha e já entra no compartilhamento", async () => comPagina(async (page) => {
    await page.getByLabel("Busca", { exact: true }).fill("crédito rural");
    await page.getByLabel("Ano", { exact: true }).selectOption("2025");
    expect(await page.getByLabel("Busca", { exact: true }).inputValue()).toBe("crédito rural");
    await page.getByRole("button", { name: "Capturar", exact: true }).click();
    const caminho = await page.getByLabel("Recorte", { exact: true }).textContent();
    const url = new URL(caminho!, origem);
    expect(url.searchParams.get("q")).toBe("crédito rural");
    expect(url.searchParams.get("ano")).toBe("2025");
    expect(url.searchParams.get("litros")).toBe("40");
    expect(url.searchParams.get("utm_origem")).toBe("pesquisa");
    expect(url.hash).toBe("#resultado");
    const outro = await navegador.newContext();
    try {
      const p = await outro.newPage(); await p.goto(url.href);
      await expect.poll(() => p.getByLabel("Busca", { exact: true }).inputValue()).toBe("crédito rural");
      expect(await p.getByLabel("Ano", { exact: true }).inputValue()).toBe("2025");
    } finally { await outro.close(); }
  }), 30_000);

  it("tanque e resultado andam juntos, inclusive em recarga, vazio e voltar/avançar", async () => comPagina(async (page) => {
    const litros = page.getByLabel("Litros", { exact: true });
    await litros.fill("60");
    await expect.poll(() => page.getByLabel("Custo", { exact: true }).textContent()).toBe("360.00");
    await page.getByLabel("Ano", { exact: true }).selectOption("2025");
    await litros.fill("80");
    await page.goBack();
    await expect.poll(() => litros.inputValue()).toBe("60");
    await page.goForward();
    await expect.poll(() => litros.inputValue()).toBe("80");
    await page.reload();
    await expect.poll(() => litros.inputValue()).toBe("80");
    expect(await page.getByLabel("Custo", { exact: true }).textContent()).toBe("480.00");
    await litros.fill(""); await page.reload();
    await expect.poll(() => litros.inputValue()).toBe("");
    expect(await page.getByLabel("Custo", { exact: true }).textContent()).toBe("Sem cálculo");
  }), 30_000);

  it("clipboard recusado oferece endereço atual selecionável e mantém o teclado", async () => comPagina(async (page) => {
    await page.getByLabel("Litros", { exact: true }).fill("75");
    await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { throw new Error("Recusado pela fixture"); } }, configurable: true }));
    await page.getByRole("button", { name: "Copiar link", exact: true }).click();
    const manual = page.getByRole("textbox", { name: "Endereço para compartilhar", exact: true });
    await manual.waitFor();
    expect(new URL(await manual.inputValue()).searchParams.get("litros")).toBe("75");
    await expect.poll(() => manual.evaluate((el) => document.activeElement === el)).toBe(true);
    expect(await page.locator('p[role="status"]').textContent()).not.toBe("");
  }), 30_000);

  it("os cenários nacional e municipal do Ideb não sobrescrevem um ao outro", async () => comPagina(async (page) => {
    const nacional = page.getByRole("region", { name: "Ideb nacional" }).getByRole("slider").first();
    const municipal = page.getByRole("region", { name: "Ideb municipal" }).getByRole("slider").first();
    await nacional.focus(); await page.keyboard.press("ArrowRight");
    await municipal.focus(); await page.keyboard.press("ArrowLeft");
    await page.getByRole("button", { name: "Capturar", exact: true }).click();
    const url = new URL((await page.getByLabel("Recorte", { exact: true }).textContent())!, origem);
    expect(Number(url.searchParams.get("ideb_br_n"))).toBe(6.1);
    expect(Number(url.searchParams.get("ideb_mun_n"))).toBe(4.9);
    await page.goto(url.href);
    await expect.poll(() => nacional.inputValue()).toBe("6.1");
    expect(await municipal.inputValue()).toBe("4.9");
  }), 30_000);
});
