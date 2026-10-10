import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const base=process.env.BASE_URL??'http://127.0.0.1:3100';
const root='/eficiencia-estatal/mobilidade-transporte/oportunidades';
const api='/api/eficiencia-mobilidade/oportunidades';
const g=JSON.parse(readFileSync('data/eficiencia_mobilidade/aop/resumo.json','utf8'));
const output='auditoria-interface-mobilidade';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[],failures=[],steps=[];let page;
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
async function step(name,fn){try{await fn();steps.push(name);console.log('APROVADO',name);}catch(e){failures.push({step:name,message:String(e?.message??e)});console.error('REPROVADO',name,e?.message);}}
function* csvRows(text){let row=[],cell='',quoted=false;for(let i=text.charCodeAt(0)===0xfeff?1:0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===';'&&!quoted){row.push(cell);cell='';}else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);yield row;row=[];cell='';}else cell+=c;}assert(!quoted,'Aspas não fechadas');if(cell||row.length){row.push(cell);yield row;}}
try{
 await step('Arquivos do servidor incluídos no tracing',async()=>{
  for(const n of ['.next/server/app/eficiencia-estatal/mobilidade-transporte/[[...painel]]/page.js.nft.json','.next/server/app/api/eficiencia-mobilidade/oportunidades/route.js.nft.json']){
   const files=new Set(JSON.parse(readFileSync(n,'utf8')).files.map(p=>resolve(dirname(n),p)));
   for(const f of ['resumo.json','resumo.sha256',...(n.includes('/api/')?['seed.json.gz.b64']:[])])assert(files.has(resolve('data/eficiencia_mobilidade/aop/'+f)),'Arquivo fora do tracing: '+f);
  }
 });
 for(const width of [320,390,768,1440])await step('Layout e acessibilidade em '+width+' px',async()=>{
  const p=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   const res=await p.goto(base+root,{waitUntil:'networkidle'});
   await p.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
   const checks=await p.evaluate(async()=>{
    const main=document.querySelector('main'),axe=await window.axe.run(main,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
    const small=[...main.querySelectorAll('button,select,input:not([type=hidden]),summary,nav a')].filter(e=>{const b=e.getBoundingClientRect();return b.width<43.5||b.height<43.5;}).map(e=>e.textContent?.trim().slice(0,80));
    return {overflow:document.documentElement.scrollWidth>innerWidth+1,h1:main.querySelectorAll('h1').length,figures:main.querySelectorAll('figure').length,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.length})),small};
   });
   results.push({width,status:res.status(),...checks,errors});
   await p.screenshot({path:output+'/oportunidades-'+width+'.png',fullPage:true});
   assert(res.status()===200&&!checks.overflow&&checks.h1===1&&checks.figures===1&&!checks.violations.length&&!checks.small.length&&!errors.length,'Estado responsivo reprovado: '+JSON.stringify(checks));
  }finally{await p.close();}
 });
 page=await browser.newPage({viewport:{width:390,height:1000}});
 await step('Filtros, renda, tabela e CSV do mesmo recorte',async()=>{
  await page.goto(base+root,{waitUntil:'networkidle'});
  await page.getByLabel('Cidade',{exact:true}).selectOption('2611606');
  await page.getByLabel('Modo de transporte',{exact:true}).selectOption('public_transport');
  await page.getByLabel('Oportunidade e tempo',{exact:true}).selectOption('CMATT60');
  await Promise.all([page.waitForURL(u=>u.searchParams.get('cidade')==='2611606',{waitUntil:'networkidle'}),page.getByRole('button',{name:'Aplicar oportunidades',exact:true}).click()]);
  assert(await page.locator('figure').count()===2,'Faltou a distribuição por renda');
  const expected=g.records.find(r=>r.city==='2611606'&&r.mode==='public_transport'&&r.peak==='1'&&r.metric==='CMATT60');
  const txt=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(expected.groups[0].mean);
  assert((await page.locator('figure').first().innerText()).includes(txt),'Gráfico difere da base');
  await page.getByText('Tabela equivalente: valores, cobertura e denominadores',{exact:true}).click();
  assert((await page.locator('details[open] table').innerText()).includes(txt),'Tabela difere do gráfico');
  await page.getByText('Tabela equivalente: valores, cobertura e denominadores',{exact:true}).click();
  const href=await page.getByRole('link',{name:'Baixar recorte e grupos de renda (CSV)',exact:true}).getAttribute('href');
  const response=await fetch(base+href),rows=[...csvRows(await response.text())];
  assert(response.ok&&rows.length===13&&Number(rows[1][10])===expected.groups[0].mean,'CSV difere do recorte');
  await page.screenshot({path:output+'/oportunidades-recife-390.png',fullPage:true});
 });
 await step('Modo não coberto continua ausente; mudança para modo ativo',async()=>{
  await page.goto(base+root+'?cidade=1501402&modo=public_transport',{waitUntil:'networkidle'});
  assert((await page.locator('main').innerText()).includes('Sem estimativa para este modo'),'Ausência não identificada');
  assert(await page.locator('figure').count()===0,'Ausência gerou figura');
  await page.getByLabel('Modo de transporte',{exact:true}).selectOption('walk');
  await Promise.all([page.waitForURL(u=>u.searchParams.get('modo')==='walk',{waitUntil:'networkidle'}),page.getByRole('button',{name:'Aplicar oportunidades',exact:true}).click()]);
  assert(await page.locator('figure').count()===2,'Modo coberto não exibido');
  assert((await page.locator('main').innerText()).includes('Sem distinção de horário'),'Modo ativo recebeu pico fictício');
  await Promise.all([page.waitForURL(u=>u.search==='',{waitUntil:'networkidle'}),page.getByRole('link',{name:'Limpar filtros',exact:true}).click()]);
  assert(await page.getByLabel('Cidade',{exact:true}).inputValue()==='','Limpar não restaurou o recorte');
 });
 await step('CSV integral: todos os valores e grupos',async()=>{
  const response=await fetch(base+api);assert(response.ok,'CSV indisponível');
  const rows=[...csvRows(await response.text())],expected=g.records.flatMap(r=>r.groups.map(x=>({r,x})));
  assert(rows.length===expected.length+1,'CSV truncado');
  for(let i=0;i<expected.length;i++){const fields=rows[i+1],{r,x}=expected[i];assert(fields.length===24&&fields[0]===r.city&&fields[4]===r.metric,'Chave CSV divergente');for(const[col,value]of [[10,x.mean],[11,x.numerator],[12,x.coveredPopulation],[13,x.totalPopulation],[14,x.coverage],[15,x.zeroPopulation],[16,x.zeroShare]])assert(value===null?fields[col]==='':Number(fields[col])===value,'Valor ou denominador divergente');}
  results.push({csvRows:expected.length});
 });
 await step('Semente e JSON integrais por HTTP: SHA-256',async()=>{
  for(const[format,expected]of [['seed',g.seedSha256],['json',readFileSync('data/eficiencia_mobilidade/aop/resumo.sha256','utf8').trim()]]){
   const r=await fetch(base+api+'?formato='+format);assert(r.ok,'Arquivo indisponível: '+format);
   const raw=Buffer.from(await r.arrayBuffer()),sha256=createHash('sha256').update(raw).digest('hex');
   assert(sha256===expected,'Arquivo truncado ou alterado: '+format);results.push({format,bytes:raw.length,sha256});
  }
 });
 await step('Filtros e rotas inválidos rejeitados',async()=>{
  for(const qs of ['modo=car','formato=json&cidade=2611606','escopo=recorte&cidade=9999999','formato=html'])assert((await fetch(base+api+'?'+qs)).status===400,'Parâmetro aceito indevidamente: '+qs);
  assert((await fetch(base+root+'/inexistente')).status===404,'Subrota fictícia não rejeitada');
 });
}catch(e){failures.push({step:'execução',message:String(e?.message??e)});}finally{
 await browser.close();
 writeFileSync(output+'/resultado-oportunidades.json',JSON.stringify({sha:process.env.GITHUB_SHA,steps,results,failures,limits:['Build de teste, não produção.','Axe e capturas não equivalem a teste com leitor de tela, zoom nativo ou usuários.','Não constitui revisão estética independente.']},null,2));
}
if(failures.length)process.exitCode=1;
