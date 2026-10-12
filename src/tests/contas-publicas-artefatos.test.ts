import {describe,it,expect} from 'vitest';
import {DADOS,fiscalAcumulado} from '../lib/contas-publicas/dados';
import {intervalosExecucao,ponteFiscal,idadesRAP} from '../lib/contas-publicas/artefatos';
import rap from '../lib/contas-publicas/snapshots/rap.json';
import custos from '../lib/contas-publicas/snapshots/custos.json';
import {dividirEmCem} from '../lib/contas-publicas/formato';
import {somarRAP} from '../lib/contas-publicas/rap-modelo';
describe('identidades dos artefatos didáticos',()=>{
 it('preserva dívida, estágios e soma das três diferenças',()=>{
  const b=DADOS.orcamento.find(b=>b.ano===2025)!;const d=intervalosExecucao(b.total);
  expect(d.map(x=>Number((x.valor/1e9).toFixed(1)))).toEqual([456,224.7,100.5]);
  expect(d.reduce((s,x)=>s+x.valor,0)).toBe(b.total.atualizada-b.total.pago);
  const divida=b.grupos.filter(g=>['2','6'].includes(g.codigo)).reduce((s,g)=>s+g.pago,0);
  expect(divida).toBe(2135085643780);expect(100*divida/b.total.pago).toBeCloseTo(42.2,1);
 });
 it.each([[2025,12],[2024,12],[2026,7]])('fecha a cascata fiscal %s/%s na tolerância publicada',(ano,mes)=>{
  const v=fiscalAcumulado(ano,mes)!;const ponte=ponteFiscal(v);
  expect(Math.abs(ponte[ponte.length-2].fim-v.resultado)).toBeLessThan(DADOS.validacao.toleranciaRTNMilhoes);
  expect(Math.abs(v.receitaTotal-v.transferencias-v.receitaLiquida)).toBeLessThan(DADOS.validacao.toleranciaRTNMilhoes);
 });
 it('preserva o estoque nas faixas de idade em todos os recortes publicados',()=>{
  for(const periodo of ['000/2026','DEZ/2025','DEZ/2024']){
   const rs=rap.registros.filter(r=>r.periodo===periodo);const total=somarRAP(rs);
   expect(idadesRAP(rs,Number(periodo.slice(-4))).reduce((s,r)=>s+r.saldo,0)).toBeCloseTo(total.saldo,1);
   expect(total.pagos+total.cancelados+total.saldo).toBeCloseTo(total.inscritos+total.reinscritos,1);
  }
 });
 it('fecha em cem cada composição de custos, mantendo apenas irmãos',()=>{
  for(const grupo of ['total','operacao','mao-obra','funcionamento','servicos','material','depreciacao']){
   const parcelas=custos.registros.filter(r=>r.parent===grupo);
   expect(dividirEmCem(parcelas.map(r=>r.ano2025)).reduce((s,v)=>s+Math.round(v*10),0)).toBe(1000);
  }
 });
});

import {escalaCumprimento} from '../components/contas-publicas/artefatos/BarraCumprimento';
it('não limita realizado a 100% e distingue original, atual e ausência',()=>{
 const e=escalaCumprimento({metaAtual:100,metaOriginal:80,realizado:130,estado:'calculavel'})!;
 expect(e.realizado).toBeGreaterThan(e.atual);expect(e.atual).toBeGreaterThan(e.original!);
 expect(escalaCumprimento({metaAtual:100,metaOriginal:null,realizado:0,estado:'calculavel'})?.realizado).toBe(0);
 expect(escalaCumprimento({metaAtual:100,metaOriginal:100,realizado:null,estado:'ausente'})).toBeNull();
 expect(escalaCumprimento({metaAtual:0,metaOriginal:100,realizado:30,estado:'inelegivel'})).toBeNull();
});
