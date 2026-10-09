import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { selecionarSerie, observacoesParaCsv } from '../lib/eficiencia/trabalho-renda/dados';
import type { SnapshotTrabalhoRenda } from '../lib/eficiencia/trabalho-renda/tipos';
const dados = JSON.parse(readFileSync('public/eficiencia/trabalho-renda/snapshot.json','utf8')) as SnapshotTrabalhoRenda;
describe('Trabalho e Renda: evidence and analytical perimeter', () => {
 it('every source reproduces its captured response exactly', () => {
  for (const fonte of dados.fontes) {
   expect(fonte.consulta).toMatch(/^https:\/\/(apisidra\.ibge\.gov\.br|api\.bcb\.gov\.br)\//);
   expect(createHash('sha256').update(readFileSync(`public${fonte.bruto}`)).digest('hex')).toBe(fonte.sha256);
  }
 });
 it('observations have unique keys and valid references; no fabricated missing-value zeros', () => {
  const keys = dados.observacoes.map(o => [o.indicadorId,o.territorioId,o.periodo,o.sexo,o.grupo].join('|'));
  expect(new Set(keys).size).toBe(keys.length);
  for (const o of dados.observacoes) {
   expect(dados.indicadores.some(i => i.id === o.indicadorId)).toBe(true);
   expect(dados.territorios.some(t => t.id === o.territorioId)).toBe(true);
   expect(dados.fontes.some(f => f.id === o.fonteId)).toBe(true);
   expect(o.status).toBe(o.valor === null ? 'ausente' : 'observado');
   if (o.valor !== null) expect(Number.isFinite(o.valor)).toBe(true);
  }
 });
 it('never substitutes a state estimate for municipal employment or disjoint subgroup', () => {
  expect(selecionarSerie(dados,'desocupacao','3550308')).toEqual([]);
  expect(selecionarSerie(dados,'subutilizacao','1','mulheres')).toEqual([]);
  expect(selecionarSerie(dados,'renda-media','3550308','mulheres')).toEqual([]);
  expect(selecionarSerie(dados,'renda-media','3550308')).toHaveLength(1);
 });
 it('exports the full selection, preserving missing values, labels and coefficient of variation', () => {
  const rows = selecionarSerie(dados,'desocupacao','1');
  const csv = observacoesParaCsv(rows);
  expect(csv.split('\r\n')).toHaveLength(rows.length+1);
  expect(csv).toContain('cv');
  const absent={...rows[0],valor:null,status:'ausente' as const};
  expect(observacoesParaCsv([absent])).toContain('""');
  expect(observacoesParaCsv([{...rows[0],grupo:'texto; "citado"'}])).toContain('"texto; ""citado"""');
 });
 it('occupational and hours coverage preserves distinct universes and historical gaps', () => {
  expect(selecionarSerie(dados,'ocupacoes-pessoas','1')).toHaveLength(1);
  expect(selecionarSerie(dados,'ocupacoes-pessoas','3550308')).toEqual([]);
  const jornada=selecionarSerie(dados,'jornada-habitual','1');
  expect(jornada.some(o=>['2020','2021','2022'].includes(o.periodo))).toBe(false);
  expect(dados.fontes.find(f=>f.id==='pnad-jornada')!.limitacoes.join(' ')).toContain('Divergência de unidade');
 });
 it('gini, rates and stock-difference calculations honor their units', () => {
  for (const o of dados.observacoes) {
   if(o.valor===null)continue;
   const indicador=dados.indicadores.find(i=>i.id===o.indicadorId)!;
   if(indicador.unidade==='%') { expect(o.valor).toBeGreaterThanOrEqual(0);expect(o.valor).toBeLessThanOrEqual(100); }
   if(o.indicadorId==='gini') { expect(o.valor).toBeGreaterThanOrEqual(0);expect(o.valor).toBeLessThanOrEqual(1); }
  }
  const bruto=JSON.parse(readFileSync('public/eficiencia/trabalho-renda/brutos/caged-sgs.json','utf8')) as {data:string;valor:string}[];
  const estoque=new Map(bruto.map(r=>[r.data.slice(6)+'-'+r.data.slice(3,5),Number(r.valor)]));
  for(const o of selecionarSerie(dados,'saldo-formal','1')) {
   const [ano,mes]=o.periodo.split('-').map(Number);const anterior=mes===1?`${ano-1}-12`:`${ano}-${String(mes-1).padStart(2,'0')}`;
   expect(o.valor).toBe(estoque.get(o.periodo)!-estoque.get(anterior)!);
  }
 });
});
