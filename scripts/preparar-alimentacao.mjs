import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const root=join(process.cwd(),'public/eficiencia/seguranca-alimentar');
for (const base of ['snapshot','cadinsan','sisan','aquisicao','precos','escolar','saude','paa']) {
  const file=join(root,`${base}.json`);
  if (!existsSync(file)) throw new Error(`Base de Segurança Alimentar ausente: ${base}`);
  const data=JSON.parse(readFileSync(file,'utf8'));
  const map=new Map(data.territorios.map(t=>[t.id,t]));
  const chunks=new Map(); const initial=[];
  for (const o of data.observacoes) {
    const t=map.get(o.territorioId);
    if (!t) throw new Error(`Território sem metadados: ${o.territorioId}`);
    if (t.nivel!=='municipio') { initial.push(o); continue; }
    const uf=t.id.slice(0,2);
    if (!chunks.has(uf)) chunks.set(uf,[]);
    chunks.get(uf).push(o);
  }
  const observed=new Set(data.observacoes.map(o=>o.territorioId));
  const territories=data.territorios.filter(t=>t.nivel!=='municipio'||observed.has(t.id));
  mkdirSync(join(root,'indices'),{recursive:true});
  writeFileSync(join(root,'indices',`${base}.json`),JSON.stringify({...data,territorios:territories,observacoes:initial})+'\n');
  mkdirSync(join(root,'chunks',base),{recursive:true});
  for (const [uf,observacoes] of chunks) {
    const ids=new Set(observacoes.map(o=>o.territorioId));
    writeFileSync(join(root,'chunks',base,`uf-${uf}.json`),JSON.stringify({...data,territorios:territories.filter(t=>ids.has(t.id)),observacoes})+'\n');
  }
  const distributed=initial.length+[...chunks.values()].reduce((n,v)=>n+v.length,0);
  if(distributed!==data.observacoes.length) throw new Error(`Perda na distribuição de ${base}`);
  console.log(`Segurança Alimentar: ${base} · ${initial.length} observações iniciais; ${chunks.size} arquivos estaduais; ${distributed} preservadas.`);
}
