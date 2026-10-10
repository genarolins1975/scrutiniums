import {chromium} from 'playwright';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const base=process.env.BASE_URL??'http://127.0.0.1:3100';
const root='/eficiencia-estatal/mobilidade-transporte';
const routes=['','tempo','transporte','acesso','seguranca','recursos','comparar','metodos'];
const gold=JSON.parse(readFileSync('data/eficiencia_mobilidade/gold.json','utf8'));
const output='auditoria-interface-mobilidade';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[],failures=[];
try{
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});
  for(const slug of routes){
   const errors=[];const onError=e=>errors.push(e.message);page.on('pageerror',onError);
   const res=await page.goto(base+root+(slug?'/'+slug:''),{waitUntil:'networkidle'});
   await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
   const checks=await page.evaluate(async()=>{
    const main=document.querySelector('main');
    const axe=await window.axe.run(main,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
    const controls=[...main.querySelectorAll('button,input:not([type=hidden]),select,summary,nav a')];
    const small=controls.filter(e=>{const r=e.getBoundingClientRect();return r.height<43.5||r.width<43.5;}).map(e=>({text:e.textContent?.trim().slice(0,70),tag:e.tagName}));
    return {overflow:document.documentElement.scrollWidth>innerWidth+1,h1:main.querySelectorAll('h1').length,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.length})),smallControls:small,hasData:!!main.querySelector('figure')||main.textContent.includes('Integração do Censo')||main.textContent.includes('Dicionário e cobertura')};
   });
   const path=output+'/'+(slug||'panorama')+'-'+width+'.png';await page.screenshot({path,fullPage:true});
   const result={slug:slug||'panorama',width,status:res.status(),...checks,errors};results.push(result);
   console.log('ROTA',JSON.stringify(result));
   if(res.status()!==200||checks.overflow||checks.h1!==1||checks.violations.length||checks.smallControls.length||!checks.hasData||errors.length)failures.push(result);
   page.off('pageerror',onError);
  }
  await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:1000}});
 await page.goto(base+root+'/transporte');
 await page.getByLabel('Indicador',{exact:true}).selectOption('pemob.tarifa');
 await Promise.all([page.waitForURL(/medida=pemob.tarifa/),page.getByRole('button',{name:'Aplicar recorte',exact:true}).click()]);
 await page.getByLabel('Buscar território',{exact:true}).fill('São Paulo');
 await Promise.all([page.waitForURL(/busca=/),page.getByRole('button',{name:'Aplicar recorte',exact:true}).click()]);
 const selected=await page.locator('figure').innerText();if(!selected.includes('São Paulo'))throw new Error('Busca territorial não refletida no gráfico');
 await page.getByText('Tabela equivalente ao gráfico',{exact:true}).click();
 const link=await page.getByRole('link',{name:'Baixar recorte completo (CSV)',exact:true}).getAttribute('href');
 const filtered=await (await fetch(base+link)).text();if(!filtered.includes('São Paulo'))throw new Error('Download do recorte não acompanha o filtro');
 await page.getByRole('link',{name:'Limpar filtros',exact:true}).click();
 await page.getByLabel('Buscar território',{exact:true}).fill('zzzz-inexistente');
 await Promise.all([page.waitForURL(/zzzz-inexistente/),page.getByRole('button',{name:'Aplicar recorte',exact:true}).click()]);
 if(!(await page.locator('main').innerText()).includes('Nenhum território corresponde'))throw new Error('Estado vazio ausente');
 const unknown=await fetch(base+root+'/pagina-inexistente');if(unknown.status!==404)throw new Error('Rota inválida não responde 404');
 const invalid=await fetch(base+'/api/eficiencia-mobilidade/exportar?medida=inexistente');if(invalid.status!==400)throw new Error('Indicador inválido não é rejeitado');
 const csvResponse=await fetch(base+'/api/eficiencia-mobilidade/exportar');const csv=await csvResponse.text();
 // As observações integradas são numéricas; nenhuma célula de origem contém CR/LF.
 const records=csv.trimEnd().split('\r\n').length-1;if(records!==gold.observations.length)throw new Error('CSV integral truncado: '+records);
 const jsonResponse=await fetch(base+'/api/eficiencia-mobilidade/exportar?formato=json');const raw=await jsonResponse.text();
 const hash=createHash('sha256').update(raw).digest('hex');if(hash!==readFileSync('data/eficiencia_mobilidade/gold.sha256','utf8').trim())throw new Error('JSON HTTP diverge do snapshot');
 console.log('EXPORTACAO',JSON.stringify({records,bytes:Buffer.byteLength(csv),sha256:hash}));
 await page.close();
 writeFileSync(output+'/resultado.json',JSON.stringify({sha:process.env.GITHUB_SHA,results,failures,exportacao:{records,sha256:hash},limites:['Inspeção automatizada; capturas não equivalem a revisão estética humana.','Sem leitor de tela real, aparelho físico ou teste com usuários.']},null,2));
 if(failures.length)throw new Error(failures.length+' estados responsivos reprovados');
 console.log('ACEITE_AUTOMATIZADO',JSON.stringify({estados:results.length,exportados:records,interacoes:'busca, seleção, tabela, download, limpeza, vazio e erros HTTP'}));
}finally{await browser.close();writeFileSync(output+'/estados.json',JSON.stringify({results,failures},null,2));}
