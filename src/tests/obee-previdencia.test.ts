import {describe,it,expect} from 'vitest';
import {ehRotaPublica} from '@/lib/rotasPublicas';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tabelas,fontes,regioes,valor,total,medidas,calcular,csv} from '@/lib/eficiencia/previdencia/dados';
describe('Previdência: conciliação e universos',()=>{
 it('respeita o método público e os painéis e downloads com sessão',()=>{
  expect(ehRotaPublica('/eficiencia-estatal/previdencia/metodos')).toBe(true);
  for(const p of ['/eficiencia-estatal/previdencia','/eficiencia-estatal/previdencia/dados','/eficiencia/previdencia/snapshot.json'])expect(ehRotaPublica(p)).toBe(false);
 });
 it('preserva 27 UFs, cinco regiões e Brasil nas tabelas territoriais',()=>{
  for(const t of ['b.13','b.14','b.15','b.16','b.17','a.14','43.1','43.2']){
   expect(tabelas[t]).toHaveLength(33);expect(tabelas[t].filter(r=>regioes.includes(r.territory))).toHaveLength(5);
   expect(tabelas[t].filter(r=>r.territory!=='BRASIL'&&!regioes.includes(r.territory))).toHaveLength(27);
  }
 });
 it('concilia grupos disjuntos, totais por espécie e por território',()=>{
  for(const [a,b] of [['b.1','b.13'],['b.2','b.14'],['b.3','b.15'],['a.1','a.14']])expect(tabelas[a][0].values).toEqual(tabelas[b][0].values);
  for(const t of ['b.1','a.1'])for(const year of ['2022','2023','2024'])expect(['BENEFÍCIOS DO RGPS','BENEFÍCIOS ASSISTENCIAIS','ENCARGOS PREV. UNIÃO - EPU'].reduce((s,g)=>s+valor(t,g,year)!,0)).toBe(total(t,year));
  expect(total('b.1')).toBe(40768493);expect(valor('b.1','BENEFÍCIOS DO RGPS')).toBe(34396083);
  expect(total('a.1')).toBe(6938784);
  expect(['Tempo de Contribuição','Idade','Invalidez'].reduce((s,g)=>s+valor('b.1',g)!,0)).toBe(valor('b.1','Aposentadorias'));
  expect(valor('b.1','Portador de Deficiência')!+valor('b.1','Idoso')!).toBe(valor('b.1','Amparos Assistenciais'));
 });
 it('usa o mesmo mês e universo para a razão monetária; não anualiza dezembro',()=>{
  expect(calcular(medidas.dezembro,tabelas['b.14'][0],'2024','total')).toBe(67883129000);
  expect(calcular(medidas.anual,tabelas['b.15'][0],'2024','total')).toBe(876903134000);
  expect(calcular(medidas.medio,tabelas['b.14'][0],'2024','total')).toBeCloseTo(67883129000/40768493,8);
  expect(tabelas['b.16'][0].values[11]).toBe(total('b.13'));
  expect(calcular(medidas.medio,{...tabelas['b.14'][0],values:Array(9).fill(null)},'2024','total')).toBeNull();
 });
 it('não transforma ausência em zero e exige 12 meses informados',()=>{
  expect(tabelas['43.1'][0].values[3]).toBeNull();
  expect(calcular(medidas.agencias,tabelas['43.1'][0],'2024','total')).toBe(1570);
  expect(calcular(medidas.atendimentos,{...tabelas['43.2'][0],values:[null,...Array(11).fill(10)]},'2024','total')).toBeNull();
 });
 it('preserva linhas oficiais inteiramente compostas por ausência',()=>{
  for(const rows of Object.values(tabelas))expect(rows).toHaveLength(33);
  for(const t of ['b.1','b.2','b.3','a.1'])expect(tabelas[t].find(r=>r.name==='Salário-Família')?.values).toEqual(Array(9).fill(null));
  expect(tabelas['a.1'].find(r=>r.name==='Rendas Mensais Vitalícias')?.values).toEqual(Array(9).fill(null));
  expect(tabelas['a.1'].filter(r=>r.values.every(v=>v===null))).toHaveLength(7);
 });
 it('preserva o manifesto auditado por SHA-256 e exporta null como célula vazia',()=>{
  expect(JSON.parse(readFileSync(join(process.cwd(),'data/previdencia/manifest.json'),'utf8'))).toEqual(fontes);
  expect(fontes.every(f=>/^[a-f0-9]{64}$/.test(f.sha256))).toBe(true);
  expect(csv(['valor','nota'],[[null,'texto; "a"']])).toBe('\uFEFF"valor";"nota"\r\n"";"texto; ""a"""');
 });
});
