import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { chromium, type BrowserContext } from 'playwright';
import { subirServidor, temBuild, exigirBuild, type ServidorProducao } from './suporte/servidor-producao';

type Mecanismo={variavel:string;com_consignado_por_60:number;com_peso:number;leitura:string};
type Especificacao={rotulo:string;r:number;obs:string};
const consignado=JSON.parse(readFileSync('public/obs/data/gold/consignado.json','utf8')) as {
  gerado_em:string;sgs:{data_base:string;atual:{inss:{taxa:number;icc:number;inad:number;prazo_conc:number};total:{taxa:number}}};
  circularidade:{especificacoes:Especificacao[];correlacao_mecanica:number;mecanismo:{testados:Mecanismo[]}};
};
const qualidade=JSON.parse(readFileSync('public/obs/data/gold/quality.json','utf8')) as Record<string,{ultima_ref:string}>;
const config=JSON.parse(readFileSync('config/config.json','utf8')) as {sgs_series:Array<{key:string;code:number;url:string}>};
const pix=JSON.parse(readFileSync('public/obs/data/gold/pix.json','utf8')) as {mes_tx:string;natureza:{atual:Array<{k:string;q:number;part_q:number;t:number}>}};
const n=(v:number,casas:number)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:casas,maximumFractionDigits:casas}).format(v);
const mes=(ref:string)=>new Intl.DateTimeFormat('pt-BR',{month:'short',timeZone:'UTC'}).format(new Date(ref.slice(0,7)+'-01T12:00:00Z')).replace(/\.$/,'')+'/'+ref.slice(0,4);
const texto=(s:string|null)=>s?.replace(/\s+/g,' ').trim()||'';
let servidor:ServidorProducao;
beforeAll(async()=>{if(temBuild||exigirBuild)servidor=await subirServidor('credito-leitura');},90_000);
afterAll(async()=>{await servidor?.parar();});
async function autenticar(context:BrowserContext){await context.addCookies([{name:'scrutiniums_session',value:servidor.cookie,url:servidor.origem}]);}

