import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { paginasTematicasDoCredito } from "@/lib/credito/navegacao";
import { PAINEIS_REDIRECIONADOS, PREFIXO_APLICACAO } from "@/lib/observatorios/reescritos";
import { subirServidor, temBuild, exigirBuild, type ServidorProducao } from "./suporte/servidor-producao";

/**
 * A aplicação do Crédito depois da remoção, em 10/11/2026, do código que desenhava as nove vistas das Famílias reescritas
 * como páginas próprias (public/obs/app.js). No navegador, sobre o build de produção e com sessão:
 * - o "Início do painel" abre sem erro, conta as páginas que a aplicação mantém (o mesmo número da vitrine da home) e liga
 *   cada uma das nove à página nova, por link comum;
 * - três vistas vivas (Pulso do crédito, Pix e Instituições) continuam desenhando, inclusive as que vivem em pedaço;
 * - nav() de cada uma das nove sai da aplicação para a página nova;
 * - o gráfico incorporado (/obs/embed.html), que não recebe o índice do servidor, mostra o aviso com o endereço antigo no
 *   lugar de uma vista reescrita e continua desenhando uma vista viva.
 */
const VISTA_DA_ABA: Record<string, string> = {
  "/desenrola": "desenrola", "/bets-financial-risk": "bets", "/financial-fraud": "fraudes", "/lawsuits": "judicial", "/debt-collection-lawsuits": "cobranca",
  "/conduct-enforcement": "conduta", "/payroll-lending-aging": "consignado", "/housing-credit": "moradia", "/formal-employment": "emprego",
};
let servidor: ServidorProducao;
let navegador: Browser;
beforeAll(async () => {
  if (!temBuild) { if (exigirBuild) throw new Error("Build obrigatório ausente"); return; }
  servidor = await subirServidor("vistas-reescritas");
  navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE });
}, 90_000);
afterAll(async () => { await navegador?.close(); await servidor?.parar(); });

async function abrir(): Promise<{ contexto: BrowserContext; page: Page; erros: string[] }> {
  const contexto = await navegador.newContext();
  await contexto.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem }]);
  const page = await contexto.newPage();
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
  return { contexto, page, erros };
}
const nav = (page: Page, v: string) => page.evaluate((x) => (window as unknown as { nav: (v: string) => void }).nav(x), v);

