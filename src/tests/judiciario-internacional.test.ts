import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import latest from '../../public/eficiencia/judiciario/internacional.json';
import history from '../../public/eficiencia/judiciario/internacional-historico.json';
import manifest from '../../public/eficiencia/judiciario/internacional-manifesto.json';
import {COLUNAS_INTERNACIONAIS,INDICADORES_INTERNACIONAIS,escore,medianaEscores,paisesReferencia,referenciaIndicador,diferencasCivis,segmentosHistoricos,type DadosInternacionais,type PaisInternacional,type HistoricoInternacional} from '@/lib/eficiencia/judiciario/internacional';
import {ehRotaPublica} from '@/lib/rotasPublicas';

const data=latest as DadosInternacionais;
const brasil=data.paises.find(p=>p.iso3==='BRA')!;
describe('Comparação internacional do Judiciário',()=>{
 it('adota uma edição explícita e conserva os 16 indicadores do instrumento',()=>{
  expect(data.edicao).toBe('2025');expect(data.paises).toHaveLength(143);
  expect(data.colunas).toEqual(COLUNAS_INTERNACIONAIS);
  expect(Object.keys(INDICADORES_INTERNACIONAIS)).toEqual(COLUNAS_INTERNACIONAIS);
  for(const p of data.paises){expect(p.escores).toHaveLength(16);for(const v of p.escores)expect(v===null||Number.isFinite(v)&&v>=0&&v<=1).toBe(true);}
 });
 it('posiciona corretamente acesso, demora e cumprimento sem trocar a polaridade',()=>{
  expect(escore(brasil,'f_7_1')).toBeCloseTo(.654269553091126,14);
  expect(escore(brasil,'f_7_5')).toBeCloseTo(.268324625924196,14);
  expect(escore(brasil,'f_7_6')).toBeCloseTo(.359231834853042,14);
  expect(escore(data.paises.find(p=>p.iso3==='DEU')!,'f_7_5')).toBeGreaterThan(escore(brasil,'f_7_5')!);
 });
 it('exclui o Brasil das referências, usando os grupos da mesma edição',()=>{
  expect(paisesReferencia(data.paises,'regiao',[])).toHaveLength(31);
  expect(paisesReferencia(data.paises,'renda',[])).toHaveLength(43);
  expect(paisesReferencia(data.paises,'mundo',[])).toHaveLength(142);
  for(const grupo of ['regiao','renda','mundo','selecionados'] as const)expect(paisesReferencia(data.paises,grupo,['BRA','PRT','PRT']).some(p=>p.iso3==='BRA')).toBe(false);
  expect(paisesReferencia(data.paises,'selecionados',['BRA','PRT','PRT']).map(p=>p.iso3)).toEqual(['PRT']);
 });
 it('não cria uma referência a partir de seleção vazia ou renda ausente',()=>{
  expect(referenciaIndicador(paisesReferencia(data.paises,'selecionados',[]),'f_7_5')).toEqual({mediana:null,cobertos:0,total:0});
  expect(paisesReferencia([{...brasil,renda:null},data.paises.find(p=>p.iso3==='PRT')!],'renda',[])).toEqual([]);
 });
 it('mediana preserva zero e desconsidera apenas ausências ou não finitos',()=>{
  expect(medianaEscores([null,0,.4])).toBe(.2);
  expect(medianaEscores([NaN,null])).toBeNull();
  const sem:PaisInternacional={...brasil,iso3:'ZZZ',escores:Array(16).fill(null)};
  expect(referenciaIndicador([{...sem,iso3:'ZERO',escores:Array(16).fill(0)},sem],'f_7_5')).toEqual({mediana:0,cobertos:1,total:2});
 });
 it('diferenças são pontos do mesmo indicador, sem substituir por nota composta',()=>{
  const refs=paisesReferencia(data.paises,'regiao',[]),rows=diferencasCivis(brasil,refs);
  expect(rows).toHaveLength(7);
  for(const row of rows)expect(row.distancia).toBeCloseTo(row.mediana!-escore(brasil,row.indicador)!);
 });
 it('preserva edições conjuntas e não promove o ano seguinte automaticamente',()=>{
  const h=history as HistoricoInternacional;
  expect(h.edicoes).toContain('2017-2018');expect(h.edicoes).not.toContain('2017');expect(h.edicoes).not.toContain('2018');expect(h.edicoes).not.toContain('2026');
  const serie=segmentosHistoricos(h,'BRA','f_7_5').flat();
  expect(serie.filter(p=>p.edicao==='2017-2018')).toHaveLength(1);
  expect(serie.at(-1)?.valor).toBe(escore(brasil,'f_7_5'));
 });
 it('não desenha continuidade por cima de edição sem informação',()=>{
  const scores=(v:number|null)=>COLUNAS_INTERNACIONAIS.map(()=>v);
  const h:HistoricoInternacional={versao:'teste',colunas:[...COLUNAS_INTERNACIONAIS],edicoes:['2020','2021','2022'],observacoes:[{iso3:'BRA',edicao:'2020',escores:scores(0)},{iso3:'BRA',edicao:'2021',escores:scores(null)},{iso3:'BRA',edicao:'2022',escores:scores(.5)}]};
  expect(segmentosHistoricos(h,'BRA','f_7_5').map(segmento=>segmento.map(p=>p.valor))).toEqual([[0],[.5]]);
 });
 it('mantém painel e todos os arquivos internacionais protegidos por sessão',()=>{
  for(const path of ['/eficiencia-estatal/judiciario/internacional',...Object.keys(manifest.arquivos).map(name=>'/eficiencia/judiciario/'+name),'/eficiencia/judiciario/internacional-manifesto.json'])expect(ehRotaPublica(path),path).toBe(false);
 });
 it('os arquivos publicados coincidem com os hashes do manifesto',()=>{
  for(const [name,hash] of Object.entries(manifest.arquivos))expect(createHash('sha256').update(readFileSync('public/eficiencia/judiciario/'+name)).digest('hex')).toBe(hash);
  expect(createHash('sha256').update(readFileSync('pipeline/judiciario/seed/wjp-historico.xlsx')).digest('hex')).toBe(data.fonte.sha256);
 });
});
