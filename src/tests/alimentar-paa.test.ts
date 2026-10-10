import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import type { SnapshotAlimentar } from '../lib/eficiencia/seguranca-alimentar/tipos';
const data=JSON.parse(readFileSync('public/eficiencia/seguranca-alimentar/paa.json','utf8')) as SnapshotAlimentar;
describe('PAA: extrato de execução, cobertura e perímetro',()=>{
 it('preserva respostas completas e fichas oficiais com hashes reproduzíveis',()=>{
  for(const f of data.fontes){
   const raw=gunzipSync(readFileSync('public'+f.bruto));expect(createHash('sha256').update(raw).digest('hex')).toBe(f.sha256);
   if(f.id.startsWith('mds-paa-')){const response=JSON.parse(raw.toString('utf8')).response;expect(response.docs.length).toBe(response.numFound);expect(response.numFound).toBe(5571);}
  }
 });
 it('reproduz cada valor municipal sem transformar campo ausente em zero',()=>{
  const code=new Map(data.territorios.filter(t=>t.nivel==='municipio').map(t=>[t.id.slice(0,6),t.id]));
  for(const f of data.fontes.filter(f=>f.id.startsWith('mds-paa-'))){
   const docs=JSON.parse(gunzipSync(readFileSync('public'+f.bruto)).toString('utf8')).response.docs as Record<string,unknown>[];
   for(const [id,field] of [['paa-fornecedores','agricultores_fornec_paa_i'],['paa-pagamentos','recur_pagos_agricul_paa_f']]){
    const rows=new Map(data.observacoes.filter(o=>o.fonteId===f.id&&o.indicadorId===id&&o.territorioId.length===7).map(o=>[o.territorioId,o]));
    expect(rows.size).toBe(docs.length);
    for(const doc of docs){const o=rows.get(code.get(String(doc.codigo_ibge))!)!;expect(o.valor).toBe(typeof doc[field]==='number'?doc[field]:null);if(o.valor===null)expect(o.status).toBe('ausente');}
   }
  }
 });
 it('agregações somam apenas valores conhecidos e declaram cobertura variável',()=>{
  for(const id of ['paa-fornecedores','paa-pagamentos'])for(const year of ['2023','2024','2025']){
   const municipal=data.observacoes.filter(o=>o.indicadorId===id&&o.periodo===year&&o.territorioId.length===7);
   const national=data.observacoes.find(o=>o.indicadorId===id&&o.periodo===year&&o.territorioId==='1')!;
   expect(municipal.length).toBe(5571);expect(national.municipiosUniverso).toBe(5571);
   expect(national.municipiosComDado).toBe(municipal.filter(o=>o.valor!==null).length);
   expect(national.valor).toBeCloseTo(municipal.reduce((s,o)=>s+(o.valor??0),0),2);
  }
  expect(data.indicadores.find(i=>i.id==='paa-fornecedores')!.unidade).toBe('registros de fornecedores');
  expect(data.fontes.find(f=>f.id==='mds-paa-202512')!.limitacoes.join(' ')).toContain('sem deduplicação entre municípios');
 });
});
