import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { subirServidor, temBuild, exigirBuild, htmlDe, type ServidorProducao } from "./suporte/servidor-producao";

let servidor: ServidorProducao;
let navegador: Browser;
beforeAll(async () => {
  if (!temBuild && !exigirBuild) return;
  expect(temBuild, "Build de produção obrigatório").toBe(true);
  servidor = await subirServidor("credito-abertura");
  navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE });
}, 90_000);
afterAll(async () => { await navegador?.close(); await servidor?.parar(); });

describe.skipIf(!temBuild && !exigirBuild)("Crédito: primeira tela independente da aplicação", () => {
  it.each(["/observatorio", "/observatorio/map"])("%s entrega título, imagem e destinos sem JavaScript, mantendo a sessão obrigatória", async caminho => {
    expect((await htmlDe(servidor, caminho, false)).status).toBe(307);
    const contexto = await navegador.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    try {
      await contexto.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem }]);
      const page = await contexto.newPage();
      await page.goto(servidor.origem + caminho);
      expect(await page.locator("#view-mapa h1").count()).toBe(1);
      expect(await page.locator(".atlas-metric-value").count()).toBe(3);
      expect(await page.locator("#view-mapa h1").isVisible()).toBe(true);
      expect(await page.locator(".atlas-city-image").evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
      expect(await page.locator(".atlas-city-points a[href^='/observatorio/']").count()).toBe(4);
      await page.goto(servidor.origem + "/observatorio/overview");
      expect(await page.locator("[data-credito-abertura]").count()).toBe(0);
    } finally { await contexto.close(); }
  }, 60_000);

  it("mostra a abertura antes do app, conserva a imagem e só busca o núcleo ao navegar", async () => {
    const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } });
    let liberar!: () => void;
    const espera = new Promise<void>(resolve => { liberar = resolve; });
    try {
      await contexto.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem }]);
      await contexto.route("**/obs/app.min.js*", async rota => { await espera; await rota.continue(); });
      const page = await contexto.newPage();
      const erros: string[] = [], gold: string[] = [];
      page.on("pageerror", e => erros.push(e.message));
      page.on("request", r => { const p = new URL(r.url()).pathname; if (p.startsWith("/obs/data/gold/")) gold.push(p.split("/").at(-1)!); });
      await page.goto(servidor.origem + "/observatorio", { waitUntil: "commit" });
      await page.locator(".atlas-city-image").waitFor({ state: "visible" });
      await expect.poll(() => page.locator(".atlas-city-image").evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
      const imagem = await page.locator(".atlas-city-image").elementHandle();
      expect(gold).toEqual([]);
      await page.locator(".atlas-city-copy .obs-primary").click();
      liberar();
      await page.locator(".credit-atlas").waitFor();
      expect(await imagem!.evaluate(e => e === document.querySelector(".atlas-city-image"))).toBe(true);
      expect(await page.locator("#view-mapa h1").count()).toBe(1);
      expect(gold).toEqual(["meta.json"]);
      await expect.poll(() => page.locator("#mp-ciclo").evaluate(e => Math.abs(e.getBoundingClientRect().top))).toBeLessThan(200);
      await page.locator("#atlas-ead").evaluate((e: HTMLInputElement) => { e.value = "200"; e.dispatchEvent(new Event("input", { bubbles: true })); });
      expect(await page.locator(".atlas-loss").innerText()).toMatch(/3,6/);
      await page.evaluate(() => (window as unknown as { nav(v: string): void }).nav("overview"));
      await page.locator("#view-overview.active .pagehead").waitFor();
      for (const nome of ["meta", "pulse", "ibcc", "overview", "alerts", "alertas_central"]) expect(gold.filter(f => f === nome + ".json")).toHaveLength(1);
      await page.evaluate(() => (window as unknown as { nav(v: string): void }).nav("mapa"));
      await page.locator("#view-mapa.active .credit-atlas").waitFor();
      expect(await page.locator("#view-mapa h1").count()).toBe(1);
      expect(erros).toEqual([]);
    } finally { liberar(); await contexto.close(); }
  }, 90_000);

  it("mantém a abertura e o resumo publicado quando a carga complementar falha", async () => {
    const contexto = await navegador.newContext();
    try {
      await contexto.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem }]);
      await contexto.route("**/obs/data/gold/meta.json*", rota => rota.fulfill({ status: 503, body: "indisponível" }));
      const page = await contexto.newPage();
      const erros: string[] = [];
      page.on("pageerror", e => erros.push(e.message));
      await page.goto(servidor.origem + "/observatorio/map");
      await page.locator(".credit-atlas").waitFor();
      expect(await page.locator("#view-mapa h1").isVisible()).toBe(true);
      expect(await page.locator(".atlas-metrics").count()).toBe(1);
      expect(await page.locator(".atlas-metric-value").count()).toBe(3);
      expect(await page.locator(".atlas-metrics").innerText()).not.toMatch(/undefined|NaN/);
      expect(erros).toEqual([]);
    } finally { await contexto.close(); }
  }, 60_000);
});
