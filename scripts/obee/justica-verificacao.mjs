import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.JUSTICA_PLAYWRIGHT||'playwright');
const base=process.env.JUSTICA_URL||'http://127.0.0.1:3220';
const server=process.env.JUSTICA_URL?null:spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3220'],{stdio:'ignore'});
if(server){process.on('exit',()=>server.kill());for(let i=0;i<30;i++){try{await fetch(base);break;}catch{await new Promise(r=>setTimeout(r,500));}}}
const out=process.env.JUSTICA_QA_DIR||'/tmp/justica-qa';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const resultados=[];const falhas=[];const erros=[];
const axe=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const slugs=['','cobertura','tempo-resposta','conciliacao','recursos','dados'];
for(const width of [320,390,768,1440]){
 const page=await browser.newPage({viewport:{width,height:950},deviceScaleFactor:1});
 page.on('pageerror',e=>erros.push(page.url()+": "+String(e)));
 for(const slug of slugs){
  const url=base+'/eficiencia-estatal/acesso-justica'+(slug?'/'+slug:'');
  const response=await page.goto(url,{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  const h1=await page.locator('h1').count();
  await page.addScriptTag({content:axe});
  const violations=await page.evaluate(async()=>{const r=await axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}));});
  const row={slug:slug||'panorama',width,status:response.status(),overflow,h1,violations};resultados.push(row);
  if(row.status!==200||overflow||h1!==1||violations.length)falhas.push(row);
  if(width===390||width===1440)await page.screenshot({path:join(out,(slug||'panorama')+'-'+width+'.png'),fullPage:true});
 }
 await page.close();
}
writeFileSync(join(out,'telas.json'),JSON.stringify({resultados,erros,falhas},null,2));
const page=await browser.newPage({viewport:{width:390,height:950},acceptDownloads:true});
page.on('pageerror',e=>erros.push(page.url()+": "+String(e)));
const checks=[];
function check(nome,ok){checks.push({nome,ok});if(!ok)falhas.push({interacao:nome});}
await page.goto(base+'/eficiencia-estatal/acesso-justica/cobertura',{waitUntil:'networkidle'});
await page.getByLabel('Unidade de comparação').selectOption('populacao');check('Cobertura populacional na URL',page.url().includes('base=populacao'));
await page.getByLabel('Destacar UF',{exact:true}).selectOption('PE');
await page.getByLabel('Nome da comarca').fill('Recife');await page.waitForTimeout(400);
check('Consulta comarca Recife',await page.getByRole('rowheader',{name:'RECIFE',exact:true}).count()===1);
const download=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar recorte completo'}).click();const file=await download;await file.saveAs(join(out,'recorte.csv'));check('CSV corresponde ao recorte',readFileSync(join(out,'recorte.csv'),'utf8').includes('RECIFE'));
await page.getByLabel('Nome da comarca').fill('Comarca inexistente ABCXYZ');await page.waitForTimeout(400);check('Ausência explícita',await page.getByText('Nenhuma comarca corresponde à consulta.',{exact:false}).isVisible());
await page.getByRole('button',{name:'Limpar consulta'}).click();await page.getByRole('button',{name:'Próxima →'}).click();check('Paginação',page.url().includes('pagina=2'));
await page.goto(base+'/eficiencia-estatal/acesso-justica/recursos',{waitUntil:'networkidle'});
await page.getByLabel('Medida',{exact:true}).selectOption('executado');await page.getByLabel('Destacar',{exact:true}).selectOption('PE');const recorte=page.url();await page.reload({waitUntil:'networkidle'});check('Seleção persiste ao recarregar',await page.getByLabel('Medida',{exact:true}).inputValue()==='executado'&&await page.getByLabel('Destacar',{exact:true}).inputValue()==='PE');
await page.getByLabel('Medida',{exact:true}).selectOption('defensores');await page.goBack();check('Voltar restaura medida',await page.getByLabel('Medida',{exact:true}).inputValue()==='executado');
await page.locator('summary').first().click();check('Tabela acessível',await page.getByRole('table').isVisible());
const download2=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar comparação CSV'}).click();const f2=await download2;await f2.saveAs(join(out,'comparacao.csv'));check('CSV com 27 entidades e cabeçalho',readFileSync(join(out,'comparacao.csv'),'utf8').split('\r\n').length===28);
await page.getByRole('button',{name:'Limpar seleção'}).focus();await page.keyboard.press('Enter');check('Botão por teclado',await page.getByLabel('Medida',{exact:true}).inputValue()==='percapita');
await page.goto(base+'/eficiencia-estatal/acesso-justica/conciliacao',{waitUntil:'networkidle'});
await page.getByRole('button',{name:'Ampliar valores abaixo do extremo'}).click();check('Extremo permanece indicado na escala ampliada',await page.getByText('↑ Fora da escala',{exact:true}).count()===1&&await page.getByText('1.335.367',{exact:true}).count()>0);
await page.locator('summary').last().click();check('Ausência e zero distintos na tabela',await page.getByRole('row',{name:/Pará Não informado/}).count()===1&&await page.getByRole('row',{name:/Roraima 0/}).count()===1);
for(const name of ['snapshot.json','comarcas.csv','defensorias.csv','tribunais.csv','fontes.json']){const r=await page.request.get(base+'/eficiencia/justica/'+name);check('Download HTTP '+name,r.status()===200);}
const sitemap=await page.request.get(base+'/sitemap.xml');check('Sitemap disponível',sitemap.status()===200);const sitemapText=await sitemap.text();check('Sitemap inclui páginas',slugs.every(s=>sitemapText.includes('/eficiencia-estatal/acesso-justica'+(s?'/'+s:''))));
await page.goto(base+'/eficiencia-estatal',{waitUntil:'networkidle'});check('Entrada pelo panorama',await page.locator('a[href="/eficiencia-estatal/acesso-justica"]').count()>0);
await page.goto(base+'/eficiencia-estatal/acesso-justica/rota-inexistente',{waitUntil:'networkidle'});check('Rota desconhecida retorna 404',(await page.request.get(page.url())).status()===404);
// Simulação de ampliação de texto: não equivale ao zoom nativo ou leitor de tela.
await page.goto(recorte,{waitUntil:'networkidle'});await page.addStyleTag({content:'html{font-size:200%!important}'});check('Texto ampliado sem overflow de página',await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
await browser.close();server?.kill();
writeFileSync(join(out,'resultado.json'),JSON.stringify({resultados,checks,erros,falhas},null,2));console.log(JSON.stringify({telas:resultados.length,interacoes:checks.length,erros,falhas},null,2));if(falhas.length||erros.length)process.exitCode=1;
