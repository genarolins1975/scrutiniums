/** Evidência focalizada do pedido de 27/10/2026: escolha e resposta antes do panorama.
 * Execute depois do build: node scripts/evidencias-resposta-entrada.mjs <pasta-de-saida>.
 * Sessão sintética e banco temporário; quatro larguras, primeiro valor, fontes, axe,
 * teclado, expansão de análise e raiz tipográfica a 200%. Reflow em 720 px é uma
 * simulação geométrica; não equivale a homologar zoom nativo nem leitor de tela.
 */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const raiz=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(raiz+'/package.json');
const {chromium}=require('playwright');
const {subirServidorLocal}=await import(raiz+'/scripts/servidor-local.mjs');
const {aguardarHidratacao,aguardarSessaoResolvida}=await import(raiz+'/scripts/ux-cromo-medida.mjs');
const saida=resolve(process.argv[2] ?? 'docs/ux-2026-10-27/resposta-na-entrada/jornadas');mkdirSync(saida,{recursive:true});
const s=await subirServidorLocal({raiz,usuario:'resposta-jornadas'});
const b=await chromium.launch({executablePath:process.env.I18N_CHROMIUM_EXECUTABLE || undefined});
const resultados=[];
const rotas=['/custo-de-vida?area=261','/combustiveis?uf=PE','/conectividade?ibge=2611606','/educacao-municipal?ibge=2611606','/eficiencia-estatal?territorio=3550308&comparador=4106902'];
try{
 for(const largura of [320,390,768,1440]){
 const c=await b.newContext({viewport:{width:largura,height:900},hasTouch:largura<768,reducedMotion:'reduce'});await c.addCookies([s.cookie]);
 for(const rota of rotas){
 const p=await c.newPage();const erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.goto(s.origem+rota,{waitUntil:'networkidle'});await aguardarSessaoResolvida(p,true);await aguardarHidratacao(p);await p.evaluate(()=>document.fonts.ready);
 const selecao=p.locator('[data-fatia="resposta"] select').first();
 if(rota.startsWith('/custo')){const opts=await selecao.locator('option').allTextContents();const rec=opts.find(x=>x.includes('Recife'));if(!rec)throw new Error('Recife não encontrado');await selecao.selectOption({label:rec});}
 const nome=rota.split('?')[0].slice(1).replaceAll('-','_')+'-'+largura;
 await p.screenshot({path:saida+'/'+nome+'-primeira-tela.jpg',quality:80});await p.screenshot({path:saida+'/'+nome+'.jpg',fullPage:true,quality:70});
 await p.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 const axe=await p.evaluate(async()=>{const r=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,impacto:v.impact,alvos:v.nodes.map(n=>n.target)}));});
 const medir=()=>{const query=document.querySelector('[data-fatia="resposta"]');const controle=query.querySelector('select,input');const resposta=query.querySelector('[data-resposta-especifica]');const valor=query.querySelector('[data-valor-resposta]');return {scrollY:window.scrollY,fonteRaiz:getComputedStyle(document.documentElement).fontSize,fonteH1:getComputedStyle(document.querySelector('h1')).fontSize,controle:controle.getBoundingClientRect().toJSON(),resposta:resposta?.getBoundingClientRect().toJSON(),valor:valor?.getBoundingClientRect().toJSON(),largura:document.documentElement.scrollWidth,altura:document.documentElement.scrollHeight};};
 const normal=await p.evaluate(medir);
 await p.locator('[data-fatia="resposta"] select, [data-fatia="resposta"] input').first().focus();await p.keyboard.press('Tab');await p.keyboard.press('Shift+Tab');
 const foco=await p.evaluate(()=>({tag:document.activeElement.tagName,contorno:getComputedStyle(document.activeElement).outlineStyle}));
 await p.evaluate(()=>{document.documentElement.style.fontSize='200%';window.scrollTo(0,0)});await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const texto200=await p.evaluate(medir);await p.screenshot({path:saida+'/'+nome+'-texto200.jpg',quality:75});await p.locator('[data-fatia="resposta"] select, [data-fatia="resposta"] input').first().scrollIntoViewIfNeeded();await p.screenshot({path:saida+'/'+nome+'-texto200-consulta.jpg',quality:75});await p.evaluate(()=>{document.documentElement.style.fontSize='';window.scrollTo(0,0)});await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 if(largura===1440){await p.setViewportSize({width:720,height:450});await p.screenshot({path:saida+'/'+nome+'-reflow200.jpg',quality:75});}
 const detalhes=[];if(rota.startsWith('/eficiencia-estatal')){await p.locator('a[href="#retrato-titulo"]').click();detalhes.push({alvo:'retrato-titulo',visivel:await p.locator('#retrato-titulo').isVisible()});}if(rota.startsWith('/conectividade')){await p.locator('a[href="#municipio-detalhes"]').click();detalhes.push({alvo:'municipio-detalhes',visivel:await p.locator('#municipio-detalhes').isVisible(),tabelas:await p.locator('#municipio-detalhes table:visible').count()});}
 resultados.push({rota:rota.split('?')[0],recorte:new URL(p.url()).search,largura,normal,texto200,foco,axe,erros,detalhes});
 await p.close();
 }
 await c.close();
 }
 writeFileSync(saida+'/jornadas.json',JSON.stringify({build:readFileSync(raiz+'/.next/BUILD_ID','utf8').trim(),commit:execFileSync('git',['rev-parse','HEAD'],{cwd:raiz,encoding:'utf8'}).trim(),data:new Date().toISOString(),resultados},null,2));
}finally{await b.close();await s.encerrar();}
