import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {dadosJustica as d,coberturaJustica as cobertura} from '@/lib/eficiencia/justica/dados';
import {agruparCobertura,razao,totalInformado,csv,duracao,PAGINAS_JUSTICA} from '@/lib/eficiencia/justica/modelo';

describe('Acesso à Justiça — fontes e cálculo',()=>{
 it('publicação corresponde à semente preservada, sem preenchimento artificial',()=>{
  const seed=JSON.parse(gunzipSync(readFileSync('pipeline/justica/seed/recorte.json.gz')).toString());
  expect(d).toEqual(seed);expect(d.comarcas).toHaveLength(2563);expect(d.tribunais).toHaveLength(27);expect(d.defensorias).toHaveLength(108);
 });
 it('reconcilia cobertura e população sem misturar presença com atendimento',()=>{
  expect(cobertura.reduce((a,r)=>a+r.regular,0)).toBe(1334);
  expect(cobertura.reduce((a,r)=>a+r.parcial,0)).toBe(200);
  expect(cobertura.reduce((a,r)=>a+r.sem,0)).toBe(1029);
  expect(cobertura.reduce((a,r)=>a+r.populacao,0)).toBe(212583750);
  for(const r of cobertura){expect(r.regular+r.parcial+r.sem).toBe(r.total);expect(r.popRegular+r.popParcial+r.popSem).toBe(r.populacao);}
  expect(new Set(d.comarcas.map(c=>c.uf+c.codigo)).size).toBe(2563);
 });
 it('recusa uma situação não prevista, em vez de convertê-la em ausência de serviço',()=>{
  expect(()=>agruparCobertura([{...d.comarcas[0],situacao:'NÃO RESPONDEU'}])).toThrow();
 });
 it('separa ausência e zero nas declarações de acordos',()=>{
  const dados=d.defensorias.filter(r=>r.ano===2024);
  expect(dados.find(r=>r.uf==='PA')!.acordos).toBeNull();expect(dados.find(r=>r.uf==='SP')!.acordos).toBeNull();expect(dados.find(r=>r.uf==='RR')!.acordos).toBe(0);
  expect(dados.find(r=>r.uf==='MG')!.acordos).toBe(1335367);
  expect(totalInformado(dados.map(r=>r.acordos)).informados).toBe(25);
  expect(totalInformado([null,null]).valor).toBeNull();expect(totalInformado([0,null])).toEqual({valor:0,informados:1,total:2});
 });
 it('não calcula razões sem denominador válido',()=>{
  expect(razao(null,10)).toBeNull();expect(razao(10,null)).toBeNull();expect(razao(10,0)).toBeNull();expect(razao(10,-1)).toBeNull();expect(razao(10,NaN)).toBeNull();expect(razao(0,10)).toBe(0);
 });
 it('preserva universos e referência dos tempos publicados',()=>{
  expect(d.tribunais.find(t=>t.uf==='SP')).toMatchObject({baixados:47,pendentes:58});
  expect(d.tribunais.find(t=>t.uf==='AM')).toMatchObject({baixados:47,pendentes:24});
  expect(d.tribunais.find(t=>t.uf==='DF')).toMatchObject({tribunal:'TJDFT',baixados:22,pendentes:48});
  expect(duracao(28)).toBe('2 anos e 4 meses');expect(duracao(12)).toBe('1 ano');expect(duracao(0)).toBe('0 meses');
  expect(d.cnj.ano).toBe(2025);expect(d.cnj.tempoBaixados).toBe(28);expect(d.cnj.tempoPendentes).toBe(43);
 });
 it('exportação preserva ausências, zeros e texto com delimitador',()=>{
  const s=csv(['a','b'],[['UF; nome',null],['Roraima',0]]);expect(s).toContain('"UF; nome";""');expect(s).toContain('"Roraima";"0"');
 });
 it('cada rota, download e fonte existe',()=>{
  for(const [slug] of PAGINAS_JUSTICA)expect(existsSync(join('src/app/eficiencia-estatal/acesso-justica',slug,'page.tsx'))).toBe(true);
  for(const file of ['snapshot.json','comarcas.csv','defensorias.csv','tribunais.csv','fontes.json'])expect(readFileSync('public/eficiencia/justica/'+file).length).toBeGreaterThan(100);
  for(const f of d.fontes)expect(f.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(createHash('sha256').update(readFileSync('public/eficiencia/justica/snapshot.json')).digest('hex')).toBe('625b5677307fd0785e6d6a0ee11742aebbf746e88bf94037c115ef9ef53355c8');
 });
});
