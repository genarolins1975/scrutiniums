import {describe,it,expect} from 'vitest';
import {moeda,numero,participacao,razao,variacaoPercentual,pontosPercentuais,dividirEmCem,compararSaldo} from '../lib/contas-publicas/formato';
import {DADOS} from '../lib/contas-publicas/dados';
import {COBERTURA,PAINEIS_COMPLEMENTARES} from '../lib/contas-publicas/cobertura';
describe('apresentação monetária e razões',()=>{
 it('declara escala, preserva nulo e trata fronteiras e sinais',()=>{
  expect(moeda(999.9e9,'reais')).toBe('R$ 999,9 bilhões');
  expect(moeda(1e12,'reais')).toBe('R$ 1,00 trilhões');
  expect(moeda(1e6,'milhoes')).toBe(moeda(1e12,'reais'));
  expect(moeda(-61_700,'milhoes')).toBe('−R$ 61,7 bilhões');
  expect(moeda(1e9,'reais',{curta:true,variacao:true})).toBe('+R$ 1,0 bi');
  expect(moeda(-0,'reais')).toBe('R$ 0,0');
  expect(moeda(null,'reais')).toBe('Não informado');
  expect(numero(-0.01)).toBe('0,0');
  expect(participacao(0,100)).toBe('0,0%');
  expect(razao(1,3)).toBe('33,3%');
  expect(razao(1,0)).toBe('Não calculável');
  expect(razao(null,1)).toBe('Não informado');
  expect(variacaoPercentual(2)).toBe('+2,0%');
  expect(pontosPercentuais(2)).toBe('+2,0 p.p.');
 });
 it('fecha a régua de cem por maiores restos sem alterar os valores da fonte',()=>{
  const b=DADOS.orcamento.find(b=>b.ano===2025)!;
  const pesos=['6','2','3','1','5','4'].map(c=>b.grupos.find(g=>g.codigo===c)!.pago);
  const cem=dividirEmCem(pesos);
  expect(cem).toEqual([35.1,7.2,45.6,7.9,3.4,0.8]);
  expect(cem.reduce((s,v)=>s+Math.round(v*10),0)).toBe(1000);
  expect(dividirEmCem([1,1,1])).toEqual([33.4,33.3,33.3]);
  expect(()=>dividirEmCem([0,0])).toThrow();expect(()=>dividirEmCem([1,-1])).toThrow();
 });
 it('descreve déficit, superávit e mudança de sinal sem inverter o sentido',()=>{
  expect(compararSaldo(-61_700,-42_900,2025)).toContain('déficit aumentou em R$ 18,8 bilhões');
  expect(compararSaldo(-40_000,-42_900,2025)).toContain('déficit diminuiu');
  expect(compararSaldo(20_000,10_000,2025)).toContain('superávit aumentou');
  expect(compararSaldo(10_000,20_000,2025)).toContain('superávit diminuiu');
  expect(compararSaldo(-1,1,2025)).toMatch(/superávit.*para déficit/);
  expect(compararSaldo(1,-1,2025)).toMatch(/déficit.*para superávit/);
  expect(compararSaldo(0,1,2025)).toContain('para equilíbrio');
 });
 it('distingue cinco indicadores observados dos painéis complementares de custos e de despesa por área',()=>{
  expect(COBERTURA).toHaveLength(12);
  // a composição funcional da despesa (Panorama) passou a ter dados com o painel Despesa por área (20/10/2026)
  expect(COBERTURA.flatMap(c=>c.observados).map(i=>i.id)).toEqual(['resultado-primario','composicao','execucao-liquidada','rap-idade','meta-entrega']);
  expect(COBERTURA.flatMap(c=>c.pendentes)).toHaveLength(19);
  expect(PAINEIS_COMPLEMENTARES.map(p=>p.href)).toEqual(['/contas-publicas/custos#custos-observados','/contas-publicas/por-area']);
 });
});
