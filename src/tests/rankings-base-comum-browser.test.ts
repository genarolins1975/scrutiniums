import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type BrowserContext, type Page, type Locator } from "playwright";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exigirBuild, subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";
let servidor: ServidorProducao;
beforeAll(async () => {
  if (!temBuild) { if (exigirBuild) throw new Error("Build obrigatório ausente"); return; }
  servidor = await subirServidor("rankings-base");
}, 90_000);
afterAll(async () => { await servidor?.parar(); });
const larguras = [320,390,768,1440];
async function comFonte(fonte: number, tarefa: (page: Page) => Promise<void>) {
  const perfil=mkdtempSync(join(tmpdir(),"rankings-base-"));
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
type Item = {nome:string;share_valor_pct?:number;share_n_pct?:number;valor:number;n:number};
const sn=JSON.parse(readFileSync("public/obs/data/gold/subnacional.json","utf8")) as {credores_12m:Item[];credores_60m:Item[];finalidades_12m:Item[];status_12m:Item[]};
async function medirListas(page: Page, seletor: string) {
  return page.locator(seletor).evaluateAll(cards=>cards.map(card=>{
    const rows=[...card.querySelectorAll(".contrib")].filter(row=>row.querySelector(".bar"));
    const medidas=rows.map(row=>{
      const label=row.querySelector<HTMLElement>(".lbl")!,num=row.querySelector<HTMLElement>(".num")!,bar=row.querySelector<HTMLElement>(".bar")!;
      const l=label.getBoundingClientRect(),n=num.getBoundingClientRect(),b=bar.getBoundingClientRect(),r=row.getBoundingClientRect();
      return {nome:label.textContent,numero:num.textContent,largura:Number.parseFloat(bar.style.width),real:b.width,x:b.left,abaixo:b.top>=Math.max(l.bottom,n.bottom)-1,fora:b.left<r.left-1||b.right>r.right+1,cor:bar.className};
    });
    return {medidas,base:medidas.length?Math.max(...medidas.map(x=>x.x))-Math.min(...medidas.map(x=>x.x)):0};
  }).filter(c=>c.medidas.length));
}
async function csvAnual(page: Page) {
  const download=page.waitForEvent("download");await page.locator('button[onclick="snCSV()"]').click();
  return readFileSync((await (await download).path())!,"utf8");
}
describe.skipIf(!temBuild&&!exigirBuild)("Rankings com origem comum após reflow",()=>{
  it.each([16,32])("fonte nativa%i: bases, larguras, nomes, medidas eCSV permanecem consistentes",async fonte=>{
    await comFonte(fonte,async page=>{
      const snapshots=new Map<string,string>();let arraysReferencia:string|undefined,csvReferencia:string|undefined;
      for(const width of larguras){
        await page.setViewportSize({width,height:1000});
        await pronto(page,"/observatorio/subnational-credit","#sn-credores .contrib",fonte);
        const seletor=page.locator('#sn-credores select');
        for(const janela of["12m","60m"]){
          await seletor.focus();await seletor.selectOption(janela);
          const credores=janela==="12m"?sn.credores_12m:sn.credores_60m;
          await expect.poll(()=>page.locator('#sn-credores .card').first().locator('.contrib .lbl').allTextContents()).toEqual(credores.map(x=>x.nome));
          expect(await page.locator('#sn-credores .card').nth(1).locator('.contrib .lbl').allTextContents()).toEqual(sn.finalidades_12m.map(x=>x.nome));
          expect(await page.locator('#sn-funil .card').first().locator('.contrib .lbl').allTextContents()).toEqual(sn.status_12m.map(x=>x.nome));
          const selector='#sn-credores .card,#sn-funil .card,#sn-garantias .card';
          await expect.poll(async()=> (await medirListas(page,selector)).flatMap(g=>g.medidas.filter(m=>!m.abaixo||m.fora||Math.abs(m.real-m.largura)>1)).length).toBe(0);
          const grupos=await medirListas(page,selector);
          expect(grupos.length).toBeGreaterThanOrEqual(4);
          for(const grupo of grupos)expect(grupo.base).toBeLessThanOrEqual(1);
          expect(await glifosIntegrais(page.locator('#sn-credores .contrib > .lbl,#sn-credores .contrib > .num,#sn-funil .contrib > .lbl,#sn-funil .contrib > .num,#sn-garantias .contrib > .lbl,#sn-garantias .contrib > .num'))).toEqual([]);
          const dados=JSON.stringify(grupos.map(g=>g.medidas.map(({nome,numero,largura,cor})=>({nome,numero,largura,cor}))));
          if(!snapshots.has(janela))snapshots.set(janela,dados);else expect(dados).toBe(snapshots.get(janela));
        }
        const arrays=await page.locator('#view-subnacional svg[data-chart]').evaluateAll(svgs=>JSON.stringify(svgs.map(s=>{
          const d=JSON.parse(decodeURIComponent(s.getAttribute('data-chart')!));return {xs:d.xs,series:d.series,band:d.band};
        })));
        if(arraysReferencia===undefined)arraysReferencia=arrays;else expect(arrays).toBe(arraysReferencia);
        if(width===larguras[0]||width===larguras.at(-1)){
          const csv=await csvAnual(page);if(csvReferencia===undefined)csvReferencia=csv;else expect(csv).toBe(csvReferencia);
        }
        await pronto(page,"/observatorio/sectors",".exposicao-ranking-pme .contrib",fonte);
        const rank=await medirListas(page,'.exposicao-ranking-pme');
        expect(rank).toHaveLength(1);expect(rank[0].base).toBeLessThanOrEqual(1);
        expect(rank[0].medidas.filter(m=>!m.abaixo||m.fora||Math.abs(m.real-m.largura)>1)).toEqual([]);
        const dados=JSON.stringify(rank[0].medidas.map(({nome,numero,largura,cor})=>({nome,numero,largura,cor})));
        if(!snapshots.has('mpe'))snapshots.set('mpe',dados);else expect(dados).toBe(snapshots.get('mpe'));
      }
    });
  },180_000);
});
