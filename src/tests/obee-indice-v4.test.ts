import {describe,it,expect,vi} from 'vitest';
// a página importa módulos marcados com server-only; no teste, o marcador não tem efeito
vi.mock('server-only',()=>({}));
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {indice,indiceSnapshot,boxExtremes,STATUS_LABELS,RESSALVA_FAIXA} from '@/lib/eficiencia/indice-v4';
import {IndiceResultados} from '@/components/eficiencia/IndiceResultados';
// a entrada é montada pela página no molde único (Iniciativa 4, 22/10/2026): o teste renderiza a página inteira
import PaginaEntradaEficiencia from '@/app/eficiencia-estatal/page';
import PaginaIndiceResultados from '@/app/eficiencia-estatal/indice-de-resultados/page';
import {indiceNumber as fmtNota} from '@/lib/eficiencia/indice-v4-nucleo';

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
  expect(h[h.length-1]).toBe('ressalva');
  expect(lines.slice(1).every(l=>l[l.length-1]===RESSALVA_FAIXA)).toBe(true);
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

 it('a abertura mostra só as posições e leva ao painel do índice com o par escolhido (decisão de 19/10/2026)',()=>{
  const html=renderToStaticMarkup(createElement(PaginaEntradaEficiencia));
  const abertura=html.slice(0,html.indexOf('id="perguntas"'));
  const fmt=(v:number)=>v.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
  for(const id of ['2611606','4106902'])expect(abertura).not.toContain(fmt(indiceSnapshot.rows.find(r=>r.id===id)!.score));
  expect(abertura).not.toMatch(/Índice de resultados ·/);
  expect(abertura).toContain('Moradia adensada');expect(abertura).toContain('Mais de 1 h até o trabalho');
  expect(abertura).toMatch(/Precisão municipal não quantificada/);
  expect(abertura).toContain('href="/eficiencia-estatal/indice-de-resultados?territorio=2611606&amp;comparador=4106902"');
  expect(html).not.toContain('id="atlas-indice"');expect(html).not.toContain('Nota do índice');
 });

 it('o painel do índice mostra nota, distribuição e composição dos escores',()=>{
  const html=renderToStaticMarkup(createElement(PaginaIndiceResultados));
  expect(html).toContain('id="atlas-indice"');expect(html).toContain('Nota do índice');
  expect(html).toContain('id="atlas-score-method"');
  expect(html).toContain(fmtNota(indiceSnapshot.rows.find(r=>r.id==='2611606')!.score));
  expect(html).toMatch(/não mede eficiência/);
 });
});

describe('Índice de resultados v4: correções da análise automatizada de 14/10/2026',()=>{
 const BOA_VISTA='1400100',RECIFE='2611606';
 it('A1: par empatado na edição não aparece como ordem mantida quando o empate pode se desfazer',()=>{
  const st=indice.stability(BOA_VISTA,RECIFE)!;
  expect(st.status).toBe('empate');
  expect(st.outcomes.pesos).toBe('desfaz_ambos');
  const html=render(BOA_VISTA,RECIFE);
  expect(html).not.toContain('Ordem mantida neste teste');
  expect(html).toContain('O empate pode se desfazer a favor de qualquer uma');
  expect(html).toMatch(/nos testes, o empate pode se desfazer \(mudança de pesos/);
 });

 it('A1: cada família de cada par tem resultado coerente com a classe do par',()=>{
  for(const p of completo.pairs){
   const st=indice.stability(p.a,p.b)!;
   for(const f of Object.keys(st.outcomes) as (keyof typeof st.outcomes)[]){
    const o=st.outcomes[f];
    if(p.status==='empate')expect(['desfaz_ambos','desfaz_a','desfaz_b','empate_mantido']).toContain(o);
    else expect(o).toBe(p.families_reversing.includes(f)?'inverte':p.families_tying.includes(f)?'empata':'mantida');
   }
  }
 });

 it('A2: a leitura da nota descreve posição relativa com metade dos empates, não porcentagem superada',()=>{
  const html=render('2800308','2211001');
  expect(html).not.toMatch(/mais favorável que o de 60%/);
  expect(html).toMatch(/metade das que empatam, incluída a própria capital/);
  expect(html).toMatch(/Não é a porcentagem de capitais superadas/);
 });

 it('A3: o rótulo de estabilidade explicita que as famílias são avaliadas separadamente',()=>{
  expect(STATUS_LABELS.mantida).toMatch(/cada teste, avaliado separadamente/);
  const html=render('2611606','4106902');
  expect(html).not.toMatch(/em todos os testes/);
  expect(html).toMatch(/combinações entre elas, como pesos e definição alternativa ao mesmo tempo, não foram testadas/);
 });

 it('A5: a ressalva de faixa e precisão acompanha a nota, a tabela das capitais e as faixas individuais',()=>{
  const html=render('2611606','4106902');
  const ressalva='Faixa metodológica, não intervalo de confiança. Precisão municipal não quantificada.';
  expect(html.split(ressalva).length-1).toBeGreaterThanOrEqual(3);
  const nota=html.indexOf('Faixa nos testes de sensibilidade');
  expect(html.indexOf(ressalva,nota)-nota).toBeLessThan(200);
 });

 it('A9: a interface fora do pacote confere com o manifesto complementar',()=>{
  const m=JSON.parse(readFileSync(join(process.cwd(),'docs/obee/resultados/v4/interface-v4.json'),'utf8')) as {packet_sha256:string;files:{path:string;sha256:string}[]};
  expect(m.packet_sha256).toBe(indiceSnapshot.packet_sha256);
  expect(m.files.length).toBeGreaterThanOrEqual(4);
  for(const f of m.files)expect(createHash('sha256').update(readFileSync(join(process.cwd(),f.path))).digest('hex'),`${f.path}: rode python3 scripts/obee_interface_v4.py`).toBe(f.sha256);
  expect(render('2611606','4106902')).toContain('interface-v4.json');
 });
});
