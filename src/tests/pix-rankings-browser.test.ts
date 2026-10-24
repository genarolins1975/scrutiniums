import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import { subirServidor, temBuild, exigirBuild, type ServidorProducao } from "./suporte/servidor-producao";

const gold=JSON.parse(readFileSync('public/obs/data/gold/pix.json','utf8')) as {epae:{setores:Array<{setor:string;v:number}>}};
let servidor:ServidorProducao;
beforeAll(async()=>{if(temBuild||exigirBuild) servidor=await subirServidor('pix-rankings');},90_000);
afterAll(async()=>{await servidor?.parar();});

describe.skipIf(!temBuild&&!exigirBuild)('Pix: identificação integral nos rankings',()=>{
  it.each([16,32])('separa nomes e medidas com fonte nativa de %ipx nas quatro larguras',async fonte=>{
    const profile=mkdtempSync(tmpdir()+'/pix-rankings-');mkdirSync(profile+'/Default');
    writeFileSync(profile+'/Default/Preferences',JSON.stringify({webkit:{webprefs:{default_font_size:fonte,default_fixed_font_size:fonte===16?13:26}}}));
    const context=await chromium.launchPersistentContext(profile,{executablePath:process.env.I18N_CHROMIUM_EXECUTABLE,headless:true,reducedMotion:'reduce'});
    await context.addCookies([{name:'scrutiniums_session',value:servidor.cookie,url:servidor.origem}]);
    const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    let referencia:Array<{nome:string;medidas:string;escala:string}>|undefined;
    try{
      for(const width of [1440,768,390,320]){
        await page.setViewportSize({width,height:900});await page.goto(servidor.origem+'/observatorio/pix');
        await page.locator('#view-pix .panbar').first().waitFor();await page.evaluate(()=>document.fonts.ready);
        expect(await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize))).toBe(fonte);
        const bars=page.locator('#view-pix .panbar');
        const medidas=await bars.evaluateAll(nodes=>nodes.map(n=>{
          const spans=n.querySelectorAll(':scope > span'),label=spans[0],value=spans[spans.length-1],track=n.querySelector('.track')!;
          const a=label.getBoundingClientRect(),b=value.getBoundingClientRect(),t=track.getBoundingClientRect(),r=n.getBoundingClientRect();
          const l=document.createRange(),v=document.createRange();l.selectNodeContents(label);v.selectNodeContents(value);
          const lt=l.getBoundingClientRect(),vt=v.getBoundingClientRect();
          return {nome:label.textContent!,medidas:value.textContent!,escala:(track.querySelector('.fill') as HTMLElement|null)?.style.width||'',
            integral:lt.left>=r.left-1&&lt.right<=r.right+1&&vt.left>=r.left-1&&vt.right<=r.right+1,
            separado:(a.bottom<=b.top||a.right<=b.left)&&Math.max(a.bottom,b.bottom)<=t.top,compacto:a.right<=b.left&&a.top<b.bottom&&b.top<a.bottom,largura:t.width,externo:r.left<0||r.right>innerWidth+1};
        }));
        expect(medidas.length).toBeGreaterThan(30);
        if(fonte===16&&width===1440)expect(medidas.some(m=>m.compacto)).toBe(true);
        expect(medidas.filter(m=>!m.integral||!m.separado||m.externo)).toEqual([]);
        const conteudo=medidas.map(({nome,medidas,escala})=>({nome,medidas,escala}));
        if(!referencia)referencia=conteudo;else expect(conteudo).toEqual(referencia);
        const ranking=page.locator('#px-epae .card').filter({has:page.getByRole('heading',{name:'Setores que mais recebem via Pix',exact:true})});
        const nomes=await ranking.locator('.panbar > span:first-child').allTextContents();
        const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        expect(nomes.map(norm)).toEqual(gold.epae.setores.slice(0,14).map(s=>norm(s.setor)));
        const escalas=await ranking.locator('.panbar .fill').evaluateAll(nodes=>nodes.map(n=>parseFloat((n as HTMLElement).style.width)));
        const max=Math.max(...gold.epae.setores.map(s=>s.v));
        escalas.forEach((p,i)=>expect(p).toBeCloseTo(gold.epae.setores[i].v/max*100,3));
        const widths=await ranking.locator('.panbar .track').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));
        expect(Math.max(...widths)-Math.min(...widths)).toBeLessThanOrEqual(1);
      }
      // O ranking continua sendo um controle por teclado, além da leitura visual.
      const ranking=page.locator('#px-epae .card').filter({has:page.getByRole('heading',{name:'Setores que mais recebem via Pix',exact:true})});
      const alvo=ranking.locator('[role="button"]').nth(2);await alvo.focus();await page.keyboard.press('Enter');
      await expect.poll(()=>new URL(page.url()).searchParams.get('xsetor')).toBe(gold.epae.setores[2].setor);
      expect(await ranking.locator('[role="button"]').nth(2).evaluate(e=>e===document.activeElement)).toBe(true);
      const familias=page.locator('#px-epae .card').filter({has:page.locator('h4',{hasText:'O que as famílias pagam a cada setor'})});
      const detalhe=familias.locator('[role="button"]').nth(1);const acao=await detalhe.getAttribute('onclick');
      await detalhe.focus();await page.keyboard.press('Space');
      await expect.poll(()=>new URL(page.url()).searchParams.get('xsetorTE')).not.toBeNull();
      expect(await familias.locator('[role="button"]').nth(1).getAttribute('onclick')).toBe(acao);
      expect(await familias.locator('[role="button"]').nth(1).evaluate(e=>e===document.activeElement)).toBe(true);
      expect(errors).toEqual([]);
    }finally{await context.close();rmSync(profile,{recursive:true,force:true});}
  },120_000);
});
