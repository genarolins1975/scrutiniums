import {describe,it,expect} from 'vitest';
import {cumprimentoFisico,eficienciaRelativaSIOP,numeroAFFO,chaveProgramacao,validarUniversoProgramacoes,type Programacao} from '../lib/contas-publicas/entregas';
describe('metas físicas: elegibilidade e referências preservadas',()=>{
 it('distingue ausência, zero observado e meta zero',()=>{
  expect(cumprimentoFisico(null,100).estado).toBe('ausente');
  expect(cumprimentoFisico(0,100).valor).toBe(0);
  expect(cumprimentoFisico(10,0).estado).toBe('inelegivel');
 });
 it('mantém superação e permite mostrar meta original e atualizada separadamente',()=>{
  expect(cumprimentoFisico(120,100).valor).toBe(120);
  expect(cumprimentoFisico(120,150).valor).toBe(80);
 });
 it('recusa valores negativos, não finitos e overflow',()=>{
  for(const [r,m] of [[-1,10],[1,-10],[Infinity,10],[10,NaN],[Number.MAX_VALUE,0.01]])expect(cumprimentoFisico(r,m).estado).toBe('inelegivel');
 });
 it('calcula EFLOA somente com bases financeiras positivas',()=>{
  expect(eficienciaRelativaSIOP(80,100,1000,800).valor).toBe(100);
  expect(eficienciaRelativaSIOP(80,100,1000,0).estado).toBe('inelegivel');
  expect(eficienciaRelativaSIOP(80,100,null,800).estado).toBe('ausente');
  expect(eficienciaRelativaSIOP(80,100,0,800).estado).toBe('inelegivel');
  expect(eficienciaRelativaSIOP(80,100,Infinity,800).estado).toBe('inelegivel');
 });
 it('preserva ausência no CSV e não aceita números parcialmente legíveis',()=>{
  expect(numeroAFFO('     0,00')).toBe(0);expect(numeroAFFO(' 1234,56 ')).toBe(1234.56);
  expect(numeroAFFO('')).toBeNull();expect(numeroAFFO('NA')).toBeNull();
  for(const x of ['123abc','1.234,56','NaN','Infinity','-'])expect(()=>numeroAFFO(x)).toThrow();
 });
});
describe('universo das programações',()=>{
 const p:Programacao={exercicio:2025,esfera:'10',orgao:'01000',uo:'01101',programa:'0034',acao:'10S2',localizador:'5664',nivel:'localizador',po:null};
 it('não mistura localizadores e planos orçamentários',()=>{
  expect(()=>validarUniversoProgramacoes([p,{...p,nivel:'plano-orcamentario',po:'0001'}])).toThrow(/sobrepostos/);
 });
 it('recusa duplicação sem somar silenciosamente',()=>{
  expect(()=>validarUniversoProgramacoes([p,{...p}])).toThrow(/duplicada/);
  expect(()=>validarUniversoProgramacoes([p,{...p,uo:'01102'}])).not.toThrow();
 });
 it('preserva zeros à esquerda e o perímetro da programação',()=>{
  expect(chaveProgramacao(p)).not.toBe(chaveProgramacao({...p,esfera:'20'}));
  expect(chaveProgramacao(p)).toContain('01000');
  expect(()=>chaveProgramacao({...p,uo:''})).toThrow();
  expect(()=>chaveProgramacao({...p,nivel:'plano-orcamentario'})).toThrow();
  expect(()=>chaveProgramacao({...p,po:'0001'})).toThrow();
 });
});
