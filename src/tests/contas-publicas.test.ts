import {describe,it,expect} from 'vitest';
import {CAPITULOS,INDICADORES,FONTES} from '../lib/contas-publicas/catalogo';
import {razao,desvioPercentual,compararRecortes} from '../lib/contas-publicas/metricas';
describe('contratos de Contas Públicas',()=>{
 it('preserva zero observado e distingue ausência e inelegibilidade',()=>{
  expect(razao(0,10)).toEqual({valor:0,status:'calculado'});
  expect(razao(null,10).status).toBe('ausente');
  expect(razao(10,0).status).toBe('inelegivel');
  expect(razao(10,-1).status).toBe('inelegivel');
  expect(razao(NaN,2).status).toBe('inelegivel');
  expect(razao(Infinity,2).status).toBe('inelegivel');
  expect(razao(Number.MAX_VALUE,0.01).status).toBe('inelegivel');
 });
 it('mantém sinal e superação sem truncar em 100%',()=>{
  expect(desvioPercentual(80,100)).toEqual({valor:-20,status:'calculado'});
  expect(razao(125,100)).toEqual({valor:125,status:'calculado'});
  expect(desvioPercentual(null,100).status).toBe('ausente');
  expect(desvioPercentual(10,0).status).toBe('inelegivel');
 });
 it('recusa operação direta entre recortes incompatíveis',()=>{
  const r={perimetro:'União',periodo:'2025',unidade:'BRL nominal',estagio:'liquidado',classificacao:'funcional-v1'};
  expect(compararRecortes(r,{...r}).comparavel).toBe(true);
  expect(compararRecortes(r,{...r,perimetro:'Governo Geral',estagio:'pago'}).divergencias).toEqual(['perimetro','estagio']);
  expect(compararRecortes({...r,unidade:''},{...r,unidade:''}).comparavel).toBe(false);
 });
 it('não deixa capítulo sem indicadores ou fonte sem destino',()=>{
  expect(new Set(INDICADORES.map(i=>i.id)).size).toBe(INDICADORES.length);
  for(const c of CAPITULOS)expect(INDICADORES.some(i=>i.capitulo===c.id)).toBe(true);
  for(const i of INDICADORES){expect(CAPITULOS.some(c=>c.id===i.capitulo)).toBe(true);expect(new URL(FONTES[i.fonte].url).protocol).toBe('https:');expect(i.status).toBe('aguardando-integracao');expect(i.ressalva.length).toBeGreaterThan(10)}
 });
});
