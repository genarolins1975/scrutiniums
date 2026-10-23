import type {Metadata} from 'next';
import Link from 'next/link';
import {FiguraAnalitica,GraficoBarras,PaginaPainel} from '@/components/painel';
import {dadosJustica as d,coberturaJustica as cobertura} from '@/lib/eficiencia/justica/dados';
import {FONTE_CNJ,FONTE_DEFENSORIA,fichaJustica} from '@/lib/eficiencia/justica/molde';
import {n,ROTA_JUSTICA,duracao} from '@/lib/eficiencia/justica/modelo';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';
import {dataBR} from '@/lib/painel/formato';
export const dynamic='force-static';
export const metadata:Metadata={title:'Acesso à Justiça',description:'Cobertura das Defensorias, duração dos processos, conciliação e recursos públicos, com dados por UF, comarca e tribunal.',alternates:{canonical:ROTA_JUSTICA}};
const CAMINHOS=[['cobertura','Onde a assistência está presente?','27 UFs e 2.563 comarcas; atendimento regular, parcial e ausência declarada.'],['tempo-resposta','Quanto tempo leva a resposta judicial?','27 tribunais estaduais; processos baixados e pendentes; fluxos nacionais.'],['conciliacao','Quais conflitos chegam a um acordo?','Conciliação judicial, centros de solução de conflitos e acordos extrajudiciais das Defensorias.'],['recursos','Que recursos sustentam a assistência?','Orçamento executado, gasto por habitante e defensores nas 27 UFs.']] as const;
/**
 * Panorama do Acesso à Justiça no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026). A abertura leva a primeira frase do texto
 * de antes como lead (o resto abre os caminhos), a nota final vira o limite e fica inteira no método; os três números passam à faixa do kit;
 * a barra de presença territorial vira o gráfico de barras do kit, com as contagens ao lado e a tabela equivalente; as três dimensões do
 * quadro "Como ler o capítulo" viram o glossário da página, sem a numeração (decisão 7, padrão sem numeração).
 */
