/** Auditoria independente: resposta POST real, retida no transporte pelo Playwright. */
import {subirServidorLocal} from './servidor-local.mjs';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const output=process.argv[2]||'/tmp/pr365-depois/rede-lenta';mkdirSync(output,{recursive:true});
const result={build:readFileSync(new URL('../.next/BUILD_ID',import.meta.url),'utf8').trim(),method:'POST real via fetch sem cookie jar; resposta retida antes de route.fulfill. Cookie apenas aplicado pelo navegador à resposta entregue.',cases:[],errors:[]};
const server=await subirServidorLocal();const browser=await chromium.launch({executablePath:'/usr/bin/chromium'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const value=async context=>decodeURIComponent((await context.cookies()).find(c=>c.name==='scrutiniums_observatorio')?.value||'');
async function until(fn,ms=8000){const start=Date.now();while(Date.now()-start<ms){if(await fn())return;await sleep(50);}throw Error('Condição não atingida em '+ms+'ms');}
async function scenario(name,run){const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addCookies([server.cookie,{...server.cookie,name:'scrutiniums_observatorio',value:'c:credito'}]);const page=await context.newPage();const report={name,requests:[],errors:[]};const pending=[];page.on('pageerror',e=>report.errors.push(e.message));const docs=[];page.on('request',r=>{if(r.resourceType()==='document')docs.push(r.url());});
 const delay=async(path,milliseconds)=>{
  await context.route('**/api/conta/ultimo-acesso',async route=>{
   const req=route.request();let body;try{body=req.postDataJSON();}catch{}
   if(req.method()!=='POST'||body?.caminho!==path){await route.continue();return;}
   const event={path,delay:milliseconds,start:Date.now(),response:null,delivered:false};report.requests.push(event);
   const operation=(async()=>{try{
    const headers=await req.allHeaders();delete headers['content-length'];delete headers['host'];
    const response=await fetch(req.url(),{method:'POST',headers,body:req.postData(),redirect:'manual'});
    const body=Buffer.from(await response.arrayBuffer());const h=Object.fromEntries(response.headers.entries());
    delete h['content-encoding'];delete h['content-length'];
    event.response=response.status;event.cookie=response.headers.get('set-cookie');event.ready=Date.now();
    await sleep(milliseconds);await route.fulfill({status:response.status,headers:h,body});event.delivered=true;
   }catch(e){event.deliveryError=e.message;}finally{event.finish=Date.now();}})();pending.push(operation);await operation;
  });
 };
 try{await run({context,page,report,delay,docs});report.ok=true;}catch(e){report.ok=false;report.failure=e.stack;result.errors.push(name+': '+e.message);}finally{await Promise.allSettled(pending);report.finalCookie=await value(context);report.documents=docs;result.cases.push(report);await context.close();}
}
async function nextDestination(page){await page.goto(server.origem+'/app/observatorios',{waitUntil:'networkidle'});await page.locator('#paginas-setor-eletrico summary').click();const link=page.locator('#paginas-setor-eletrico a[href^="/setor-eletrico"]').first();assert.equal(await link.count(),1);return {link,path:await link.getAttribute('href')};}
try{
 await scenario('Next: POST1000ms, retorno ao mapa espera continuidade',async({context,page,report,delay,docs})=>{
  const {link,path}=await nextDestination(page);await delay(path,1000);const before=docs.length;await link.click();await page.waitForURL(server.origem+path);await until(()=>report.requests.length===1);await page.goBack({waitUntil:'domcontentloaded'});await until(async()=>(await value(context))==='c:setor-eletrico');await page.locator('[data-retomar=continuar]').filter({hasText:'Setor Elétrico'}).waitFor();report.continuar=await page.locator('[data-retomar=continuar]').innerText();assert.equal(docs.length,before,'navegação Next sem novo documento');assert.equal(report.requests[0].response,204);
 });
 await scenario('SPA: POST1000ms, saída para mapa entrega Pagamentos',async({context,page,report,delay})=>{
  await page.goto(server.origem+'/observatorio',{waitUntil:'networkidle'});await until(async()=>(await value(context))==='c:credito');await delay('/observatorio/pix',1000);await page.evaluate(()=>window.showView('pix'));await until(()=>report.requests.length===1);await page.locator('#obsTrocar > summary').click();const t=Date.now();await page.locator('a[href="/app/observatorios"]').first().click();await page.waitForURL('**/app/observatorios');report.navigationMs=Date.now()-t;assert.equal(await value(context),'c:pagamentos');await page.locator('[data-retomar=continuar]').filter({hasText:'Pagamentos'}).waitFor();assert.equal(report.requests[0].response,204);
 });
 await scenario('SPA: POST6000ms abortado, saída não fica presa',async({context,page,report,delay})=>{
  await page.goto(server.origem+'/observatorio',{waitUntil:'networkidle'});await until(async()=>(await value(context))==='c:credito');await delay('/observatorio/pix',6000);await page.evaluate(()=>window.showView('pix'));await until(()=>report.requests.length===1);await page.locator('#obsTrocar > summary').click();const t=Date.now();await page.locator('a[href="/app/observatorios"]').first().click();await page.waitForURL('**/app/observatorios',{timeout:5000});report.navigationMs=Date.now()-t;assert.ok(report.navigationMs<4000,'prazo2500ms mais tolerância1500ms');report.cookieOnArrival=await value(context);report.limitation='POST abortado pode preservar coleção anterior; navegação deve continuar.';
 });
 await scenario('Next A: resposta atrasada não sobrescreve documento B',async({context,page,report,delay})=>{
  const {link,path}=await nextDestination(page);await delay(path,1800);await link.click();await page.waitForURL(server.origem+path);await until(()=>report.requests[0]?.response===204);await page.goto(server.origem+'/gas-natural',{waitUntil:'domcontentloaded'});await until(async()=>(await value(context))==='c:gas');report.cookieAfterB=await value(context);await sleep(2500);assert.equal(await value(context),'c:gas','respostaA não pode sobrescreverB');
 });
 await scenario('SPA A: resposta atrasada não sobrescreve documento B',async({context,page,report,delay})=>{
  await page.goto(server.origem+'/observatorio',{waitUntil:'networkidle'});await until(async()=>(await value(context))==='c:credito');await delay('/observatorio/pix',1800);await page.evaluate(()=>window.showView('pix'));await until(()=>report.requests[0]?.response===204);await page.goto(server.origem+'/gas-natural',{waitUntil:'domcontentloaded'});await until(async()=>(await value(context))==='c:gas');report.cookieAfterB=await value(context);await sleep(2500);assert.equal(await value(context),'c:gas','respostaSPA-A não pode sobrescreverB');
 });
}finally{await browser.close();await server.encerrar();writeFileSync(output+'/resultado.json',JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=1;
