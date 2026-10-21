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
const arquivosInternacionais=['internacional.json','internacional-historico.json','internacional.csv','internacional-manifesto.json'];
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
 // Next usa localhost na URL interna de redirects de Route Handlers locais.
 // Usar a mesma origem evita trocar o host e perder o cookie da fixture no POST.
 child=spawn(process.execPath,[join(ROOT,'node_modules/next/dist/bin/next'),'start','--hostname','localhost','--port','0'],{cwd:ROOT,env,stdio:['ignore','pipe','pipe']});
 let logs='';const collect=chunk=>{logs=(logs+chunk).slice(-64000);};child.stdout.on('data',collect);child.stderr.on('data',collect);
 let origin='';
 for(let i=0;i<100;i++){
  if(child.exitCode!==null)throw Error('Next encerrou: '+logs);
  const match=logs.match(/http:\/\/localhost:\d+/);
  if(match){origin=match[0];try{if((await fetch(origin+'/api/auth/eu')).status===401)break;}catch{}}
  await new Promise(r=>setTimeout(r,300));
 }
 assert.ok(origin,'Next não informou a origem local');
 browser=await chromium.launch({executablePath:process.env.I18N_CHROMIUM_EXECUTABLE||undefined});
 const anonymous=await browser.newContext();
 const observatoryRoots=['/observatorio','/setor-eletrico','/eficiencia-estatal','/contas-publicas','/contas-publicas-estaduais','/saneamento','/gas-natural','/agronegocio'];
 // Consulta aberta desde 19/10/2026 (leva 1 da estratégia "aberto e com conta"): a entrada da Eficiência Estatal abre sem sessão.
 const consultasAbertas=['/eficiencia-estatal'];
 for(const path of consultasAbertas)check('Consulta aberta sem sessão: '+path,(await anonymous.request.get(origin+path,{maxRedirects:0})).status()===200);
 for(const path of observatoryRoots.filter(p=>!consultasAbertas.includes(p))){
  const response=await anonymous.request.get(origin+path,{maxRedirects:0});
  check('Observatório exige sessão: '+path,response.status()===307&&response.headers().location.includes('/entrar'));
 }
 for(const path of [PREFIX,PREFIX+'/comparar',PREFIX+'/internacional',PREFIX+'/tribunais/tjsp','/eficiencia/judiciario/snapshot.json',...arquivosInternacionais.map(f=>'/eficiencia/judiciario/'+f)]){
  const response=await anonymous.request.get(origin+path,{maxRedirects:0});
  check('Protegido sem sessão: '+path,response.status()===307&&response.headers().location.includes('/entrar'));
 }
 check('Método acessível sem sessão',(await anonymous.request.get(origin+PREFIX+'/metodos')).status()===200);
 check('Ilustração conceitual pública sem abrir dados',(await anonymous.request.get(origin+'/home/judiciario-por-dentro.webp')).status()===200);
 const anonPage=await anonymous.newPage();
 await anonPage.goto(origin+PREFIX+'/metodos',{waitUntil:'networkidle'});
 // Barra comum dos seis observatórios (Onda 1, 19/10/2026): a conta aparece depois da consulta de sessão.
 const entrarAnonimo=anonPage.getByRole('banner').getByRole('link',{name:'Entrar',exact:true});
 await entrarAnonimo.waitFor({timeout:15000});
 check('Cabeçalho anônimo oferece entrada com retorno ao método',(await entrarAnonimo.getAttribute('href')).includes(encodeURIComponent(PREFIX+'/metodos')));
 check('Cabeçalho anônimo mostra os seis observatórios',await anonPage.getByRole('navigation',{name:'Observatórios da Scrutiniums'}).getByRole('link').count()===6);

 check('Seletor exige sessão',(await anonymous.request.get(origin+'/app/observatorios',{maxRedirects:0})).status()===307);
 check('Escolha do Judiciário exige sessão',(await anonymous.request.post(origin+'/app/observatorios/entrar',{form:{d:'judiciario'},headers:{origin},maxRedirects:0})).status()===307);
 await anonymous.close();
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}});
 await context.addCookies([{name:'scrutiniums_session',value:cookie,url:origin,httpOnly:true,sameSite:'Lax',secure:false}]);
 check('Sessão real da fixture no banco',(await context.request.get(origin+'/api/auth/eu')).status()===204);
 for(const path of observatoryRoots)check('Observatório com sessão: '+path,(await context.request.get(origin+path)).status()===200);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(page.url()+': '+e.message));
 page.on('console',message=>{if(message.type()==='error')errors.push('Console: '+message.text());});
 // O Next pré-carrega links visíveis em fila, depois do networkidle; navegar no meio da fila aborta o pré-carregamento
 // e o framework registra erro no console. Esperar a fila esvaziar antes de navegar ou recarregar mantém a checagem de erros estrita.
 let pendentes=0;page.on('request',()=>pendentes++);page.on('requestfinished',()=>pendentes--);page.on('requestfailed',()=>pendentes--);
 const ocioso=async()=>{for(let quieto=0,i=0;quieto<6&&i<160;i++){await page.waitForTimeout(125);quieto=pendentes>0?0:quieto+1;}};
 const captura=async opcoes=>{await page.screenshot(opcoes);await ocioso();};
 for(const metodo of ['goto','reload']){const original=page[metodo].bind(page);page[metodo]=async(...args)=>{await ocioso();return original(...args);};}
 const axe=await readFile(require.resolve('axe-core/axe.min.js'),'utf8');
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:width===390?844:1000});
  await page.goto(origin+'/app/observatorios',{waitUntil:'networkidle'});
  const card=page.getByRole('article',{name:'Observatório Brasileiro do Judiciário',exact:true});
  check('Cartão próprio do Judiciário '+width+'px',await card.isVisible()&&await card.getByRole('button',{name:/Explorar Judiciário/}).isVisible());
  check('Oito observatórios e Judiciário no seletor '+width+'px',await page.locator('input[name="d"]').count()===observatoryRoots.length+1);
  await card.locator('summary').click();
  check('Fonte e cobertura reais no cartão '+width+'px',(await card.innerText()).includes('57 tribunais')&&(await card.innerText()).includes('2009–2025'));
  await page.addScriptTag({content:axe});
  const violations=await page.evaluate(async()=>{const r=await axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return r.violations.map(v=>v.id);});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  check('Seletor acessível e sem overflow '+width+'px',!overflow&&violations.length===0);
  screens.push({slug:'seletor-observatorios',width,status:200,overflow,violations});
  await captura({path:join(out,'seletor-'+width+'.png'),fullPage:true});
 }
 const choice=page.getByRole('article',{name:'Observatório Brasileiro do Judiciário',exact:true});
 await choice.getByRole('button',{name:/Explorar Judiciário/}).focus();
 const navigation=page.waitForNavigation({waitUntil:'networkidle',timeout:20000});
 await page.keyboard.press('Enter');await navigation;
 await captura({path:join(out,'seletor-destino.png'),fullPage:true});
 check('Cartão abre o Judiciário por teclado',new URL(page.url()).pathname===PREFIX);
 check('Escolha preserva a sessão',(await context.request.get(origin+'/api/auth/eu')).status()===204);
 check('Cookie guarda o Judiciário',(await context.cookies()).some(c=>c.name==='scrutiniums_observatorio'&&c.value==='judiciario'&&c.httpOnly));
 await page.goto(origin+'/app/observatorios',{waitUntil:'networkidle'});
 check('Último acesso identifica o cartão do Judiciário',await page.getByRole('article',{name:'Observatório Brasileiro do Judiciário',exact:true}).getByText('Último acesso',{exact:true}).isVisible());
 const slugs=['','panorama','internacional','recursos','tempo','filas','entrega','consistencia','criminal','acesso','comparar','metodos','tribunais/tjsp','tribunais/tjdft','tribunais/trf3','tribunais/trt3'];
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:width===390?844:1000});
  for(const slug of slugs){
   const response=await page.goto(origin+PREFIX+(slug?'/'+slug:''),{waitUntil:'networkidle'});
   await page.evaluate(()=>document.fonts.ready);
   if(slug===''){
    check('Entrada mostra as duas medidas dos 27 TJs '+width+'px',await page.locator('#endereco ol li').count()===27&&await page.locator('#endereco [data-serie="1"]').count()>=27);
    if([390,1440].includes(width))await captura({path:join(out,'entrada-primeira-tela-'+width+'.png')});
   }
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
   await page.addScriptTag({content:axe});
   const violations=await page.evaluate(async()=>{const result=await axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));});
   const row={slug:slug||'entrada',width,status:response.status(),overflow,h1:await page.locator('h1').count(),violations};screens.push(row);
   check(`Tela ${row.slug} ${width}px`,row.status===200&&!overflow&&row.h1===1&&violations.length===0);
   if([390,1440].includes(width))await captura({path:join(out,`${(slug||'entrada').replaceAll('/','-')}-${width}.png`),fullPage:true});
  }
 }
 await page.goto(origin+PREFIX,{waitUntil:'networkidle'});
 // Seletor da barra comum: observatórios e coleções; o Judiciário segue pela Eficiência Estatal e pela navegação do módulo.
 const platformMenu=page.locator('summary[aria-label^="Coleção atual"]').first();
 await platformMenu.click();
 const platformNav=platformMenu.locator('xpath=..');
 const minhaConta=page.getByRole('banner').getByRole('link',{name:'Minha conta',exact:true});
 await minhaConta.waitFor({timeout:15000});
 check('Cabeçalho logado vai à conta, sem convite de login',await minhaConta.isVisible()&&await page.getByRole('banner').getByRole('link',{name:'Entrar',exact:true}).count()===0);
 for(const route of observatoryRoots)check('Menu mantém destino '+route,await platformNav.locator('a[href="'+route+'"]').count()===1);
 await platformMenu.press('Escape');
 check('Menu fecha por Escape',!(await platformMenu.evaluate(e=>e.parentElement.open)));
 const branchButtons=page.getByRole('group',{name:'Conhecer os ramos da Justiça'});
 await branchButtons.getByRole('button',{name:/Federal/}).click();
 check('Ramo Federal tem contexto e comparação próprios',(await page.locator('#ramo-em-foco').innerText()).includes('Justiça Federal')&&(await page.locator('#ramo-em-foco a').getAttribute('href')).includes('ramo=federal'));
 await branchButtons.getByRole('button',{name:/Trabalho/}).click();
 check('Ramo Trabalho tem contexto próprio',(await page.locator('#ramo-em-foco').innerText()).includes('Justiça do Trabalho'));
 await page.getByLabel('Buscar tribunal pela sigla').fill('tribunal inexistente');
 await page.getByRole('button',{name:'Abrir ficha',exact:true}).click();
 check('Busca informa sigla inexistente',await page.getByRole('status').filter({hasText:'Escolha uma sigla'}).isVisible());
 await page.getByLabel('Buscar tribunal pela sigla').fill('trf3');await page.getByLabel('Buscar tribunal pela sigla').press('Enter');
 await page.waitForURL('**/tribunais/trf3');
 check('Busca abre ficha regional por teclado',(await page.locator('h1').innerText()).includes('TRF3'));
 await page.goto(origin+PREFIX,{waitUntil:'networkidle'});
 await page.locator('#endereco').getByRole('link',{name:'TJSP',exact:true}).click();
 await page.waitForURL('**/tribunais/tjsp');
 check('Halteres da entrada abrem a ficha do tribunal',(await page.locator('h1').innerText()).includes('TJSP'));
 await page.goto(origin+PREFIX,{waitUntil:'networkidle'});
 await page.getByRole('link',{name:/Comparar os tribunais/}).click();
 await page.waitForURL('**/comparar');
 check('Pergunta do endereço leva ao comparador',new URL(page.url()).pathname===PREFIX+'/comparar');
 await page.goto(origin+PREFIX+'/comparar',{waitUntil:'networkidle'});
 await page.getByLabel('Tribunal 1',{exact:true}).selectOption('tjsp');
 await page.getByLabel('Tribunal 2',{exact:true}).selectOption('tjpe');
 await page.getByLabel('Tribunal 3',{exact:true}).selectOption('tjac');
 await page.getByLabel('Medida dos tribunais',{exact:true}).selectOption('idadePendentes');
 await captura({path:join(out,'comparacao-tres-tribunais.png'),fullPage:true});
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
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:width===390?844:1000});
  await page.goto(origin+PREFIX+'/internacional',{waitUntil:'networkidle'});
  check('Fonte internacional correta '+width+'px',(await page.locator('main').innerText()).includes('WJP · Rule of Law Index · edição 2025'));
  check('Brasil e três países, sem confundir escore com meses '+width+'px',await page.locator('[data-brasil]').count()===4&&(await page.locator('[data-brasil=true]').innerText()).includes('0,268'));
  await page.getByLabel('Referência internacional',{exact:true}).selectOption('renda');
  check('Referência de renda exclui o Brasil '+width+'px',await page.getByText(/Mediana calculada entre 43 outros países/).isVisible());
  await page.getByRole('button',{name:'Portugal, Espanha e Alemanha',exact:true}).click();
  check('Atalho internacional preenche países '+width+'px',await page.getByLabel('País internacional 1',{exact:true}).inputValue()==='PRT'&&await page.getByLabel('País internacional 3',{exact:true}).inputValue()==='DEU');
  await page.getByLabel('Referência internacional',{exact:true}).selectOption('mundo');
  check('Referência mundial exclui o Brasil '+width+'px',await page.getByText(/Mediana calculada entre 142 outros países/).isVisible());
  await page.getByText('Consultar os 143 países da edição',{exact:true}).click();
  check('Tabela mundial preserva todos os países '+width+'px',await page.getByRole('region',{name:'Tabela internacional completa',exact:true}).getByRole('row').count()===144);
  await page.getByText('Consultar os 143 países da edição',{exact:true}).click();
  await page.getByLabel('Indicador internacional',{exact:true}).selectOption('f_8_7');
  const allDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar os 143 países CSV',exact:true}).click();
  const all=await allDownload;await all.saveAs(join(out,'internacional-todos-'+width+'.csv'));
  const allCsv=await readFile(join(out,'internacional-todos-'+width+'.csv'),'utf8');
  check('CSV internacional tem todos os 143 países e unidade correta '+width+'px',allCsv.split('\r\n').length===144&&allCsv.includes('"f_8_7"')&&allCsv.includes('"escore de 0 a 1"'));
  await page.reload({waitUntil:'networkidle'});
  check('URL internacional sobrevive ao reload '+width+'px',await page.getByLabel('Indicador internacional',{exact:true}).inputValue()==='f_8_7'&&await page.getByLabel('País internacional 3',{exact:true}).inputValue()==='DEU');
  await page.getByLabel('Indicador internacional',{exact:true}).selectOption('f_7_6');
  await page.goBack();await page.waitForFunction(()=>document.querySelector('select[aria-label="Indicador internacional"]').value==='f_8_7');
  check('Voltar restaura indicador internacional '+width+'px',await page.getByLabel('Indicador internacional',{exact:true}).inputValue()==='f_8_7');
  await page.goForward();await page.waitForFunction(()=>document.querySelector('select[aria-label="Indicador internacional"]').value==='f_7_6');
  check('Avançar restaura indicador internacional '+width+'px',await page.getByLabel('Indicador internacional',{exact:true}).inputValue()==='f_7_6');
  await page.getByRole('button',{name:'Restaurar comparação inicial',exact:true}).click();
  await page.getByRole('button',{name:'Explorar evolução histórica',exact:true}).click();
  await page.getByRole('img',{name:/evolução dos escores de/}).waitFor({state:'visible'});
  await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Histórico internacional carregado');
  check('Foco é preservado ao carregar a trajetória '+width+'px',await page.getByRole('figure',{name:'Histórico internacional carregado',exact:true}).evaluate(e=>e===document.activeElement));
  await page.getByText('Ver valores por país e edição',{exact:true}).click();
  check('Histórico mantém quatro países e dez edições '+width+'px',await page.getByRole('region',{name:'Tabela histórica dos países selecionados',exact:true}).getByRole('row').count()===41);
  const seriesDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar histórico dos países selecionados CSV',exact:true}).click();
  const series=await seriesDownload;await series.saveAs(join(out,'internacional-historico-'+width+'.csv'));
  const seriesCsv=await readFile(join(out,'internacional-historico-'+width+'.csv'),'utf8');
  check('CSV histórico não duplica 2017–2018 nem promove 2026 '+width+'px',seriesCsv.split('\r\n').length===41&&(seriesCsv.match(/"2017-2018"/g)||[]).length===4&&!seriesCsv.includes('"2026"'));
  const social=page.getByRole('button',{name:/Ver a decisão cumprida/});
  await social.evaluate(e=>{window.__contrastePergunta=null;const observer=new MutationObserver(()=>{if(e.getAttribute('aria-pressed')!=='true')return;const style=getComputedStyle(e);const luminancia=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};const a=luminancia(style.color),b=luminancia(style.backgroundColor);window.__contrastePergunta={valor:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),texto:style.color,fundo:style.backgroundColor};observer.disconnect();});observer.observe(e,{attributes:true,attributeFilter:['aria-pressed']});});
  await social.focus();await page.keyboard.press('Enter');
  const primeiroQuadro=await page.evaluate(()=>window.__contrastePergunta);if(!primeiroQuadro||primeiroQuadro.valor<4.5)console.error('Contraste da pergunta selecionada: '+JSON.stringify(primeiroQuadro));check('Pergunta mantém contraste desde a seleção '+width+'px',!!primeiroQuadro&&primeiroQuadro.valor>=4.5);
  check('Pergunta social muda o indicador por teclado '+width+'px',await page.getByLabel('Indicador internacional',{exact:true}).inputValue()==='f_7_6'&&await social.getAttribute('aria-pressed')==='true');
  await page.addScriptTag({content:axe});
  const issues=await page.evaluate(async()=>{const r=await axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({html:n.html,summary:n.failureSummary}))}));});
  const overflowInternacional=await page.evaluate(()=>({documento:document.documentElement.scrollWidth,janela:innerWidth,elementos:[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1);}).slice(0,8).map(e=>({tag:e.tagName,classe:e.className,html:e.outerHTML.slice(0,500)}))}));
  if(issues.length||overflowInternacional.documento>overflowInternacional.janela+1)console.error('Diagnóstico internacional '+width+'px: '+JSON.stringify({issues,overflow:overflowInternacional}));
  check('Histórico e controles internacionais acessíveis '+width+'px',issues.length===0&&overflowInternacional.documento<=overflowInternacional.janela+1);
  await captura({path:join(out,'internacional-historico-'+width+'.png'),fullPage:true});
  await page.goto(origin+PREFIX+'/internacional?referencia=selecionados&p1=&p2=&p3=',{waitUntil:'networkidle'});
  check('Referência vazia permanece ausência, sem overflow '+width+'px',await page.getByText('Selecione ao menos um país estrangeiro para formar esta referência.',{exact:true}).isVisible()&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.goto(origin+PREFIX+'/internacional?referencia=selecionados&p1=PRT&p2=PRT&p3=',{waitUntil:'networkidle'});
  check('Duplicata internacional não altera peso da referência '+width+'px',await page.locator('[data-brasil]').count()===2&&await page.getByRole('status').filter({hasText:'repetia um país'}).isVisible());
  await page.goto(origin+PREFIX+'/internacional?foco=invalido&p1=ZZZ',{waitUntil:'networkidle'});
  check('Consulta internacional inválida usa padrões válidos '+width+'px',await page.getByLabel('Indicador internacional',{exact:true}).inputValue()==='f_7_5'&&await page.getByLabel('País internacional 1',{exact:true}).inputValue()==='PRT');
 }
 await page.goto(origin+PREFIX,{waitUntil:'networkidle'});
 await page.getByRole('link',{name:'Explorar a comparação internacional',exact:true}).click();await page.waitForURL('**/internacional');
 check('Comparação internacional a um clique da entrada',new URL(page.url()).pathname===PREFIX+'/internacional');
 for(const file of ['snapshot.json','ramos.csv','tribunais.csv','despesas-historico.csv','manifesto.json',...arquivosInternacionais]){
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
