import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type BrowserContext } from "playwright";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exigirBuild, subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";
let servidor: ServidorProducao;
beforeAll(async () => {
  if (!temBuild) { if (exigirBuild) throw new Error("Build obrigatório ausente"); return; }
  servidor = await subirServidor("menu-spa");
}, 90_000);
afterAll(async () => { await servidor?.parar(); });
describe.skipIf(!temBuild && !exigirBuild)("Menu da SPA: contenção com preferência nativa de fonte", () => {
  it.each([16,32])("fonte %i: menu, glifos e foco cabem após abrir e redimensionar", async fonte => {
    const profile = mkdtempSync(join(tmpdir(),"scrutiniums-menu-native-"));
    mkdirSync(join(profile,"Default"));
    writeFileSync(join(profile,"Default","Preferences"), JSON.stringify({webkit:{webprefs:{default_font_size:fonte,default_fixed_font_size:fonte===16?13:26}}}));
    let context: BrowserContext | undefined;
    try {
      context = await chromium.launchPersistentContext(profile,{channel:"chromium",executablePath:process.env.I18N_CHROMIUM_EXECUTABLE,viewport:{width:1440,height:1000},reducedMotion:"reduce"});
      await context.addCookies([{name:"scrutiniums_session",value:servidor.cookie,url:servidor.origem}]);
      const page = await context.newPage(), erros: string[] = [];
      page.on("pageerror", e => erros.push(e.message));
      await page.goto(servidor.origem + "/observatorio/credit");
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe(fonte+"px");
      const summary = page.locator("#obsTrocar > summary"), menu = page.locator("#obsTrocar > .obs-trocar-menu");
      await summary.focus(); await page.keyboard.press("Enter");
      const destinos = await menu.locator("a").evaluateAll(as => as.map(a => a.getAttribute("href")));
      for (const width of [1440,768,390,320,1440]) {
        await page.setViewportSize({width,height:1000});
        await expect.poll(() => menu.evaluate(e => {
          const b=e.getBoundingClientRect();
          return (e.parentElement as HTMLDetailsElement).open && b.width>0 && b.left>=0 && b.right<=document.documentElement.clientWidth+1;
        })).toBe(true);
        const pos = await menu.evaluate(e => {
          const b=e.getBoundingClientRect(), s=e.parentElement!.querySelector("summary")!.getBoundingClientRect();
          return {left:b.left,top:b.top,anchor:s.left,bottom:s.bottom};
        });
        expect(pos.top).toBeGreaterThanOrEqual(pos.bottom-1);
        if(width===1440)expect(Math.abs(pos.left-pos.anchor)).toBeLessThan(1);
        await menu.locator("a").last().focus();
        expect(await menu.locator("a").last().evaluate(e => {
          const r=e.getBoundingClientRect(), c=getComputedStyle(e), o=parseFloat(c.outlineWidth)||0;
          return e===document.activeElement && r.left-o>=0 && r.right+o<=document.documentElement.clientWidth+1 && r.top>=0 && r.bottom<=innerHeight;
        })).toBe(true);
        const fora = await menu.evaluate(e => {
          const limite=e.getBoundingClientRect(), erros: string[]=[];
          const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let no:Node|null;
          while((no=walker.nextNode())){
            if(!no.textContent?.trim()||no.parentElement?.closest(".sr-only"))continue;
            const range=document.createRange();range.selectNodeContents(no);
            for(const r of range.getClientRects())if(r.width>0&&(r.left<limite.left-1||r.right>limite.right+1))erros.push(no.textContent);
          }return erros;
        });
        expect(fora).toEqual([]);
        expect(await menu.locator("a").evaluateAll(as => as.map(a => a.getAttribute("href")))).toEqual(destinos);
      }
      await page.keyboard.press("Escape");
      expect(await page.locator("#obsTrocar").getAttribute("open")).toBeNull();
      expect(await summary.evaluate(e => e===document.activeElement)).toBe(true);
      await page.keyboard.press("Enter");
      await menu.locator('a[href="/observatorio/pix"]').click();
      await page.waitForURL(/\/observatorio\/pix$/);
      expect(erros).toEqual([]);
    } finally { await context?.close(); rmSync(profile,{recursive:true,force:true}); }
  }, 90_000);
});
