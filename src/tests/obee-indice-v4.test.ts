import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {indice,indiceSnapshot,boxExtremes,STATUS_LABELS} from '@/lib/eficiencia/indice-v4';
import {IndiceResultados} from '@/components/eficiencia/IndiceResultados';
import {AtlasCidadao} from '@/components/eficiencia/AtlasCidadao';
import {montarRetrato} from '@/lib/eficiencia/entrada';

type Par={a:string;b:string;difference:number;status:keyof typeof STATUS_LABELS;families_reversing:string[];families_tying:string[];dominance:boolean;ranges:Record<string,[number,number]>};
const completo=JSON.parse(readFileSync(join(process.cwd(),'docs/obee/resultados/v4/indice-resultados-v4.json'),'utf8')) as {pairs:Par[];rows:{id:string;score:number}[];edition:string};
const render=(place:string,reference:string)=>renderToStaticMarkup(createElement(IndiceResultados,{data:indiceSnapshot,place,reference,onReference:()=>{}}));

describe('Índice de resultados v4: reconciliação com o pipeline exato',()=>{
 it('mantém edição, 26 capitais sem DF, pesos iguais e habitação por moradores',()=>{
  expect(indiceSnapshot.edition).toBe('indice-resultados-2022-v4');
  expect(indiceSnapshot.rows).toHaveLength(26);
  expect(indiceSnapshot.rows.some(r=>r.id==='5300108')).toBe(false);
  expect(new Set(Object.values(indiceSnapshot.weights))).toEqual(new Set(['1/7']));
  expect(indiceSnapshot.indicators.find(i=>i.id==='habitacao')!.label).toMatch(/Moradores.*mais de 3/);
 });

 it('a nota é a soma das sete contribuições e fica dentro da faixa',()=>{
  for(const r of indiceSnapshot.rows){
   expect(Object.values(r.contributions).reduce((a,b)=>a+b,0)).toBeCloseTo(r.score,9);
   expect(r.band[0]).toBeLessThanOrEqual(r.score+1e-9);
   expect(r.band[1]).toBeGreaterThanOrEqual(r.score-1e-9);
  }
 });

 it('recalcula em TypeScript a classe e os limites dos 325 pares e coincide com o Python',()=>{
  expect(completo.pairs).toHaveLength(325);
  for(const p of completo.pairs){
   const st=indice.stability(p.a,p.b)!;
   expect(st.status,`${p.a}-${p.b}`).toBe(p.status);
   expect(st.reversing).toEqual(p.families_reversing);
   expect(st.tying).toEqual(p.families_tying);
   expect(st.dominance).toBe(p.dominance);
   expect(st.baseline).toBeCloseTo(p.difference,9);
   for(const [f,[lo,hi]] of Object.entries(p.ranges)){
    expect(st.ranges[f as keyof typeof st.ranges][0]).toBeCloseTo(lo,9);
    expect(st.ranges[f as keyof typeof st.ranges][1]).toBeCloseTo(hi,9);
   }
  }
 });

 it('decompõe a diferença de qualquer par sem resíduo',()=>{
  for(const a of indiceSnapshot.rows)for(const b of indiceSnapshot.rows){
   const g=indice.gap(a.id,b.id)!;
   expect(g.components.reduce((s,c)=>s+c.points,0)).toBeCloseTo(g.total,9);
  }
  expect(indice.gap('Brasil','4106902')).toBeNull();
  expect(indice.stability('2611606','5300108')).toBeNull();
 });

 it('limites da família de pesos coincidem com os vértices da caixa',()=>{
  const v=[30,-10,5,0,12.5,-40,7];
  let lo=Infinity,hi=-Infinity;
  for(let free=0;free<7;free++)for(let mask=0;mask<64;mask++){
   const w=Array(7).fill(0);let k=0,sum=0;
   for(let i=0;i<7;i++){if(i===free)continue;w[i]=((mask>>k++)&1?1.25:.75)/7;sum+=w[i];}
   w[free]=1-sum;
   if(w[free]<.75/7-1e-12||w[free]>1.25/7+1e-12)continue;
   const t=w.reduce((s,x,i)=>s+x*v[i],0);lo=Math.min(lo,t);hi=Math.max(hi,t);
  }
  const [a,b]=boxExtremes(v);
  expect(a).toBeCloseTo(lo,12);expect(b).toBeCloseTo(hi,12);
  expect(()=>boxExtremes([1,Number.NaN])).toThrow();
 });

 it('exporta as 26 capitais com valores originais, posições, pesos e contribuições sem arredondamento',()=>{
  const lines=indice.csv().trim().split('\r\n').map(l=>l.split(',').map(v=>v.replace(/^"|"$/g,'')));
  expect(lines).toHaveLength(27);
  const h=lines[0],r=lines.find(l=>l[2]==='4106902')!,row=indiceSnapshot.rows.find(x=>x.id==='4106902')!;
  expect(Number(r[h.indexOf('score')])).toBe(row.score);
  expect(Number(r[h.indexOf('habitacao_raw')])).toBe(row.raw_values.habitacao);
  expect(r[h.indexOf('trabalho_weight')]).toBe('1/7');
 });
});

