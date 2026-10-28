import { chromium } from 'playwright';
import { subirServidorLocal } from '../servidor-local.mjs';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
// Rodar após npm run build; usa somente conta e banco locais temporários.
const pasta=resolve(process.argv[2] ?? 'docs/ux-2026-10-28/saude-cobertura/interacoes');
await mkdir(pasta,{recursive:true});
const servidor=await subirServidorLocal();
const browser=await chromium.launch({executablePath:process.env.I18N_CHROMIUM_EXECUTABLE || process.env.CHROMIUM_PATH || undefined,args:['--no-sandbox']});
const contexto=await browser.newContext();
await contexto.addCookies([servidor.cookie]);
const page=await contexto.newPage();
const erros=[];
page.on('pageerror',e=>erros.push(e.message));
const rota='/eficiencia-estatal/saude-capitais/rede-e-atencao-primaria';
const resumo=[];
try {
 for(const width of [1440,390,320,768]) {
  await page.setViewportSize({width,height:900});
  await page.goto(servidor.origem+rota,{waitUntil:'networkidle'});
  await page.locator('#aps-capital').selectOption('3550308');
  await page.locator('#aps-ano').selectOption('2026');
  await page.locator('#aps-mensal').scrollIntoViewIfNeeded();
  await page.evaluate(()=>document.fonts.ready);
  assert.match(await page.locator('#aps-mensal').innerText(),/59,46/);
  assert.match(await page.locator('#aps-mensal').innerText(),/cadastro vinculado.*incompleto/);
  assert.equal(await page.locator('#aps-mensal tbody tr').count(),7);
  const dims=await page.evaluate(()=>({viewport:innerWidth,body:document.documentElement.scrollWidth}));
  assert.ok(dims.body<=dims.viewport,JSON.stringify(dims));
  await page.locator('#aps-mensal').screenshot({path:`${pasta}/mensal-${width}.png`});
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:`${pasta}/pagina-${width}.png`,fullPage:true});
  resumo.push({width,...dims,linhas:7});
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('#aps-mensal > summary').click();
 assert.equal(await page.locator('#aps-mensal tbody').isVisible(),false);
 await page.locator('#aps-mensal').screenshot({path:`${pasta}/recolhido-390.png`});
 await page.locator('#aps-mensal > summary').click();
 assert.equal(await page.locator('#aps-mensal tbody').isVisible(),true);
 const regiao=page.locator('#aps-mensal [role=region]').first();
 await regiao.focus();
 await regiao.press('ArrowRight');
 await page.waitForFunction(()=>document.querySelector('#aps-mensal [role=region]').scrollLeft>0);
 assert.match(await page.locator('#aps-mensal').innerText(),/tabela continua à direita/);
 assert.equal(await page.locator('#aps-mensal [data-natureza=OBSERVADO]').count(),1);
 await regiao.evaluate(el=>el.scrollLeft=el.scrollWidth);
 await page.locator('#aps-mensal').screenshot({path:`${pasta}/rolagem-390.png`});
 // Reflow ampliado; simulação CSS de 200%, sem alegar teste manual de zoom do navegador.
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#aps-mensal').screenshot({path:`${pasta}/reflow-200.png`});
 await page.evaluate(()=>document.documentElement.style.zoom='');
 await page.locator('#aps-ano').selectOption('2021');
 assert.match(await page.locator('#aps-mensal').innerText(),/regra anterior/);
 assert.equal(await page.locator('#aps-mensal tbody tr').count(),12);
 await page.locator('#aps-mensal').screenshot({path:`${pasta}/metodo-2021.png`});
 await page.locator('#aps-vista').selectOption('capitais');
 await page.locator('#aps-mes').selectOption('2025-12');
 assert.equal(await page.locator('#aps-mensal tbody tr').count(),26);
 assert.match(page.url(),/aps_mes=2025-12/);
 await page.locator('#aps-mensal').screenshot({path:`${pasta}/capitais-2025.png`});
 const medidas=await page.locator('#aps-medida option').evaluateAll(xs=>xs.map(x=>x.value));
 for(const medida of medidas) {
  await page.locator('#aps-medida').selectOption(medida);
  assert.equal(await page.locator('#aps-mensal tbody tr').count(),26);
  assert.equal(await page.locator('#aps-medida').inputValue(),medida);
 }
 const link=page.url(); await page.reload({waitUntil:'networkidle'});
 assert.equal(page.url(),link);
 assert.equal(await page.locator('#aps-medida').inputValue(),medidas.at(-1));
 await page.locator('#aps-medida').selectOption('esf');
 await page.goBack();
 assert.equal(await page.locator('#aps-medida').inputValue(),medidas.at(-1));
 // Uma URL inválida deve voltar a um recorte válido.
 await page.goto(servidor.origem+rota+'?aps_cap=invalido&aps_ano=1900&aps_med=nao-existe',{waitUntil:'networkidle'});
 assert.equal(await page.locator('#aps-medida').inputValue(),'cobertura_pct');
 assert.equal(await page.locator('#aps-ano').inputValue(),'2026');
 const csv=await contexto.request.get(servidor.origem+'/eficiencia/series/saude_aps_mensal.csv');
 assert.equal(csv.status(),200);
 assert.match(await csv.text(),/sha256_seed/);
 await page.goto(servidor.origem+'/eficiencia-estatal/saude-capitais/metodos',{waitUntil:'networkidle'});
 await page.locator('#cobertura summary').click();
 assert.equal(await page.locator('#cobertura tbody tr').count(),23);
 await page.locator('#cobertura').screenshot({path:`${pasta}/cobertura-1440.png`});
 await page.setViewportSize({width:390,height:844});
 await page.locator('#cobertura').screenshot({path:`${pasta}/cobertura-390.png`});
 assert.equal(erros.length,0,erros.join('\n'));
 await writeFile(`${pasta}/interacoes.json`,JSON.stringify({resumo,medidas:medidas.length,erros,teste:'expansão da seção, recortes, URL, reload, voltar, parâmetros inválidos, CSV, inventário, teclado e zoom CSS200%' },null,2));
 console.log(JSON.stringify({resumo,medidas:medidas.length,erros}));
} finally { await browser.close(); await servidor.encerrar(); }
