/** Build-only materialization from a hash-checked, preserved official snapshot. */
import { readFileSync,writeFileSync,mkdirSync,renameSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root));
const manifest=JSON.parse(read('pipeline/eficiencia_alimentar/seed/manifesto.json'));
const seed=read('pipeline/eficiencia_alimentar/seed/recorte_ibge.json.gz');
if(createHash('sha256').update(seed).digest('hex')!==manifest.seed_sha256)throw Error('Seed alimentar com hash divergente');
const data=JSON.parse(gunzipSync(seed));
const towns=new Map(data.towns.map(t=>[t.code,t]));
if(towns.size!==5570||data.towns.length!==5570||data.metrics.length!==10||data.needs.length!==12||new Set(data.needs.map(r=>r.territory+':'+r.year)).size!==12)throw Error('Cobertura alimentar inválida');
const indexed=new Map();
for(const m of data.metrics){const map=new Map(m.rows.map(r=>[r.code,r]));if(map.size!==5570||m.rows.length!==5570||m.rows.some(r=>!towns.has(r.code)||!r.status||(['-',null,'Não sabe informar'].includes(r.raw)&&r.status==='OBSERVADO')))throw Error('Registros alimentares inválidos');indexed.set(m.id,map);}
const files=new Map();
const quote=v=>{const s=String(v??'');return /[;"\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s};
const csv=(head,rows)=>'\ufeff'+[head,...rows].map(r=>r.map(quote).join(';')).join('\r\n')+'\r\n';
files.set('municipios.csv',csv(['codigo_ibge','municipio','uf','variavel','indicador','periodo','unidade','valor_original','status','papel_escore','fonte','registro'],data.metrics.flatMap(m=>m.rows.map(r=>[r.code,towns.get(r.code).city,towns.get(r.code).uf,m.id,m.name,m.period,m.unit,r.raw,r.status,m.role,'IBGE MUNIC 2024',m.sheet+' / '+m.id]))));
files.set('pnad.csv',csv(['territorio','ano','seguranca_pct','inseguranca_pct','leve_pct','moderada_pct','grave_pct','fonte','pagina'],data.needs.map(r=>[r.territory,r.year,r.secure,r.insecure,r.mild,r.moderate,r.severe,'IBGE PNADC 2024',6])));
for(const uf of new Set(data.towns.map(t=>t.uf))){files.set(`uf-${uf}.json`,JSON.stringify(data.towns.filter(t=>t.uf===uf).map(t=>({...t,values:Object.fromEntries(data.metrics.map(m=>[m.id,indexed.get(m.id).get(t.code)]))}))));}
const out=new URL('public/eficiencia/seguranca-alimentar/',root);mkdirSync(out,{recursive:true});
for(const [name,body] of files){const temp=new URL(name+'.tmp',out);writeFileSync(temp,body);renameSync(temp,new URL(name,out));}
console.log('Segurança alimentar: 5570 municípios, 55700 respostas e 12 recortes PNADC materializados.');
