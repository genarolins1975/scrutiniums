import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {base,csvTic,seleciona} from '@/lib/eficiencia/cultura/dados';
import {analisaHtml} from './support/html-contrato';
describe('Cultura: universos, precisão e reconciliação',()=>{
 it('preserva as células oficiais e as margens publicadas',()=>{
  const wifi=seleciona('B10','Sim','biblioteca');
  expect(wifi).toHaveLength(1);
  expect(wifi[0]).toMatchObject({valor:64.8432,margem:5.563,origem:{aba:'B10',linha:7,coluna:3}});
  expect(base.tic).toHaveLength(210);
  expect(base.tic.every(r=>r.valor>=0&&r.valor<=100&&r.margem>=0)).toBe(true);
  expect(seleciona('C11','Realização de oficinas ou atividades de formação','ponto')[0].valor).toBe(92.8081);
 });
 it('conserva os universos e a precisão na exportação do recorte',()=>{
  const linhas=seleciona('D4B','Sim','BIBLIÓTECA');
  expect(linhas).toHaveLength(1);
  const csv=csvTic(linhas);
  expect(csv).toContain('11.26');
  expect(csv).toContain('95%');
  expect(csv).toContain('inclui públicos e privados');
  expect(csv).not.toContain('Museu');
  expect(seleciona('B10','Sim','inexistente')).toHaveLength(0);
 });
 it('reconcilia esferas e 27 governos estaduais em cada um dos onze anos',()=>{
  for(let ano=2013;ano<=2023;ano++){
   const g=base.gastos.filter(r=>r.ano===ano), u=base.ufs.filter(r=>r.ano===ano);
   expect(g).toHaveLength(4);expect(u).toHaveLength(27);
   expect(Math.abs(g.find(r=>r.entidade==='Total')!.valor-g.filter(r=>r.entidade!=='Total').reduce((s,r)=>s+r.valor,0))).toBeLessThan(.01);
   expect(Math.abs(g.find(r=>r.entidade==='Estadual')!.valor-u.reduce((s,r)=>s+r.valor,0))).toBeLessThan(.01);
  }
  const total=base.gastos.find(r=>r.ano===2023&&r.entidade==='Total')!;
  expect(total.valor).toBeCloseTo(18893947618.284584,2);
  expect(total.pesoOrcamento).toBeCloseTo(.381052966,8);
 });
 it('preserva as composições publicadas sem somar atividades sobrepostas',()=>{
  for(const aba of ['A3','A4'])for(const tipo of base.tipos){
   expect(base.tic.filter(r=>r.aba===aba&&r.tipo===tipo).reduce((s,r)=>s+r.valor,0)).toBeCloseTo(100,2);
  }
  expect(base.catalogo.find(f=>f.localizacao_registro.startsWith('C11;'))!.limites).toContain('não devem ser somados');
 });
 it('publica fichas, fontes e localizações para todas as medidas',()=>{
  expect(base.catalogo).toHaveLength(12);
  for(const f of base.catalogo)for(const k of ['id','nome','familia','pergunta','o_que_mede','o_que_nao_mede','formula','numerador','denominador','unidade','fontes','localizacao_registro','periodo','perimetro','ausencias','transformacoes','estado_publicacao','limites'])expect(f).toHaveProperty(k);
  for(const f of base.fontes)expect(f.sha256).toMatch(/^[a-f0-9]{64}$/);
 });
 const build=existsSync('.next/server/app/eficiencia-estatal/cultura.html');
 it.skipIf(!build)('sete rotas geradas obedecem ao contrato de HTML',()=>{
  for(const slug of ['', 'rede','acesso','atividades','acervos','recursos','metodos']){
   const p='.next/server/app/eficiencia-estatal/cultura'+(slug?'/'+slug:'')+'.html';
   expect(existsSync(p)).toBe(true);
   expect(analisaHtml(readFileSync(p,'utf8'),p).violacoes).toEqual([]);
  }
 });
});