describe.skipIf(!temBuild && !exigirBuild)("aplicação do Crédito sem o desenho das nove vistas reescritas", () => {
  it("as nove vistas do registro são as nove que este teste percorre", () => {
    expect(PAINEIS_REDIRECIONADOS.map((p) => p.abaAntiga).sort()).toEqual(Object.keys(VISTA_DA_ABA).sort());
  });

  it("o Início do painel abre sem erro, conta as páginas da aplicação e liga as nove à página nova", async () => {
    const { contexto, page, erros } = await abrir();
    try {
      const resposta = await page.goto(servidor.origem + "/observatorio");
      expect(resposta?.status()).toBe(200);
      const mapa = page.locator("#view-mapa.active");
      // atlas.js recolhe o índice por pergunta num details: o bloco existe e é lido, visível ou não
      await mapa.locator("#mp-perguntas").waitFor({ state: "attached" });
      // a contagem que a tela escreve é a da vitrine da home (src/lib/vitrine.ts), da mesma fonte
      const esperado = paginasTematicasDoCredito().length;
      expect(await mapa.getAttribute("data-paginas")).toBe(String(esperado));
      expect((await mapa.textContent())?.replace(/\s+/g, " ")).toMatch(new RegExp(`${esperado} ?páginas temáticas`));
      for (const p of PAINEIS_REDIRECIONADOS) {
        // no ciclo e na lista por pergunta: link comum para a página nova, com a pergunta dela; nenhum para o endereço antigo
        const links = mapa.locator(`a[href="${p.rota}"]`);
        expect(await links.count(), p.rota).toBeGreaterThanOrEqual(2);
        expect(await links.first().getAttribute("onclick"), p.rota).toBeNull();
        expect((await links.last().textContent())?.trim(), p.rota).toBe(p.titulo);
        expect(await mapa.locator(`a[href="${PREFIXO_APLICACAO + p.abaAntiga}"]`).count(), p.abaAntiga).toBe(0);
        expect(await mapa.locator("#mp-perguntas dt", { hasText: p.resumo }).count(), p.resumo).toBe(1);
      }
      expect(await page.locator("section.view").evaluateAll((ns) => ns.map((n) => n.id))).not.toEqual(expect.arrayContaining(Object.values(VISTA_DA_ABA).map((v) => `view-${v}`)));
      expect(erros).toEqual([]);
    } finally { await contexto.close(); }
  }, 90_000);

  it("três vistas vivas desenham: Pulso do crédito, Pix e Instituições", async () => {
    const { contexto, page, erros } = await abrir();
    try {
      await page.goto(servidor.origem + "/observatorio");
      await page.locator("#view-mapa.active #mp-perguntas").waitFor({ state: "attached" });
      for (const [vista, caminho] of [["pulse", "/observatorio/credit"], ["pix", "/observatorio/pix"], ["institutions", "/observatorio/institutions"]] as const) {
        await nav(page, vista);
        await page.waitForURL((u) => u.pathname === caminho);
        const secao = page.locator(`#view-${vista}.active`);
        await secao.locator(".pagehead").getByRole("heading", { level: 1 }).waitFor();
        // conteúdo de verdade, não só o cabeçalho: gráfico ou tabela desenhados
        await expect.poll(() => secao.locator("svg.chart, table.data").count(), { timeout: 30_000 }).toBeGreaterThan(0);
        expect(await secao.innerText()).not.toMatch(/undefined|NaN|Falha ao carregar este painel/);
      }
      expect(erros).toEqual([]);
    } finally { await contexto.close(); }
  }, 120_000);

  it.each(Object.entries(VISTA_DA_ABA))("nav da vista de %s sai para a página nova", async (abaAntiga, vista) => {
    const destino = PAINEIS_REDIRECIONADOS.find((p) => p.abaAntiga === abaAntiga)!.rota;
    const { contexto, page, erros } = await abrir();
    try {
      await page.goto(servidor.origem + "/observatorio");
      await page.locator("#view-mapa.active #mp-perguntas").waitFor({ state: "attached" });
      await nav(page, vista);
      await page.waitForURL(servidor.origem + destino);
      await page.getByRole("heading", { level: 1 }).first().waitFor();
      expect(await page.locator("section.view").count()).toBe(0);
      expect(erros).toEqual([]);
    } finally { await contexto.close(); }
  }, 90_000);

  it("o gráfico incorporado mostra o aviso no lugar da vista reescrita e segue desenhando uma vista viva", async () => {
    const { contexto, page, erros } = await abrir();
    try {
      // embed.html não declara ícone: o pedido automático de /favicon.ico responde 404 e não é erro da aplicação
      await contexto.route("**/favicon.ico", (rota) => rota.fulfill({ status: 204, body: "" }));
      await page.goto(servidor.origem + "/obs/embed.html?g=bets");
      const aviso = page.locator("#embReescrita");
      await aviso.waitFor();
      expect(await aviso.locator("h4").innerText()).toBe("Apostas e crédito das famílias");
      expect(await aviso.locator("a").getAttribute("href")).toBe("/observatorio/bets-financial-risk");
      expect(await page.locator("section.view.active").count()).toBe(0);
      await page.goto(servidor.origem + "/obs/embed.html?g=pulse");
      await page.locator("#view-pulse.active .pagehead").waitFor();
      expect(await page.locator("#embReescrita").count()).toBe(0);
      expect(erros).toEqual([]);
    } finally { await contexto.close(); }
  }, 90_000);
});
