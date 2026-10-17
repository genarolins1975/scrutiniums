/** Verificação real do build: sessão local, filtros, downloads e telas.
 * Nenhum dado ou credencial de produção; não aceita origem externa.
 * I18N_CHROMIUM_EXECUTABLE=/usr/bin/chromium node scripts/obee/judiciario-verificacao.mjs
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash,createHmac,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from 'playwright';

const ROOT=fileURLToPath(new URL('../../',import.meta.url)),require=createRequire(import.meta.url);
const PREFIX='/eficiencia-estatal/judiciario';
const out=resolve(process.env.JUDICIARIO_QA_DIR||'/tmp/judiciario-qa');
const temporary=await mkdtemp(join(tmpdir(),'scrutiniums-judiciario-'));
const bundleDir=await mkdtemp(join(ROOT,'node_modules/.judiciario-qa-'));
const secret=randomBytes(32).toString('hex'),token=randomBytes(32).toString('hex');
const expires=new Date(Date.now()+3_600_000),exp=Math.floor(expires.getTime()/1000);
const cookie=`${exp}.${token}.${createHmac('sha256',secret).update(`${exp}.${token}`).digest('hex')}`;
const checks=[],screens=[],errors=[];
const startedAt=new Date().toISOString();
const datasetSha256=createHash('sha256').update(await readFile(join(ROOT,'public/eficiencia/judiciario/snapshot.json'))).digest('hex');
let child,browser;
function check(name,value){checks.push({name,passed:!!value});assert.ok(value,name);}
await mkdir(out,{recursive:true});
try{
 process.env.DATABASE_URL='pglite://'+join(temporary,'db');
 const bundle=join(bundleDir,'db.cjs');
 await build({root:ROOT,configFile:false,envFile:false,publicDir:false,logLevel:'silent',build:{ssr:join(ROOT,'src/lib/db.ts'),outDir:bundleDir,emptyOutDir:false,minify:false,rollupOptions:{output:{format:'cjs',entryFileNames:'db.cjs'}}}});
 const {getDb,schema}=require(bundle),db=await getDb(),now=new Date();
 await db.insert(schema.users).values({id:'judiciario-qa',email:'judiciario-qa@example.invalid',emailVerifiedAt:now,phoneVerifiedAt:now,onboardingStatus:'COMPLETE',createdAt:now,updatedAt:now});
 await db.insert(schema.sessions).values({id:'judiciario-qa-session',userId:'judiciario-qa',tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:expires,createdAt:now});
 await db.$client.close();
 const env={NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',DATABASE_URL:process.env.DATABASE_URL,COOKIE_SECRET:secret};
 for(const key of ['PATH','LANG','LC_ALL','TZ','TMPDIR','TEMP','TMP','NODE_EXTRA_CA_CERTS'])if(process.env[key]!==undefined)env[key]=process.env[key];
 child=spawn(process.execPath,[join(ROOT,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','0'],{cwd:ROOT,env,stdio:['ignore','pipe','pipe']});
 let logs='';const collect=chunk=>{logs=(logs+chunk).slice(-64000);};child.stdout.on('data',collect);child.stderr.on('data',collect);
 let origin='';
 for(let i=0;i<100;i++){
  if(child.exitCode!==null)throw Error('Next encerrou: '+logs);
  const match=logs.match(/http:\/\/127\.0\.0\.1:\d+/);
  if(match){origin=match[0];try{if((await fetch(origin+'/api/auth/eu')).status===401)break;}catch{}}
  await new Promise(r=>setTimeout(r,300));
 }
 assert.ok(origin,'Next não informou a origem local');
 browser=await chromium.launch({executablePath:process.env.I18N_CHROMIUM_EXECUTABLE||undefined});
 const anonymous=await browser.newContext();
 const observatoryRoots=['/observatorio','/setor-eletrico','/eficiencia-estatal','/contas-publicas','/contas-publicas-estaduais','/saneamento','/gas-natural'];
 for(const path of observatoryRoots){
  const response=await anonymous.request.get(origin+path,{maxRedirects:0});
  check('Observatório exige sessão: '+path,response.status()===307&&response.headers().location.includes('/entrar'));
 }
 for(const path of [PREFIX,PREFIX+'/comparar',PREFIX+'/tribunais/tjsp','/eficiencia/judiciario/snapshot.json']){
  const response=await anonymous.request.get(origin+path,{maxRedirects:0});
  check('Protegido sem sessão: '+path,response.status()===307&&response.headers().location.includes('/entrar'));
 }
 check('Método acessível sem sessão',(await anonymous.request.get(origin+PREFIX+'/metodos')).status()===200);
 await anonymous.close();
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}});
 await context.addCookies([{name:'scrutiniums_session',value:cookie,url:origin,httpOnly:true,sameSite:'Lax',secure:false}]);
 check('Sessão real da fixture no banco',(await context.request.get(origin+'/api/auth/eu')).status()===204);
 for(const path of observatoryRoots)check('Observatório com sessão: '+path,(await context.request.get(origin+path)).status()===200);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(page.url()+': '+e.message));
 page.on('console',message=>{if(message.type()==='error')errors.push('Console: '+message.text());});
 const axe=await readFile(require.resolve('axe-core/axe.min.js'),'utf8');
 const slugs=['','panorama','recursos','tempo','filas','entrega','acesso','comparar','metodos','tribunais/tjsp','tribunais/tjdft','tribunais/trf3','tribunais/trt3'];
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:1000});
  for(const slug of slugs){
   const response=await page.goto(origin+PREFIX+(slug?'/'+slug:''),{waitUntil:'networkidle'});
   await page.evaluate(()=>document.fonts.ready);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
   await page.addScriptTag({content:axe});
   const violations=await page.evaluate(async()=>{const result=await axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));});
   const row={slug:slug||'entrada',width,status:response.status(),overflow,h1:await page.locator('h1').count(),violations};screens.push(row);
   check(`Tela ${row.slug} ${width}px`,row.status===200&&!overflow&&row.h1===1&&violations.length===0);
   if([390,1440].includes(width))await page.screenshot({path:join(out,`${(slug||'entrada').replaceAll('/','-')}-${width}.png`),fullPage:true});
  }
 }
 await page.goto(origin+PREFIX+'/comparar',{waitUntil:'networkidle'});
 await page.getByLabel('Tribunal 1',{exact:true}).selectOption('tjsp');
 await page.getByLabel('Tribunal 2',{exact:true}).selectOption('tjpe');
 await page.getByLabel('Tribunal 3',{exact:true}).selectOption('tjac');
 await page.getByLabel('Medida dos tribunais',{exact:true}).selectOption('idadePendentes');
 await page.screenshot({path:join(out,'comparacao-tres-tribunais.png'),fullPage:true});
 const shared=page.url();check('Seleção compartilhável',shared.includes('t1=tjsp')&&shared.includes('t3=tjac')&&shared.includes('medida=idadePendentes'));
 await page.reload({waitUntil:'networkidle'});
 check('Reload preserva recorte',await page.getByLabel('Tribunal 2',{exact:true}).inputValue()==='tjpe'&&await page.getByLabel('Medida dos tribunais',{exact:true}).inputValue()==='idadePendentes');
 await page.getByLabel('Medida dos tribunais',{exact:true}).selectOption('tempoBaixados');
 await page.goBack();check('Voltar restaura medida',await page.getByLabel('Medida dos tribunais',{exact:true}).inputValue()==='idadePendentes');
 await page.goForward();check('Avançar restaura medida',await page.getByLabel('Medida dos tribunais',{exact:true}).inputValue()==='tempoBaixados');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar todos os pares CSV'}).click();
 const download=await downloadPromise;const file=join(out,'pares.csv');await download.saveAs(file);
 const csv=await readFile(file,'utf8');
 check('CSV exporta 27 pares, não só três selecionados',csv.split('\r\n').length===28&&csv.includes('"meses"')&&csv.includes('"TJSP"'));
 await page.getByRole('button',{name:'Limpar comparação'}).focus();await page.keyboard.press('Enter');
 check('Limpar por teclado',await page.getByLabel('Tribunal 1',{exact:true}).inputValue()==='');
 for(const branch of ['federal','trabalho']){
  await page.getByLabel('Ramo dos tribunais',{exact:true}).selectOption(branch);
  const id=branch==='federal'?'trf3':'trt3';
  await page.getByLabel('Tribunal 1',{exact:true}).selectOption(id);
  check('Tribunal do ramo selecionado: '+branch,await page.getByLabel('Tribunal 1',{exact:true}).inputValue()===id);
  await page.goto(origin+PREFIX+'/tribunais/'+id,{waitUntil:'networkidle'});
  check('Ficha real do ramo: '+branch,(await page.locator('h1').innerText()).includes(id.toUpperCase()));
  await page.goto(origin+PREFIX+'/tempo?ramo='+branch,{waitUntil:'networkidle'});
  check('Agregado do ramo existe: '+branch,await page.getByLabel('Ramo',{exact:true}).inputValue()===branch&&await page.getByRole('rowheader',{name:branch==='federal'?'Justiça Federal':'Justiça do Trabalho',exact:true}).count()===1);
  await page.goto(origin+PREFIX+'/comparar',{waitUntil:'networkidle'});
 }
 await page.goto(origin+PREFIX+'/comparar?ramo=federal&t1=tjsp',{waitUntil:'networkidle'});
 check('Seleção incompatível não mistura ramos',await page.getByRole('status').filter({hasText:'outro ramo ou porte'}).count()===1);
 await page.goto(origin+PREFIX+'/comparar?ramo=federal&porte=Grande',{waitUntil:'networkidle'});
 check('Porte federal não inventado',await page.getByRole('heading',{name:'Nenhum tribunal corresponde ao recorte.'}).isVisible());
 await page.getByRole('button',{name:'Limpar porte'}).click();
 check('Limpar porte restaura pares',await page.getByLabel('Tribunal 1',{exact:true}).count()===1);
 await page.goto(origin+PREFIX+'/recursos',{waitUntil:'networkidle'});
 await page.getByLabel('Preços da série',{exact:true}).selectOption('nominal');
 check('Nominal não inventa histórico',await page.getByText('A série histórica nominal não está disponível no relatório consultado.',{exact:false}).count()===1);
 await page.getByText('Ver tabela anual equivalente',{exact:true}).click();
 check('Nominal só tem ano-base',await page.getByRole('region',{name:'Tabela anual de despesas'}).getByRole('row').count()===2);
 await page.getByLabel('Preços da série',{exact:true}).selectOption('real');
 check('Série real tem 17 anos',await page.getByRole('region',{name:'Tabela anual de despesas'}).getByRole('row').count()===18);
 const historyDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar série selecionada CSV'}).click();
 const history=await historyDownload;await history.saveAs(join(out,'despesa-recorte.csv'));
 check('CSV preserva preços e todos os anos',(await readFile(join(out,'despesa-recorte.csv'),'utf8')).split('\r\n').length===18);
 await page.goto(origin+PREFIX+'/comparar?t1=tjsp&t2=tjsp',{waitUntil:'networkidle'});
 check('Duplicata na URL não duplica tribunal',await page.getByRole('status').filter({hasText:'repetia um tribunal'}).count()===1);
 await page.goto(origin+PREFIX+'/tribunais/tjpe',{waitUntil:'networkidle'});
 check('Ficha reutilizável TJPE',(await page.locator('h1').innerText()).includes('Pernambuco'));
 check('Tribunal desconhecido 404',(await context.request.get(origin+PREFIX+'/tribunais/inexistente')).status()===404);
 for(const file of ['snapshot.json','ramos.csv','tribunais.csv','despesas-historico.csv','manifesto.json']){
  const response=await context.request.get(origin+'/eficiencia/judiciario/'+file);
  check('Download autenticado '+file,response.status()===200);
  check('Cache privado '+file,/private/.test(response.headers()['cache-control']||''));
 }
 await page.goto(origin+PREFIX,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Execução',exact:true}).click();
 check('Jornada interativa',await page.getByRole('heading',{name:'Transformar a decisão em cumprimento'}).isVisible());
 await page.setViewportSize({width:768,height:1000});
 await page.addStyleTag({content:'html{font-size:200%!important}'});
 check('Texto ampliado sem overflow global',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 // Navegação do módulo e vitrine: sessão e anonimato preservados.
 for(const logged of [true,false]){
  const ctx=logged?context:await browser.newContext();
  if(logged){
   await page.goto(origin+'/',{waitUntil:'networkidle'});
   await page.waitForURL('**/app/observatorios');
   check('Home logada preserva destino do seletor',new URL(page.url()).pathname==='/app/observatorios');
   const selector=await ctx.request.get(origin+'/app/observatorios');
   check('Seletor mantém acesso ao OBEE',selector.status()===200&&(await selector.text()).includes('/eficiencia-estatal'));
  }else{
   const html=await (await ctx.request.get(origin+'/')).text();
   check('Vitrine anônima anuncia cobertura real',html.includes('Judiciário: filas e tempos'));
  }
  if(!logged)await ctx.close();
 }
 for(const route of ['/eficiencia-estatal','/eficiencia-estatal/acesso-justica']){
  const html=await (await context.request.get(origin+route)).text();check('Integração '+route,html.includes(PREFIX));
 }
 const sitemap=await (await context.request.get(origin+'/sitemap.xml')).text();
 check('Sitemap não expõe painéis',!sitemap.includes(PREFIX+'/comparar'));
 check('Sem erros JavaScript',errors.length===0);
 await context.close();
 console.log(JSON.stringify({telas:screens.length,checks:checks.length,errors,out}));
}catch(error){errors.push(String(error));throw error;}
finally{
 await writeFile(join(out,'resultado.json'),JSON.stringify({startedAt,datasetSha256,screens,checks,errors},null,2));
 await browser?.close();
 if(child&&child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,5000))]);if(child.exitCode===null)child.kill('SIGKILL');}
 await rm(temporary,{recursive:true,force:true});await rm(bundleDir,{recursive:true,force:true});
}
