/** Revisão #384, 25/10/2026: cenário sintético com modalidade inteira em zero.
 * Uso: node conferir-recuperacao.mjs RAIZ SAIDA. Restaura a gold no finally.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const [raiz,saida]=process.argv.slice(2).map(p=>resolve(p));
const require=createRequire(join(raiz,'package.json'));
const {chromium}=require('playwright');
const {subirServidorLocal}=await import(pathToFileURL(join(raiz,'scripts/servidor-local.mjs')));
const arquivo=join(raiz,'public/obs/data/gold/juros.json');const original=readFileSync(arquivo);
const gold=JSON.parse(original);const m=gold.modalidades.find(m=>m.segmento==='PF');
m.ranking=m.ranking.map(r=>({...r,taxa_aa:0,taxa_am:0,vs_mediana:0}));
m.stats={n:m.ranking.length,min:0,p25:0,mediana:0,p75:0,max:0};
gold.perfis_if.push({cnpj8:'99999999',nome:'Instituição ausente — cenário sintético',modalidades:[]});
const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const outra=gold.modalidades.find(c=>c.segmento===m.segmento&&c.modalidade!==m.modalidade&&c.ranking.some(r=>r.taxa_aa>0));
const zero=m.ranking[0].cnpj8;const registros=[];let servidor,browser;
mkdirSync(saida,{recursive:true});
try{
 writeFileSync(arquivo,JSON.stringify(gold));servidor=await subirServidorLocal({raiz});browser=await chromium.launch({executablePath:process.env.I18N_CHROMIUM_EXECUTABLE||'/usr/bin/chromium'});
 for(const largura of [320,390,768,1440])for(const banco of ['', '99999999']){
  const c=await browser.newContext({viewport:{width:largura,height:900},hasTouch:largura<768,reducedMotion:'reduce'});await c.addCookies([servidor.cookie]);const p=await c.newPage();const erros=[];p.on('pageerror',e=>erros.push(e.message));
  const params=new URLSearchParams({seg:'pf',mod:slug(m.modalidade),banco,valor:'3.000',prazo:'12',cet:'15',taxa:'50',un:'aa'});const url=servidor.origem+'/observatorio-do-credito/simulador-da-parcela?'+params;
  await p.goto(url);await p.locator('[data-ausencia]').waitFor();await p.evaluate(()=>document.fonts.ready);
  assert.equal(await p.locator('select[name=mod]').isVisible(),true);assert.equal(await p.locator('select[name=banco]').isVisible(),true);
  await p.addScriptTag({path:require.resolve('axe-core')});const axe=await p.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>v.id);});assert.deepEqual(axe,[]);
  await p.evaluate(()=>{const aviso=document.createElement('p');aviso.textContent='CENÁRIO SINTÉTICO DE TESTE: todas as taxas desta modalidade foram fixadas em zero. Não são os valores publicados.';aviso.style.cssText='padding:16px;border:2px solid #222;background:#fff;color:#111;font:16px sans-serif';document.querySelector('main')?.prepend(aviso);});
  await p.screenshot({path:join(saida,`sem-referencia-${largura}-${banco?'ausente':'sem-banco'}.jpg`),fullPage:true,quality:80});
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await p.locator('select[name=mod]').selectOption(slug(outra.modalidade));await p.waitForURL(u=>u.searchParams.get('mod')===slug(outra.modalidade));await p.locator('[data-resultado]').waitFor();
  for(const [chave,valor] of Object.entries({valor:'3.000',prazo:'12',cet:'15'}))assert.equal(new URL(p.url()).searchParams.get(chave),valor);
  assert.equal(new URL(p.url()).searchParams.has('taxa'),false);assert.equal(new URL(p.url()).searchParams.has('un'),false);
  await p.goto(url);await p.locator('select[name=banco]').selectOption(zero);await p.waitForURL(u=>u.searchParams.get('banco')===zero);await p.locator('[data-taxa-zero]').waitFor();await p.locator('[data-resultado]').waitFor();assert.equal(await p.locator('[data-comparacao-mediana]').count(),0);
  assert.equal(await p.locator('input[name=valor]:not([type=hidden])').inputValue(),'3.000');assert.equal(await p.locator('input[name=prazo]:not([type=hidden])').inputValue(),'12');
  assert.deepEqual(erros,[]);registros.push({largura,bancoInicial:banco||null,outraModalidade:true,bancoZero:true,parametrosPreservados:true,axe,erros});await c.close();
 }
 const c=await browser.newContext({viewport:{width:390,height:900},javaScriptEnabled:false});await c.addCookies([servidor.cookie]);const p=await c.newPage();await p.goto(servidor.origem+'/observatorio-do-credito/simulador-da-parcela?'+new URLSearchParams({seg:'pf',mod:slug(m.modalidade),valor:'3.000',prazo:'12'}));await p.locator('select[name=banco]').selectOption(zero);await p.getByRole('button',{name:'Consultar',exact:true}).click();await p.locator('[data-taxa-zero]').waitFor();await p.locator('[data-resultado]').waitFor();assert.equal(await p.locator('input[name=valor]:not([type=hidden])').inputValue(),'3.000');registros.push({semJavaScript:true,formularioGet:true,bancoZero:true});await c.close();
}finally{await browser?.close();await servidor?.encerrar();writeFileSync(arquivo,original);writeFileSync(join(saida,'resultado.json'),JSON.stringify({build:readFileSync(join(raiz,'.next/BUILD_ID'),'utf8').trim(),data:new Date().toISOString(),cenario:'Sintético: todas as taxas da modalidade em zero',registros},null,2)+'\n');}
console.log(`${registros.length} jornadas de recuperação aprovadas.`);
