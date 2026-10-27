import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const raiz='/workspace/scrutiniums-resposta-na-entrada';
const saida='/workspace/resposta-revisao-final';
mkdirSync(saida,{recursive:true});
const require=createRequire(raiz+'/package.json');
const {chromium}=require('playwright');
const {subirServidorLocal}=await import(raiz+'/scripts/servidor-local.mjs');
const {aguardarHidratacao,aguardarSessaoResolvida}=await import(raiz+'/scripts/ux-cromo-medida.mjs');
const resultados=[], erros=[];
const servidor=await subirServidorLocal({raiz,usuario:'revisao-layout-final'});
const navegador=await chromium.launch({executablePath:'/usr/bin/chromium'});
const ctx=await navegador.newContext({viewport:{width:390,height:900},hasTouch:true,reducedMotion:'reduce'});
await ctx.addCookies([servidor.cookie]);
const pagina=await ctx.newPage(); pagina.setDefaultTimeout(30000);
pagina.on('pageerror',e=>erros.push(e.message));
const checar=(ok,motivo)=>{if(!ok)throw new Error(motivo)};
const quadro=()=>pagina.locator('[data-fatia="resposta"]');
async function pronta(){await aguardarSessaoResolvida(pagina,true);await aguardarHidratacao(pagina);await pagina.evaluate(()=>document.fonts.ready);await pagina.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function abrir(rota){await pagina.goto(servidor.origem+rota,{waitUntil:'networkidle'});await pronta();}
async function foto(nome,inteira=false){await pagina.screenshot({path:`${saida}/${nome}.jpg`,fullPage:inteira,quality:80});}
async function medir(){return await pagina.evaluate(()=>{const r=document.querySelector('[data-fatia="resposta"]'),c=r?.querySelector('input,select'),v=r?.querySelector('[data-valor-resposta]');return{url:location.pathname+location.search+location.hash,scrollY,largura:innerWidth,scrollWidth:document.documentElement.scrollWidth,altura:document.documentElement.scrollHeight,controle:c?.getBoundingClientRect().toJSON(),valor:v?.getBoundingClientRect().toJSON(),valorTexto:v?.textContent,contextoValor:v?.parentElement?.textContent,ativo:{tag:document.activeElement.tagName,id:document.activeElement.id,role:document.activeElement.getAttribute('role')},fonteRaiz:getComputedStyle(document.documentElement).fontSize}});}
async function caso(nome,func){try{const detalhe=await func();resultados.push({nome,ok:true,detalhe});console.log('OK '+nome)}catch(e){const erro=String(e?.stack??e);resultados.push({nome,ok:false,erro});await foto('falha-'+resultados.length).catch(()=>{});console.log('FALHA '+nome+' '+String(e.message))}writeFileSync(saida+'/resultados-parciais.json',JSON.stringify(resultados,null,2));}
async function buscar(rota,consulta,codigo,modo){
 await abrir(rota);const input=quadro().getByRole('combobox');await input.focus();await input.fill(consulta);
 const opcao=pagina.getByRole('option').filter({hasText:consulta.split(' ')[0]}).first();await opcao.waitFor({state:'visible'});
 await foto(rota.slice(1).replaceAll('-','_')+'-busca-'+modo);
 if(modo==='teclado'){await input.press('ArrowDown');await input.press('ArrowUp');await input.press('Enter')}else await opcao.tap();
 await pagina.waitForURL(u=>u.searchParams.get('ibge')===codigo);await pronta();
 checar((await quadro().innerText()).includes(consulta.split(' ')[0]),'Resultado não identifica a escolha');
 const dados=await medir();await foto(rota.slice(1).replaceAll('-','_')+'-escolha-'+modo);return dados;
}
try{
 await caso('Combustíveis UF, litros e unidade do delta',async()=>{await abrir('/combustiveis?uf=PE');const lit=quadro().getByLabel('Litros', {exact:true});await lit.fill('60');checar((await quadro().locator('[data-combustivel="gasolina"] [data-valor-resposta]').innerText()).includes('410,40'),'Conta de 60 litros não corresponde a 6,84');const txt=await quadro().locator('[data-combustivel="gasolina"]').innerText();checar(txt.includes('por litro'),'Unidade ausente');await foto('combustiveis-60-litros');await quadro().getByLabel('Seu estado', {exact:true}).selectOption('SP');checar((await quadro().innerText()).includes('São Paulo'),'UF não mudou');await lit.fill('0');checar((await quadro().innerText()).includes('Informe de 1 a 1.000 litros'),'Volume inválido sem aviso');const invalido=await quadro().locator('[data-combustivel="gasolina"] [data-valor-resposta]').innerText();checar(invalido.includes('por litro')&&!invalido.includes('para 0'),'Zero litros gerou tanque');await foto('combustiveis-volume-invalido');return{gasolinaPE60:txt,invalido,...await medir()}});
}finally{
 const arquivo={commit:'304b6dba31c0810f2eee66c9d0a992c368633a8f',build:readFileSync(raiz+'/.next/BUILD_ID','utf8').trim(),data:new Date().toISOString(),resultados,erros};
 writeFileSync(saida+'/resultados-combustiveis.json',JSON.stringify(arquivo,null,2));
 await navegador.close();await servidor.encerrar();
}
