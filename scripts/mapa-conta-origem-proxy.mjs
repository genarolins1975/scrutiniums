import {fileURLToPath} from 'node:url';
/** Prova HTTP independente do endpoint; apenas fixture/banco/sessão temporários. */
import {subirServidorLocal} from './servidor-local.mjs';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const raiz=fileURLToPath(new URL('../',import.meta.url));
const saida=process.argv[2]||'/tmp/pr365-publicacao/proxy';mkdirSync(saida,{recursive:true});
const result={build:readFileSync(raiz+'/.next/BUILD_ID','utf8').trim(),commit:execFileSync('git',['rev-parse','HEAD'],{cwd:raiz,encoding:'utf8'}).trim(),metodo:'next start local com Host/Origin e forwarded simulando proxy; não é deployment Vercel',casos:[],erros:[]};
const s=await subirServidorLocal();
try{
 const casos=[
  {nome:'direto local autenticado',headers:{origin:s.origem},esperado:204},
  {nome:'proxy TLS host canônico',headers:{host:'scrutiniums.com',origin:'https://scrutiniums.com','x-forwarded-proto':'https','x-forwarded-host':'scrutiniums.com'},esperado:204},
  {nome:'proxy TLS host interno, origem canônica',headers:{host:'internal.example.test',origin:'https://scrutiniums.com','x-forwarded-proto':'https','x-forwarded-host':'scrutiniums.com'},esperado:204},
  {nome:'proxy TLS www canônico',headers:{host:'www.scrutiniums.com',origin:'https://www.scrutiniums.com','x-forwarded-proto':'https','x-forwarded-host':'www.scrutiniums.com'},esperado:204},
  {nome:'origem externa',headers:{origin:'https://evil.example.test'},esperado:403},
  {nome:'forwarded externo não confiável',headers:{origin:'https://evil.example.test','x-forwarded-host':'evil.example.test','x-forwarded-proto':'https'},esperado:403},
  {nome:'sem Origin',headers:{},esperado:403},
  {nome:'Origin null',headers:{origin:'null'},esperado:403},
  {nome:'Origin com caminho',headers:{origin:'https://scrutiniums.com/caminho'},esperado:403},
  {nome:'Origin com credenciais',headers:{origin:'https://alguem@scrutiniums.com'},esperado:403},
  {nome:'Origin FTP',headers:{origin:'ftp://scrutiniums.com'},esperado:403},
  {nome:'sem sessão com origem válida',headers:{origin:s.origem},sessao:false,esperado:401},
  {nome:'caminho fora do catálogo',headers:{origin:s.origem},caminho:'/nao-existe',esperado:400},
 ];
 for(const c of casos){
  const headers={...c.headers,'content-type':'application/json'};if(c.sessao!==false)headers.cookie=s.cookie.name+'='+s.cookie.value;
  const resposta=await fetch(s.origem+'/api/conta/ultimo-acesso',{method:'POST',headers,body:JSON.stringify({caminho:c.caminho||'/setor-eletrico'}),redirect:'manual'});
  const row={nome:c.nome,headers:c.headers,esperado:c.esperado,status:resposta.status,cookie:resposta.headers.get('set-cookie'),cache:resposta.headers.get('cache-control')};
  try{assert.equal(row.status,c.esperado);if(c.esperado===204){assert.match(row.cookie,/scrutiniums_observatorio=c%3Asetor-eletrico/);assert.match(row.cookie,/HttpOnly/);assert.match(row.cookie,/Secure/);assert.match(row.cookie,/SameSite=lax/i);assert.equal(row.cache,'no-store');}else{assert.equal(row.cookie,null);}row.ok=true;}catch(e){row.ok=false;row.erro=e.message;result.erros.push(c.nome+': '+e.message);}result.casos.push(row);
 }
}finally{await s.encerrar();writeFileSync(saida+'/resultado.json',JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result,null,2));if(result.erros.length)process.exitCode=1;
