import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { subirServidor, temBuild, exigirBuild, type ServidorProducao } from "./suporte/servidor-producao";

const gold = JSON.parse(readFileSync("public/obs/data/gold/pix.json", "utf8"));
let servidor: ServidorProducao;
let navegador: Browser;
let contexto: BrowserContext;
beforeAll(async () => {
  if (!temBuild) { if (exigirBuild) throw new Error("Build obrigatório ausente"); return; }
  servidor = await subirServidor("pix-ux");
  navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE });
  contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  await contexto.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem }]);
}, 90_000);
afterAll(async () => { await navegador?.close(); await servidor?.parar(); });

describe.skipIf(!temBuild && !exigirBuild)("Pix: leitura equivalente e recorte persistente", () => {
  it("tabela e CSV preservam todos os fluxos e os valores da fonte", async () => {
    const page = await contexto.newPage();
    try {
      await page.goto(servidor.origem + "/observatorio/pix");
      await page.locator("#px-fluxos-tabela summary").click();
      const linhas = await page.locator("#px-fluxos-tabela tbody tr").allTextContents();
      expect(linhas).toHaveLength(gold.natureza.atual.length);
      for (const [i, x] of gold.natureza.atual.entries()) {
        expect(linhas[i]).toContain(x.q.toLocaleString("pt-BR"));
        expect(linhas[i]).toContain(x.v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        expect(linhas[i]).toContain(x.t.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      }
      const download = page.waitForEvent("download");
      await page.locator('#px-fluxos-tabela button').click();
      const arquivo = await (await download).path();
      const rows = readFileSync(arquivo!, "utf8").trim().split("\n").slice(1).map(l => l.split(";"));
      expect(rows).toHaveLength(gold.natureza.atual.length);
      for (const [i, x] of gold.natureza.atual.entries()) {
        expect(rows[i].slice(0, 2)).toEqual([gold.mes_tx, x.k]);
        expect(rows[i].slice(2).map(v => Number(v.replace(",", ".")))).toEqual([x.q, x.v, x.t]);
      }
    } finally { await page.close(); }
  }, 60_000);

  it("alternância por teclado mantém foco, tabela aberta e recorte após recarregar/voltar", async () => {
    const page = await contexto.newPage();
    try {
      await page.goto(servidor.origem + "/observatorio/pix");
      await page.locator("#px-fluxos-tabela summary").click();
      const valor = page.locator('#px-natureza button[onclick="pxSet(\'hmnat\',\'v\')"]');
      await valor.focus(); await page.keyboard.press("Enter");
      await page.waitForURL(/xhmnat=v/);
      expect(await valor.getAttribute("aria-pressed")).toBe("true");
      expect(await valor.evaluate(e => e === document.activeElement)).toBe(true);
      expect(await page.locator("#px-fluxos-tabela").getAttribute("open")).not.toBeNull();
      const recorte = page.url();
      await page.reload();
      await page.locator(".px-heatmap").waitFor();
      expect(await valor.getAttribute("aria-pressed")).toBe("true");
      await page.goto(servidor.origem + "/observatorio/credit");
      await page.goBack();
      await page.locator(".px-heatmap").waitFor();
      expect(page.url()).toBe(recorte);
      expect(await valor.getAttribute("aria-pressed")).toBe("true");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    } finally { await page.close(); }
  }, 60_000);
  it("gráficos de série do Pulso cabem no celular com eixos legíveis", async () => {
    const page = await contexto.newPage();
    try {
      await page.setViewportSize({ width: 320, height: 844 });
      await page.goto(servidor.origem + "/observatorio/credit");
      await page.locator("#view-pulse .line-chart").first().waitFor();
      await expect.poll(() => page.evaluate(() => [...document.querySelectorAll("#view-pulse .line-chart")].every(e => Math.abs(e.getBoundingClientRect().width - Number((e as HTMLElement).dataset.lineWidth)) < 2))).toBe(true);
      const textos = await page.locator("#view-pulse .line-chart svg text").evaluateAll(nodes => nodes.map(e => {
        const r = e.getBoundingClientRect(), svg = e.closest("svg")!.getBoundingClientRect();
        return { text: e.textContent, width: r.width, inside: r.left >= svg.left - 1 && r.right <= svg.right + 1, size: parseFloat(getComputedStyle(e).fontSize) * svg.width / e.closest("svg")!.viewBox.baseVal.width };
      }).filter(r => r.width > 0));
      expect(textos.length).toBeGreaterThan(20);
      expect(textos.filter(r => !r.inside || r.size < 11.9)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    } finally { await page.close(); }
  }, 60_000);

});