describe('Índice de resultados v4: apresentação',()=>{
 it('mostra nota, faixa, estabilidade do par, ressalva de precisão e ausência de Saúde',()=>{
  const html=render('2611606','4106902');
  const a=indiceSnapshot.rows.find(r=>r.id==='2611606')!;
  expect(html).toContain('id="atlas-indice"');
  expect(html).toContain(a.score.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1}));
  expect(html).toMatch(/Faixa nos testes de sensibilidade/);
  expect(html).toContain(STATUS_LABELS[indice.stability('2611606','4106902')!.status]);
  expect(html).toMatch(/precisão municipal das fontes não foi quantificada/);
  expect(html).toMatch(/Saúde não está incluída/);
  expect(html).toMatch(/não mede eficiência nem atribui o resultado/);
 });

 it('expõe as sete contribuições e a soma que forma a nota',()=>{
  const html=render('2800308','2211001');
  for(const i of indiceSnapshot.indicators)expect(html).toContain(i.label);
  expect(html).toMatch(/A nota é a soma das sete contribuições/);
  expect(html).toContain('Retirada de um indicador');
 });

 it('não apresenta nota para território fora da referência',()=>{
  const html=render('Brasil','4106902');
  expect(html).toMatch(/somente para as capitais estaduais/);
  expect(html).not.toMatch(/Nota do índice/);
 });

 it('a abertura mostra as notas das duas capitais e o perfil nos sete resultados',()=>{
  const html=renderToStaticMarkup(createElement(AtlasCidadao,{retrato:montarRetrato(),indice:indiceSnapshot}));
  const abertura=html.slice(0,html.indexOf('id="perguntas"'));
  const fmt=(v:number)=>v.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
  for(const id of ['2611606','4106902'])expect(abertura).toContain(fmt(indiceSnapshot.rows.find(r=>r.id===id)!.score));
  expect(abertura).toContain(STATUS_LABELS[indice.stability('2611606','4106902')!.status]);
  expect(abertura).toContain('Moradia adensada');expect(abertura).toContain('Mais de 1 h até o trabalho');
  expect(abertura).toMatch(/Precisão municipal não quantificada/);expect(abertura).toMatch(/Saúde ainda fora da nota/);
  expect(abertura).toContain('href="#atlas-indice"');
 });

 it('a entrada recebe o índice por prop e não o exibe sem ele',()=>{
  const retrato=montarRetrato();
  expect(renderToStaticMarkup(createElement(AtlasCidadao,{retrato,indice:indiceSnapshot}))).toContain('id="atlas-indice"');
  const sem=renderToStaticMarkup(createElement(AtlasCidadao,{retrato}));
  expect(sem).not.toContain('id="atlas-indice"');expect(sem).not.toContain('Nota do índice');
 });
});
