import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {ESCALA,converterEscala,compararDespesas,denominador,exportarComparacaoFiscal} from '@/lib/contas-publicas/escala';
import {fiscalAcumulado} from '@/lib/contas-publicas/dados';

describe('IBGE e escala das contas federais',()=>{
 it('preserva bytes oficiais, população em pessoas e quatro trimestres por ano',()=>{
  for(const fonte of Object.values(ESCALA.fontes)) {
   const raw=readFileSync(`data/contas-publicas/escala-2026-10-12/${fonte.arquivo}`);
   expect(createHash('sha256').update(raw).digest('hex')).toBe(fonte.sha256);
  }
  expect(ESCALA.registros.map(r=>[r.ano,r.populacao,r.pibMilhoes])).toEqual([[2024,212583750,11779251],[2025,213421037,12738566]]);
  for(const r of ESCALA.registros){expect(r.trimestres).toHaveLength(4);expect(r.trimestres.reduce((s,t)=>s+t.valorMilhoes,0)).toBe(r.pibMilhoes);}
 });
 it('converte unidades sem perder sinal ou confundir milhões com reais',()=>{
  expect(converterEscala(12738566,2025,12,'pib')).toBe(100);
  expect(converterEscala(213.421037,2025,12,'habitante')).toBeCloseTo(1,10);
  expect(converterEscala(-61694.308980989066,2025,12,'pib')).toBeCloseTo(-0.48431127,7);
  expect(converterEscala(0,2025,12,'habitante')).toBe(0);
 });
 it('não anualiza parcial, não imputa denominador e distingue zero de ausência',()=>{
  expect(denominador(2026,7)).toBeNull();
  expect(converterEscala(100,2025,7,'pib')).toBeNull();
  expect(converterEscala(100,2023,12,'habitante')).toBeNull();
  expect(converterEscala(null,2025,12,'total')).toBeNull();
  expect(converterEscala(Infinity,2025,12,'pib')).toBeNull();
  expect(converterEscala(100,2025,0,'total')).toBeNull();
  expect(compararDespesas(2024,12,'habitante')).toBeNull();
  expect(compararDespesas(2026,7,'pib')).toBeNull();
 });
 it('compara o mesmo número de meses e concilia os quatro grupos com a despesa',()=>{
  for(const [ano,mes] of [[2024,12],[2025,12],[2026,7]]){
   const linhas=compararDespesas(ano,mes,'total')!;
   const a=fiscalAcumulado(ano,mes)!,b=fiscalAcumulado(ano-1,mes)!;
   expect(linhas.reduce((s,l)=>s+l.atual,0)).toBeCloseTo(a.despesa,6);
   expect(linhas.reduce((s,l)=>s+l.anterior,0)).toBeCloseTo(b.despesa,6);
   expect(linhas.reduce((s,l)=>s+l.diferenca,0)).toBeCloseTo(a.despesa-b.despesa,6);
  }
 });
 it('usa o denominador próprio de cada ano e calcula diferença da razão em p.p.',()=>{
  const linhas=compararDespesas(2025,12,'pib')!;
  const l=linhas.find(x=>x.id==='previdencia')!;
  expect(l.atual).toBeCloseTo(1026872.53793049/12738566*100,9);
  expect(l.anterior).toBeCloseTo(938544.5372642202/11779251*100,9);
  expect(l.diferenca).toBeCloseTo(l.atual-l.anterior,12);
  const nominal=compararDespesas(2025,12,'total')!;
  expect([...nominal].sort((a,b)=>b.atual-a.atual)[0].id).toBe('previdencia');
  expect([...nominal].sort((a,b)=>Math.abs(b.diferenca)-Math.abs(a.diferenca))[0].id).toBe('previdencia');
 });
 it('exporta o recorte integral, com unidades do valor e da diferença explícitas',()=>{
  const nominal=exportarComparacaoFiscal(compararDespesas(2026,7,'total')!,2026,7,'total');
  expect(nominal.split('\r\n')).toHaveLength(5);
  expect(nominal).toContain('"R$ milhões correntes";"R$ milhões correntes";"1-7"');
  const pib=exportarComparacaoFiscal(compararDespesas(2025,12,'pib')!,2025,12,'pib');
  expect(pib).toContain('"% do PIB";"p.p.";"1-12"');
 });
});
