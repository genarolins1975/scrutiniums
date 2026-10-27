import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const raiz='/workspace/scrutiniums-resposta-na-entrada';
const saida='/workspace/resposta-revisao-legibilidade';
mkdirSync(saida,{recursive:true});
const require=createRequire(raiz+'/package.json');
const {chromium}=require('playwright');
const {subirServidorLocal}=await import(raiz+'/scripts/servidor-local.mjs');
const {aguardarHidratacao,aguardarSessaoResolvida}=await import(raiz+'/scripts/ux-cromo-medida.mjs');
const build=readFileSync(raiz+'/.next/BUILD_ID','utf8').trim();
if(build!=='joprJiw7FCX_7Z-nqHMuN')throw new Error('Build não corresponde ao aprovado: não executar');
const servidor=await subirServidorLocal({raiz,usuario:'revisao-legibilidade'});
const navegador=await chromium.launch({executablePath:'/usr/bin/chromium'});
const ctx=await navegador.newContext({viewport:{width:320,height:900},hasTouch:true,reducedMotion:'reduce'});
await ctx.addCookies([servidor.cookie]);
const p=await ctx.newPage();p.setDefaultTimeout(30000);
const resultados=[],erros=[];p.on('pageerror',e=>erros.push(e.message));
const quadro=()=>p.locator('[data-fatia="resposta"]');
const checar=(b,msg)=>{if(!b)throw new Error(msg)};
async function pronta(){await aguardarSessaoResolvida(p,true);await aguardarHidratacao(p);await p.evaluate(()=>document.fonts.ready);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function abrir(rota,fonte){await p.goto(servidor.origem+rota,{waitUntil:'networkidle'});await pronta();await p.evaluate(f=>document.documentElement.style.fontSize=f===200?'200%':'',fonte);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function medir(){return p.evaluate(()=>{
 const q=document.querySelector('[data-fatia="resposta"]');
 const ret=e=>e?.getBoundingClientRect().toJSON();
 const quantias=[...q.querySelectorAll('[data-quantia-inteira]')].map(e=>{const range=document.createRange();range.selectNodeContents(e);const caixas=[...range.getClientRects()].map(r=>r.toJSON());return{texto:e.textContent,caixas,fonte:getComputedStyle(e).fontSize,whiteSpace:getComputedStyle(e).whiteSpace,container:ret(e.closest('[data-valor-resposta]')),rect:ret(e)};});
 const v=q.querySelector('[data-valor-resposta]'),campo=q.querySelector('input,select');
 return{url:location.pathname+location.search,largura:innerWidth,scrollWidth:document.documentElement.scrollWidth,altura:document.documentElement.scrollHeight,scrollY,fonte:getComputedStyle(document.documentElement).fontSize,quantias,valor:ret(v),valorTexto:v?.textContent,controle:ret(campo),texto:q.innerText,grade:q.querySelector('.edm-extrato dl')?getComputedStyle(q.querySelector('.edm-extrato dl')).gridTemplateColumns:null};
 });}
function verificarNumeros(m){checar(m.scrollWidth<=m.largura+1,'Overflow do documento');for(const q of m.quantias){checar(q.caixas.length===1,'Número fragmentado: '+q.texto);checar(q.rect.left>=q.container.left-1&&q.rect.right<=q.container.right+1,'Número excede o próprio bloco: '+q.texto);checar(q.rect.left>=-1&&q.rect.right<=m.largura+1,'Número fora da tela: '+q.texto);}}
async function foto(nome){await p.screenshot({path:saida+'/'+nome+'.jpg',quality:85});}
async function caso(nome,fn){try{const detalhe=await fn();resultados.push({nome,ok:true,detalhe});console.log('OK '+nome)}catch(e){resultados.push({nome,ok:false,erro:String(e.stack??e)});await foto('falha-'+resultados.length).catch(()=>{});console.log('FALHA '+nome+' '+e.message)}writeFileSync(saida+'/parcial.json',JSON.stringify(resultados,null,2));}
try{
 await p.setViewportSize({width:320,height:900});
 await abrir('/combustiveis?uf=PE',200);await quadro().getByLabel('Litros',{exact:true}).fill('1000');await pronta();
 await quadro().locator('[data-valor-resposta]').first().scrollIntoViewIfNeeded();
 await foto('combustiveis-320-texto200-1000L');
 const m=await medir();resultados.push({nome:'Conferência visual 1000L a320 texto200',detalhe:m});
}finally{
 writeFileSync(saida+'/conferencia-1000L.json',JSON.stringify({commit:'38c543ae5e536d23f470a3640c8746bc6bdec60a',build,data:new Date().toISOString(),resultados,erros},null,2));
 await navegador.close();await servidor.encerrar();
}
