import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { chromium, type Browser } from "playwright";
import { exigirBuild, subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";
import { ehRotaPublica } from "@/lib/rotasPublicas";

const fonte = readFileSync("public/obs/lucro-banco.js", "utf8");
const context = vm.createContext({});
vm.runInContext(fonte, context);
const modelo = context.LucroBanco;
const gold = JSON.parse(readFileSync("public/obs/data/gold/lucro_banco.json", "utf8"));

describe("contratos da apresentação de lucro", () => {
  it("cascata preserva sinais, começa em zero e não desenha lacunas", () => {
    const r = modelo.waterfall([{ valor: 100 }, { valor: -120 }], -20);
    expect(r.map((x: { inicio: number; fim: number }) => [x.inicio, x.fim])).toEqual([[0, 100], [100, -20], [0, -20]]);
    expect(modelo.waterfall([{ valor: null }], 0)).toEqual([]);
    expect(modelo.waterfall([{ valor: 0 }], 0)[0].tamanho).toBe(0);
  });
  it("simulação reduz lucro se atraso sobe e bloqueia bases inválidas", () => {
    expect(modelo.simular(80, -20, 10, 20, 100)).toBe(60);
    expect(modelo.simular(80, -20, 10, 0, 100)).toBe(100);
    expect(modelo.simular(80, -20, 0, 10, 100)).toBeNull();
    expect(modelo.simular(80, 20, 10, 20, 100)).toBeNull();
  });
  it("mediana par usa os dois centrais e conserva ausência", () => {
    expect(modelo.mediana([10, null, 20])).toBe(15);
    expect(modelo.mediana([])).toBeNull();
  });
  it("painel e gold exigem conta; aperitivo continua público", () => {
    expect(ehRotaPublica('/observatorio/bank-profit')).toBe(false);
    expect(ehRotaPublica('/obs/data/gold/lucro_banco.json')).toBe(false);
    expect(ehRotaPublica('/observatorio-do-credito')).toBe(true);
    expect(readFileSync('public/obs/app.js', 'utf8')).toContain('pageHead({ title: "De onde vem o lucro deste banco, e onde ele perde dinheiro?"');
    expect(gold.sistema.n).toBeGreaterThan(100);
    expect(gold.sistema.n).toBeLessThanOrEqual(gold.sistema.universo);
  });
});

let servidor: ServidorProducao, browser: Browser;
beforeAll(async () => {
  if (!temBuild) { if (exigirBuild) throw new Error("Build obrigatório ausente"); return; }
  servidor = await subirServidor("lucro-banco");
  browser = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE });
}, 90_000);
afterAll(async () => { await browser?.close(); await servidor?.parar(); });

describe.skipIf(!temBuild && !exigirBuild)("Lucro: navegação e interação reais", () => {
  it("troca banco e unidade, abre rubrica pelo teclado, simula sem mudar publicado e exporta fontes", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    try {
      await ctx.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem }]);
      const page = await ctx.newPage(), erros: string[] = [];
      page.on('pageerror', e => erros.push(e.message));
      await page.goto(servidor.origem + '/observatorio/bank-profit');
      await page.locator('.lb-waterfall').waitFor();
      expect(await page.locator('#lb-bank').inputValue()).toBe('C0080099');
      expect(await page.locator('.lb-comparison').textContent()).toContain('mediana dos pares');
      const inicio = await page.locator('.lb-profit strong').textContent();
      await page.locator('#lb-options summary').click();
      await page.locator('#lb-unit').selectOption('reais');
      expect(await page.locator('.lb-profit strong').textContent()).toBe(inicio);
      await page.locator('[data-step="0"]').focus();
      await page.keyboard.press('Enter');
      expect(await page.locator('#lb-detail').isVisible()).toBe(true);
      expect(await page.locator('#lb-detail').textContent()).toContain('141835');
      const sim = await page.locator('#lb-result').textContent();
      await page.locator('#lb-shock').focus();
      await page.keyboard.press('ArrowRight');
      expect(await page.locator('#lb-result').textContent()).not.toBe(sim);
      expect(await page.locator('.lb-profit strong').textContent()).toBe(inicio);
      await page.locator('.lb-method').last().locator(':scope > summary').click();
      const download = page.waitForEvent('download');
      await page.locator('#lb-download').click();
      const csv = readFileSync((await (await download).path())!, 'utf8');
      expect(csv).toContain('141840'); expect(csv).toContain('estoque em'); expect(csv).toContain('estimativa de modelo'); expect(csv).toContain('Simulação');
      await page.locator('#lb-bank').selectOption('C0080738');
      expect(await page.locator('.lb-profit strong').textContent()).not.toBe(inicio);
      await page.locator('#lb-bank').selectOption('sistema');
      await page.locator('#lb-window').selectOption('6');
      expect(await page.locator('.lb-lead').textContent()).toContain('6 meses');
      await page.locator('#lb-language').selectOption('en');
      expect(await page.locator('.lb-lead').textContent()).toContain('Reported net profit');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const semDre = gold.instituicoes.find((b: { lucro: number | null }) => b.lucro === null);
      if (semDre) {
        await page.locator('#lb-language').selectOption('pt');
        await page.locator('#lb-bank').selectOption(semDre.id);
        expect(await page.locator('.lb-waterfall').count()).toBe(0);
        expect(await page.locator('#lb-content').textContent()).toContain('Não publicado pelo IF.data nesta data-base');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await page.route('**/lucro_banco.json*', route => route.fulfill({ json: { instituicoes: [] } }));
      await page.reload();
      await expect.poll(() => page.locator('#view-lucro').textContent()).toContain('Dados indisponíveis');
      expect(await page.locator('.lb-waterfall').count()).toBe(0);
      expect(erros).toEqual([]);
    } finally { await ctx.close(); }
  }, 90_000);
  it("sem conta oferece aperitivo e mantém o painel protegido", async () => {
    const ctx = await browser.newContext();
    try {
      const page = await ctx.newPage();
      await page.goto(servidor.origem + '/observatorio-do-credito');
      expect(await page.locator('#aperitivo-lucro').textContent()).toContain('lucro dos bancos');
      await page.goto(servidor.origem + '/observatorio/bank-profit');
      expect(new URL(page.url()).pathname).toBe('/entrar');
    } finally { await ctx.close(); }
  }, 45_000);
});
