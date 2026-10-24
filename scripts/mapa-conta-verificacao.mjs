/** Regressões do mapa com sessão sintética e build de produção; nenhuma conta real. */
import { subirServidorLocal } from './servidor-local.mjs';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const saida = process.argv[2] || '/tmp/pr365-depois/funcional';
mkdirSync(saida, {recursive:true});
const servidor = await subirServidorLocal();
const browser = await chromium.launch({executablePath:process.env.I18N_CHROMIUM_EXECUTABLE || '/usr/bin/chromium'});
const resultado = {build:readFileSync(new URL('../.next/BUILD_ID',import.meta.url),'utf8').trim(),configuracoes:[],links:[],continuidade:[],erros:[]};
const conta = 'scrutiniums_observatorio';
const valor = async ctx => decodeURIComponent((await ctx.cookies()).find(c=>c.name===conta)?.value ?? '');
async function aguardarCookie(ctx, esperado) {
 for(let i=0;i<60;i++){if(await valor(ctx)===esperado)return;await new Promise(r=>setTimeout(r,100));}
 assert.equal(await valor(ctx),esperado);
}
try {
 for(const width of [390,1440]) {
  const context = await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:'reduce'});
  await context.addCookies([servidor.cookie]);
  await context.addInitScript({path:require.resolve('axe-core/axe.min.js')});
  const page = await context.newPage();
  const erros=[];page.on('pageerror',e=>erros.push(e.message));page.on('console',e=>{if(e.type()==='error')erros.push(e.text());});
  await page.goto(servidor.origem+'/app/observatorios',{waitUntil:'networkidle'});
  const input=page.locator('[data-mapa-conta] input[name=q]');
  assert.equal(await page.locator('[data-colecao]').count(),28);
  assert.equal(await page.locator('nav[aria-label="Ir para um observatório"] a').count(),6);
  const primeiro=await page.locator('nav[aria-label="Ir para um observatório"]').boundingBox();
  assert.ok(primeiro.y+primeiro.height<(width===390?844:900),'seis destinos na primeira tela');
  await input.fill('saneamneto');await page.locator('[data-mapa-conta] [role=option]').first().waitFor();
  assert.match(await page.locator('[data-mapa-conta] .bp-busca-painel').innerText(),/saneamento/i);
  await input.press('ArrowDown');assert.ok(await input.getAttribute('aria-activedescendant'));
  await input.press('Escape');assert.equal(await input.getAttribute('aria-expanded'),'false');
  const detalhe=page.locator('#paginas-setor-eletrico');
  await detalhe.locator('summary').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>new URLSearchParams(location.search).get('abertos')?.includes('paginas-setor-eletrico'));
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await input.inputValue(),'saneamneto');assert.equal(await detalhe.evaluate(e=>e.open),true);
  await input.press('Escape');
  // Âncora cria entrada própria: back/forward restauram a consulta e os detalhes de cada entrada.
  await page.locator('a[href="#obs-familias"]').click();
  await input.fill('Ideb');await input.press('Escape');
  await page.goBack({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('[data-mapa-conta] input[name=q]').value==='saneamneto');
  await page.goForward({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('[data-mapa-conta] input[name=q]').value==='Ideb');
  await input.press('Escape');
  const paginaDaColecao = detalhe.locator('a[href^="/"]').first();
  const hrefDaPagina = await paginaDaColecao.getAttribute('href');
  await paginaDaColecao.click();await page.waitForURL(servidor.origem+hrefDaPagina);
  await page.goBack({waitUntil:'networkidle'});
  assert.equal(await input.inputValue(),'Ideb');assert.equal(await detalhe.evaluate(e=>e.open),true);
  await input.press('Escape');
  // Estados expandidos entram na auditoria, inclusive os links curtos e as fontes.
  await page.locator('[data-mapa-conta] details').evaluateAll(ds=>ds.forEach(d=>d.open=true));
  const medidas=await page.evaluate(()=>({
   horizontal:document.documentElement.scrollWidth>innerWidth,
   pequenos:[...document.querySelectorAll('[data-mapa-conta] a,[data-mapa-conta] button,[data-mapa-conta] summary')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').map(e=>({texto:e.textContent.trim().slice(0,90),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})).filter(x=>x.w<43.9||x.h<43.9),
   piso:Math.min(...[...document.querySelectorAll('[data-mapa-conta] *')].filter(e=>e.getClientRects().length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(e=>parseFloat(getComputedStyle(e).fontSize))),
  }));
  const axe=await page.evaluate(async()=>{const r=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations;});
  resultado.configuracoes.push({width,primeiro,medidas,axe,erros});
  await page.screenshot({path:saida+'/expandido-'+width+'.png',fullPage:true});
  assert.equal(medidas.horizontal,false);assert.deepEqual(medidas.pequenos,[]);assert.ok(medidas.piso>=12);assert.deepEqual(axe,[]);assert.deepEqual(erros,[]);
  if(width===1440) {
   const links=await page.locator('[data-mapa-conta] a[href^="/"]').evaluateAll(as=>[...new Set(as.map(a=>a.getAttribute('href'))) ]);
   for(const href of links) {
    const r=await context.request.get(servidor.origem+href);
    const fim=new URL(r.url());
    const ok=r.status()===200&&!fim.pathname.includes('/entrar');
    resultado.links.push({href,status:r.status(),final:fim.pathname,ok});
   }
   assert.ok(resultado.links.every(x=>x.ok),'todos os destinos do mapa respondem sem login/404');
  }
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.addCookies([servidor.cookie,{...servidor.cookie,name:conta,value:'c:setor-eletrico'}]);
 const page=await context.newPage();
 await page.goto(servidor.origem+'/app/observatorios',{waitUntil:'networkidle'});
 const documentos=[];page.on('request',r=>{if(r.resourceType()==='document')documentos.push(r.url());});
 // Link Next real: usa o retomar da conta para abrir o painel.
 await page.locator('[data-retomar=continuar] a').click();await page.waitForURL('**/setor-eletrico');
 await aguardarCookie(context,'c:setor-eletrico');
 await context.request.get(servidor.origem+'/gas-natural',{headers:{accept:'*/*',rsc:'1','next-router-prefetch':'1'}});
 assert.equal(await valor(context),'c:setor-eletrico','prefetch não altera último acesso');
 await page.goBack({waitUntil:'networkidle'});
 assert.match(await page.locator('[data-retomar=continuar]').innerText(),/Setor Elétrico/);
 resultado.continuidade.push({caso:'Next Link, prefetch e retorno ao mapa',ok:true,documentos:[...documentos]});
 await page.goto(servidor.origem+'/observatorio',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>typeof window.showView==='function');
 await aguardarCookie(context,'c:credito');
 // Aciona o roteador que os controles da SPA usam; o documento não é recarregado.
 await page.evaluate(()=>window.showView('pix'));
 await aguardarCookie(context,'c:pagamentos');
 await page.goBack({waitUntil:'domcontentloaded'});await aguardarCookie(context,'c:credito');
 await page.goForward({waitUntil:'domcontentloaded'});await aguardarCookie(context,'c:pagamentos');
 await page.locator('#obsTrocar > summary').click();
 await page.locator('a[href="/app/observatorios"]:visible').first().click();await page.waitForURL('**/app/observatorios');
 assert.match(await page.locator('[data-retomar=continuar]').innerText(),/Pagamentos/);
 resultado.continuidade.push({caso:'Crédito→Pix, voltar/avançar e Continuar em Pagamentos',ok:true});
 await context.close();
 const anon=await browser.newContext();
 const resposta=await anon.request.get(servidor.origem+'/app/observatorios',{maxRedirects:0});
 assert.equal(resposta.status(),307);assert.match(resposta.headers().location,/\/entrar/);
 await anon.close();
} catch(e) {resultado.erros.push(e.stack);process.exitCode=1;}
finally {await browser.close();await servidor.encerrar();writeFileSync(saida+'/resultado.json',JSON.stringify(resultado,null,2)+'\n');}
console.log(JSON.stringify({configuracoes:resultado.configuracoes.length,links:resultado.links.length,continuidade:resultado.continuidade,erros:resultado.erros},null,2));
