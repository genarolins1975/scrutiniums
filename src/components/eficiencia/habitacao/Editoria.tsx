import Link from 'next/link';
import {GraficoBarras,LeituraGuiada} from '@/components/painel';
import {fichaDaFigura} from '@/lib/eficiencia/fichaDaFigura';
import {dados} from '@/lib/eficiencia/habitacao/dados';
import {ROTA,n,pct} from '@/lib/eficiencia/habitacao/modelo';
import {dataBR} from '@/lib/painel/formato';
import type {Natureza,TabelaEquivalente} from '@/lib/painel/tipos';
export {Nota,Secao} from '@/components/eficiencia/justica/Editoria';
/** Abertura das visões; sem numeração de capítulo (a ordem está nas abas do cabeçalho). */
export function Abertura({titulo,texto}:{titulo:string;texto:string}){return <header className="mb-9"><p className="rotulo text-obee">Habitação</p><h1 className="mt-3 max-w-4xl break-words font-serif text-4xl leading-tight md:text-5xl">{titulo}</h1><p className="mt-5 max-w-prose2 text-base leading-relaxed text-carvao-muted">{texto}</p><p className="mt-4 text-sm text-obee-dark">Brasil, regiões e 27 UFs · referência 2024 · FJP, edição 2026</p></header>}

export function Numeros({itens}:{itens:{valor:string;titulo:string;nota:string}[]}){return <dl className="my-8 grid grid-cols-1 gap-6 border-y border-linha py-6 sm:grid-cols-3">{itens.map(i=><div className="min-w-0" key={i.titulo}><dt className="text-sm text-carvao-muted">{i.titulo}</dt><dd className="mt-2 font-serif text-3xl leading-tight [overflow-wrap:anywhere] md:text-4xl">{i.valor}</dd><dd className="mt-3 max-w-xs text-xs leading-relaxed text-carvao-muted">{i.nota}</dd></div>)}</dl>}

/*
 * Peças das visões da habitação no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026). A frase de fonte de antes (FJP, Pnad
 * Contínua e CadÚnico, com o complemento de cada seção e o link para Dados e métodos) vai ao bloco recolhido da abertura e ao método; as
 * barras de composição viram o GraficoBarras do kit, com a mesma conta (estimativa sobre o denominador declarado) e a tabela equivalente
 * com estimativa e percentual de cada categoria.
 */
export const FJP='https://fjp.mg.gov.br/deficit-habitacional-no-brasil/';
/** A frase de fonte das visões, com o complemento de cada uma (abas, tabela do relatório). */
export function FonteFjp({children}:{children?:React.ReactNode}){return <p>Fonte: <a className="underline" href={FJP}>Fundação João Pinheiro, estimativas 2024</a>, a partir da Pnad Contínua/IBGE e do CadÚnico no componente de improvisados. {children} <Link className="underline" href={ROTA+'/dados'}>Fontes, localizadores e arquivos.</Link></p>;}
/** Edição e captura, como no déficit. */
export function Edicao(){return <p>Edição: {dados.edicao}. Captura pela Scrutiniums em {dataBR(dados.capturadoEm,'pt')}.</p>;}
export const SIGLAS=<p>FJP: Fundação João Pinheiro. Pnad Contínua: Pesquisa Nacional por Amostra de Domicílios Contínua, do IBGE. CadÚnico: Cadastro Único para Programas Sociais.</p>;
/** Recorte comum das visões (o mesmo da abertura de antes: "Brasil, regiões e 27 UFs · referência 2024 · FJP, edição 2026"). */
export const RECORTE={periodo:'referência '+dados.ano,universo:'Brasil, regiões e 27 UFs',unidade:'domicílios estimados e %',fonte:'FJP, edição 2026'};

/** Ficha "Sobre este dado" de uma figura da habitação: o arquivo original lido pelo snapshot, com hash e captura; a licença não está registrada. */
export function fichaFjp({indicador,natureza,arquivo,recurso,limitacoes,transformacoes,url=FJP}:{indicador:string;natureza:Natureza;arquivo:string;recurso:string;limitacoes:string[];transformacoes?:string[];url?:string}){
 const f=dados.fontes.find(x=>x.arquivo===arquivo)!;
 return fichaDaFigura({indicador,natureza,orgao:'Fundação João Pinheiro',conjunto:(arquivo.startsWith('inadequacao')?'Inadequação de domicílios no Brasil':'Déficit habitacional no Brasil')+', estimativas '+dados.ano,
  recurso:f.arquivo+', '+recurso,url,urlArquivo:f.url,unidade:'domicílios estimados e % do denominador declarado',frequencia:'Edição única nesta base',referencia:{inicio:String(dados.ano),fim:String(dados.ano)},
  capturadoEm:dados.capturadoEm,sha256:f.sha256,snapshot:'public/eficiencia/habitacao/snapshot.json',versao:'snapshot da habitação, versão '+dados.versao,
  transformacoes:transformacoes??['Percentual calculado como razão entre a estimativa e o denominador da mesma base (razão de totais, não média simples das UFs).'],
  limitacoes,notas:'FJP, '+dados.edicao+'. Estimativas a partir da Pnad Contínua/IBGE e do CadÚnico no componente de improvisados.'});
}

type Item={nome:string;valor:number};
/** Barras de participação no total declarado (Brasil, 2024): a escala parte de zero; somáveis só quando as categorias compõem o total. */
export function Barras({itens,total,titulo,somaveis=true}:{itens:Item[];total:number;titulo:string;somaveis?:boolean}){return <div><p className="t-meta mb-2 text-carvao-muted">{titulo}. Escala linear a partir de zero. {somaveis?'Categorias da composição.':'Categorias sobrepostas; não somar.'}</p>
 <GraficoBarras titulo={titulo} series={[{id:'pct',nome:'Participação',pontos:itens.map(r=>({x:r.nome,y:pct(r.valor,total)}))}]} eixoY={{unidade:'%',zero:true,casas:1}} orientacao="horizontal" rotulosValor/></div>;}
/** Tabela equivalente das barras: a mesma de antes (medida, estimativa e percentual), com o total de referência no título. */
export function tabelaBarras(itens:Item[],total:number,titulo:string):TabelaEquivalente{return {titulo,colunas:['Medida','Estimativa','%'],linhas:itens.map(r=>[r.nome,r.valor,pct(r.valor,total)]),casas:[null,0,1]};}
/** Os valores que cada barra mostrava ao lado do nome ("estimativa · percentual"), numa frase sob o gráfico. */
export function LeituraBarras({itens,total}:{itens:Item[];total:number}){return <LeituraGuiada rotulo="Em números">{itens.map(r=>r.nome+': '+n(r.valor)+' · '+n(pct(r.valor,total),1)+'%').join('; ')}.</LeituraGuiada>;}
