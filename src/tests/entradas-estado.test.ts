import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AberturaFederal} from '@/components/contas-publicas/AberturaFederal';
import {AberturaEstadual} from '@/components/contas-estaduais/AberturaEstadual';
import {AberturaCidada} from '@/components/eficiencia/AberturaCidada';
import {IndiceFederal} from '@/components/contas-publicas/IndiceFederal';
import {DADOS} from '@/lib/contas-publicas/dados';
import {moeda} from '@/lib/contas-publicas/formato';
import {CAPITULOS} from '@/lib/contas-publicas/catalogo';
import {snapshot,dividaPrimaria} from '@/lib/contas-estaduais/dados';
import {comparar} from '@/lib/contas-estaduais/comparacao';
import atlas from '@/lib/eficiencia/atlas-resumo.json';
import panorama from '@/lib/eficiencia/panorama-atlas.json';

const percentual=(v:number)=>v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
describe('Aberturas editoriais: números e perímetros preservados',()=>{
 it('Federal usa os quatro estágios do mesmo exercício, com fonte e ressalva',()=>{
  const html=renderToStaticMarkup(createElement(AberturaFederal));
  const b=DADOS.orcamento.find(b=>b.ano===2025)!;
  for(const campo of ['atualizada','empenhado','liquidado','pago'] as const)expect(html).toContain(moeda(b.total[campo],'reais'));
  expect(html).toContain('Os estágios não se somam');
  expect(html).toContain('pagamentos de restos a pagar ficam separados');
  expect(html).toContain('Fonte: SIOP');
  expect(html).toContain('2026 · parcial');
 });
 it.each(snapshot.ufs)('Estadual mantém os números conferidos de $uf e as 27 bandeiras',u=>{
  const html=renderToStaticMarkup(createElement(AberturaEstadual,{uf:u.uf,ano:2025,selecionar:()=>{}}));
  const execucao=comparar(2025,'CE-04','Todas',true).linhas.find(l=>l.uf===u.uf)!.valor!;
  expect(html).toContain(percentual(execucao));
  expect(html).toContain(percentual(dividaPrimaria(u.uf,2025)!.valores.percentual_declarado));
  expect(html.match(/<button /g)).toHaveLength(27);
  expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  if(u.uf==='DF')expect(html).toContain('competências estaduais e municipais');
 });
 it('Estadual distingue ausência de dado conferido de valor zero',()=>{
  const html=renderToStaticMarkup(createElement(AberturaEstadual,{uf:'PE',ano:2015,selecionar:()=>{}}));
  expect(html.match(/Não conferido/g)).toHaveLength(2);
  expect(html).not.toContain('0,00%');
 });
 it.each(atlas.cities)('OBEE apresenta a observação de $name sem alterar a referência',city=>{
  const reference=city.id==='4106902'?'2611606':'4106902';
  const html=renderToStaticMarkup(createElement(AberturaCidada,{selection:{scope:'cidades',place:city.id,reference,metric:'frequencia',age:'47813'},onSelect:()=>{}}));
  const m=panorama.metrics.find(m=>m.id==='educacao')!;
  expect(html).toContain(percentual(m.observations.find(o=>o.territory===city.id)!.value!));
  expect(html).toContain('Inclui redes públicas e privadas');
  expect(html).not.toContain('atlas-piloto');
 });
 it.each(panorama.metrics)('cada perspectiva da abertura respeita unidade e ressalva de $chapter',m=>{
  const html=renderToStaticMarkup(createElement(AberturaCidada,{selection:{scope:'cidades',place:'2611606',reference:'4106902',metric:'frequencia',age:'47813',perspective:m.id},onSelect:()=>{}}));
  expect(html).toContain(m.title);expect(html).toContain(m.warning);
  expect(html).toContain(m.period);
  if(m.id==='trabalho')expect(html).toContain('Sem ajuste espacial de preços');
  for(const id of ['2611606','4106902']){
   const v=m.observations.find(o=>o.territory===id)!.value!;
   expect(html).toContain(m.unit==='%'?percentual(v):'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}));
  }
 });
 it('a visão regional usa a situação alimentar e não reaproveita as medidas municipais',()=>{
  const html=renderToStaticMarkup(createElement(AberturaCidada,{selection:{scope:'regioes',place:'Nordeste',reference:'Sul',metric:'frequencia',age:'47813'},onSelect:()=>{}}));
  expect(html).toContain('Domicílios com segurança alimentar');
  expect(html).toContain(percentual(atlas.regions.find(r=>r.id==='Nordeste')!.value!));
  expect(html).not.toContain('Frequência escolar');
 });
 it('o índice federal preserva acesso a todos os capítulos e identifica os ainda não integrados',()=>{
  const html=renderToStaticMarkup(createElement(IndiceFederal));
  for(const c of CAPITULOS)expect(html).toContain(`href="/contas-publicas/${c.id}"`);
  expect(html).toContain('Dados disponíveis');expect(html).toContain('Em preparação');
 });
});
