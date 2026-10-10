import {readFileSync,writeFileSync,mkdirSync,renameSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const seed=join(process.cwd(),'pipeline/eficiencia_alimentar/distribuicao');
const manifest=JSON.parse(readFileSync(join(seed,'manifest.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const verified=[];const paths=new Set();
function decode(manifest){
const text=manifest.partes.map(name=>{
  if(!/^(?:[a-z0-9-]+-)?base-\d{3}\.gz\.b64$/.test(name))throw new Error('Nome inválido de parte canônica');
  return readFileSync(join(seed,name),'utf8').replace(/\s/g,'');
}).join('');
if(!text||text.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(text))throw new Error('Base64 inválida na base de Segurança Alimentar');
const payload=gunzipSync(Buffer.from(text,'base64'));
if(payload.length!==manifest.bytes||sha(payload)!==manifest.sha256||payload.subarray(0,4).toString()!=='SAN1')throw new Error('Integridade da base de Segurança Alimentar não confere');
const headerLength=payload.readUInt32BE(4);
const entries=JSON.parse(payload.subarray(8,8+headerLength).toString('utf8'));
if(JSON.stringify(entries)!==JSON.stringify(manifest.arquivos))throw new Error('Manifesto e conteúdo divergentes');
let offset=8+headerLength;
for(const item of entries){
  if(typeof item.path!=='string'||!item.path||item.path.includes('\\')||item.path.startsWith('/')||item.path.split('/').some(p=>!p||p==='.'||p==='..')||paths.has(item.path))throw new Error('Caminho de dados inválido');
  paths.add(item.path);
  if(!Number.isSafeInteger(item.bytes)||item.bytes<0)throw new Error('Tamanho inválido');
  const bytes=payload.subarray(offset,offset+item.bytes);offset+=item.bytes;
  if(bytes.length!==item.bytes||sha(bytes)!==item.sha256)throw new Error(`Integridade não confere: ${item.path}`);
  if(item.path.endsWith('.json'))JSON.parse(bytes.toString('utf8'));
  verified.push({path:item.path,bytes});
}
if(offset!==payload.length)throw new Error('Bytes excedentes ou ausentes na base');
}
decode(manifest);
for(const name of manifest.suplementos??[]){
  if(!/^[a-z0-9-]+-manifest\.json$/.test(name))throw new Error('Nome inválido de suplemento');
  decode(JSON.parse(readFileSync(join(seed,name),'utf8')));
}
const root=join(process.cwd(),'public/eficiencia/seguranca-alimentar');
for(const item of verified){
  const target=join(root,item.path);mkdirSync(dirname(target),{recursive:true});
  if(existsSync(target)&&readFileSync(target).equals(item.bytes))continue;
  const temporary=target+`.tmp-${process.pid}`;writeFileSync(temporary,item.bytes);renameSync(temporary,target);
}
console.log(`Segurança Alimentar: ${verified.length} arquivos canônicos verificados e materializados.`);
