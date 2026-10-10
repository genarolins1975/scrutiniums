import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {dirname,join,relative,resolve,sep} from 'node:path';
import nextConfig from '../next.config.mjs';
const rota='/eficiencia-estatal/seguranca-alimentar/dados.csv';
const fontes=['snapshot.json','cadinsan.json','sisan.json','aquisicao.json','precos.json','escolar.json','saude.json','paa.json'];
const pasta=resolve('public/eficiencia/seguranca-alimentar');
const declaradas=nextConfig.experimental.outputFileTracingIncludes[rota];
assert.deepEqual(new Set(declaradas.map(p=>resolve(p))),new Set(fontes.map(f=>join(pasta,f))),'O exportador CSV deve declarar exatamente as oito bases canônicas.');
const caminhoTrace=resolve('.next/server/app/eficiencia-estatal/seguranca-alimentar/dados.csv/route.js.nft.json');
const trace=JSON.parse(readFileSync(caminhoTrace,'utf8'));
assert.ok(Array.isArray(trace.files),'Tracing da função CSV ausente ou inválido. Execute o build antes deste teste obrigatório.');
const arquivos=new Set(trace.files.map(f=>resolve(dirname(caminhoTrace),f)));
for(const fonte of fontes){const arquivo=join(pasta,fonte);assert.ok(arquivos.has(arquivo),`Fonte ${fonte} não incluída no bundle serverless.`);assert.ok(statSync(arquivo).size>0,`Fonte ${fonte} vazia.`);}
const dadosIncluidos=[...arquivos].filter(f=>f.startsWith(pasta+sep));
assert.deepEqual(new Set(dadosIncluidos),new Set(fontes.map(f=>join(pasta,f))),'Bundle CSV contém brutos, chunks ou índices desnecessários.');
console.log(JSON.stringify({rota,trace:relative(process.cwd(),caminhoTrace),fontesIncluidas:fontes,arquivosDadosNoBundle:dadosIncluidos.length,bytesDadosNoBundle:fontes.reduce((total,f)=>total+statSync(join(pasta,f)).size,0),resultado:'aprovado'},null,2));
