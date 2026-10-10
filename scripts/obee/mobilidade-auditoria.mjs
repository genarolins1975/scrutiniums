import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const base=process.env.BASE_URL??'http://127.0.0.1:3100';
const root='/eficiencia-estatal/mobilidade-transporte';
const routes=['','tempo','transporte','acesso','seguranca','recursos','comparar','metodos'];
const gold=JSON.parse(readFileSync('data/eficiencia_mobilidade/gold.json','utf8'));
const output='auditoria-interface-mobilidade';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[],failures=[],interacoes=[];
let etapa='início',activePage,exportacao=null,tracing=null,error=null;
function assert(condition,message){if(!condition)throw new Error(message);}
/** Leitor independente do CSV, incluindo CR/LF dentro de campos entre aspas. */
function* csvRows(text){let row=[],cell='',quoted=false;for(let i=text.charCodeAt(0)===0xfeff?1:0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===';'&&!quoted){row.push(cell);cell='';}else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);yield row;row=[];cell='';}else cell+=c;}assert(!quoted,'CSV com aspas não fechadas');if(cell||row.length){row.push(cell);yield row;}}
async function passo(nome,fn){etapa=nome;console.log('INICIAR',nome);await fn();interacoes.push(nome);console.log('APROVADO',nome);}
async function aplicar(page,expected){await Promise.all([page.waitForURL(expected,{waitUntil:'networkidle'}),page.getByRole('button',{name:'Aplicar recorte',exact:true}).click()]);}
try{
 etapa='arquivos necessários à função serverless';
 tracing=[];
 for(const n of ['.next/server/app/eficiencia-estatal/mobilidade-transporte/[[...painel]]/page.js.nft.json','.next/server/app/api/eficiencia-mobilidade/exportar/route.js.nft.json']){
  const trace=JSON.parse(readFileSync(n,'utf8')),files=new Set(trace.files.map(p=>resolve(dirname(n),p)));
  for(const f of ['data/eficiencia_mobilidade/gold.json','data/eficiencia_mobilidade/gold.sha256'])assert(files.has(resolve(f)),'Arquivo necessário ausente do tracing: '+f+' em '+n);
  tracing.push({arquivo:n,necessarios:'gold.json e gold.sha256 presentes'});
 }
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});activePage=page;
  for(const slug of routes){
   etapa='rota '+(slug||'panorama')+' em '+width;
   const errors=[],onError=e=>errors.push(e.message);page.on('pageerror',onError);
   const res=await page.goto(base+root+(slug?'/'+slug:''),{waitUntil:'networkidle'});
   await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
   const checks=await page.evaluate(async()=>{
    const main=document.querySelector('main');
    const axe=await window.axe.run(main,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
    const controls=[...main.querySelectorAll('button,input:not([type=hidden]),select,summary,nav a')];
    const small=controls.filter(e=>{const r=e.getBoundingClientRect();return r.height<43.5||r.width<43.5;}).map(e=>({text:e.textContent?.trim().slice(0,70),tag:e.tagName}));
    return {overflow:document.documentElement.scrollWidth>innerWidth+1,h1:main.querySelectorAll('h1').length,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.length})),smallControls:small,hasData:!!main.querySelector('figure')||main.textContent.includes('Dicionário e cobertura')};
   });
   await page.screenshot({path:output+'/'+(slug||'panorama')+'-'+width+'.png',fullPage:true});
   const result={slug:slug||'panorama',width,status:res.status(),...checks,errors};results.push(result);console.log('ROTA',JSON.stringify(result));
   if(res.status()!==200||checks.overflow||checks.h1!==1||checks.violations.length||checks.smallControls.length||!checks.hasData||errors.length)failures.push(result);
   page.off('pageerror',onError);
  }
  await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:1000}});activePage=page;
 await passo('selecionar indicador pelo nome acessível',async()=>{
  const response=await page.goto(base+root+'/transporte',{waitUntil:'networkidle'});assert(response.status()===200,'Transporte indisponível');
  // getByRole usa o nome acessível; getByLabel(exact) também captura o texto
  // de opções dentro do label implícito, apesar do nome acessível correto.
  await page.getByRole('combobox',{name:'Indicador',exact:true}).selectOption('pemob.tarifa');
  await aplicar(page,u=>u.searchParams.get('medida')==='pemob.tarifa');
 });
 await passo('busca territorial, tabela e CSV do mesmo recorte',async()=>{
  await page.getByLabel('Buscar território',{exact:true}).fill('São Paulo');
  await aplicar(page,u=>u.searchParams.get('busca')==='São Paulo');
  assert((await page.locator('figure').innerText()).includes('São Paulo'),'Busca territorial não refletida no gráfico');
  await page.getByText('Tabela equivalente ao gráfico',{exact:true}).click();
  assert((await page.locator('details[open] table').innerText()).includes('São Paulo'),'Tabela não acompanha a busca');
  const link=await page.getByRole('link',{name:'Baixar recorte completo (CSV)',exact:true}).getAttribute('href');
  const r=await fetch(base+link);assert(r.ok,'Falha HTTP no CSV do recorte');const rows=Array.from(csvRows(await r.text())).slice(1);
  assert(rows.length===1&&rows[0][0]==='3550308'&&rows[0][4]==='pemob.tarifa','Download não corresponde ao recorte São Paulo/tarifa');
 });
 await passo('simulador de custo: hipótese editável, não dado observado',async()=>{
  await page.getByLabel('Tarifa por embarque (R$)',{exact:true}).fill('5');
  await page.getByLabel('Dias no mês',{exact:true}).fill('22');
  await page.getByLabel('Embarques pagos por dia',{exact:true}).fill('2');
  await page.waitForFunction(()=>document.querySelector('[aria-live=polite]')?.textContent.includes('220,00'));
  await page.screenshot({path:output+'/simulador-390.png',fullPage:true});
 });
 await passo('limpar filtros e estado vazio',async()=>{
  await Promise.all([page.waitForURL(u=>!u.searchParams.has('busca'),{waitUntil:'networkidle'}),page.getByRole('link',{name:'Limpar filtros',exact:true}).click()]);
  await page.getByLabel('Buscar território',{exact:true}).fill('zzzz-inexistente');
  await aplicar(page,u=>u.searchParams.get('busca')==='zzzz-inexistente');
  assert((await page.locator('main').innerText()).includes('Nenhum território corresponde'),'Estado vazio ausente');
 });
 await passo('paginação preserva indicador e universo',async()=>{
  await page.goto(base+root+'/transporte?medida=pemob.tarifa',{waitUntil:'networkidle'});
  await Promise.all([page.waitForURL(u=>u.searchParams.get('pagina')==='2',{waitUntil:'networkidle'}),page.getByRole('link',{name:'Próxima página →',exact:true}).click()]);
  assert(new URL(page.url()).searchParams.get('medida')==='pemob.tarifa','Paginação perdeu a medida');
  assert((await page.locator('main').innerText()).includes('25–48'),'Faixa da paginação incorreta');
 });
 await passo('erros de rota e parâmetros inválidos',async()=>{
  assert((await fetch(base+root+'/pagina-inexistente')).status===404,'Rota inválida não responde 404');
  for(const qs of ['medida=inexistente','nivel=invalido','formato=html'])assert((await fetch(base+'/api/eficiencia-mobilidade/exportar?'+qs)).status===400,'Parâmetro inválido não é rejeitado: '+qs);
 });
 await passo('CSV nacional completo: todos os registros reconciliados',async()=>{
  const response=await fetch(base+'/api/eficiencia-mobilidade/exportar');assert(response.ok,'Exportação integral indisponível');
  const csv=await response.text(),index=new Map(gold.observations.map(o=>[[o.territory,o.metric,o.period].join('|'),o]));
  let records=0,first=true;
  for(const fields of csvRows(csv)){
   if(first){assert(fields.length===17&&fields[0]==='codigo_ibge','Cabeçalho do CSV incompatível');first=false;continue;}
   assert(fields.length===17,'Número de colunas incorreto');
   const key=[fields[0],fields[4],fields[6]].join('|'),o=index.get(key);assert(!!o,'Registro inesperado ou duplicado no CSV: '+key);
   assert(fields[9]===o.state,'Estado divergente: '+key);
   for(const [column,value]of [[7,o.value],[10,o.numerator],[11,o.denominator]])assert(value==null?fields[column]==='':Number(fields[column])===value,'Valor ou componente divergente: '+key);
   index.delete(key);records++;
  }
  assert(index.size===0&&records===gold.observations.length,'CSV integral truncado');exportacao={records,csvBytesAfterDecoding:Buffer.byteLength(csv)};
 });
 await passo('JSON integral transmitido com SHA-256 idêntico',async()=>{
  const response=await fetch(base+'/api/eficiencia-mobilidade/exportar?formato=json');assert(response.ok,'JSON integral indisponível');
  const bytes=Buffer.from(await response.arrayBuffer()),hash=createHash('sha256').update(bytes).digest('hex');
  assert(hash===readFileSync('data/eficiencia_mobilidade/gold.sha256','utf8').trim(),'JSON HTTP diverge do snapshot');
  exportacao={...exportacao,jsonBytes:bytes.length,sha256:hash};console.log('EXPORTACAO',JSON.stringify(exportacao));
 });
 await passo('entrada geral do OBEE contém acesso ao novo capítulo',async()=>{
  const res=await page.goto(base+'/eficiencia-estatal',{waitUntil:'networkidle'});assert(res.status()===200,'Entrada OBEE indisponível');
  assert(await page.locator('a[href="'+root+'"]').count()>0,'Entrada geral não contém acesso a Mobilidade');
  assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'Entrada geral transborda no celular');
  await page.screenshot({path:output+'/entrada-obee-390.png',fullPage:true});
 });
 if(failures.length)throw new Error(failures.length+' estados responsivos reprovados');
 console.log('ACEITE_AUTOMATIZADO',JSON.stringify({estados:results.length,exportacao,interacoes}));
}catch(e){
 error={etapa,message:String(e?.message??e),url:activePage&&!activePage.isClosed()?activePage.url():null};console.error('FALHA',JSON.stringify(error));
 if(activePage&&!activePage.isClosed())await activePage.screenshot({path:output+'/falha.png',fullPage:true}).catch(()=>{});
 process.exitCode=1;
}finally{
 await browser.close();
 const report={sha:process.env.GITHUB_SHA,results,failures,error,interacoes,exportacao,tracing,limites:['Capturas e verificações automatizadas não equivalem a revisão estética independente.','Sem leitor de tela real, aparelho físico, zoom nativo ou teste com usuários.','HTTP validado no build de teste; não atesta produção.']};
 writeFileSync(output+'/resultado.json',JSON.stringify(report,null,2));
 writeFileSync(output+'/estados.json',JSON.stringify({results,failures},null,2));
}
