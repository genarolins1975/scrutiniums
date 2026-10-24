import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { subirServidor, temBuild, exigirBuild, type ServidorProducao } from "./suporte/servidor-producao";

let servidor: ServidorProducao;
let navegador: Browser;
beforeAll(async () => {
  if (!temBuild) { if (exigirBuild) throw new Error("Build obrigatório ausente"); return; }
  servidor = await subirServidor("credito-historico");
  navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE });
}, 90_000);
afterAll(async () => { await navegador?.close(); await servidor?.parar(); });
const url = (page: Page) => page.evaluate(() => location.pathname + location.search + location.hash);
const tamanhoHistorico = (page: Page) => page.evaluate(() => history.length);
const pronta = async (page: Page) => {
  await page.locator('.view.active').waitFor();
  await expect.poll(() => page.getByRole('link', {name:'Minha conta',exact:true}).first().getAttribute('href')).toBe('/app/conta');
};

describe.skipIf(!temBuild && !exigirBuild)("Histórico entre a SPA de Crédito e a conta", () => {
  it.each(['credit','payroll-lending-aging','pix','sectors','subnational-credit','institutions'])("%s: link real, voltar e avançar preservam a entrada da conta", async route => {
    const context = await navegador.newContext({viewport:{width:390,height:844},hasTouch:true});
    await context.addCookies([{name:'scrutiniums_session',value:servidor.cookie,url:servidor.origem}]);
    const page = await context.newPage();
    try {
      await page.goto(servidor.origem+'/observatorio/'+route); await pronta(page);
      const origem = await url(page), inicial = await tamanhoHistorico(page);
      await page.getByRole('link',{name:'Minha conta',exact:true}).first().tap();
      await page.waitForURL('**/app/conta');
      expect(await tamanhoHistorico(page)).toBe(inicial+1);
      await page.goBack(); await pronta(page);
      expect(await url(page)).toBe(origem);
      expect(await tamanhoHistorico(page)).toBe(inicial+1);
      await page.goForward(); await page.waitForURL('**/app/conta');
      expect(await tamanhoHistorico(page)).toBe(inicial+1);
    } finally { await context.close(); }
  },90_000);

  it("recorte direto e reload preservam filtros sem criar entrada; navegação SPA cria uma entrada", async () => {
    const context = await navegador.newContext();
    await context.addCookies([{name:'scrutiniums_session',value:servidor.cookie,url:servidor.origem}]);
    const page=await context.newPage();
    try {
      await page.goto(servidor.origem+'/observatorio/credit?seg=pf&range=24&transf=yoy'); await pronta(page);
      const recorte=await url(page), inicial=await tamanhoHistorico(page);
      expect(new URL(page.url()).searchParams.get('seg')).toBe('pf');
      expect(new URL(page.url()).searchParams.get('range')).toBe('24');
      expect(new URL(page.url()).searchParams.get('transf')).toBe('yoy');
      await page.reload(); await pronta(page);
      expect(await url(page)).toBe(recorte); expect(await tamanhoHistorico(page)).toBe(inicial);
      // Navegação do próprio roteador, usada pelos controles analíticos.
      await page.evaluate(() => (window as unknown as Window & {nav: (v:string)=>void}).nav('pix'));
      await page.locator('#view-pix.active').waitFor();
      expect(await tamanhoHistorico(page)).toBe(inicial+1);
      const pix=await url(page);
      await page.goBack(); await page.locator('#view-pulse.active').waitFor(); expect(await url(page)).toBe(recorte);
      await page.goForward(); await page.locator('#view-pix.active').waitFor(); expect(await url(page)).toBe(pix);
      await page.reload(); await pronta(page); expect(await url(page)).toBe(pix); expect(await tamanhoHistorico(page)).toBe(inicial+1);
    } finally { await context.close(); }
  },90_000);

  it("alias aposentado e embed continuam usando a vista e o recorte canônicos", async () => {
    const context=await navegador.newContext();
    await context.addCookies([{name:'scrutiniums_session',value:servidor.cookie,url:servidor.origem}]);
    const page=await context.newPage();
    try {
      await page.goto(servidor.origem+'/observatorio/leading-indicators'); await pronta(page);
      expect(new URL(page.url()).pathname).toBe('/observatorio/leading-signals');
      expect(new URL(page.url()).searchParams.get('ltab')).toBe('protocolo');
      const inicial=await tamanhoHistorico(page); await page.reload(); await pronta(page);
      expect(await tamanhoHistorico(page)).toBe(inicial);
      await page.goto(servidor.origem+'/obs/embed.html?g=pulse.pu-saldo');
      await page.locator('#embAttr').waitFor();
      expect(await page.locator('body').evaluate(e=>e.classList.contains('embed'))).toBe(true);
      expect(await page.locator('#pu-saldo').isVisible()).toBe(true);
      expect(await page.locator('#embAttr a').getAttribute('href')).toContain('sec=pu-saldo');
    } finally { await context.close(); }
  },90_000);
});
