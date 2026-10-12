import {describe,it,expect} from 'vitest';
import d from '@/lib/contas-publicas/snapshots/custos.json';
describe('custos RFC 2025',()=>{
 it('preserva a referência publicada e a edição revisada',()=>{
  const t=d.registros.find(r=>r.id==='total')!;expect([t.ano2025,t.ano2024,t.realPublicado]).toEqual([3661983.6,3429963.1,1.7]);
  expect(d.fonte.sha256).toBe('a4f30c1c0e6c1010a9e71eb3fb65c889ae412907c3884ab58343684c14c0d400');
  expect(d.registros).toHaveLength(27);expect(new Set(d.registros.map(r=>r.id)).size).toBe(27);
 });
 it('mantém a hierarquia sem duplicar pais, filhos ou itens fora dos custos',()=>{
  const topo=d.registros.filter(r=>r.parent==='total');expect(topo).toHaveLength(5);expect(topo.some(r=>r.id==='reparticao'||r.id==='reducoes')).toBe(false);
  expect(d.registros.filter(r=>r.parent==='funcionamento')).toHaveLength(4);
  for(const c of d.conferencia){const filhos=d.registros.filter(r=>r.parent===c.grupo);const campo=c.ano===2025?'ano2025':'ano2024';const soma=filhos.reduce((n,r)=>n+r[campo],0);expect(soma).toBeCloseTo(c.somaParcelas,5);expect(c.totalPublicado-soma).toBeCloseTo(c.residuoMilhoes,5);expect(Math.abs(c.residuoMilhoes)).toBeLessThanOrEqual((filhos.length+1)*.05)}
 });
 it('preserva percentuais publicados em vez de inferir precisão inexistente',()=>{
  const mora=d.registros.find(r=>r.id==='mora')!;expect(mora.nominalPublicado).toBe(134.9);expect(mora.realPublicado).toBe(123.7);
  expect(100*(mora.ano2025/mora.ano2024-1)).not.toBeCloseTo(mora.nominalPublicado,1);
 });
});

import {resumirCustos} from '@/lib/contas-publicas/custos-leitura';
describe('leitura direta de custos',()=>{
 it('distingue maior componente, maior aumento nominal e maior alta real',()=>{
  const r=resumirCustos(d.registros,'total');
  expect(r.maiores[0].id).toBe('previdencia');expect(r.altas[0].id).toBe('financeiros');expect(r.quedas[0].id).toBe('outros');
  expect(r.percentuais[0].id).toBe('financeiros');expect(r.maiores.reduce((s,x)=>s+x.ano2025,0)).toBeCloseTo(3661983.5,1);
 });
 it('recalcula o recorte e mantém a pequena base da alta percentual visível',()=>{
  const r=resumirCustos(d.registros,'funcionamento');
  expect(r.maiores[0].id).toBe('servicos');expect(r.altas[0].id).toBe('servicos');expect(r.percentuais[0].id).toBe('mora');
  expect(r.percentuais[0].ano2024).toBe(11.3);expect(r.percentuais[0].realPublicado).toBe(123.7);expect(r.quedas).toHaveLength(0);
 });
 it('não inventa alta em conjunto de quedas e preserva empates',()=>{
  const base={id:'a',parent:'grupo',nome:'A',ano2024:100,ano2025:80,diferencaPublicada:-20,nominalPublicado:-20,realPublicado:-24};
  const r=resumirCustos([base,{...base,id:'b',nome:'B'}],'grupo');expect(r.altas).toHaveLength(0);expect(r.percentuais).toHaveLength(0);expect(r.maiores.filter(x=>x.ano2025===r.maiores[0].ano2025)).toHaveLength(2);
 });
});
