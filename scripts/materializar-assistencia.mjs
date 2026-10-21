/** Offline build gate: preserve originals, validate keys and derive descriptive summaries. */
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root));
const manifest=JSON.parse(read('pipeline/assistencia/seed/manifesto.json'));
const packed=read('pipeline/assistencia/seed/recorte.json.gz');
if(createHash('sha256').update(packed).digest('hex')!==manifest.seed_sha256)throw Error('Snapshot SUAS com hash divergente');
const data=JSON.parse(gunzipSync(packed));
if(data.units.length!==Object.values(manifest.counts).reduce((a,b)=>a+b,0)||data.monthly.length!==manifest.rma_rows)throw Error('Cobertura SUAS divergente');
const unitKeys=new Set(),monthKeys=new Set();
for(const u of data.units){const k=u.kind+':'+u.id;if(unitKeys.has(k)||!u.uf||!u.id)throw Error('Chave SUAS inválida');unitKeys.add(k);for(const v of Object.values(u.values)){if(v.status!=='OBSERVADO'&&v.value!==null)throw Error('Ausência SUAS com valor');if(v.status==='OBSERVADO'&&v.value===null)throw Error('Observação SUAS sem valor');}}
for(const r of data.monthly){const k=r[0]+':'+r[3];if(monthKeys.has(k)||r.length!==12||r[3]<1||r[3]>12||r.slice(4).some(v=>v!==null&&(!Number.isInteger(v)||v<0)))throw Error('RMA inválido');monthKeys.add(k);}
const out=new URL('public/eficiencia/assistencia-social/',root);mkdirSync(out,{recursive:true});
const files=new Map(),json=v=>JSON.stringify(v),quote=v=>{const s=String(v??'');return /[;"\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s};
const csv=(h,rs)=>'\ufeff'+[h,...rs].map(r=>r.map(quote).join(';')).join('\r\n')+'\r\n';
files.set('unidades.csv',csv(['tipo','identificador','codigo_ibge','municipio','uf','competencia','natureza','preenchimento','variavel','periodo','valor_original','valor_padronizado','status','fonte'],data.units.flatMap(u=>Object.entries(u.values).map(([k,v])=>[u.kind,u.id,u.code,u.city,u.uf,u.scope,u.nature,u.complete,k,data.catalog.find(c=>c.kind===u.kind&&c.variable===k).period,v.raw,v.value,v.status,'MDS Censo SUAS 2025']))));
files.set('rma-cras.csv',csv(manifest.rma_columns.concat(['ano','fonte']),data.monthly.map(r=>[...r,2025,'MDS RMA CRAS 2025; Base tratada e originais; nulo não é zero'])));
const ufs=[...new Set(data.units.map(u=>u.uf))].sort();
if(ufs.length!==27||data.monthly.some(r=>!ufs.includes(r[2])))throw Error('UF inválida');
for(const uf of ufs){files.set('uf-'+uf+'.json',json({units:data.units.filter(u=>u.uf===uf),monthly:data.monthly.filter(r=>r[2]===uf)}));}
const scopes=['Brasil',...ufs],stats={};
for(const scope of scopes){const us=data.units.filter(u=>scope==='Brasil'||u.uf===scope);const rs=data.monthly.filter(r=>scope==='Brasil'||r[2]===scope);stats[scope]={counts:{},metrics:{},monthly:[]};
 for(const kind of ['CRAS','CREAS','DIA']){const group=us.filter(u=>u.kind===kind);stats[scope].counts[kind]={total:group.length,local:group.filter(u=>!['Regional','Estadual'].includes(u.scope)).length,regional:group.filter(u=>u.scope==='Regional').length,state:group.filter(u=>u.scope==='Estadual').length,complete:group.filter(u=>u.complete==='Completo').length};}
 for(const c of data.catalog.filter(c=>c.kind!=='RMA')){const group=us.filter(u=>u.kind===c.kind);const observed=group.map(u=>u.values[c.variable]).filter(v=>v.status==='OBSERVADO');const categories=new Map();for(const v of observed){if(typeof v.value==='string')categories.set(v.value,(categories.get(v.value)||0)+1);}
 const nums=observed.filter(v=>typeof v.value==='number').map(v=>v.value).sort((a,b)=>a-b);const n=nums.length;
 stats[scope].metrics[c.id]={total:group.length,observed:observed.length,notApplicable:group.filter(u=>u.values[c.variable].status==='NAO_APLICAVEL').length,missing:group.filter(u=>u.values[c.variable].status==='NAO_INFORMADO').length,categories:[...categories].sort((a,b)=>a[0].localeCompare(b[0],'pt-BR')).map(([label,count])=>({label,count,percent:100*count/observed.length})),sum:n?nums.reduce((a,b)=>a+b,0):null,median:n?(n%2?nums[(n-1)/2]:(nums[n/2-1]+nums[n/2])/2):null};}
 for(let month=1;month<=12;month++){const group=rs.filter(r=>r[3]===month);const values={};for(const [k,i] of [['a1',4],['a2',6],['c1',8],['c5',10]]){const obs=group.filter(r=>r[i]!==null);values[k]={sum:obs.length?obs.reduce((s,r)=>s+r[i],0):null,observed:obs.length,total:group.length,changed:group.filter(r=>r[i]!==r[i+1]).length};}stats[scope].monthly.push({month,values});}
}
files.set('panorama.json',json({year:2025,ufs,stats,catalog:data.catalog,manifest}));
files.set('dicionario.json',json(data.catalog));files.set('manifesto.json',json(manifest));
files.set('memoria-escore.json',json({edition:'OBEE-servicos-v0.4-experimental',chapter:'assistance',value:null,status:'COBERTURA_INSUFICIENTE',pillars:{access:{value:null,missing:['Demanda elegível e pessoas atendidas sem duplicidade','Referências de acesso validadas']},response:{value:null,missing:['Continuidade individual e encaminhamentos concluídos','Referências de espera por modalidade']},quality:{value:null,missing:['Segurança e resultados verificados','Experiência representativa de usuários e não atendidos']}},capacity_is_not_service_quality:true,resources_are_context:true,satisfaction_is_separate:true}));
for(const [name,body] of files){const temp=new URL(name+'.tmp',out);writeFileSync(temp,body);renameSync(temp,new URL(name,out));}
console.log(`Assistência social: ${data.units.length} unidades e ${data.monthly.length} formulários RMA; arquivos íntegros.`);
