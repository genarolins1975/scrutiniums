import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {IPCA,fiscalRealAcumulado} from '@/lib/contas-publicas/inflacao';
import {DADOS,CAMPOS_FISCAIS} from '@/lib/contas-publicas/dados';
import {compararDespesas,converterEscala,exportarComparacaoFiscal} from '@/lib/contas-publicas/escala';

describe('Correção mensal de fluxos pelo IPCA',()=>{
 it('preserva a origem oficial e reproduz o snapshot com o importador',()=>{
  expect(createHash('sha256').update(readFileSync('data/contas-publicas/ipca-2026-10-12/ipca.json')).digest('hex')).toBe(IPCA.fonte.sha256);
  expect(IPCA.registros).toHaveLength(43);
  expect(IPCA.registros.at(-1)).toEqual({periodo:'2026-07',indice:7657.73});
  expect(execFileSync('python3',['scripts/contas-publicas/importar-ipca.py','--verificar'],{encoding:'utf8'})).toContain('43 meses');
  execFileSync('python3',['-m','unittest','discover','-s','scripts/contas-publicas','-p','test_importar_ipca.py'],{stdio:'pipe'});
 });
 it('corrige cada mês antes de somar, com sinal e zero preservados',()=>{
  const fluxo=(periodo:string,valor:number)=>({periodo,...Object.fromEntries(CAMPOS_FISCAIS.map(k=>[k,valor])),resultado:-valor,transferencias:0}) as typeof DADOS.rtnMensal[number];
  const f=[fluxo('2025-01',100),fluxo('2025-02',100)];
  const i=[{periodo:'2025-01',indice:100},{periodo:'2025-02',indice:200}];
  const total=fiscalRealAcumulado(2025,2,f,i,'2025-02')!;
  expect(total.despesa).toBe(300); // 100×2 + 100×1; não 200×1.
  expect(total.resultado).toBe(-300);
  expect(total.transferencias).toBe(0);
  expect(converterEscala(200,2025,12,'real')).toBeNull();
 });
 it('recusa mês ausente, duplicado, índice inválido e fluxo não finito',()=>{
  expect(fiscalRealAcumulado(2026,8)).toBeNull();
  expect(fiscalRealAcumulado(2025,0)).toBeNull();
  expect(fiscalRealAcumulado(2025,1,[],IPCA.registros)).toBeNull();
  const f=DADOS.rtnMensal.find(m=>m.periodo==='2025-01')!;
  expect(fiscalRealAcumulado(2025,1,[f,f])).toBeNull();
  expect(fiscalRealAcumulado(2025,1,[{...f,despesa:NaN}])).toBeNull();
  for(const indice of [0,-1,Infinity,NaN]) {
   const indices=IPCA.registros.map(i=>i.periodo==='2025-01'?{...i,indice}:i);
   expect(fiscalRealAcumulado(2025,1,[f],indices)).toBeNull();
  }
  expect(fiscalRealAcumulado(2025,1,[f],IPCA.registros.filter(i=>i.periodo!==IPCA.basePrecos))).toBeNull();
  expect(fiscalRealAcumulado(2025,1,[f],[...IPCA.registros,...IPCA.registros])).toBeNull();
 });
 it('concilia categorias e identidades em anos completos e na janela parcial',()=>{
  for(const [ano,mes] of [[2024,12],[2025,12],[2026,7]]) {
   const linhas=compararDespesas(ano,mes,'real')!;
   const total=fiscalRealAcumulado(ano,mes)!;
   expect(linhas.reduce((s,l)=>s+l.atual,0)).toBeCloseTo(total.despesa,6);
   expect(linhas.reduce((s,l)=>s+l.participacao!,0)).toBeCloseTo(100,8);
   expect(total.receitaTotal-total.transferencias).toBeCloseTo(total.receitaLiquida,6);
   expect(total.receitaLiquida-total.despesa).toBeCloseTo(total.resultado,6);
   const nominal=compararDespesas(ano,mes,'total')!;
   linhas.forEach((l,k)=>expect(l.variacaoNominal).toBe(nominal[k].variacao));
  }
 });
 it('uma mudança de base comum reescala os valores mas preserva as taxas reais',()=>{
  const a=fiscalRealAcumulado(2025,12)!.despesa,b=fiscalRealAcumulado(2024,12)!.despesa;
  const a2=fiscalRealAcumulado(2025,12,DADOS.rtnMensal,IPCA.registros,'2025-12')!.despesa;
  const b2=fiscalRealAcumulado(2024,12,DADOS.rtnMensal,IPCA.registros,'2025-12')!.despesa;
  expect(a/b).toBeCloseTo(a2/b2,12);
 });
 it('exporta quatro grupos, base de preços, valores e taxas nominais e reais',()=>{
  const csv=exportarComparacaoFiscal(compararDespesas(2026,7,'real')!,2026,7,'real');
  expect(csv.split('\r\n')).toHaveLength(5);
  expect(csv).toContain('R$ milhões a preços de julho de 2026 (IPCA)');
  expect(csv).toContain('"1-7";"2026-07"');
  expect(csv).toContain('variacao_nominal_percentual');
  expect(csv).not.toMatch(/NaN|undefined|Infinity/);
 });
});
