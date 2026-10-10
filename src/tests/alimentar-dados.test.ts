import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import type { SnapshotAlimentar } from '../lib/eficiencia/seguranca-alimentar/tipos';
const base='public/eficiencia/seguranca-alimentar/';
const datasets=['snapshot','cadinsan','sisan','aquisicao'].map(file=>JSON.parse(readFileSync(base+file+'.json','utf8')) as SnapshotAlimentar);
describe('Segurança Alimentar: evidência e universos',()=>{
 it('reproduz hashes das respostas originais descomprimidas',()=>{
  for(const dataset of datasets) for(const source of dataset.fontes){
   const raw=gunzipSync(readFileSync('public'+source.bruto));
   expect(createHash('sha256').update(raw).digest('hex')).toBe(source.sha256);
  }
 });
 it('preserva chaves únicas por dimensão e códigos regionais sem colisão com Brasil',()=>{
  for(const data of datasets){
   const keys=data.observacoes.map(o=>[o.indicadorId,o.territorioId,o.periodo,o.dimensao,o.grupo].join('|'));
   expect(new Set(keys).size).toBe(keys.length);
   const territories=new Set(data.territorios.map(t=>t.id));
   const indicators=new Set(data.indicadores.map(i=>i.id));
   for(const o of data.observacoes){expect(territories.has(o.territorioId)).toBe(true);expect(indicators.has(o.indicadorId)).toBe(true);}
   expect(data.territorios.find(t=>t.id==='1')!.nome).toBe('Brasil');
  }
 });
 it('EBIA prevalência usa total do mesmo grupo; não reutiliza composição ou CV da contagem',()=>{
  const ebia=datasets[0];
  for(const o of ebia.observacoes){
   if(o.numerador===undefined)continue;
   expect(o.cv).toBeNull();
   if(o.numerador===null||o.denominador===null||o.denominador===0) expect(o.valor).toBeNull();
   else expect(Math.abs(o.valor!-100*o.numerador/o.denominador!)).toBeLessThanOrEqual(0.050000000001); // Published at one decimal; Python uses half-even ties.
   const den=ebia.observacoes.find(d=>d.indicadorId==='ebia-total-domicilios'&&d.territorioId===o.territorioId&&d.periodo===o.periodo&&d.dimensao===o.dimensao&&d.grupo===o.grupo);
   expect(den!.valor).toBe(o.denominador);
  }
  expect(ebia.observacoes.filter(o=>!['total','area'].includes(o.dimensao)).every(o=>o.territorioId==='1')).toBe(true);
 });
 it('mantém CadINSAN no universo do anexo, com diferenças e cenários não causais',()=>{
  const cad=datasets[1];
  const denominator=cad.observacoes.filter(o=>o.indicadorId==='cadinsan-familias-analisadas'&&o.territorioId.length===7);
  expect(denominator).toHaveLength(5570);expect(denominator.reduce((s,o)=>s+o.valor!,0)).toBe(21236683);
  expect(cad.fontes[0].limitacoes.join(' ')).toContain('223.323');
  const rows=new Map(cad.observacoes.filter(o=>o.territorioId.length===7&&o.indicadorId==='cadinsan-risco-familias').map(o=>[o.territorioId,o.valor!]));
  expect(cad.observacoes.filter(o=>o.territorioId.length===7&&o.indicadorId==='cadinsan-cenario-sem-pbf-familias'&&o.valor!<rows.get(o.territorioId)!).length).toBe(270);
 });
 it('agregações MUNIC somam respostas conhecidas e preservam cobertura e ausência',()=>{
  for(const data of datasets.slice(2))for(const indicator of data.indicadores){
   const municipal=data.observacoes.filter(o=>o.indicadorId===indicator.id&&o.territorioId.length===7);
   const national=data.observacoes.find(o=>o.indicadorId===indicator.id&&o.territorioId==='1')! as typeof municipal[number]&{municipiosComDado:number;municipiosUniverso:number};
   expect(municipal).toHaveLength(5570);
   expect(national.municipiosUniverso).toBe(5570);
   expect(national.municipiosComDado).toBe(municipal.filter(o=>o.valor!==null).length);
   expect(national.valor).toBe(municipal.reduce((s,o)=>s+(o.valor??0),0));
   for(const o of municipal)if(o.valor===null)expect(o.status).toBe('ausente');
  }
 });
});