describe.skipIf(!temBuild&&!exigirBuild)('Crédito: conclusões e tabelas legíveis, com o mesmo recorte dos dados',()=>{
  it('distingue juros das novas operações e ICC da carteira no período das duas séries oficiais',async()=>{
    const browser=await chromium.launch({channel:'chromium',executablePath:process.env.I18N_CHROMIUM_EXECUTABLE});
    const context=await browser.newContext({viewport:{width:768,height:900}});await autenticar(context);const page=await context.newPage();
    try{
      await page.goto(servidor.origem+'/observatorio/payroll-lending-aging');
      const card=page.locator('#cg-expo .card').filter({has:page.locator('table.cgseg')});
      await card.waitFor();
      const periodo=qualidade.consig_inss_taxa.ultima_ref;
      // Referências por série, não gerado_em nem apenas a data geral do painel.
      expect(qualidade.consig_inss_icc.ultima_ref).toBe(periodo);expect(consignado.sgs.data_base).toBe(periodo);
      const linha=card.locator('tbody tr').filter({has:page.getByText('Beneficiários do INSS',{exact:true})});
      const colunas=await linha.locator('td').allTextContents();expect(colunas).toHaveLength(5);
      expect(texto(colunas[3])).toBe(n(consignado.sgs.atual.inss.taxa,2)+'%');
      expect(texto(colunas[2])).toBe(n(consignado.sgs.atual.inss.inad,2)+'%');
      expect(texto(colunas[4])).toBe(n(consignado.sgs.atual.inss.prazo_conc,1)+' meses');
      expect(await card.locator('thead th').nth(3).textContent()).toMatch(/novas operações/i);
      const nota=card.locator(':scope > p.src').filter({has:page.getByRole('link',{name:'BCB/SGS 27677',exact:true})});
      await expect.poll(()=>nota.textContent()).toContain(mes(periodo));
      expect(texto(await nota.textContent())).toContain(n(consignado.sgs.atual.inss.taxa,2)+'% a.a.');
      expect(texto(await nota.textContent())).toContain(n(consignado.sgs.atual.inss.icc,2)+'% a.a.');
      expect(texto(await nota.textContent())).toMatch(/ICC.*carteira existente/);
      expect(texto(await nota.textContent())).toMatch(/novas operações/);
      for(const key of ['consig_inss_taxa','consig_inss_icc']){
        const fonte=config.sgs_series.find(s=>s.key===key)!;expect(fonte).toBeTruthy();
        expect(await nota.getByRole('link',{name:'BCB/SGS '+fonte.code,exact:true}).getAttribute('href')).toBe(fonte.url);
      }
      const total=card.locator('tbody tr').filter({has:page.getByText('Total',{exact:true})});
      expect(texto(await total.locator('td').nth(3).textContent())).toBe(n(consignado.sgs.atual.total.taxa,2)+'%');
    }finally{await browser.close();}
  },60_000);

  it('a conclusão Pix acompanha o maior fluxo Total/PF/PJ e conserva o denominador da fonte',async()=>{
    const browser=await chromium.launch({channel:'chromium',executablePath:process.env.I18N_CHROMIUM_EXECUTABLE});
    const context=await browser.newContext({viewport:{width:390,height:900}});await autenticar(context);const page=await context.newPage();
    try{
      await page.goto(servidor.origem+'/observatorio/pix');
      const card=page.locator('#px-natureza .card').filter({has:page.getByRole('heading',{name:/Quantidade e tíquete por natureza/})});
      await card.waitFor();
      for(const [filtro,botao]of [['todos','Total'],['pf','Pagador PF'],['pj','Pagador PJ']]as const){
        const button=card.getByRole('button',{name:botao,exact:true});await button.focus();await page.keyboard.press('Enter');
        await expect.poll(()=>button.getAttribute('aria-pressed')).toBe('true');
        const rows=pix.natureza.atual.filter(r=>filtro==='todos'||r.k.startsWith(filtro==='pf'?'P2':'B2'));
        const maxima=Math.max(...rows.map(r=>r.q));const lider=rows.find(r=>r.q===maxima)!;
        const barras=card.locator('.panbar');expect(await barras.count()).toBe(rows.length);
        const barra=barras.nth(rows.indexOf(lider));const label=texto(await barra.locator(':scope > span').first().textContent());
        const medidas=texto(await barra.locator(':scope > span').last().textContent());
        expect(medidas).toContain(n(lider.q/1e9,2)+' bi');expect(medidas).toContain(n(lider.part_q,1)+'%');
        const nota=card.locator(':scope > div.src').last();const conteudo=texto(await nota.textContent());
        expect(conteudo).toContain(label);expect(conteudo).toContain(n(lider.q/1e9,2)+' bi');expect(conteudo).toContain(n(lider.part_q,1)+'%');
        expect(conteudo).toContain(mes(pix.mes_tx));expect(conteudo).toMatch(/total transacional do mês/);expect(conteudo).toMatch(/Tíquete.*valor médio por transação/);
        // A participação não pode virar share apenas do subconjunto PF/PJ.
        const shareFiltrado=100*lider.q/rows.reduce((sum,r)=>sum+r.q,0);
        if(filtro!=='todos'&&n(shareFiltrado,1)!==n(lider.part_q,1))expect(conteudo).not.toContain(n(shareFiltrado,1)+'%');
        expect(await button.evaluate(e=>e===document.activeElement)).toBe(true);
      }
    }finally{await browser.close();}
  },60_000);

  it.each([16,32])('preserva explicações, medidas e rolagem por teclado com fonte nativa %ipx',async fonte=>{
    const profile=mkdtempSync(tmpdir()+'/credito-leitura-');mkdirSync(profile+'/Default');
    writeFileSync(profile+'/Default/Preferences',JSON.stringify({webkit:{webprefs:{default_font_size:fonte,default_fixed_font_size:fonte===16?13:26}}}));
    // Chromium completo aplica a preferência nativa; headless-shell não a aplica no CI.
    const context=await chromium.launchPersistentContext(profile,{channel:'chromium',executablePath:process.env.I18N_CHROMIUM_EXECUTABLE,reducedMotion:'reduce',headless:true});
    await autenticar(context);const page=await context.newPage();const erros:string[]=[];page.on('pageerror',e=>erros.push(e.message));let horizontais=0;
    try{
      for(const width of [320,390,768,1440]){
        await page.setViewportSize({width,height:900});await page.goto(servidor.origem+'/observatorio/payroll-lending-aging',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
        expect(await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize))).toBe(fonte);
        for(const [nome,tipo]of [['Especificações da correlação: comparação por colunas','especificacoes'],['Mecanismos testados: comparação por colunas','mecanismos']]as const){
          const wrap=page.getByRole('region',{name:nome,exact:true});await wrap.waitFor();const table=wrap.getByRole('table');
          const rows=table.locator('tbody tr');const esperado=tipo==='especificacoes'?consignado.circularidade.especificacoes:consignado.circularidade.mecanismo.testados;
          expect(await rows.count()).toBe(esperado.length+(tipo==='especificacoes'?1:0));
          for(let i=0;i<esperado.length;i++){
            const td=rows.nth(i).locator('td');const r=esperado[i];
            if('rotulo'in r){expect(texto(await td.first().textContent())).toContain(r.rotulo);expect(texto(await td.nth(1).textContent())).toBe(n(r.r,3));expect(texto(await td.last().textContent())).toBe(texto(r.obs));}
            else{expect(texto(await td.first().textContent())).toBe(r.variavel);expect(texto(await td.nth(1).textContent())).toBe(n(r.com_consignado_por_60,3));expect(texto(await td.nth(2).textContent())).toBe(n(r.com_peso,3));expect(texto(await td.last().textContent())).toBe(texto(r.leitura));}
          }
          const geometria=await table.evaluate(t=>Array.from(t.querySelectorAll('tr')).flatMap(tr=>Array.from(tr.children).map((cell,index)=>{
            const b=cell.getBoundingClientRect(),css=getComputedStyle(cell),walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);let node;const fora:string[]=[];
            while(node=walker.nextNode()){if(!node.textContent?.trim()||node.parentElement?.closest('.sr-only'))continue;const range=document.createRange();range.selectNodeContents(node);for(const r of Array.from(range.getClientRects()))if(r.width>0&&(r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1))fora.push(node.textContent);}
            return{texto:cell.textContent,fora,prosa:cell.tagName==='TD'&&index===tr.children.length-1,largura:b.width,fonte:parseFloat(css.fontSize)};
          })));
          expect(geometria.filter(g=>g.fora.length),`${nome}, ${width}px, fonte${fonte}`).toEqual([]);
          // Composição efetiva: a prosa dispõe de pelo menos dez em úteis; não vira uma faixa de caracteres.
          expect(geometria.filter(g=>g.prosa&&g.largura<g.fonte*10),`${nome}, ${width}px, fonte${fonte}`).toEqual([]);
          const primeiraMedida=await rows.first().locator('td').nth(1).evaluate(e=>{
            const area=e.closest('.tblwrap')!.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(e);
            const rects=Array.from(range.getClientRects()).filter(r=>r.width>0),linhas=new Set(rects.map(r=>Math.round(r.top)));
            return{linhas:linhas.size,visivel:rects.every(r=>r.left>=area.left-1&&r.right<=area.right+1)};
          });
          expect(primeiraMedida.linhas).toBe(1);
          if(fonte===16&&width<=390)expect(primeiraMedida.visivel,`${nome}: primeira medida, ${width}px`).toBe(true);
          const dimensoes=await wrap.evaluate(e=>({h:e.scrollWidth-e.clientWidth,v:e.scrollHeight-e.clientHeight}));
          if(dimensoes.h>2){
            horizontais++;await wrap.focus();expect(await wrap.evaluate(e=>e===document.activeElement)).toBe(true);
            const inicio=await wrap.evaluate(e=>e.scrollLeft);await page.keyboard.press('ArrowRight');
            await expect.poll(()=>wrap.evaluate(e=>e.scrollLeft)).toBeGreaterThan(inicio);
          }
        }
        await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      }
      expect(horizontais).toBeGreaterThan(0);expect(erros).toEqual([]);
    }finally{await context.close();rmSync(profile,{recursive:true,force:true});}
  },120_000);
});
