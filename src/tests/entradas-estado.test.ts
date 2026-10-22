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
 it('Federal abre com a pergunta e uma cascata só, com o que fica para trás em cada passo (diagnóstico de 20/10/2026, item 9)',()=>{
  const html=renderToStaticMarkup(createElement(AberturaFederal));
  const b=DADOS.orcamento.find(b=>b.ano===2025)!.total;
  expect(html).toMatch(/<h1[^>]*>Quanto do orçamento federal vira <em>pagamento<\/em>\?<\/h1>/);
  expect(html).not.toContain('à <em>entrega.</em>');
  // uma barra encaixada no lugar das quatro barras soltas, e sem a escala comum delas
  expect(html.match(/role="img"/g)).toHaveLength(1);
  expect(html).not.toContain('Escala comum');
  for(const [de,para] of [['atualizada','empenhado'],['empenhado','liquidado'],['liquidado','pago']] as const)expect(html).toContain(moeda(b[de]-b[para],'reais'));
  expect(html).toContain('não empenhados');
  expect(html).toContain('liquidados e não pagos');
  expect(html).toContain('cada um está dentro do anterior');
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
  // a matriz das 27 UFs e a lista dos 48 contratos ficam recolhidas; a lista abre sozinha quando o leitor busca,
  // e o resumo continua capaz de fechá-la com o filtro ativo (o open não fica preso à busca)
  expect(painel).toContain('Ver a matriz das 27 UFs em');
  expect(painel).toContain('open={catalogoAberto}');
  expect(painel).toContain('if (e.target.value) setCatalogoAberto(true);');
  expect(painel).toContain('if (e.target.value !== "Todos") setCatalogoAberto(true);');
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
  // destaque colorido no título só no H1 da página inicial (decisão do dono de 22/10/2026)
  expect(html).toContain(`Como se vive ${naCapital(city.nome).split(" ")[0]} ${city.nome}?`);
  for(const m of retrato.condicoes)expect(html).toContain(numero(m.valores[city.id].valor,m.unidade));
  expect(city.contorno).not.toBeNull();expect(html).toContain('retrato-hachura');
  expect(city.populacao).toBeGreaterThan(0);expect(html).toContain(Math.round(city.populacao!).toLocaleString('pt-BR'));
  expect(html).toContain('Posição relativa, não nota nem meta');
  expect(html).not.toContain('NaN');
 });
 it('o retrato mostra uma régua de posição por resultado, sem pétalas nem fundo escuro (decisão do dono de 21/10/2026, diagnóstico de 20/10/2026, item 8)',()=>{
  const html=retratoDe('2611606','4106902');
  const reguas=html.match(/<svg[^>]*role="img"[^>]*aria-label="[^"]*na posição \d+ de 100; Curitiba na posição \d+"/g)??[];
  expect(reguas).toHaveLength(retrato.condicoes.length);
  expect(html).toContain('Onde Recife fica entre as 26 capitais');
  // os valores das duas capitais em cada régua: a escolhida e, com o losango, a de comparação
  for(const m of retrato.condicoes){expect(html).toContain(numero(m.valores['2611606'].valor,m.unidade));expect(html).toContain(numero(m.valores['4106902'].valor,m.unidade));}
  expect((html.match(/<dt class="sr-only">Curitiba<\/dt>/g)??[]).length).toBe(retrato.condicoes.length);
  expect(html).not.toMatch(/pétala/i);
  const css=readFileSync('src/components/eficiencia/entrada/Entrada.module.css','utf8');
  expect(css).not.toMatch(/repeating-linear-gradient/);
  expect(css).toMatch(/\.hero\{[^}]*background:var\(--cor-obee-atlas-papel\)/);
 });
 it('empate de posição entre a capital e o comparador: os dois marcadores continuam visíveis (Porto Velho e São Luís na renda)',()=>{
  const renda=retrato.condicoes.find(m=>m.posicoes&&Math.abs(m.posicoes['1100205']-m.posicoes['2111300'])<0.01);
  expect(renda).toBeDefined();
  const html=retratoDe('1100205','2111300');
  // a capital sobe (cy 8) e o losango do comparador desce (centro em 21) na régua do empate
  expect(html).toMatch(/<circle cx="[\d.]+" cy="8" r="6.5"/);
  expect(html).toMatch(/<path d="M[\d.]+ 15l6 6l-6 6l-6 -6Z"/);
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
