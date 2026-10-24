import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type BrowserContext, type Page, type Locator } from "playwright";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exigirBuild, subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";
let servidor: ServidorProducao;
beforeAll(async () => {
  if (!temBuild) { if (exigirBuild) throw new Error("Build obrigatório ausente"); return; }
  servidor = await subirServidor("identidade-series");
}, 90_000);
afterAll(async () => { await servidor?.parar(); });
const larguras = [320,390,768,1440];
async function comFonte(fonte: number, tarefa: (page: Page) => Promise<void>) {
  const perfil=mkdtempSync(join(tmpdir(),"identidade-series-"));
  mkdirSync(join(perfil,"Default"));
  writeFileSync(join(perfil,"Default","Preferences"),JSON.stringify({webkit:{webprefs:{default_font_size:fonte,default_fixed_font_size:fonte===16?13:26}}}));
  let contexto: BrowserContext | undefined;
  try {
    contexto=await chromium.launchPersistentContext(perfil,{channel:"chromium",executablePath:process.env.I18N_CHROMIUM_EXECUTABLE,viewport:{width:320,height:1000},hasTouch:true,reducedMotion:"reduce"});
    await contexto.addCookies([{name:"scrutiniums_session",value:servidor.cookie,url:servidor.origem}]);
    const page=await contexto.newPage(),erros: string[]=[];
    page.on("pageerror",e=>erros.push(e.message));
    await tarefa(page);
    expect(erros).toEqual([]);
  } finally { await contexto?.close();rmSync(perfil,{recursive:true,force:true}); }
}
async function pronto(page: Page, rota: string, alvo: string, fonte: number) {
  await page.goto(servidor.origem+rota);
  await page.locator(alvo).first().waitFor();
  await page.evaluate(()=>document.fonts.ready);
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize)).toBe(fonte+"px");
}
async function glifosIntegrais(alvos: Locator) {
  return alvos.evaluateAll(nos=>nos.flatMap(e=>{
    const b=e.getBoundingClientRect(),falhas: string[]=[];
    const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let no:Node|null;
    while((no=walker.nextNode())){
      if(!no.textContent?.trim()||no.parentElement?.closest(".sr-only"))continue;
      const range=document.createRange();range.selectNodeContents(no);
      for(const r of range.getClientRects())if(r.width>0&&(r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1))falhas.push(no.textContent);
    }return falhas;
  }));
}
type SerieGold = {meta:{name:string};obs:Array<{ref:string;v:number|null}>};
const pulse=JSON.parse(readFileSync("public/obs/data/gold/pulse.json","utf8")) as {series:Record<string,SerieGold>};
const exposicoes=JSON.parse(readFileSync("public/obs/data/gold/exposures.json","utf8")) as {ranking_pme:Array<{nome:string;cod_inst:string;pme_share_pct:number;carteira_pj_brl:number}>};
type Chart = {xs:string[];series:Array<{label:string;vals:Array<number|null>}>;band:unknown};
async function payload(card: Locator): Promise<Chart> {
  return card.locator("svg[data-chart]").evaluate(e=>JSON.parse(decodeURIComponent(e.getAttribute("data-chart")!)));
}
async function baixar(page: Page, botao: Locator) {
  const download=page.waitForEvent("download");await botao.click();
  return readFileSync((await (await download).path())!,"utf8").replace(/^\uFEFF/,"").trim();
}
describe.skipIf(!temBuild&&!exigirBuild)("Identidades completas de séries e instituições",()=>{
  it.each([16,32])("fonte nativa%i: comparador conserva identidade, foco lógico, valores e CSV",async fonte=>{
    await comFonte(fonte,async page=>{
      let referencia: string|undefined,csvReferencia: string|undefined;
      for(const width of larguras){
        await page.setViewportSize({width,height:1000});
        await pronto(page,"/observatorio/credit",".pulse-comparador select",fonte);
        const card=page.locator(".pulse-comparador"),selects=card.locator("select");
        expect(await selects.count()).toBe(3);
        for(let i=0;i<3;i++){
          const select=selects.nth(i);
          const options=await select.locator('option[value]:not([value=""])').evaluateAll(os=>os.map(o=>({key:(o as HTMLOptionElement).value,text:o.textContent})));
          expect(options).toEqual(Object.entries(pulse.series).map(([key,s])=>({key,text:s.meta.name})));
          await select.focus();const anterior=await select.inputValue();
          await page.keyboard.press("ArrowDown");await page.keyboard.press("Enter");
          await expect.poll(()=>select.inputValue()).not.toBe(anterior);
          expect(await select.evaluate(e=>e===document.activeElement)).toBe(true);
          const selected=await select.inputValue();
          expect(await card.locator('#'+await select.getAttribute("aria-describedby")).textContent()).toBe(pulse.series[selected].meta.name);
          await page.keyboard.press("Tab");
          const proximo=i<2?selects.nth(i+1):card.locator('.seg button').first();
          expect(await proximo.evaluate(e=>e===document.activeElement)).toBe(true);
        }
        for(const [i,key]of ["saldo_total","inad_total",""].entries()){
          await selects.nth(i).focus();await selects.nth(i).selectOption(key);
        }
        const keys=["saldo_total","inad_total"],names=keys.map(k=>pulse.series[k].meta.name);
        await expect.poll(async()=>(await payload(card)).series.map(s=>s.label)).toEqual(names);
        expect(await card.locator(".legend > span").allTextContents()).toEqual(names);
        expect(await glifosIntegrais(card.locator(".legend > span,.pulse-cmp-nome"))).toEqual([]);
        const d=await payload(card);
        for(let j=0;j<keys.length;j++){
          const obs=pulse.series[keys[j]].obs.filter(o=>d.xs.includes(o.ref));
          const base=obs.find(o=>o.v!=null)!.v!;
          for(let i=0;i<d.xs.length;i++){
            const p=obs.find(o=>o.ref===d.xs[i]);
            if(!p||p.v==null)expect(d.series[j].vals[i]).toBeNull();
            else expect(d.series[j].vals[i]).toBeCloseTo(p.v/base*100,8);
          }
        }
        const data=JSON.stringify({xs:d.xs,vals:d.series.map(s=>s.vals),band:d.band});
        if(referencia===undefined)referencia=data;else expect(data).toBe(referencia);
        await card.locator(".charttable summary").click();
        expect((await card.locator(".charttable thead th").allTextContents()).slice(1)).toEqual(names);
        expect(await card.locator(".charttable tbody tr").count()).toBe(d.xs.length);
        const svg=card.locator("svg[data-chart]");await svg.focus();await page.keyboard.press("ArrowRight");
        await expect.poll(()=>page.locator("#tooltip .tt-lbl").allTextContents()).toEqual(names);
        const csv=await baixar(page,card.locator('button[onclick="pulseCmpCSV()"]'));
        if(csvReferencia===undefined)csvReferencia=csv;else expect(csv).toBe(csvReferencia);
        const rows=csv.split(/\r?\n/).map(r=>r.split(";"));
        expect(rows[0]).toEqual(["ref",...keys]);expect(rows.length-1).toBe(d.xs.length);
        for(let i=0;i<d.xs.length;i++){
          expect(rows[i+1][0]).toBe(d.xs[i]);
          for(let j=0;j<keys.length;j++){
            const v=d.series[j].vals[i];if(v==null)expect(rows[i+1][j+1]).toBe("");else expect(Math.abs(Number(rows[i+1][j+1])-v)).toBeLessThanOrEqual(.000501);
          }
        }
        for(const key of["saldo_pf","saldo_pj"]){
          await selects.first().focus();await selects.first().selectOption(key);
          expect(await card.locator(".pulse-cmp-nome").first().textContent()).toBe(pulse.series[key].meta.name);
          expect((await payload(card)).series[0].label).toBe(pulse.series[key].meta.name);
        }
      }
    });
  },180_000);
  it.each([16,32])("fonte nativa%i: rankingMPE exibe as dez identidades completas do gold",async fonte=>{
    await comFonte(fonte,async page=>{
      // Contexto novo: Setores é a primeira entrada, sem cache ou visita a Instituições.
      const chunks:string[]=[];
      page.on('request',request=>{if(request.url().includes('/obs/app-emergentes.min.js'))chunks.push(request.url());});
      const esperado=exposicoes.ranking_pme.slice(0,10);let referencia:string|undefined;
      for(const width of larguras){
        await page.setViewportSize({width,height:1000});
        await pronto(page,"/observatorio/sectors",".exposicao-ranking-pme .contrib",fonte);
        const rows=page.locator(".exposicao-ranking-pme .contrib");
        expect(await rows.locator(":scope > .lbl").allTextContents()).toEqual(esperado.map(x=>x.nome));
        const medidas=await rows.evaluateAll(ns=>ns.map(n=>({texto:n.querySelector('.num')!.textContent,l:n.querySelector<HTMLElement>('.bar')!.style.width,carteira:n.querySelector('.num .src')!.textContent})));
        expect(medidas.map(m=>Number.parseFloat(m.l))).toEqual(esperado.map(x=>x.pme_share_pct));
        expect(medidas.map(m=>Number.parseFloat(m.texto!.replace(',', '.')))).toEqual(esperado.map(x=>x.pme_share_pct));
        for(const [i,m]of medidas.entries()){
          const monetario=m.carteira!.match(/R\$\s*([\d.,]+)\s*(tri|bi|mi)?/)!;
          expect(monetario).not.toBeNull();
          const escala=monetario[2]==='tri'?1e12:monetario[2]==='bi'?1e9:monetario[2]==='mi'?1e6:1;
          const mostrado=Number(monetario[1].replace(/\./g,'').replace(',','.'));
          expect(Math.abs(mostrado-esperado[i].carteira_pj_brl/escala)).toBeLessThanOrEqual(escala===1?.500001:.050001);
        }
        expect(new Set(await rows.locator(":scope > .lbl").allTextContents()).size).toBe(new Set(esperado.map(x=>x.nome)).size);
        const atual=JSON.stringify(medidas);if(referencia===undefined)referencia=atual;else expect(atual).toBe(referencia);
        expect(await glifosIntegrais(rows.locator(":scope > .lbl,:scope > .num"))).toEqual([]);
        expect(chunks, 'Setores frio não deve carregar emergentes para identificar credores').toEqual([]);
      }
    });
  },120_000);
  it.each([16,32])("fonte nativa%i: credores e composiçãoCNAE/modalidades conservam identificação integral",async fonte=>{
    const ex=JSON.parse(readFileSync("public/obs/data/gold/exposures.json","utf8")) as {setores:Record<string,{top_volume:Array<{nome:string}>;top_exposicao_relativa:Array<{nome:string}>}>};
    const institutions=JSON.parse(readFileSync("public/obs/data/gold/institutions.json","utf8")) as {instituicoes:Array<{cod_inst:string;carteira_perfil?:{top_cnae?:Array<[string,number]>;top_mod_pf?:Array<[string,number]>;top_mod_pj?:Array<[string,number]>}}>};
    const alvo=institutions.instituicoes.find(i=>i.carteira_perfil?.top_cnae?.some(([k])=>k.length>32))!;
    const normaliza=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const grupos:string[]=[];
    const explorar=(v:unknown)=>{if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(explorar);return;}const obj=v as Record<string,unknown>;if(typeof obj.grupo==='string')grupos.push(obj.grupo);Object.values(obj).forEach(explorar);};
    explorar(JSON.parse(readFileSync("public/obs/data/gold/explorer.json","utf8")));
    await comFonte(fonte,async page=>{
      for(const width of larguras){
        await page.setViewportSize({width,height:1000});
        await pronto(page,"/observatorio/sectors","#sec-exposicoes table",fonte);
        const texto=await page.locator('#sec-exposicoes > .tblwrap').innerText();
        for(const setor of Object.values(ex.setores))for(const pessoa of [...setor.top_volume.slice(0,3),...setor.top_exposicao_relativa.slice(0,3)])expect(texto).toContain(pessoa.nome);
        await pronto(page,"/observatorio/institutions","details[data-inst]",fonte);
        const detalhe=page.locator(`details[data-inst="${alvo.cod_inst}"]`);
        await detalhe.locator('summary').click();
        await expect.poll(()=>detalhe.locator('.lazy').count()).toBe(0);
        const corpo=normaliza(await detalhe.innerText());
        for(const [k]of alvo.carteira_perfil!.top_cnae||[]){
          if(k==='outros')continue;
          const completo=grupos.find(g=>normaliza(g).startsWith(normaliza(k)))||k.replace(/_/g,' ');
          expect(corpo).toContain(normaliza(completo));
        }
        for(const [k]of [...(alvo.carteira_perfil!.top_mod_pf||[]),...(alvo.carteira_perfil!.top_mod_pj||[])])expect(corpo).toContain(normaliza(k));
      }
    });
  },180_000);

});
