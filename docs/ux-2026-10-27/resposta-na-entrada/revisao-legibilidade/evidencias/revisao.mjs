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
 for(const largura of [320,390]){
  await p.setViewportSize({width:largura,height:900});
  for(const fonte of [100,200]){
   await abrir('/combustiveis?uf=PE',fonte);
   for(const litros of [40,60,1000])await caso(`Combustível ${largura} texto${fonte} litros${litros}`,async()=>{
    await quadro().getByLabel('Litros',{exact:true}).fill(String(litros));await pronta();
    const m=await medir();verificarNumeros(m);checar(m.quantias.length===4,'Faltam produtos');
    const esperado=(6.84*litros).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    checar(m.quantias[0].texto===esperado,'Cálculo do tanque mudou');
    if(litros===40){await p.evaluate(()=>scrollTo(0,0));await foto(`combustiveis-${largura}-texto${fonte}-inicio`);}
    await quadro().locator('[data-valor-resposta]').first().scrollIntoViewIfNeeded();await foto(`combustiveis-${largura}-texto${fonte}-${litros}L`);
    return{...m,aposRolar:await medir()};
   });
   for(const [nome,id] of [['recife','2611606'],['nome-longo','3305158'],['ausencia','2605459']])await caso(`Educação ${largura} texto${fonte} ${nome}`,async()=>{
    await abrir('/educacao-municipal?ibge='+id,fonte);const m=await medir();verificarNumeros(m);
    if(nome==='ausencia'){checar(m.quantias.length===0&&m.texto.includes('Sem Ideb 2025'),'Ausência não preservada');checar(m.texto.includes('Fernando de Noronha'),'Nome ausente');}
    else{checar(m.quantias.length===2,'Faltam etapas');checar(m.texto.includes('de 0 a 10'),'Unidade ausente');if(nome==='nome-longo')checar(m.texto.includes('São José do Vale do Rio Preto'),'Nome longo perdido');}
    if(nome==='recife'){await p.evaluate(()=>scrollTo(0,0));await foto(`educacao-${largura}-texto${fonte}-inicio`);}
    await quadro().locator('[data-valor-resposta]').first().scrollIntoViewIfNeeded();await foto(`educacao-${largura}-texto${fonte}-${nome}`);
    return{...m,aposRolar:await medir()};
   });
  }
  await caso(`Volume inválido ${largura} texto200`,async()=>{await abrir('/combustiveis?uf=PE',200);await quadro().getByLabel('Litros',{exact:true}).fill('0');const m=await medir();verificarNumeros(m);checar(m.texto.includes('Informe de 1 a 1.000 litros'),'Aviso ausente');checar(m.valorTexto.includes('por litro')&&m.quantias[0].texto==='6,84','Fallback não é por litro');await quadro().locator('[data-valor-resposta]').first().scrollIntoViewIfNeeded();await foto(`combustiveis-${largura}-texto200-volume-invalido`);return m;});
  await caso(`Busca nome longo por teclado ${largura} texto200`,async()=>{await abrir('/educacao-municipal',200);const inp=quadro().getByRole('combobox');await inp.fill('São José do Vale do Rio Preto RJ');await p.getByRole('option').first().waitFor({state:'visible'});await inp.press('ArrowDown');await inp.press('Enter');await p.waitForURL(u=>u.searchParams.get('ibge')==='3305158');await pronta();const m=await medir();verificarNumeros(m);checar(m.texto.includes('São José do Vale do Rio Preto'),'Busca não atualizou');await quadro().locator('[data-valor-resposta]').first().scrollIntoViewIfNeeded();await foto(`educacao-${largura}-texto200-busca-teclado`);return m;});
  await caso(`Busca ausência por toque ${largura} texto200`,async()=>{await abrir('/educacao-municipal?ibge=2611606',200);const inp=quadro().getByRole('combobox');await inp.fill('Fernando de Noronha PE');await p.getByRole('option').first().waitFor({state:'visible'});await p.getByRole('option').first().tap();await p.waitForURL(u=>u.searchParams.get('ibge')==='2605459');await pronta();const m=await medir();verificarNumeros(m);checar(m.texto.includes('Sem Ideb 2025'),'Ausência após toque incorreta');await quadro().locator('[data-valor-resposta]').first().scrollIntoViewIfNeeded();await foto(`educacao-${largura}-texto200-busca-toque-ausencia`);return m;});
 }
}finally{
 writeFileSync(saida+'/resultados.json',JSON.stringify({commit:'38c543ae5e536d23f470a3640c8746bc6bdec60a',build,data:new Date().toISOString(),resultados,erros},null,2));
 await navegador.close();await servidor.encerrar();
}
