import {readFileSync,writeFileSync} from 'node:fs';
const base='public/eficiencia/previdencia/';
const {tables,sources}=JSON.parse(readFileSync(base+'snapshot.json','utf8'));
const escape=v=>{const s=String(v??'');return /[;"\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
const rows=[['Tabela','Linha original','Rótulo original','Coluna (base 0)','Valor original','Unidade original','URL da fonte']];
for(const source of sources)for(const row of tables[source.id])for(const [col,value] of row.values.entries())rows.push([source.id,Number(row.id)+1,row.name,col,value===null?'':String(value).replace('.',','),['b.2','b.3','b.14','b.15','b.17'].includes(source.id)?'R$ mil':'contagem',source.url]);
writeFileSync(base+'tabelas.csv','\uFEFF'+rows.map(row=>row.map(escape).join(';')).join('\r\n')+'\r\n');
console.log(`Previdência: ${rows.length-1} células normalizadas materializadas.`);
