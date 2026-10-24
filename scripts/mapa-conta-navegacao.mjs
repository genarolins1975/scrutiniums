import {subirServidorLocal} from './servidor-local.mjs';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const server=await subirServidorLocal();
const browser=await chromium.launch({executablePath:'/usr/bin/chromium'});
const context=await browser.newContext({viewport:{width:1440,height:900}});
await context.addCookies([server.cookie]);
const page=await context.newPage();
const saida=process.argv[2]||'/tmp/pr365-depois/navegacao';
const result=[];let erros=[];
page.on('response',r=>{if(r.status()>=400)erros.push(r.status()+' '+r.url());});
page.on('pageerror',e=>erros.push(e.message));page.on('console',e=>{if(e.type()==='error')erros.push(e.text());});
try {
 await page.goto(server.origem+'/app/observatorios',{waitUntil:'networkidle'});
 const destinos=await page.locator('[data-colecao] h3 a,[data-observatorio] h2 a').evaluateAll(as=>as.map(a=>({href:a.getAttribute('href'),texto:a.textContent.trim()})));
 for(const destino of destinos) {
  // Respeita a política existente: 40 eventos de telemetria por usuário/minuto.
  await page.waitForTimeout(5000);
  await page.goto(server.origem+'/app/observatorios',{waitUntil:'networkidle'});erros=[];
  const link=page.locator('[data-colecao] h3 a,[data-observatorio] h2 a').filter({hasText:destino.texto}).first();
  const [response]=await Promise.all([page.waitForNavigation({waitUntil:'networkidle'}),link.click()]);
  const dados=await page.evaluate(()=>({h1:document.querySelector('h1')?.textContent.trim(),horizontal:document.documentElement.scrollWidth>innerWidth,url:location.pathname}));
  result.push({...destino,...dados,status:response?.status(),erros:[...erros]});
 }
} catch(e){result.push({erro:e.stack});process.exitCode=1;}
finally{await browser.close();await server.encerrar();mkdirSync(saida,{recursive:true});writeFileSync(saida+'/resultado.json',JSON.stringify(result,null,2)+'\n');}
const falhas=result.filter(r=>r.erro||r.status!==200||r.erros.length||r.horizontal||r.url.includes('/entrar'));
console.log(JSON.stringify({destinos:result.length,falhas},null,2));if(falhas.length)process.exitCode=1;