export default function Panorama(){const total=d.comarcas.length;const reg=cobertura.reduce((a,c)=>a+c.regular,0),par=cobertura.reduce((a,c)=>a+c.parcial,0),sem=total-reg-par;
 const situacoes=[['Regular',reg],['Parcial ou excepcional',par],['Sem atendimento da Defensoria',sem]] as const;
 const fichaCobertura=fichaJustica('defensoria',{indicador:'Comarcas por situação de atendimento da Defensoria Pública',natureza:'CALCULADO',unidade:'comarcas; % das comarcas',inicio:d.coberturaEm,fim:d.coberturaEm,recurso:'Aba Comarcas, colunas A a I',formula:'Comarcas em cada situação ÷ total de comarcas × 100',limitacoes:['Cada comarca tem o mesmo peso, independentemente de sua população.','Presença declarada da Defensoria não mede todas as pessoas que precisam de assistência.']});
 const fichaCnj=fichaJustica('cnj',{indicador:'Duração média dos processos baixados e índice de conciliação',natureza:'OBSERVADO',unidade:'meses; %',inicio:String(d.cnj.ano),fim:String(d.cnj.ano),recurso:'Relatório integral em PDF, p. 24 (duração) e p. 233 (conciliação)',limitacoes:['Médias publicadas pelo CNJ; inclui execuções fiscais.']});
 return <PaginaPainel rota={ROTA_JUSTICA} principal={false}
  abertura={{grupo:TEMAS_EFICIENCIA.justica.nome,acento:'obee',titulo:'O direito encontra uma porta aberta?',
   lead:'O acesso começa na orientação jurídica, passa pela possibilidade de resolver um conflito e depende de uma resposta em tempo útil.',
   recorte:{periodo:'Defensorias: cobertura em abril de 2025 e administração em 2024 · Judiciário: ano-base 2025',universo:`27 UFs, ${n(total)} comarcas e o Judiciário`,unidade:'percentuais, meses e processos',fonte:FONTE_DEFENSORIA+' e '+FONTE_CNJ},
   limite:'uma nota de eficiência: cobertura territorial, composição dos processos e capacidade de resolver demandas são dimensões distintas, e faltam denominadores comuns para medir a demanda não atendida e a qualidade final do acesso.',
   fontesDatasSiglas:<><p>Cobertura das Defensorias declarada em {dataBR(d.coberturaEm,'pt')}; Judiciário com ano-base {d.cnj.ano}. Snapshot capturado em {dataBR(d.capturadoEm,'pt')}.</p><p>CNJ: Conselho Nacional de Justiça.</p></>}}
  numeros={[
   {rotulo:'Comarcas com atendimento regular',valor:100*reg/total,formato:'percentual',casas:1,unidade:'das comarcas',periodo:dataBR(d.coberturaEm,'pt'),recorte:`${n(reg)} de ${n(total)} comarcas`,fonte:FONTE_DEFENSORIA,natureza:'CALCULADO',nota:'Defensorias estaduais e do DF.'},
   {rotulo:'Tempo médio dos processos baixados',valor:d.cnj.tempoBaixados,valorTexto:duracao(d.cnj.tempoBaixados),unidade:'',periodo:'ano-base '+d.cnj.ano,recorte:'Judiciário',fonte:FONTE_CNJ+', p. 24',natureza:'OBSERVADO',nota:'Da entrada à primeira baixa; inclui execuções fiscais.'},
   {rotulo:'Índice de conciliação judicial',valor:d.cnj.conciliacao,formato:'percentual',casas:1,unidade:'',periodo:String(d.cnj.ano),fonte:FONTE_CNJ+', p. 233',natureza:'OBSERVADO',nota:'Homologações de acordo / sentenças e decisões terminativas.'},
  ]}
  navegacaoLocal={<nav aria-labelledby="caminhos-justica" className="mt-10 border-t border-linha pt-6"><h2 id="caminhos-justica" className="t-h2 text-carvao">Da assistência ao desfecho.</h2><p className="t-meta mt-3 max-w-prose2 text-carvao-muted">Este painel acompanha a presença das Defensorias, os processos no Judiciário e os recursos mobilizados. Escolha a pergunta e examine os dados, com a mesma seleção no gráfico, na tabela e na exportação.</p>
   <ul className="mt-4 grid gap-x-10 md:grid-cols-2">{CAMINHOS.map(([slug,t,desc])=><li key={slug} className="border-b border-linha"><Link className="block min-h-[44px] py-5" href={ROTA_JUSTICA+'/'+slug}><span className="t-h3 block text-carvao underline decoration-linha underline-offset-4">{t}</span><span className="t-meta mt-2 block text-carvao-muted">{desc}</span></Link></li>)}
    <li className="border-b border-linha"><Link className="block min-h-[44px] py-5" href="/eficiencia-estatal/judiciario"><span className="t-h3 block text-carvao underline decoration-linha underline-offset-4">Judiciário: filas, tempos e comparação de tribunais</span><span className="t-meta mt-2 block text-carvao-muted">57 tribunais de três ramos, com a referência nacional do CNJ.</span></Link></li></ul></nav>}
  figuras={<FiguraAnalitica id="presenca" pergunta="A presença territorial da Defensoria" subtitulo={`Comarcas por situação de atendimento · % das ${n(total)} comarcas · Defensorias estaduais e do DF`} natureza="CALCULADO" idioma="pt" proveniencia={fichaCobertura} complementares={[{rotulo:'Sobre o tempo e a conciliação',p:fichaCnj}]}
   comoInterpretar="Cada barra representa uma parcela das comarcas, independentemente de sua população. Percentuais recalculados da base de comarcas."
   naoConcluir="Presença declarada da Defensoria numa comarca não mede quantas pessoas precisam de assistência nem quantas foram atendidas; a comarca pode reunir vários municípios."
   tabela={{colunas:['Situação','Comarcas','% das comarcas'],linhas:situacoes.map(([s,v])=>[s,v,100*v/total]),casas:[null,0,1]}}
   complemento={<><dl className="t-meta max-w-md space-y-2">{situacoes.map(([label,v])=><div className="flex items-center justify-between gap-4" key={label}><dt>{label}</dt><dd className="whitespace-nowrap tabular-nums">{n(v)} · {n(100*v/total,1)}%</dd></div>)}</dl><Link className="inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4" href={ROTA_JUSTICA+'/cobertura'}>Comparar UFs e consultar comarcas →</Link></>}>
   <GraficoBarras semTabela titulo="Comarcas por situação de atendimento da Defensoria" dados={situacoes.map(([s,v])=>({id:s,nome:s,v:100*v/total}))} chaveCategoria="id" chaveRotulo="nome" orientacao="horizontal" series={[{id:'v',rotulo:'Participação nas comarcas',cor:'var(--cor-obee)'}]} unidade="%" casas={1} rotulosValor/>
  </FiguraAnalitica>}
  notas={{id:'como-ler-justica',titulo:'Como ler o capítulo: três dimensões, três perguntas',itens:[
   {termo:'Conseguir ajuda',definicao:'A cobertura descreve onde a Defensoria declara atuar. Não mede todas as pessoas que precisam de assistência.'},
   {termo:'Obter uma resposta',definicao:'A duração acompanha processos encerrados e ainda pendentes. Cada medida tem seu próprio universo.'},
   {termo:'Resolver o conflito',definicao:'Acordos e baixas são registros de atividade. A efetividade do direito e a satisfação exigem evidência adicional.'},
  ]}}
  metodo={<><p>O capítulo não atribui uma nota de eficiência. A cobertura territorial, a composição dos processos e a capacidade de resolver demandas são dimensões distintas. Faltam denominadores comuns para medir a demanda não atendida e a qualidade final do acesso.</p><p>Cobertura: {FONTE_DEFENSORIA}, aba Comarcas, percentuais recalculados das {n(total)} linhas. Duração média: {FONTE_CNJ}, ano-base {d.cnj.ano}, p. 24; conciliação na p. 233.</p><p>Fontes, recortes, hashes e arquivos em <Link className="underline" href={ROTA_JUSTICA+'/dados'}>Dados e métodos</Link>.</p></>}
 />;}
