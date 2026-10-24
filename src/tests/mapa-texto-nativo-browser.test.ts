import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type BrowserContext, type Page } from "playwright";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { exigirBuild, subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";

let servidor: ServidorProducao;
beforeAll(async () => {
  if (!temBuild) { if (exigirBuild) throw new Error("Build obrigatório ausente"); return; }
  servidor = await subirServidor("mapa-texto-nativo");
}, 90_000);
afterAll(async () => { await servidor?.parar(); });

/** Mede os glifos efetivos: caixas sem overflow global também podem ter texto sobreposto. */
async function medirItens(page: Page) {
  return page.locator('[data-colecao]').evaluateAll(items => items.map(item => {
    const row = item.querySelector<HTMLElement>('[data-estado-colecao]')!;
    const metadata = row.tagName === 'SUMMARY' ? row.children[0] : row;
    const action = row.tagName === 'SUMMARY' ? row.children[1] : null;
    const bounds = metadata.getBoundingClientRect(), actionBounds = action?.getBoundingClientRect();
    const walker = document.createTreeWalker(metadata, NodeFilter.SHOW_TEXT);
    const violations: {kind:string;text:string;right:number;limit:number}[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.width < .1 || r.height < .1) continue;
        if (r.left < bounds.left-1 || r.right > bounds.right+1) violations.push({kind:'texto fora do metadado',text:node.textContent,right:r.right,limit:bounds.right});
        if (actionBounds && Math.min(r.right,actionBounds.right)-Math.max(r.left,actionBounds.left)>1 && Math.min(r.bottom,actionBounds.bottom)-Math.max(r.top,actionBounds.top)>1) violations.push({kind:'metadado sobre a ação',text:node.textContent,right:r.right,limit:actionBounds.left});
      }
    }
    if (actionBounds && (actionBounds.right>innerWidth+1 || actionBounds.left< -1)) violations.push({kind:'ação fora da tela',text:action?.textContent??'',right:actionBounds.right,limit:innerWidth});
    return {id:item.getAttribute('data-colecao'),metadata:metadata.textContent?.trim(),action:action?.textContent?.trim(),height:row.getBoundingClientRect().height,violations};
  }));
}

async function medirBusca(page: Page) {
  return page.locator('.bp-busca--pagina').evaluate(e => ({
    width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
    rects:[e,...e.querySelectorAll('.bp-busca-caixa,.bp-busca-form,input,.bp-busca-painel')]
      .filter(q=>!(q as HTMLElement).hidden&&q.getBoundingClientRect().width>0)
      .map(q=>{const r=q.getBoundingClientRect();return {class:q.className,x:r.x,right:r.right};}),
  }));
}

const cases = [16,32].flatMap(font => [320,390,768,1440].map(width => ({font,width})));
describe.skipIf(!temBuild && !exigirBuild)("Mapa: preferência nativa de fonte, busca e metadados", () => {
  it.each(cases)("fonte $font px e viewport $width px: todas as coleções e popup sem colisões", async ({font,width}) => {
    const profile=mkdtempSync(join(tmpdir(),'scrutiniums-mapa-native-'));
    mkdirSync(join(profile,'Default'));
    writeFileSync(join(profile,'Default','Preferences'),JSON.stringify({webkit:{webprefs:{default_font_size:font,default_fixed_font_size:font===16?13:26}}}));
    let context: BrowserContext | undefined;
    try {
      context=await chromium.launchPersistentContext(profile,{executablePath:process.env.I18N_CHROMIUM_EXECUTABLE,viewport:{width,height:900},reducedMotion:'reduce'});
      await context.addCookies([{name:'scrutiniums_session',value:servidor.cookie,url:servidor.origem}]);
      const page=await context.newPage();await page.goto(servidor.origem+'/app/observatorios',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(()=>Object.keys(document.querySelector('.bp-busca--pagina')??{}).some(k=>k.startsWith('__reactFiber$')));
      const root=await page.evaluate(()=>({font:getComputedStyle(document.documentElement).fontSize,zoom:getComputedStyle(document.documentElement).zoom,dpr:devicePixelRatio}));
      expect(root).toEqual({font:font+'px',zoom:'1',dpr:1});
      const expected=OBSERVATORIOS.flatMap(o=>o.colecoes.map(c=>c.id)).sort();
      const closed=await medirItens(page);expect(closed.map(c=>c.id).sort()).toEqual(expected);
      expect(closed.filter(c=>!c.metadata||c.violations.length||c.height<44)).toEqual([]);
      const summaries=page.locator('[data-colecao] summary[data-estado-colecao]');
      for (let i=0;i<await summaries.count();i++) {
        const summary=summaries.nth(i),id=await summary.evaluate(e=>e.closest('[data-colecao]')?.getAttribute('data-colecao'));
        await summary.press('Enter');expect(await summary.evaluate(e=>(e.parentElement as HTMLDetailsElement).open)).toBe(true);
        const opened=(await medirItens(page)).find(c=>c.id===id)!;expect(opened.violations,JSON.stringify(opened)).toEqual([]);
        expect(await summary.evaluate(e=>e===document.activeElement)).toBe(true);
        await summary.press('Space');expect(await summary.evaluate(e=>(e.parentElement as HTMLDetailsElement).open)).toBe(false);
      }
      const input=page.locator('.bp-busca--pagina input[type=search]');await input.fill('saneamento');await page.locator('.bp-busca--pagina [role=option]').first().waitFor();await input.press('ArrowDown');expect(await input.getAttribute('aria-activedescendant')).toBeTruthy();
      const search=await medirBusca(page);expect(search.scrollWidth).toBeLessThanOrEqual(width+1);expect(search.rects.filter(r=>r.x< -1||r.right>width+1)).toEqual([]);
      expect(await input.evaluate(e=>e===document.activeElement)).toBe(true);await input.press('Escape');expect(await input.getAttribute('aria-expanded')).toBe('false');
      expect(new URL(page.url()).searchParams.get('q')).toBe('saneamento');await page.reload({waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await expect.poll(()=>input.inputValue()).toBe('saneamento');
      const reloaded=await medirBusca(page);expect(reloaded.rects.filter(r=>r.x< -1||r.right>width+1)).toEqual([]);
    } finally {await context?.close();rmSync(profile,{recursive:true,force:true});}
  },120_000);
});
