import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AberturaFederal} from '@/components/contas-publicas/AberturaFederal';
import {AberturaEstadual} from '@/components/contas-estaduais/AberturaEstadual';
import {RetratoCapital} from '@/components/eficiencia/entrada/RetratoCapital';
import {montarRetrato} from '@/lib/eficiencia/entrada';
import {naCapital,numero} from "@/lib/eficiencia/entrada-nucleo";
import {IndiceFederal} from '@/components/contas-publicas/IndiceFederal';
import {DADOS} from '@/lib/contas-publicas/dados';
import {moeda} from '@/lib/contas-publicas/formato';
import {CAPITULOS_EM_PREPARACAO,CAPITULOS_PUBLICADOS} from '@/lib/contas-publicas/catalogo';
import {snapshot,dividaPrimaria} from '@/lib/contas-estaduais/dados';
import {comparar} from '@/lib/contas-estaduais/comparacao';

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
 it('Estadual abre com a pergunta e a página não repete a grade de bandeiras nem os cartões com fotos (diagnóstico de 20/10/2026, item 5)',()=>{
  const html=renderToStaticMarkup(createElement(AberturaEstadual,{uf:'PE',ano:2025,selecionar:()=>{}}));
  expect(/<h1[^>]*>([^<]+)<\/h1>/.exec(html)![1]).toBe('Como estão as contas do seu estado?');
  const painel=readFileSync('src/components/contas-estaduais/PainelEstadual.tsx','utf8');
  expect(painel).not.toContain('<TrilhasEstado');
  expect(readFileSync('src/components/contas-estaduais/TerritoriosEstaduais.tsx','utf8')).not.toContain('ce-flag-list');
  // a matriz das 27 UFs e a lista dos 48 contratos ficam recolhidas; a lista abre sozinha quando o leitor busca
  expect(painel).toContain('Ver a matriz das 27 UFs em');
  expect(painel).toContain('open={catalogoAberto || busca !== "" || grupo !== "Todos"}');
 });
 it('Estadual distingue ausência de dado conferido de valor zero',()=>{
  const html=renderToStaticMarkup(createElement(AberturaEstadual,{uf:'PE',ano:2015,selecionar:()=>{}}));
  expect(html.match(/Não conferido/g)).toHaveLength(2);
  expect(html).not.toContain('0,00%');
 });
 const retrato=montarRetrato();
 const retratoDe=(a:string,b:string)=>renderToStaticMarkup(createElement(RetratoCapital,{a:retrato.capitais.find(c=>c.id===a)!,b:retrato.capitais.find(c=>c.id===b)!,condicoes:retrato.condicoes,capitais:retrato.capitais,onSelect:()=>{},fonteContornos:retrato.fonteContornos,fontePopulacao:retrato.fontePopulacao}));
 it.each(retrato.capitais)('OBEE retrata $nome com os sete valores originais, contorno oficial e população do Censo',city=>{
  const reference=city.id==='4106902'?'2611606':'4106902';
  const html=retratoDe(city.id,reference);
  expect(html).toContain(`Como se vive ${naCapital(city.nome).split(" ")[0]} <em>${city.nome}</em>?`);
  for(const m of retrato.condicoes)expect(html).toContain(numero(m.valores[city.id].valor,m.unidade));
  expect(city.contorno).not.toBeNull();expect(html).toContain('retrato-hachura');
  expect(city.populacao).toBeGreaterThan(0);expect(html).toContain(Math.round(city.populacao!).toLocaleString('pt-BR'));
  expect(html).toContain('Posição relativa, não nota nem meta');
  expect(html).not.toContain('NaN');
 });
 it('o retrato declara partes remotas fora do enquadramento',()=>{
  const vitoria=retrato.capitais.find(c=>c.nome==='Vitória')!;
  expect(vitoria.contorno!.partesDistantes).toBeGreaterThan(0);
  expect(retratoDe(vitoria.id,'2611606')).toMatch(/partes remotas ficam fora do enquadramento/);
 });
 it('o índice federal dá acesso a todos os capítulos com dados e não anuncia os em preparação (Onda 3)',()=>{
  const html=renderToStaticMarkup(createElement(IndiceFederal));
  for(const c of CAPITULOS_PUBLICADOS)expect(html).toContain(`href="/contas-publicas/${c.id}"`);
  for(const c of CAPITULOS_EM_PREPARACAO){expect(html).not.toContain(`href="/contas-publicas/${c.id}"`);expect(html).not.toContain(c.titulo);}
  expect(html).toContain('Dados disponíveis');expect(html).not.toContain('Em preparação');expect(html).not.toContain('Conhecer a proposta');
 });
});
