import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PREVIDENCIA_PLAYWRIGHT||'playwright');
const base=process.env.PREVIDENCIA_URL||'http://127.0.0.1:3224';
const out=process.env.PREVIDENCIA_QA_DIR||'/tmp/previdencia-qa';mkdirSync(out,{recursive:true});
const server=process.env.PREVIDENCIA_URL?null:spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3224'],{stdio:'ignore'});
if(server){process.on('exit',()=>server.kill());for(let i=0;i<40;i++){try{await fetch(base);break}catch{await new Promise(r=>setTimeout(r,500))}}}
const browser=await chromium.launch({...(process.env.PREVIDENCIA_CHROME?{executablePath:process.env.PREVIDENCIA_CHROME}:{}),args:['--no-sandbox']});
const axe=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const slugs=['','beneficios','territorio','recursos','atendimento','dados'];const telas=[],checks=[],erros=[];const check=(nome,ok)=>checks.push({nome,ok});
try{
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:950}});page.on('pageerror',e=>erros.push(e.message));
  for(const slug of slugs){
   const r=await page.goto(base+'/eficiencia-estatal/previdencia'+(slug?'/'+slug:''),{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await page.addScriptTag({content:axe});
   const violations=await page.evaluate(async()=>{const r=await axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
   telas.push({slug:slug||'panorama',width,status:r.status(),h1:await page.locator('h1').count(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),violations});
   if(width===390||width===1440)await page.screenshot({path:out+'/'+(slug||'panorama')+'-'+width+'.png',fullPage:true});
   if(width===390){await page.addStyleTag({content:'html{font-size:200%!important}'});check('Texto 200%: '+(slug||'panorama'),await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  }await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:950},acceptDownloads:true});page.on('pageerror',e=>erros.push(e.message));
 await page.goto(base+'/eficiencia-estatal/previdencia/territorio',{waitUntil:'networkidle'});
 await page.getByLabel('Ano',{exact:true}).selectOption('2022');await page.getByLabel('Clientela',{exact:true}).selectOption('rural');await page.getByLabel('Territórios',{exact:true}).selectOption('Região');await page.reload({waitUntil:'networkidle'});
 check('Recarga preserva três filtros',await page.getByLabel('Ano',{exact:true}).inputValue()==='2022'&&await page.getByLabel('Clientela',{exact:true}).inputValue()==='rural'&&await page.getByLabel('Territórios',{exact:true}).inputValue()==='Região');
 await page.getByLabel('Ordenação',{exact:true}).selectOption('maior');await page.goBack();check('Histórico restaura ordenação',await page.getByLabel('Ordenação',{exact:true}).inputValue()==='nome');
 await page.getByText('Ver tabela e origem dos valores',{exact:true}).click();check('Tabela equivalente: cinco regiões',await page.locator('tbody tr').count()===5);
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar comparação CSV'}).click();const file=await downloaded;await file.saveAs(out+'/comparacao.csv');const csv=readFileSync(out+'/comparacao.csv','utf8');check('CSV do recorte: 5 linhas e universo',csv.split('\r\n').length===6&&csv.includes('2022')&&csv.includes('rural')&&csv.includes('Não é contagem de pessoas'));
 await page.getByRole('button',{name:'Limpar seleção'}).focus();await page.keyboard.press('Enter');check('Limpar por teclado',await page.getByLabel('Ano',{exact:true}).inputValue()==='2024'&&await page.locator('tbody tr').count()===27);
 await page.goto(base+'/eficiencia-estatal/previdencia/recursos?medida=medio&ano=2023&clientela=urbana',{waitUntil:'networkidle'});check('Link direto à razão monetária',await page.getByLabel('Indicador',{exact:true}).inputValue()==='medio'&&await page.getByLabel('Ano',{exact:true}).inputValue()==='2023');
 await page.goto(base+'/eficiencia-estatal/previdencia/atendimento?ano=2022&clientela=rural',{waitUntil:'networkidle'});check('Atendimento mantém referência 2024 e sem filtro incompatível',await page.getByLabel('Ano',{exact:true}).count()===0&&await page.getByLabel('Clientela',{exact:true}).count()===0);await page.getByLabel('Indicador',{exact:true}).selectOption('atendimentos');check('Indicador de atendimentos',await page.getByText('Soma OBEE dos 12 meses de 2024',{exact:false}).isVisible());
 for(const f of ['snapshot.json','tabelas.csv','fontes.json','originais.zip']){const r=await page.request.get(base+'/eficiencia/previdencia/'+f);check('Download íntegro '+f,r.status()===200&&createHash('sha256').update(await r.body()).digest('hex')===createHash('sha256').update(readFileSync('public/eficiencia/previdencia/'+f)).digest('hex'));}
 const sitemap=await(await page.request.get(base+'/sitemap.xml')).text();check('Seis rotas no sitemap',slugs.every(s=>sitemap.includes('/eficiencia-estatal/previdencia'+(s?'/'+s:''))));
 await page.goto(base+'/eficiencia-estatal',{waitUntil:'networkidle'});check('Entrada no OBEE',await page.locator('a[href="/eficiencia-estatal/previdencia"]').count()>0);check('Rota inexistente é 404',(await page.request.get(base+'/eficiencia-estatal/previdencia/inexistente')).status()===404);
}catch(e){erros.push(String(e))}finally{
 await browser.close();server?.kill();const falhas=[...telas.filter(t=>t.status!==200||t.h1!==1||t.overflow||t.violations.length),...checks.filter(c=>!c.ok)];writeFileSync(out+'/resultado.json',JSON.stringify({telas,checks,erros,falhas},null,2));console.log(JSON.stringify({telas:telas.length,checks:checks.length,erros,falhas},null,2));if(erros.length||falhas.length)process.exitCode=1;
}
