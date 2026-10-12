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
