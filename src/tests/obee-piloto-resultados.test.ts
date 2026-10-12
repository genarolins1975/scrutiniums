import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {pilotoResultados,pilotRow,pilotCsv,pilotDimensions,pilotPreviewEnabled} from '@/lib/eficiencia/piloto-resultados';
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
  const html=renderToStaticMarkup(createElement(PilotoResultados,{place:'2611606',reference:'4106902',onReference:()=>{}}));
  for(const text of ['Piloto experimental','33,5','77,3','Saúde permanece em pesquisa','Não é intervalo de confiança','por 100 mil','R$','peso de 20%'])expect(html).toContain(text);
  expect(html).not.toContain('Saúde</h4>');
 });
 it('não apresenta número para território fora da referência',()=>{
  const html=renderToStaticMarkup(createElement(PilotoResultados,{place:'Brasil',reference:'4106902',onReference:()=>{}}));
  expect(html).toContain('Piloto indisponível neste recorte');expect(html).not.toContain('77,3');
 });
 it('preserva a entrada pública por padrão e habilita o bloco somente com prop explícita',()=>{
  expect(renderToStaticMarkup(createElement(AtlasCidadao))).not.toContain('id="atlas-piloto"');
  expect(renderToStaticMarkup(createElement(AtlasCidadao,{showPilot:true}))).toContain('id="atlas-piloto"');
 });
});
