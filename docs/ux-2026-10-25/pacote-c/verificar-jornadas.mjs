/** Pacote C, 25/10/2026: jornadas no build local com as golds da captura real.
 * Uso: node verificar-jornadas.mjs RAIZ CANDIDATA SAIDA
 * Troca temporária das duas golds; restaura os bytes no finally. Rodar sem outra suíte em curso.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const [raiz, candidata, saida] = process.argv.slice(2).map(p => resolve(p));
const require = createRequire(join(raiz, 'package.json'));
const { chromium } = require('playwright');
const { subirServidorLocal } = await import(pathToFileURL(join(raiz, 'scripts/servidor-local.mjs')));
const nomes = ['juros.json', 'desenrola.json'];
const anteriores = nomes.map(n => readFileSync(join(raiz,'public/obs/data/gold',n)));
const j = JSON.parse(readFileSync(join(candidata,'juros.json'),'utf8'));
const d = JSON.parse(readFileSync(join(candidata,'desenrola.json'),'utf8'));
const m = j.modalidades.find(m => m.ranking.some(r => r.taxa_aa === 0));
const zero = m.ranking.find(r => r.taxa_aa === 0);
const elegiveis = m.ranking.filter(r => r.taxa_aa !== 0).sort((a,b)=>a.taxa_aa-b.taxa_aa);
const positivo = elegiveis[0];
const mediana = (elegiveis[Math.floor((elegiveis.length-1)/2)].taxa_aa + elegiveis[Math.floor(elegiveis.length/2)].taxa_aa) / 2;
const slug = m.modalidade.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const base = '/observatorio-do-credito/quanto-meu-banco-cobra';
const params = new URLSearchParams({seg:m.segmento.toLowerCase(),mod:slug,banco:zero.cnpj8});
const rota = base+'?'+params;
const registros=[];
let servidor, navegador;
async function conferirAxe(page) {
 await page.addScriptTag({path:require.resolve('axe-core')});
 const violacoes=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.map(v=>({id:v.id,impacto:v.impact,nos:v.nodes.length}));});
 assert.deepEqual(violacoes,[]);
 return violacoes;
}
mkdirSync(saida,{recursive:true});
try {
 for (const n of nomes) writeFileSync(join(raiz,'public/obs/data/gold',n),readFileSync(join(candidata,n)));
 servidor=await subirServidorLocal({raiz});
 navegador=await chromium.launch({executablePath:process.env.I18N_CHROMIUM_EXECUTABLE||'/usr/bin/chromium'});
 for(const largura of [320,390,768,1440]) {
  const contexto=await navegador.newContext({viewport:{width:largura,height:900},hasTouch:largura<768,reducedMotion:'reduce'});
  await contexto.addCookies([servidor.cookie]);
  const page=await contexto.newPage();const erros=[];
  page.on('pageerror',e=>erros.push(e.message));
  await page.goto(servidor.origem+rota);await page.evaluate(()=>document.fonts.ready);
  const nota=page.locator(`[data-taxa-zero="${zero.cnpj8}"]`);
  await nota.waitFor();assert((await nota.innerText()).includes('0,00%'));
  assert((await nota.innerText()).includes('fora da comparação'));
  assert.equal(await nota.evaluate(e=>!!e.closest('details:not([open])')),false);
  const axeJuros=await conferirAxe(page);
  const figura=page.locator('#distribuicao');
  assert(!(await figura.innerText()).includes(zero.nome));
  assert((await figura.innerText()).includes(String(elegiveis.length)));
  assert((await figura.innerText()).includes(mediana.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})));
  const tabela=figura.locator('details').filter({has:page.locator('table')});
  await tabela.locator('summary').focus();await page.keyboard.press('Enter');
  assert.equal(await tabela.getAttribute('open'),'');
  assert.equal(await tabela.locator('tbody tr').count(),elegiveis.length);
  const linhas=await tabela.locator('tbody tr').evaluateAll(rs=>rs.map(r=>[...r.children].map(c=>c.textContent.trim())));
  assert.deepEqual(linhas.map(r=>r[1]),elegiveis.map(r=>r.nome));
  const numero=t=>Number(t.replace(/\./g,'').replace(',','.'));
  assert.deepEqual(linhas.map(r=>numero(r[2])),elegiveis.map(r=>r.taxa_aa));
  assert.deepEqual(linhas.map(r=>numero(r[3])),elegiveis.map(r=>r.taxa_am));
  assert(!(await tabela.innerText()).includes(zero.nome));
  await page.keyboard.press('Space');assert.equal(await tabela.getAttribute('open'),null);
  await nota.scrollIntoViewIfNeeded();await page.screenshot({path:join(saida,`juros-zero-${largura}.jpg`),fullPage:true,quality:80});
  await nota.screenshot({path:join(saida,`nota-zero-${largura}.png`)});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  // Formulário GET, URL compartilhável e volta/avanço preservam instituição/modalidade.
  await page.locator('select[name=banco]').focus();
  await page.keyboard.press('Shift+Tab');assert.equal(await page.locator(':focus').getAttribute('name'),'mod');
  await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('name'),'banco');
  await page.locator('select[name=banco]').selectOption(positivo.cnpj8);
  await page.waitForURL(u=>u.searchParams.get('banco')===positivo.cnpj8);
  await page.goto(servidor.origem+rota);
  await page.goBack();await page.waitForURL(u=>u.searchParams.get('banco')===positivo.cnpj8);
  await page.goForward();await page.waitForURL(u=>u.searchParams.get('banco')===zero.cnpj8);
  await page.goto(servidor.origem+rota);await page.reload();await nota.waitFor();
  const linkSimulador=page.getByRole('link',{name:/Calcular a parcela com esta taxa/});
  if(largura<768) await linkSimulador.tap(); else await linkSimulador.click();
  await page.waitForURL(u=>u.pathname.includes('simulador-da-parcela'));
  assert.equal(new URL(page.url()).searchParams.get('banco'),zero.cnpj8);
  await page.locator('[data-taxa-zero]').waitFor();
  const axeSimulador=await conferirAxe(page);
  await page.screenshot({path:join(saida,`simulador-zero-${largura}.jpg`),fullPage:true,quality:80});
  await page.goto(servidor.origem+'/observatorio/desenrola');
  const ressalva=page.locator('[data-desenrola-fora-recorte]');await ressalva.waitFor();
  await page.waitForFunction(()=>!/\d{4}-\d{2}/.test(document.querySelector('[data-desenrola-fora-recorte]')?.innerText??''));
  const mes=iso=>['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][Number(iso.slice(5))-1]+'/'+iso.slice(0,4);
  const aviso=d.fora_do_recorte.ressalva.replace(d.fora_do_recorte.periodo_inicio,mes(d.fora_do_recorte.periodo_inicio)).replace(d.fora_do_recorte.periodo_fim,mes(d.fora_do_recorte.periodo_fim));
  assert((await ressalva.innerText()).includes(aviso));
  assert.equal(await ressalva.evaluate(e=>e.getBoundingClientRect().left>=0&&e.getBoundingClientRect().right<=innerWidth),true);
  assert.equal(await ressalva.evaluate(e=>!!e.closest('details:not([open])')),false);
  await ressalva.scrollIntoViewIfNeeded();await ressalva.screenshot({path:join(saida,`nota-desenrola-${largura}.png`)});
  await page.screenshot({path:join(saida,`desenrola-${largura}.jpg`),fullPage:true,quality:80});
  const rolagemDesenrola=await page.evaluate(()=>({largura:innerWidth,documento:document.documentElement.scrollWidth,indevida:document.documentElement.scrollWidth>innerWidth+1}));
  const axeDesenrola=await conferirAxe(page);
  assert.deepEqual(erros,[]);
  registros.push({largura,rota,teclado:['Tab','Shift+Tab','Enter','Espaço'],filtros:true,historico:true,recarga:true,simulador:true,ressalva:d.fora_do_recorte,rolagemDesenrola,axe:{juros:axeJuros,simulador:axeSimulador,desenrola:axeDesenrola},erros});
  await contexto.close();
 }
 const semJs=await navegador.newContext({javaScriptEnabled:false,viewport:{width:390,height:900}});
 await semJs.addCookies([servidor.cookie]);const page=await semJs.newPage();
 await page.goto(servidor.origem+rota);assert((await page.locator('[data-taxa-zero]').innerText()).includes('0,00%'));
 await page.locator('select[name=banco]').selectOption(positivo.cnpj8);
 await page.getByRole('button',{name:'Consultar',exact:true}).click();
 await page.waitForURL(u=>u.searchParams.get('banco')===positivo.cnpj8);
 registros.push({semJavaScript:true,formularioGet:true});await semJs.close();
} finally {
 await navegador?.close();await servidor?.encerrar();
 nomes.forEach((n,i)=>writeFileSync(join(raiz,'public/obs/data/gold',n),anteriores[i]));
 writeFileSync(join(saida,'jornadas.json'),JSON.stringify({build:readFileSync(join(raiz,'.next/BUILD_ID'),'utf8').trim(),data:new Date().toISOString(),registros},null,2)+'\n');
}
// Conserva o critério: registra todas as larguras antes de reprovar o overflow encontrado.
assert.deepEqual(registros.filter(r=>r.rolagemDesenrola?.indevida).map(r=>r.largura),[], 'Rolagem horizontal indevida no Desenrola');
console.log(`${registros.length} jornadas verificadas; golds originais restauradas.`);
