import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { chromium, type BrowserContext } from 'playwright';
import { subirServidor, temBuild, exigirBuild, type ServidorProducao } from './suporte/servidor-producao';

const pix=JSON.parse(readFileSync('public/obs/data/gold/pix.json','utf8')) as {mes_tx:string;natureza:{atual:Array<{k:string;q:number;part_q:number;t:number}>}};
const n=(v:number,casas:number)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:casas,maximumFractionDigits:casas}).format(v);
const mes=(ref:string)=>new Intl.DateTimeFormat('pt-BR',{month:'short',timeZone:'UTC'}).format(new Date(ref.slice(0,7)+'-01T12:00:00Z')).replace(/\.$/,'')+'/'+ref.slice(0,4);
const texto=(s:string|null)=>s?.replace(/\s+/g,' ').trim()||'';
let servidor:ServidorProducao;
beforeAll(async()=>{if(temBuild||exigirBuild)servidor=await subirServidor('credito-leitura');},90_000);
afterAll(async()=>{await servidor?.parar();});
async function autenticar(context:BrowserContext){await context.addCookies([{name:'scrutiniums_session',value:servidor.cookie,url:servidor.origem}]);}

describe.skipIf(!temBuild&&!exigirBuild)('Crédito: conclusões e tabelas legíveis, com o mesmo recorte dos dados',()=>{
  // Teste aposentado em 10/11/2026: 'distingue juros das novas operações e ICC da carteira no período das duas séries oficiais' (#cg-expo da
  // vista antiga do consignado). Motivo: decisão do dono de 10/11/2026: fechada a paridade (docs/familias/PARIDADE.md), /observatorio/payroll-lending-aging redireciona (308) para /divida-das-familias/consignado e a vista antiga não é mais desenhada.
  // Na página nova a tabela por vínculo e as notas de juros e ICC vêm no HTML do servidor e são conferidas contra a gold em
  // src/tests/familias-consignado.test.ts ("mostra os valores da gold, sem recalcular").

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

  // Teste aposentado em 10/11/2026: 'preserva explicações, medidas e rolagem por teclado com fonte nativa' (tabelas de especificações e de
  // mecanismos em #cg-circ da vista antiga). Motivo: decisão do dono de 10/11/2026: fechada a paridade (docs/familias/PARIDADE.md), /observatorio/payroll-lending-aging redireciona (308) para /divida-das-familias/consignado e a vista antiga não é mais desenhada.
  // Na página nova as duas tabelas são TabelaDados do kit, conferidas contra a gold em src/tests/familias-consignado.test.ts.
});
