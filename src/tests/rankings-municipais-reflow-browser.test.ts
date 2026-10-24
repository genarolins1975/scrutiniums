import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type BrowserContext, type Page, type Locator } from "playwright";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exigirBuild, subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";
let servidor: ServidorProducao;
beforeAll(async () => {
  if (!temBuild) { if (exigirBuild) throw new Error("Build obrigatório ausente"); return; }
  servidor = await subirServidor("rankings-municipais");
}, 90_000);
afterAll(async () => { await servidor?.parar(); });
const larguras = [320,390,768,1440];
async function comFonte(fonte: number, tarefa: (page: Page) => Promise<void>) {
  const perfil=mkdtempSync(join(tmpdir(),"rankings-municipais-"));
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
type Municipio={c?:string;cod?:string;n?:string;nome?:string;uf:string;p60?:number;pgp?:number;penetracao?:number;valor_hab?:number};
const rotas=[
  {rota:"payroll-lending-aging",gold:"consignado_mun",root:"#view-consignado",perfil:"#cg-perfil",campo:"p60",dec:1,moeda:false,asc:false},
  {rota:"credit-penetration",gold:"penetracao_mun",root:"#view-penetracao",perfil:"#pen-perfil",campo:"penetracao",dec:1,moeda:false,asc:true},
  {rota:"housing-credit",gold:"moradia_mun",root:"#view-moradia",perfil:".morperfil",campo:"pgp",dec:1,moeda:false,asc:false},
  {rota:"rural-credit",gold:"rural_mun",root:"#view-rural",perfil:"#ru-perfil",campo:"valor_hab",dec:0,moeda:true,asc:false},
] as const;
const casos=rotas.flatMap(rota=>[16,32].map(fonte=>({...rota,fonte})));
async function medirRanking(lista: Locator) {
  return lista.locator('button').evaluateAll(bs=>bs.map(b=>{
    const name=b.querySelector('.n')!,value=b.querySelector('.v')!,n=name.getBoundingClientRect(),v=value.getBoundingClientRect(),r=b.getBoundingClientRect(),p=b.closest('.penlista')!.getBoundingClientRect();
    return {codigo:b.getAttribute('onclick')!.match(/\('([^']+)'\)/)![1],nome:name.textContent,valor:value.textContent,acao:b.getAttribute('onclick'),aria:b.getAttribute('aria-label'),
      sobreposto:Math.min(n.right,v.right)-Math.max(n.left,v.left)>1&&Math.min(n.bottom,v.bottom)-Math.max(n.top,v.top)>1,
      externo:r.left<p.left-1||r.right>p.right+1||r.left<0||r.right>innerWidth+1};
  }));
}
describe.skipIf(!temBuild&&!exigirBuild)("Rankings municipais: identidade, reflow e seleção real",()=>{
  it.each(casos)("$rota: fonte nativa$fonte nas quatro larguras",async caso=>{
    const municipios=(JSON.parse(readFileSync(`public/obs/data/gold/${caso.gold}.json`,"utf8")) as {municipios:Municipio[]}).municipios;
    const porCodigo=new Map(municipios.map(m=>[m.c||m.cod,m]));
    await comFonte(caso.fonte,async page=>{
      let referencia:string|undefined;
      for(const width of larguras){
        await page.setViewportSize({width,height:1000});
        await pronto(page,"/observatorio/"+caso.rota,caso.root+" .penlista button",caso.fonte);
        const lista=page.locator(caso.root+" .penlista").first();
        const atual=await medirRanking(lista);
        expect(atual.length).toBeGreaterThan(5);
        expect(atual.filter(x=>x.sobreposto||x.externo)).toEqual([]);
        expect(await glifosIntegrais(lista.locator('button'))).toEqual([]);
        const valores:number[]=[];
        for(const row of atual){
          const m=porCodigo.get(row.codigo)!;expect(m).toBeDefined();
          expect(row.nome).toBe((m.n||m.nome)+m.uf);
          const valor=m[caso.campo]!;valores.push(valor);
          const numero=caso.dec===0?Math.round(valor).toLocaleString('pt-BR'):valor.toLocaleString('pt-BR',{minimumFractionDigits:caso.dec,maximumFractionDigits:caso.dec});
          expect(row.valor).toBe(caso.moeda?'R$ '+numero:numero+'%');
        }
        expect(valores).toEqual([...valores].sort((a,b)=>caso.asc?a-b:b-a));
        const dados=JSON.stringify(atual.map(({codigo,nome,valor,acao,aria})=>({codigo,nome,valor,acao,aria})));
        if(referencia===undefined)referencia=dados;else expect(dados).toBe(referencia);
        const ativar=async(index:number,tecla:'Enter'|'Space'|'touch')=>{
          const registro=atual[index],botao=lista.locator('button').nth(index);
          await botao.scrollIntoViewIfNeeded();await botao.focus();
          expect(await botao.evaluate(e=>e===document.activeElement)).toBe(true);
          const focoAntes=await botao.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),o=parseFloat(s.outlineWidth)||0;return {visivel:r.left-o>=-1&&r.right+o<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1,outline:o};});
          expect(focoAntes.visivel).toBe(true);expect(focoAntes.outline).toBeGreaterThan(0);
          if(tecla==='touch')await botao.tap();else await page.keyboard.press(tecla);
          await expect.poll(()=>lista.locator('li.sel button').getAttribute('onclick')).toBe(registro.acao);
          const nome=porCodigo.get(registro.codigo)!.n||porCodigo.get(registro.codigo)!.nome!;
          const perfil=page.locator(caso.root+' '+caso.perfil).first();
          await expect.poll(()=>perfil.textContent()).toContain(nome);
          // A ativação pode conservar o botão ou mover o foco para o perfil nomeado.
          // BODY sem destino lógico interrompe a continuação pelo teclado.
          const focoDepois=await page.waitForFunction(({root,perfil,acao})=>{
            const e=document.activeElement as HTMLElement|null;
            if(!e||e===document.body)return false;
            const destino=document.querySelector(root+' '+perfil);
            const r=e.getBoundingClientRect();
            return (e.getAttribute('onclick')===acao||!!destino?.contains(e))&&r.width>0&&r.height>0;
          },{root:caso.root,perfil:caso.perfil,acao:registro.acao},{timeout:2000}).then(async handle=>{await handle.dispose();return true;},()=>false);
          expect.soft(focoDepois,`${caso.rota} ${width}px/${caso.fonte}px ${tecla}: foco deve permanecer lógico após seleção`).toBe(true);
          expect((await medirRanking(lista)).map(({codigo,nome,valor})=>({codigo,nome,valor}))).toEqual(atual.map(({codigo,nome,valor})=>({codigo,nome,valor})));
        };
        await ativar(0,'Enter');await ativar(1,'Space');
        if(width<500)await ativar(atual.length-1,'touch');
        const largura=await page.evaluate(()=>({documento:document.documentElement.scrollWidth,viewport:innerWidth}));
        expect(largura.documento<=largura.viewport+1,`${caso.rota} ${width}px/${caso.fonte}px após seleção: documento=${largura.documento}px, viewport=${largura.viewport}px`).toBe(true);
      }
    });
  },240_000);
});
