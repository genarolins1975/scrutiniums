import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {pilotoResultados,pilotRow,pilotCsv,pilotDimensions,pilotPreviewEnabled,pilotGap,pilotStability,summarizePilotScenarios} from '@/lib/eficiencia/piloto-resultados';
import {PilotoResultados} from '@/components/eficiencia/PilotoResultados';
import {AtlasCidadao} from '@/components/eficiencia/AtlasCidadao';

describe('Apresentação experimental dos resultados',()=>{
 it('mantém o resultado congelado e a ausência no contrato de seis dimensões',()=>{
  expect(pilotoResultados.publication_ready).toBe(false);
  expect(pilotRow('2611606')?.pilot_five.score).toBeCloseTo(33.46153846153847,10);
  expect(pilotRow('4106902')?.pilot_five.score).toBeCloseTo(77.3076923076923,10);
  for(const row of pilotoResultados.rows){expect(row.extended_six.score).toBeNull();expect(row.extended_six.missing).toContain('saude');}
  expect(pilotRow('Brasil')).toBeUndefined();
 });
 it('exporta todas as 26 capitais e os 130 valores originais sem arredondamento',()=>{
  const lines=pilotCsv().trim().split('\r\n').map(line=>line.split(',').map(v=>v.replace(/^"|"$/g,'')));
  expect(lines).toHaveLength(27);
  for(const row of pilotoResultados.rows){
   const exported=lines.find(l=>l[2]===row.id)!;
   expect(Number(exported[4])).toBe(row.pilot_five.score);
   expect(exported[7]).toBe('');expect(exported[8]).toBe('not_eligible');
   for(const dimension of pilotDimensions){const idx=lines[0].indexOf(dimension.id+'_raw');expect(Number(exported[idx])).toBe(row.raw_values[dimension.id]);}
  }
 });
 it('não habilita o piloto em builds públicos ou ambientes desconhecidos',()=>{
  expect(pilotPreviewEnabled('production','production')).toBe(false);
  expect(pilotPreviewEnabled(undefined,'production')).toBe(false);
  expect(pilotPreviewEnabled('production','development')).toBe(false);
  expect(pilotPreviewEnabled('preview','production')).toBe(true);
  expect(pilotPreviewEnabled(undefined,'development')).toBe(true);
 });
 it('identifica unidades, interpretação e saúde ausente na apresentação',()=>{
  const html=renderToStaticMarkup(createElement(PilotoResultados,{data:pilotoResultados,place:'2611606',reference:'4106902',onReference:()=>{}}));
  for(const text of ['Piloto experimental','33,5','77,3','Saúde permanece em pesquisa','Não é intervalo de confiança','por 100 mil','R$','peso de 20%'])expect(html).toContain(text);
  expect(html).not.toContain('Saúde</h4>');
  expect(html).toContain('/eficiencia-estatal/laboratorio-cesta?cityA=2611606&amp;cityB=4106902');
 });
 it('não apresenta número para território fora da referência',()=>{
  const html=renderToStaticMarkup(createElement(PilotoResultados,{data:pilotoResultados,place:'Brasil',reference:'4106902',onReference:()=>{}}));
  expect(html).toContain('Piloto indisponível neste recorte');expect(html).not.toContain('77,3');
 });
 it('preserva a entrada pública por padrão e habilita o bloco somente com prop explícita',()=>{
  expect(renderToStaticMarkup(createElement(AtlasCidadao))).not.toContain('id="atlas-piloto"');
  expect(renderToStaticMarkup(createElement(AtlasCidadao))).not.toContain('/eficiencia-estatal/laboratorio-cesta');
  expect(renderToStaticMarkup(createElement(AtlasCidadao,{pilot:pilotoResultados}))).toContain('id="atlas-piloto"');
  expect(renderToStaticMarkup(createElement(AtlasCidadao,{pilot:null}))).not.toContain('id="atlas-piloto"');
 });
});

 describe('Decomposição da diferença do piloto',()=>{
  it('reconcilia todos os 676 pares com os escores congelados, sem arredondamento',()=>{
   for(const a of pilotoResultados.rows)for(const b of pilotoResultados.rows){
    const gap=pilotGap(a.id,b.id)!;
    expect(gap.components.reduce((sum,d)=>sum+d.points,0)).toBeCloseTo(a.pilot_five.score-b.pilot_five.score,10);
    expect(gap.components.every(d=>Math.abs(d.points)<=20)).toBe(true);
    expect(gap.total).toBeCloseTo(-pilotGap(b.id,a.id)!.total,10);
   }
  });
  it('mantém zero para a mesma cidade e ausência para recorte não suportado',()=>{
   expect(pilotGap('2611606','2611606')!.components.every(d=>d.points===0)).toBe(true);
   expect(pilotGap('Brasil','2611606')).toBeNull();
  });
 });

 describe('Estabilidade pareada',()=>{
  it('reconcilia inversões com a auditoria e deduplica os pesos',()=>{
   let reversals=0,tiesBroken=0;
   const rows=pilotoResultados.rows;
   for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
    const result=pilotStability(rows[i].id,rows[j].id)!;
    const weights=result.families[0];
    expect(weights.scenarios).toHaveLength(31);
    expect(weights.above+weights.below+weights.ties).toBe(31);
    if(weights.reversed)reversals++;
    if(weights.label==='Empate de referência desfeito')tiesBroken++;
    const opposite=pilotStability(rows[j].id,rows[i].id)!.families[0];
    expect(weights.lower).toBeCloseTo(-opposite.upper,10);
    expect(weights.label).toBe(opposite.label);
   }
   expect(reversals).toBe(37);expect(tiesBroken).toBe(3);
  // 325 pares e suas inversas; orçamento de execução da reconciliação completa na CI.
  },30000);
  it('calcula limites com diferenças do mesmo cenário, não extremos marginais',()=>{
   const result=pilotStability('2611606','2927408')!;
   expect(result.families[0].lower).toBeCloseTo(-9.090909090909093,10);
   expect(result.families[0].upper).toBeCloseTo(0.8875739644970437,10);
   expect(result.families[0].label).toBe('Há inversão da ordem');
   expect(pilotStability('2611606','4106902')!.families.every(f=>f.label==='Ordem mantida')).toBe(true);
  });
  it('distingue empate alcançado, empate original desfeito e resíduos numéricos',()=>{
   const scenario=(difference:number)=>({id:'s',label:'s',assumption:'s',difference});
   expect(summarizePilotScenarios(1,[scenario(1e-12)]).label).toBe('A diferença chega a empate');
   expect(summarizePilotScenarios(0,[scenario(1)]).label).toBe('Empate de referência desfeito');
   expect(summarizePilotScenarios(0,[scenario(1e-12)]).label).toBe('Empate mantido');
   expect(()=>summarizePilotScenarios(1,[])).toThrow();
  });
  it('mantém autopares empatados e territórios fora da referência ausentes',()=>{
   expect(pilotStability('2611606','2611606')!.families.every(f=>f.label==='Empate mantido')).toBe(true);
   expect(pilotStability('Brasil','2611606')).toBeNull();
  });
  it('expõe o resultado e as hipóteses do par no HTML acessível',()=>{
   const html=renderToStaticMarkup(createElement(PilotoResultados,{data:pilotoResultados,place:'2611606',reference:'2927408',onReference:()=>{}}));
   for(const text of ['Há inversão da ordem','31 combinações distintas','Contagens não são probabilidades','Conferir as hipóteses do par selecionado','−','Sem Educação'])expect(html).toContain(text);
  });
 });
