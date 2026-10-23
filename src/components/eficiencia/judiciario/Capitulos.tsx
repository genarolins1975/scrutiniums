import type {ReactNode} from 'react';
import Link from 'next/link';
import {judiciario as d} from '@/lib/eficiencia/judiciario/dados';
import {internacionalJudiciario as internacional} from '@/lib/eficiencia/judiciario/internacional-dados';
import {BASE_JUDICIARIO,CAPITULOS,type CapituloJudiciario} from '@/lib/eficiencia/judiciario/modelo';
import {n,duracao} from '@/lib/eficiencia/justica/modelo';
import {Recolhido} from '@/components/observatorios/Recolhido';
import {FaixaNumeros,FiguraAnalitica,GraficoBarras,GraficoLinhas,NumeroIndicador,PaginaPainel,TabelaDados,type AberturaProps,type NumeroProps} from '@/components/painel';
import {fichaDaFigura} from '@/lib/eficiencia/fichaDaFigura';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';
import {dataBR} from '@/lib/painel/formato';
import {SerieDespesasJudiciario} from './SerieDespesas';
import {ComposicaoDespesasJudiciario} from './ComposicaoDespesas';
import {TemposUniversosJudiciario} from './TemposUniversos';
import {ComparadorJudiciario,ExploradorRamos} from './Exploradores';
import {AcervoParadoJudiciario} from './Respostas';
import {MultiplosTribunais} from './Evolucao';
import {ExecucaoTribunais,LaboratorioConsistencia} from './Consistencia';
import {PainelInternacionalJudiciario} from './Internacional';
import {linhasPosicoesWjp} from './EntradaInternacional';
import {INDICADORES_INTERNACIONAIS,type IndicadorInternacional} from '@/lib/eficiencia/judiciario/internacional';
import {TextoCoberturaJudiciario,estiloJudiciario as s} from './Editoria';

/**
 * Capítulos do Judiciário no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026), como o panorama já estava desde o PR 1: cada
 * capítulo é um PaginaPainel dentro do <main> do layout, com a pergunta do capítulo como H1, o texto de abertura como lead, o recorte do
 * Justiça em Números e a frase do limite. Os gráficos de domínio que o kit não tem (halteres, pequenos múltiplos, composição em anel,
 * barras com o link de cada tribunal, o funil do acaso) ficam dentro da FiguraAnalitica, marcados como legado; as tabelas à mão passam à
 * TabelaDados, à vista quando estavam à vista; as notas viram o limite, a ressalva da figura, o glossário ou o método, sem perder texto.
 * O pictograma da abertura sai (o molde não tem ícone decorativo), como no panorama.
 *
 * Os seletores, rótulos e textos que scripts/obee/judiciario-verificacao.mjs procura (a tabela dos ramos à vista com uma linha por ramo,
 * "Preços da série", "Ver tabela anual equivalente" e a região "Tabela anual de despesas", os controles do comparador e do painel
 * internacional) continuam os mesmos.
 */
export const TEXTOS_JUDICIARIO:Record<CapituloJudiciario,string>={internacional:'Compare experiências de acesso, demora, cumprimento e garantias no Brasil e em outros países. Explore referências e trajetórias sem confundir pontuação com duração ou ganho de uma reforma.',panorama:'Veja quantos processos chegaram, foram baixados e continuaram em tramitação. Explore os três ramos deste recorte e sua relação com a referência nacional.',recursos:'Quanto a Justiça custa para cada pessoa, como a despesa evoluiu e o que compõe os gastos. Os valores ajudam a entender a estrutura do serviço; uma razão isolada não mede eficiência.',tempo:'Nem todo tempo mede a mesma espera. Separe os processos que já saíram daqueles que ainda aguardam e compare conhecimento e execução.',filas:'Quantos casos entram, quantos saem e quantos permanecem? Explore os fluxos do ano e o acervo acumulado, cada um com seu próprio universo.',entrega:'Da decisão ao cumprimento, há uma diferença importante. Veja o que a conciliação e a baixa registram e o que ainda falta observar.',acesso:'Onde há estrutura para buscar uma solução? Explore centros de conciliação e a cobertura das Defensorias, respeitando o território de cada base.',consistencia:'Previsibilidade é parte da Justiça: casos parecidos deveriam ter respostas parecidas. Veja o que os dados públicos já mostram sobre contestação, espera por uma regra comum e percepção de tratamento igual, e como a dispersão entre juízes pode ser medida.',criminal:'Quantos casos criminais entram, quantas penas estão em execução e como o Brasil se situa entre os países em investigação, julgamento e imparcialidade da Justiça criminal.',comparar:'Escolha até três tribunais do mesmo ramo. Compare tempos publicados, veja o conjunto dos pares e abra as fichas para entender o contexto.',metodos:'Conheça a origem dos números, as fórmulas permitidas, os universos e o que este recorte ainda não permite medir. Ausência não é zero.'};

const FONTE=`CNJ, Justiça em Números ${d.edicao}`;
const fonteCnj=(p:string)=>`${FONTE}, p. ${p}`;
const linkCnj=(p:string)=>`${d.fonte.url}#page=${p.split(/[– e,]/)[0]}`;
/** Ficha "Sobre este dado" de uma figura do CNJ: o mesmo montador do panorama (fichaDaFigura), com a página do relatório como recurso. */
function fichaCnj(o:{indicador:string;natureza:'OBSERVADO'|'CALCULADO';unidade:string;paginas:string;limitacoes?:string[];formula?:string;inicio?:string;fim?:string}){
 return fichaDaFigura({indicador:o.indicador,natureza:o.natureza,orgao:'CNJ',conjunto:'Justiça em Números '+d.edicao,recurso:'Relatório integral em PDF, p. '+o.paginas,url:d.fonte.url,unidade:o.unidade,frequencia:'Anual (edição do Justiça em Números)',
  referencia:{inicio:o.inicio??String(d.ano),fim:o.fim??String(d.ano)},capturadoEm:d.capturadoEm,sha256:d.fonte.sha256,snapshot:'public/eficiencia/judiciario/snapshot.json',versao:'snapshot do Judiciário, versão '+d.versao,
  formula:o.formula??null,limitacoes:o.limitacoes??[],notas:d.fonte.referencia+'. Localizadores: '+d.fonte.localizadores});
}
/** Ficha da comparação internacional: a planilha do World Justice Project fixada no commit fonte, com o SHA-256 conferido. */
function fichaWjp(indicador:string){
 const e=internacional.edicao;
 return fichaDaFigura({indicador,natureza:'OBSERVADO',orgao:'World Justice Project',conjunto:'Rule of Law Index, edição '+e,recurso:'Planilha do próprio WJP, fixada no commit fonte',url:internacional.fonte.url,unidade:'escore de 0 a 1',frequencia:'Edição do índice',
  referencia:{inicio:String(e),fim:String(e)},cobertura:{inicio:String(internacional.cobertura.edicoes[0]).split('-')[0],fim:String(internacional.cobertura.edicoes.at(-1))},capturadoEm:internacional.fonte.verificadoEm,sha256:internacional.fonte.sha256,snapshot:'public/eficiencia/judiciario/internacional.json',versao:'comparação internacional do Judiciário',
  limitacoes:['Experiências e percepções de pesquisas domiciliares e de especialistas, de 0 a 1: não são percentuais de pessoas, meses ou taxas administrativas.','Intervalos de incerteza não foram integrados; diferenças pequenas não demonstram significância estatística.'],notas:internacional.fonte.notaEdicao});
}
function abertura(slug:CapituloJudiciario,o:{limite:ReactNode;universo?:string;unidade?:string;periodo?:string;fonte?:string;lead?:string;acao?:ReactNode}):AberturaProps{
 return {grupo:TEMAS_EFICIENCIA.judiciario.nome,acento:'obee',titulo:CAPITULOS.find(c=>c[0]===slug)![2],lead:o.lead??TEXTOS_JUDICIARIO[slug],acao:o.acao,
  recorte:{periodo:o.periodo??'ano-base '+d.ano,universo:o.universo??'Justiça Estadual, Federal e do Trabalho',unidade:o.unidade,fonte:o.fonte??FONTE},limite:o.limite,
  fontesDatasSiglas:<><p>Fonte: <a className="underline" href={d.fonte.url}>{FONTE}</a> · ano-base {d.ano}. Original identificado pelo SHA-256 <span className="break-all">{d.fonte.sha256}</span>; captura em {dataBR(d.capturadoEm,'pt')}.</p><p>CNJ: Conselho Nacional de Justiça.</p></>};
}
/** A linha de fonte de antes (FonteJudiciario), agora no método: a página do relatório com o link para ela. */
function Fonte({pagina,children}:{pagina:string;children?:ReactNode}){return <p>Fonte: <a className="underline" href={linkCnj(pagina)}>{fonteCnj(pagina)}</a> · ano-base {d.ano}. {children}</p>;}
function Metodo({children}:{children?:ReactNode}){return <>{children}<p>Cobertura, fichas dos indicadores e reprodução em <Link className="underline" href={BASE_JUDICIARIO+'/metodos'}>Dados e método</Link>.</p></>;}
const LINK='inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao';
const legado=(no:ReactNode)=><div data-figura-legado="">{no}</div>;
const nomeRamo=(id:string)=>d.ramos.find(r=>r.id===id)?.nome??id;

export function Downloads(){return <div className={s.links}>{[['snapshot.json','Snapshot com metadados'],['ramos.csv','Agregados dos ramos · CSV'],['tribunais.csv','57 tribunais · CSV'],['despesas-historico.csv','Histórico financeiro · CSV'],['tribunais-historico.csv','Tempos por tribunal, 2021 a 2025 · CSV'],['manifesto.json','Manifesto e checksums']].map(([file,title])=><a key={file} href={'/eficiencia/judiciario/'+file} download>{title}</a>)}</div>;}

/* ------------------------------------------------------------------ recursos */
export function Recursos(){
 const c=d.porHabitante,tjs=d.tribunais.filter(t=>t.ramo==='estadual').sort((a,b)=>b.despesaPorHabitante!-a.despesaPorHabitante!),estadual=d.ramos.find(r=>r.id==='estadual')!,max=Math.max(...tjs.map(t=>t.despesaPorHabitante!));
 const m=d.magistrados,e=d.comparacaoEuropa,porRamo=Object.entries(m.porRamo).filter(([k])=>k!=='Tribunais Superiores');
 const numeros:NumeroProps[]=[...d.ramos.map(r=>({nome:r.nome,valor:r.despesaTotal})),{nome:'Referência nacional CNJ · seis segmentos',valor:d.financeiro.total}].map(r=>({rotulo:r.nome,valor:r.valor/1e9,formato:'reais' as const,casas:1,unidade:'R$ bi',periodo:String(d.ano),fonte:fonteCnj('64'),natureza:'OBSERVADO' as const,nota:'Despesa de 2025 · valor completo disponível na tabela e no snapshot.'}));
 const numerosHabitante:NumeroProps[]=[{rotulo:'Despesa por habitante · Brasil',valor:c.valor,formato:'reais',casas:2,unidade:'por habitante',periodo:String(d.ano),recorte:'seis segmentos do Judiciário · reais nominais',fonte:fonteCnj('64'),natureza:'OBSERVADO'},{rotulo:'Sem inativos',valor:c.semInativos,formato:'reais',casas:2,unidade:'por habitante',periodo:String(d.ano),fonte:fonteCnj('64'),natureza:'OBSERVADO',nota:`Inativos são ${n(c.inativosPercentual,1)}% da despesa total.`},{rotulo:'Parte do PIB',valor:c.pib,formato:'percentual',casas:1,unidade:'',periodo:String(d.ano),fonte:fonteCnj('64'),natureza:'OBSERVADO',nota:`${n(c.pibSemInativos,1)}% sem inativos; ${n(c.gastosPublicos,2)}% dos gastos de União, estados, DF e municípios.`},{rotulo:'Justiça Estadual por habitante',valor:estadual.despesaPorHabitante!,formato:'reais',casas:1,unidade:'por habitante',periodo:String(d.ano),fonte:fonteCnj('64'),natureza:'OBSERVADO',nota:`Valor agregado do ramo como publicado, não média simples dos tribunais; sem inativos, R$ ${n(estadual.despesaPorHabitanteSemInativos!,1)}.`}];
 return <PaginaPainel rota={BASE_JUDICIARIO+'/recursos'} principal={false}
  abertura={abertura('recursos',{unidade:'reais nominais e reais de 2025',limite:'eficiência a partir de uma razão financeira isolada: a Scrutiniums reproduz os valores publicados pelo CNJ, não rateia gasto por comarca nem atribui um TRF ou TRT à UF de sua sede.'})}
  numeros={numeros} notaNumeros="Valores em reais nominais de 2025, publicados na figura 30. Não se somam novamente despesas de tribunais ao agregado do ramo."
  figuras={<>
   <FiguraAnalitica id="serie-despesas" pergunta="Como a despesa evoluiu em termos reais?" subtitulo="Despesa total · bilhões de reais a preços de 2025 · referência nacional e três ramos" natureza="OBSERVADO" idioma="pt"
    proveniencia={fichaCnj({indicador:'Despesa total do Judiciário, série real',natureza:'OBSERVADO',unidade:'R$ a preços de 2025',paginas:'62–63, 110–111, 132–133 e 157–158',inicio:String(d.financeiro.series.nacional[0].ano),fim:String(d.ano),limitacoes:['Rótulos publicados a 0,1 bilhão de reais; a conversão para reais não acrescenta precisão.','Em valores nominais, só o ano-base tem valor publicado no relatório consultado.']})}
    comoInterpretar="Série publicada pelo próprio CNJ com correção pelo IPCA. A alteração de preços não é recalculada a partir de um índice incompleto."
    naoConcluir="A despesa maior não mede mais ou menos serviço: a série descreve o custo total publicado, sem dividir por processo, pessoa ou resultado, e a precisão é a dos rótulos da fonte."
    tabela={{naFigura:'no resumo “Ver tabela anual equivalente”, logo abaixo do gráfico, com o valor e a página da fonte de cada ano.'}}>
    <SerieDespesasJudiciario series={d.financeiro.series} fonte={d.fonte.url} convencao={d.financeiro.convencao}/>
   </FiguraAnalitica>
   <FiguraAnalitica id="pessoal" pergunta="O que compõe a despesa com pessoal?" subtitulo={`Composição interna de pessoal · R$ nominais e % do pessoal · referência nacional, ${d.ano}`} natureza="CALCULADO" idioma="pt"
    proveniencia={fichaCnj({indicador:'Composição da despesa com pessoal',natureza:'CALCULADO',unidade:'R$ nominais; % do pessoal',paginas:'64 e 70–71',formula:'Participação = rubrica ÷ despesa com pessoal × 100',limitacoes:['Inclui ativos, inativos, benefícios e demais rubricas publicadas; não equivale somente a salários.','Alguns tribunais têm inativos pagos por fundos fora de seu orçamento, conforme ressalva da fonte.']})}
    comoInterpretar="Composição interna de pessoal na referência nacional do CNJ, 2025. Inclui ativos, inativos, benefícios e demais rubricas publicadas; não equivale somente a salários."
    naoConcluir="As parcelas internas do pessoal não se somam novamente ao total, e a diferença entre total e pessoal não se separa em custeio, investimento e tecnologia neste recorte."
    tabela={{titulo:'Referência nacional · R$ nominais de 2025 · composição de pessoal',colunas:['Rubrica','Valor em R$','Participação no pessoal (%)'],linhas:d.financeiro.pessoal.map(p=>[p.nome,p.valor,100*p.valor/d.financeiro.pessoalTotal]),casas:[null,0,1]}}
    complemento={<p className="t-meta max-w-prose2 text-carvao-muted">Demais despesas, por diferença entre total e pessoal: R$ {n(d.financeiro.total-d.financeiro.pessoalTotal)}. O recorte não separa essa diferença em custeio, investimento e tecnologia. As parcelas internas do pessoal não se somam novamente ao total. Alguns tribunais têm inativos pagos por fundos fora de seu orçamento, conforme ressalva da fonte.</p>}>
    {legado(<ComposicaoDespesasJudiciario total={d.financeiro.total} pessoal={d.financeiro.pessoalTotal} rubricas={d.financeiro.pessoal} ano={d.ano}/>)}
   </FiguraAnalitica>
   <FiguraAnalitica id="por-habitante" pergunta="Quanto custa para cada pessoa?" subtitulo={`Despesa por habitante em cada Tribunal de Justiça · R$ nominais de ${d.ano} · ordem decrescente do total`} natureza="OBSERVADO" idioma="pt"
    proveniencia={fichaCnj({indicador:'Despesa por habitante, Brasil e Tribunais de Justiça',natureza:'OBSERVADO',unidade:'R$ por habitante, nominais',paginas:'64 e 113',limitacoes:[c.nota,'Valores por habitante dos TRFs e TRTs não foram integrados nesta versão.']})}
    comoInterpretar={`Despesa do Poder Judiciário por habitante em ${d.ano}, como publicada pelo CNJ. A versão sem inativos retira aposentadorias e pensões pagas pelo orçamento dos tribunais.`}
    ressalva="A Scrutiniums não calcula despesa por habitante própria: reproduz os valores publicados pelo CNJ, com a população adotada pela fonte. Não atribuímos um TRF ou TRT à UF de sua sede, não rateamos gasto por comarca e não tratamos uma razão financeira isolada como eficiência. Pessoas e equivalentes de jornada também não são intercambiáveis."
    naoConcluir="Quando total e sem inativos coincidem na precisão publicada, a figura não permite separar a despesa com inativos; a diferença entre tribunais não mede qualidade nem eficiência."
    tabela={{titulo:`27 TJs · ${d.ano} · R$ por habitante, nominais`,colunas:['Tribunal','Total','Sem inativos','Diferença'],linhas:tjs.map(t=>[t.sigla,t.despesaPorHabitante,t.despesaPorHabitanteSemInativos,t.despesaPorHabitante!-t.despesaPorHabitanteSemInativos!]),casas:[null,1,1,1],limite:tjs.length}}
    complemento={<FaixaNumeros rotulo="Despesa por habitante" idioma="pt">{numerosHabitante.map(x=><NumeroIndicador key={x.rotulo} {...x} tamanho="m" idioma="pt"/>)}</FaixaNumeros>}>
    {legado(<figure className={`${s.chart} ${s.capitaChart}`}><figcaption>Despesa por habitante em cada Tribunal de Justiça · R$ nominais de {d.ano} · ordem decrescente do total</figcaption><p className={s.dumbbellLegend}><span><i data-serie="0" aria-hidden="true"/>Total</span><span><i data-serie="1" aria-hidden="true" style={{background:'var(--cor-obee-atlas-serie-par)',border:0}}/>Sem inativos</span></p>{tjs.map(t=><div className={s.barRow} key={t.id}><Link href={BASE_JUDICIARIO+'/tribunais/'+t.id}>{t.sigla}</Link><div className={s.capitaPair} role="img" aria-label={`${t.sigla}: R$ ${n(t.despesaPorHabitante,1)} por habitante; sem inativos, R$ ${n(t.despesaPorHabitanteSemInativos,1)}`}><div className={s.track}><div className={s.bar} style={{width:100*t.despesaPorHabitante!/max+'%'}}/></div><div className={s.track}><div className={s.bar} data-serie="1" style={{width:100*t.despesaPorHabitanteSemInativos!/max+'%'}}/></div></div><span className={s.value}>R$ {n(t.despesaPorHabitante,1)}</span></div>)}<p className={s.scale}>Escala de zero a R$ {n(max,1)}. Quando total e sem inativos coincidem na precisão publicada, a figura não permite separar a despesa com inativos. Uma explicação possível é o pagamento por fundos fora do orçamento do tribunal, que a fonte menciona para alguns tribunais sem identificá-los.</p></figure>)}
   </FiguraAnalitica>
   <FiguraAnalitica id="juizes" pergunta="Há juízes suficientes para a demanda?" subtitulo={`Cargos de magistrado providos por cem mil habitantes · por ramo · ${d.ano}`} natureza="OBSERVADO" idioma="pt"
    proveniencia={fichaCnj({indicador:'Magistrados por cem mil habitantes e comparação com a União Europeia',natureza:'OBSERVADO',unidade:'cargos providos por cem mil habitantes',paginas:'51 e 231',limitacoes:[m.nota,e.nota]})}
    comoInterpretar="Cargos de magistrado providos por cem mil habitantes e a comparação que o próprio CNJ faz com a União Europeia. A diferença de demanda pesa mais que a de juízes."
    naoConcluir="Os países europeus têm sistemas, competências e registros diferentes: a tabela orienta escala, não ordem de classificação, e cargos providos não medem jornada disponível."
    tabela={{colunas:['Ramo','Magistrados por cem mil habitantes'],linhas:porRamo.map(([k,v])=>[k,v]),casas:[null,2]}}
    complemento={<FaixaNumeros rotulo="Magistrados no Poder Judiciário" idioma="pt"><NumeroIndicador rotulo="Magistrados por cem mil habitantes" valor={m.porCemMil} formato="decimal" casas={2} unidade="por cem mil habitantes" periodo={String(d.ano)} recorte="Poder Judiciário · cargos providos" fonte={fonteCnj('51')} natureza="OBSERVADO" tamanho="m" idioma="pt"/></FaixaNumeros>}
    depois={<TabelaDados recolhida={false} tituloVisivel="Brasil e União Europeia" lead="Comparação publicada pelo CNJ." titulo="Brasil e União Europeia · comparação publicada pelo CNJ" colunas={['Indicador','União Europeia','Brasil']} linhas={e.linhas.map(l=>[l.indicador,l.uniaoEuropeia,l.brasil])} limite={e.linhas.length} nota={<>{e.nota} Os países europeus têm sistemas, competências e registros diferentes; a tabela orienta escala, não ordem de classificação. Fonte: <a className="underline" href={linkCnj('231')}>{fonteCnj('231')}</a>.</>}/>}>
    <GraficoBarras semTabela titulo="Magistrados por cem mil habitantes, por ramo" dados={porRamo.map(([k,v])=>({id:k,nome:k,v}))} chaveCategoria="id" chaveRotulo="nome" orientacao="horizontal" series={[{id:'v',rotulo:'Magistrados por cem mil habitantes',cor:'var(--cor-obee)'}]} unidade="por cem mil hab." casas={2} rotulosValor/>
   </FiguraAnalitica>
  </>}
  tabelas={<TabelaDados recolhida={false} id="despesa-por-baixa" tituloVisivel="Despesa anual e baixas: uma razão, não um custo individual." lead="A despesa exata por ramo é dividida pelos volumes de baixas arredondados do sumário, no mesmo ano. A razão é aproximada e não atribui despesa a um processo, assunto ou comarca."
   titulo={`${d.ano} · mesmo ramo · denominadores arredondados`} colunas={['Ramo','Despesa anual · R$','Baixados','R$ por baixa · aproximação']} linhas={d.ramos.map(r=>[r.nome,r.despesaTotal,r.baixados,r.despesaPorBaixaAproximada])} casas={[null,0,0,0]} limite={d.ramos.length} nota={<>Fonte: <a className="underline" href={linkCnj('23')}>{fonteCnj('23 e 64')}</a>.</>}/>}
  metodo={<Metodo><Fonte pagina="64">Valores em reais nominais de 2025, publicados na figura 30. Não se somam novamente despesas de tribunais ao agregado do ramo.</Fonte><Fonte pagina="62–63, 110–111, 132–133 e 157–158">Série real com correção pelo IPCA publicada pelo CNJ. {d.financeiro.convencao}</Fonte><Fonte pagina="113">Figura 79. Valores por habitante dos TRFs e TRTs não foram integrados nesta versão.</Fonte><Fonte pagina="51 e 231"/></Metodo>}
 />;
}

/* --------------------------------------------------------------------- tempo */
export function Tempo(){
 const h=d.historicoTempos;
 const ramo=(r:string)=>d.tribunais.filter(t=>t.ramo===r).sort((a,b)=>a.sigla.localeCompare(b.sigla,'pt-BR',{numeric:true}));
 const universos:[string,number,number][]=[['Todos os processos',d.nacional.tempoBaixados,d.nacional.tempoPendentes],['Execuções fiscais',d.nacional.tempoBaixadosFiscal,d.nacional.tempoPendentesFiscal],['Sem execuções fiscais',d.nacional.tempoBaixadosSemFiscal,d.nacional.tempoPendentesSemFiscal]];
 const todos=['estadual','federal','trabalho'].flatMap(ramo);
 return <PaginaPainel rota={BASE_JUDICIARIO+'/tempo'} principal={false}
  abertura={abertura('tempo',{unidade:'meses',limite:'o tempo que falta esperar num processo: a idade dos pendentes é tempo já decorrido, e o recorte não tem eventos individuais para mediana, percentis ou coortes.'})}
  figuras={<>
   <FiguraAnalitica id="ramos" pergunta="Quanto tempo têm os processos pendentes em cada ramo?" subtitulo={`Idade média dos pendentes · meses · três ramos, ${d.ano}`} natureza="OBSERVADO" idioma="pt" ressalva={<TextoCoberturaJudiciario/>}
    proveniencia={fichaCnj({indicador:'Idade média dos processos pendentes por ramo e fase',natureza:'OBSERVADO',unidade:'meses',paginas:'24',limitacoes:['Médias publicadas, não medianas; universos próprios para cada fase.']})}
    comoInterpretar="Idade média dos processos pendentes, com universos próprios para cada fase."
    naoConcluir="Um processo pendente ainda não tem sua duração final observada: a idade já decorrida não é o tempo que falta esperar, e o recorte não permite mediana, percentis, coortes nem ajuste de censura à direita."
    tabela={{naFigura:'logo abaixo do gráfico, à vista, com o valor, a unidade e a precisão de cada ramo no recorte escolhido.'}}>
    <ExploradorRamos ramos={d.ramos} medidas={['idadePendente','conhecimento','execucao']} fonte={d.fonte.url} ano={d.ano}/>
   </FiguraAnalitica>
   <FiguraAnalitica id="universos" pergunta="Baixados e pendentes não contam a mesma história." subtitulo={`Médias nacionais publicadas · meses · referência nacional do CNJ, ${d.ano}`} natureza="OBSERVADO" idioma="pt"
    proveniencia={fichaCnj({indicador:'Duração média dos baixados e idade média dos pendentes, nacional, por universo',natureza:'OBSERVADO',unidade:'meses',paginas:'24'})}
    comoInterpretar="Médias nacionais oficiais, sem calcular uma média das médias dos tribunais."
    naoConcluir="As médias descrevem grupos diferentes e não são somadas: baixados medem a duração até a primeira baixa; pendentes, a idade já decorrida no acervo, sem duração final observada."
    tabela={{titulo:`Referência nacional do CNJ · ${d.ano} · médias publicadas em meses`,colunas:['Universo','Duração dos baixados','Idade dos pendentes'],linhas:universos.map(([nome,b,p])=>[nome,duracao(b),duracao(p)])}}
    complemento={<Link className={LINK} href={BASE_JUDICIARIO+'/comparar'}>Comparar os 57 tribunais</Link>}>
    {legado(<TemposUniversosJudiciario ano={d.ano} linhas={universos.map(([nome,baixados,pendentes])=>({nome,baixados,pendentes}))}/>)}
   </FiguraAnalitica>
   <FiguraAnalitica id="execucao" pergunta="Ganhei. Quanto tempo até levar?" subtitulo={`Fase de execução do primeiro grau · meses · por tribunal, um ramo por vez, ${d.ano}`} natureza="OBSERVADO" idioma="pt"
    proveniencia={fichaCnj({indicador:'Duração dos baixados e idade dos pendentes na fase de execução, por tribunal',natureza:'OBSERVADO',unidade:'meses',paginas:'340, 400 e 465'})}
    comoInterpretar="Na fase de execução, a decisão é transformada em cumprimento: pagamento, entrega de bem ou outra obrigação. Os tempos abaixo são do primeiro grau, por tribunal, com as duas médias juntas."
    ressalva="Inclui execuções fiscais e de títulos extrajudiciais, que não passam pela fase de conhecimento."
    naoConcluir="Tempo da execução não é tempo até o dinheiro chegar a quem ganhou; as médias não controlam assuntos nem a proporção de execuções fiscais."
    tabela={{colunas:['Tribunal','Ramo','Duração dos baixados (meses)','Idade dos pendentes (meses)'],linhas:todos.map(t=>[t.sigla,nomeRamo(t.ramo),t.execucaoBaixados,t.execucaoPendentes]),casas:[null,null,0,0],limite:todos.length}}>
    {legado(<ExecucaoTribunais linhas={d.tribunais.map(t=>({id:t.id,sigla:t.sigla,uf:t.uf,ramo:t.ramo,tempoBaixados:t.execucaoBaixados,idadePendentes:t.execucaoPendentes}))} ano={d.ano}/>)}
   </FiguraAnalitica>
   <FiguraAnalitica id="evolucao" pergunta="Os tempos melhoraram?" subtitulo={`Duração dos baixados e idade dos pendentes · meses · por tribunal, ${h.anos[0]} a ${h.anos.at(-1)}`} natureza="OBSERVADO" idioma="pt"
    proveniencia={fichaCnj({indicador:'Tempos por tribunal publicados em cada edição',natureza:'OBSERVADO',unidade:'meses',paginas:'333, 397 e 459',inicio:String(h.anos[0]),fim:String(h.anos.at(-1)),limitacoes:[h.nota]})}
    comoInterpretar={`Valores publicados em cada edição do Justiça em Números, de ${h.anos[0]} a ${h.anos.at(-1)}. Os dois tempos andam juntos: quando o acervo envelhece, a fila cresce; quando a duração dos baixados sobe e a idade do acervo cai, o tribunal pode estar encerrando processos antigos.`}
    naoConcluir="Cada edição publica valores calculados com os dados da época, sem revisão retroativa pela fonte: a mudança entre anos não identifica a causa nem compara a mesma coorte de processos."
    extraFonte={<>Edições: {h.edicoes.map((e,i)=><span key={e.edicao}>{i>0&&'; '}<a className="underline" href={e.url}>Justiça em Números {e.edicao}, p. {e.paginas.join(', ')}</a></span>)}; <a className="underline" href={d.fonte.url}>Justiça em Números {d.edicao}, p. 333, 397 e 459</a>. Arquivos com checksum no manifesto.</>}
    tabela={{colunas:['Tribunal','Ramo',...h.anos.map(a=>`Baixados ${a}`),...h.anos.map(a=>`Pendentes ${a}`)],linhas:todos.map(t=>[t.sigla,nomeRamo(t.ramo),...h.anos.map(a=>t.historico.find(p=>p.ano===a)?.tempoBaixados??null),...h.anos.map(a=>t.historico.find(p=>p.ano===a)?.idadePendentes??null)]),casas:[null,null,...h.anos.map(()=>0),...h.anos.map(()=>0)],limite:todos.length}}>
    {legado(<><MultiplosTribunais tribunais={ramo('estadual')} titulo="Tribunais de Justiça" nota={h.nota}/>
     <details className={s.passport}><summary>Ver Tribunais Regionais Federais e do Trabalho</summary><MultiplosTribunais tribunais={ramo('federal')} titulo="Tribunais Regionais Federais" nota="TRF6 instalado em 2022: sem valor para 2021."/><MultiplosTribunais tribunais={ramo('trabalho')} titulo="Tribunais Regionais do Trabalho" nota={`Ausentes por texto ilegível na figura: ${h.ausentes.filter(a=>a.startsWith('TRT')).join(', ')}.`}/></details></>)}
   </FiguraAnalitica>
  </>}
  metodo={<Metodo><Fonte pagina="24">Idade média dos processos pendentes, com universos próprios para cada fase; médias nacionais por universo.</Fonte><Fonte pagina="340, 400 e 465">Execução por tribunal.</Fonte><p>Um processo pendente ainda não tem sua duração final observada. A idade já decorrida não é o tempo que falta esperar. O recorte não contém eventos individuais para calcular mediana, percentis, coortes ou ajustar censura à direita.</p></Metodo>}
 />;
}

/* --------------------------------------------------------------------- filas */
export function Filas(){
 const novos=d.ramos.reduce((a,r)=>a+r.novos,0),baixados=d.ramos.reduce((a,r)=>a+r.baixados,0);
 const balanco='O balanço do estoque não pode ser fechado com este recorte. Faltam estoque inicial compatível, transferências, reativações, revisões e exclusões. Por isso não calculamos um resíduo artificial nem forçamos “final = inicial + novos − baixas”. As taxas oficiais de congestionamento são reproduzidas, sem recalcular com volumes arredondados. A variante líquida retira suspensos, sobrestados e arquivo provisório do acervo. Carga de trabalho e produtividade não foram reconstruídas sem os denominadores apropriados.';
 return <PaginaPainel rota={BASE_JUDICIARIO+'/filas'} principal={false}
  abertura={abertura('filas',{unidade:'processos e %',limite:'o balanço do estoque: faltam estoque inicial compatível, transferências, reativações, revisões e exclusões, e mais saídas que entradas não comprovam o cumprimento dos direitos.'})}
  figuras={<>
   <FiguraAnalitica id="ramos" pergunta="Quantos processos entram, saem e ficam em cada ramo?" subtitulo={`Casos novos, baixados e pendentes · processos · três ramos, ${d.ano}`} natureza="OBSERVADO" idioma="pt" ressalva={<TextoCoberturaJudiciario/>}
    proveniencia={fichaCnj({indicador:'Casos novos, baixados e pendentes por ramo',natureza:'OBSERVADO',unidade:'processos',paginas:'22–23',limitacoes:[d.ramos[0].nota]})}
    naoConcluir="Os volumes são arredondados a 0,1 milhão: somas e razões derivadas são aproximadas, e a soma dos três ramos não é o total do Judiciário."
    tabela={{naFigura:'logo abaixo do gráfico, à vista, com o valor, a unidade e a precisão de cada ramo no recorte escolhido.'}}>
    <ExploradorRamos ramos={d.ramos} medidas={['novos','baixados','pendentes']} fonte={d.fonte.url} ano={d.ano}/>
   </FiguraAnalitica>
   <FiguraAnalitica id="acervo" pergunta="Quem ocupa o acervo?" subtitulo={`Dois recortes do acervo pendente · % do acervo · Brasil, dezembro de ${d.ano}`} natureza="OBSERVADO" idioma="pt"
    proveniencia={fichaCnj({indicador:'Acervo suspenso e execuções fiscais no acervo pendente',natureza:'OBSERVADO',unidade:'milhões de processos; % do acervo pendente',paginas:`${d.acervo.suspensos.pagina} e ${d.acervo.execucaoFiscal.pagina}`,limitacoes:[d.acervo.nota]})}
    comoInterpretar={`Dos ${n(d.nacional.pendentesMilhoes,1)} milhões de processos pendentes no país, uma parte não anda porque espera um evento externo, e outra parte é o poder público cobrando dívidas. A fonte publica os dois recortes separadamente.`}
    naoConcluir="Os dois recortes não se somam: a fonte não informa a sobreposição entre processos suspensos e execuções fiscais. Referência nacional, todos os segmentos."
    tabela={{colunas:['Recorte','Processos (milhões)','% do acervo pendente','Página'],linhas:[['Suspensos, sobrestados ou em arquivo provisório',d.acervo.suspensos.processosMilhoes,d.acervo.suspensos.percentualPendentes,String(d.acervo.suspensos.pagina)],['Execuções fiscais',d.acervo.execucaoFiscal.processosMilhoes,d.acervo.execucaoFiscal.percentualPendentes,String(d.acervo.execucaoFiscal.pagina)]],casas:[null,1,1,null]}}>
    {legado(<AcervoParadoJudiciario/>)}
   </FiguraAnalitica>
  </>}
  tabelas={<TabelaDados recolhida={false} id="saidas-entradas" tituloVisivel="A relação entre saídas e entradas." lead={<><p>O IAD oficial é reproduzido da fonte. Ao lado, a razão derivada do sumário mostra o efeito da precisão limitada dos volumes arredondados; os números não são silenciosamente equiparados.</p><p className="mt-2 font-medium text-carvao">{n(100*baixados/novos,1)}% nos três ramos selecionados: {n(baixados)} baixados / {n(novos)} casos novos.</p></>}
   titulo={`Mesmo ramo e ano · volumes arredondados · ${d.ano}`} colunas={['Ramo','Baixados','Novos','IAD oficial (%)','Saídas / entradas arredondadas · aprox. (%)','Congestionamento bruto / líquido']}
   linhas={d.ramos.map(r=>[r.nome,r.baixados,r.novos,r.iadOficial,r.atendimentoAproximado,`${n(r.congestionamentoBruto,1)}% / ${n(r.congestionamentoLiquido,1)}%`])} casas={[null,0,0,1,1,null]} limite={d.ramos.length}
   nota="O agregado divide a soma das baixas pela soma das entradas, sem tirar média simples dos percentuais. Mais saídas que entradas não comprovam o cumprimento dos direitos."/>}
  notas={{id:'balanco-estoque',titulo:'Antes de ler as filas',itens:[{termo:'Balanço do estoque',definicao:balanco},{termo:'IAD',definicao:'Índice de Atendimento à Demanda: processos baixados sobre casos novos, como publicado pelo CNJ.'}]}}
  metodo={<Metodo><Fonte pagina="22–23">Volumes do sumário arredondados a 0,1 milhão.</Fonte><Fonte pagina={`${d.acervo.suspensos.pagina} e ${d.acervo.execucaoFiscal.pagina}`}>Referência nacional, todos os segmentos.</Fonte><p>{balanco}</p></Metodo>}
 />;
}

/* ------------------------------------------------------------------- entrega */
export function Entrega(){
 const serie=d.conciliacaoSerie;
 return <PaginaPainel rota={BASE_JUDICIARIO+'/entrega'} principal={false}
  abertura={abertura('entrega',{unidade:'% das sentenças e decisões terminativas',periodo:`${serie[0].ano} a ${serie.at(-1)!.ano}`,universo:'Judiciário, referência nacional',limite:'que processo baixado signifique direito efetivamente cumprido: acordo homologado não é acordo cumprido, arrecadação não é necessariamente valor entregue ao cidadão, e a satisfação do direito não é mensurável nestas bases.'})}
  figuras={<FiguraAnalitica id="conciliacao" pergunta="Qual parcela das decisões homologa um acordo?" subtitulo={`Índice nacional de conciliação · % das sentenças e decisões terminativas · ${serie[0].ano} a ${serie.at(-1)!.ano}`} natureza="OBSERVADO" idioma="pt"
   proveniencia={fichaCnj({indicador:'Índice nacional de conciliação',natureza:'OBSERVADO',unidade:'%',paginas:'232–234',inicio:String(serie[0].ano),fim:String(serie.at(-1)!.ano),formula:'Sentenças e decisões homologatórias de acordo ÷ total de sentenças e decisões terminativas × 100'})}
   comoInterpretar="Série oficial nacional do índice de conciliação: sentenças e decisões homologatórias de acordo em relação ao total de sentenças e decisões terminativas. Índice nacional publicado; não é uma média simples dos ramos. A série mantém o conceito da edição, inclusive suas mudanças normativas."
   naoConcluir="O índice é publicado pelo CNJ: numeradores e denominadores anuais não estão disponíveis neste recorte e não são reconstruídos a partir dos percentuais, e acordo homologado não é acordo cumprido."
   tabela={{titulo:'Índice nacional de conciliação · %',colunas:['Ano','Índice oficial (%)'],linhas:serie.map(p=>[String(p.ano),p.valor]),casas:[null,1]}}>
   <GraficoLinhas semTabela titulo="Índice nacional de conciliação" dados={serie.map(p=>({ano:String(p.ano),v:p.valor}))} chaveX="ano" formatoX="texto" series={[{id:'v',rotulo:'Índice nacional',cor:'var(--cor-obee)'}]} unidade="%" casas={1} zeroNoEixo/>
  </FiguraAnalitica>}
  notas={{id:'elo-nao-medido',titulo:'Da resposta ao cumprimento: o elo ainda não medido',itens:[
   {termo:'Execução tem universo próprio',definicao:<>A idade média dos pendentes em execução descreve o acervo que permanece, não a probabilidade de uma pessoa receber um valor. Processos e valores não têm a mesma unidade nem podem ser convertidos sem evidência. <Link className="underline" href={BASE_JUDICIARIO+'/tempo?medida=execucao'}>Explorar a idade dos pendentes em execução</Link></>},
   {termo:'Qualidade exige outras evidências',definicao:'Recursos, reformas e anulações não são automaticamente erro judicial. O recorte não contém pesquisas de satisfação com população, amostra e instrumento validados. Não há nota de qualidade jurídica nem taxa de satisfação do direito.'},
  ]}}
  metodo={<Metodo><p>Processo baixado não significa necessariamente direito efetivamente cumprido. Acordo homologado não é acordo cumprido; arrecadação não é necessariamente valor entregue ao cidadão. Satisfação do direito não é mensurável nas bases deste recorte.</p><Fonte pagina="232–234">Índice nacional publicado; não é uma média simples dos ramos.</Fonte><Downloads/></Metodo>}
 />;
}

/* -------------------------------------------------------------------- acesso */
/** `aviso`: o aviso de painel principal desta cópia (PainelPrincipal), escrito na página da rota, onde o teste das cópias o procura. */
export function Acesso({aviso}:{aviso:ReactNode}){
 const g=d.justicaGratuita,tjs=d.tribunais.filter(t=>t.ramo==='estadual').sort((a,b)=>b.justicaGratuita!-a.justicaGratuita!||a.sigla.localeCompare(b.sigla));
 const caminhos=[['cobertura','Onde há assistência jurídica?','Cobertura regular, parcial e ausência declarada das Defensorias; consulta por comarca e população com seu próprio denominador.'],['recursos','Quais recursos sustentam a assistência?','Execução orçamentária e defensores, distinguindo as instituições de assistência dos tribunais.'],['dados','Como a cobertura foi medida?','Fontes, recortes, datas, ausências e arquivos integrais do capítulo existente.']];
 return <PaginaPainel rota={BASE_JUDICIARIO+'/acesso'} principal={false}
  abertura={abertura('acesso',{unidade:'unidades e %',limite:'acesso de cada morador nem demanda reprimida: o recorte não traz geometrias de jurisdição nem localização de todas as unidades, e ausência de processo não demonstra ausência de necessidade.'})}
  navegacaoLocal={<div className="mt-10 space-y-6">{aviso}<section aria-labelledby="assistencia-juridica" className="border-t border-linha pt-6"><h2 id="assistencia-juridica" className="t-h2 text-carvao">A assistência jurídica permanece no capítulo de Acesso à Justiça.</h2><p className="t-meta mt-2 max-w-prose2 text-carvao-muted">A presença das Defensorias é medida por comarca; a atividade judicial tem outro perímetro. As URLs e a base existente permanecem preservadas.</p><ul className="mt-4 grid gap-x-10 md:grid-cols-3">{caminhos.map(([slug,titulo,texto])=><li key={slug} className="border-b border-linha"><Link className="block min-h-[44px] py-5" href={'/eficiencia-estatal/acesso-justica/'+slug}><span className="t-h3 block text-carvao underline decoration-linha underline-offset-4">{titulo}</span><span className="t-meta mt-2 block text-carvao-muted">{texto}</span></Link></li>)}</ul></section></div>}
  figuras={<>
   <FiguraAnalitica id="cejuscs" pergunta="Centros de solução de conflitos instalados" subtitulo={`CEJUSCs · unidades · três ramos, ${d.ano}`} natureza="OBSERVADO" idioma="pt"
    proveniencia={fichaCnj({indicador:'Centros Judiciários de Solução de Conflitos e Cidadania por ramo',natureza:'OBSERVADO',unidade:'unidades',paginas:'233'})}
    comoInterpretar="A contagem de centros mostra estrutura por ramo."
    naoConcluir="A contagem não mede acesso de cada morador, atendimento digital ou presencial, demanda reprimida nem tempo de deslocamento."
    ressalva="Este recorte não fornece geometrias de jurisdição ou localização de todas as unidades. Não mostramos um mapa de sedes como se fossem áreas atendidas e não atribuímos a um estado os processos de toda uma região federal."
    tabela={{naFigura:'logo abaixo do gráfico, à vista, com o valor e a unidade de cada ramo no recorte escolhido.'}}>
    <ExploradorRamos ramos={d.ramos} medidas={['cejuscs']} fonte={d.fonte.url} ano={d.ano}/>
   </FiguraAnalitica>
   <FiguraAnalitica id="gratuidade" pergunta="Quantos casos tiveram Justiça gratuita?" subtitulo={`Processos com Justiça gratuita entre os arquivados definitivamente · % · Tribunais de Justiça, ${d.ano}`} natureza="OBSERVADO" idioma="pt"
    proveniencia={fichaCnj({indicador:'Processos arquivados com assistência judiciária gratuita',natureza:'OBSERVADO',unidade:'% dos arquivados definitivamente',paginas:`${g.pagina} e 303`,limitacoes:[g.definicao]})}
    comoInterpretar={`${n(g.percentual,1)}% dos processos arquivados definitivamente no país em ${d.ano} tiveram assistência judiciária gratuita, ${n(g.variacaoPontos,1)} pontos acima do ano anterior. ${g.definicao}`}
    naoConcluir="Zero é o valor publicado; a fonte não detalha se reflete ausência do benefício ou do registro no DataJud, por isso não o interpretamos, e a parcela não mede a necessidade de assistência."
    tabela={{colunas:['Tribunal','Justiça gratuita (%)'],linhas:tjs.map(t=>[t.sigla,t.justicaGratuita]),casas:[null,0],limite:tjs.length}}>
    {legado(<figure className={s.chart}><figcaption>Processos com Justiça gratuita entre os arquivados definitivamente · Tribunais de Justiça · {d.ano} · %</figcaption>{tjs.map(t=><div className={s.barRow} key={t.id}><Link href={BASE_JUDICIARIO+'/tribunais/'+t.id} prefetch={false}>{t.sigla}</Link><div className={s.track} role="img" aria-label={`${t.sigla}: ${n(t.justicaGratuita,0)}%`}><div className={s.bar} style={{width:t.justicaGratuita+'%'}}/></div><span className={s.value}>{n(t.justicaGratuita,0)}%</span></div>)}<p className={s.scale}>Escala de 0 a 100%. Valores publicados, sem casas decimais. Zero é o valor publicado; a fonte não detalha se reflete ausência do benefício ou do registro no DataJud, por isso não o interpretamos.</p></figure>)}
   </FiguraAnalitica>
  </>}
  metodo={<Metodo><Fonte pagina="233">Centros instalados por ramo.</Fonte><Fonte pagina={`${g.pagina} e 303`}>Justiça gratuita por tribunal.</Fonte><p>Este recorte não fornece geometrias de jurisdição ou localização de todas as unidades. Não mostramos um mapa de sedes como se fossem áreas atendidas e não atribuímos a um estado os processos de toda uma região federal. Ausência de processo não demonstra ausência de necessidade.</p></Metodo>}
 />;
}

/** Posição do Brasil em subfatores do WJP, na tabela do kit, à vista como antes; linhas no quarto inferior destacadas, sem cor de julgamento. */
function TabelaWjp({ids,legenda,id,titulo,lead}:{ids:IndicadorInternacional[];legenda:string;id:string;titulo:string;lead:string}){
 const linhas=linhasPosicoesWjp(ids);
 return <TabelaDados recolhida={false} id={id} tituloVisivel={titulo} lead={lead} titulo={`${legenda} · WJP, edição ${internacional.edicao} · escala de 0 a 1 · mediana dos outros países com valor`} colunas={['Subfator','Brasil','Mediana dos outros','Posição']}
  linhas={linhas.map(l=>[INDICADORES_INTERNACIONAIS[l.id].titulo,l.valor,l.mediana,l.posicao===null?'Sem valor':`${l.posicao}º de ${l.comValor}`])} casas={[null,3,3,null]} limite={linhas.length} linhasDestacadas={linhas.flatMap((l,i)=>l.posicao!==null&&l.posicao>l.comValor*0.75?[i]:[])}
  nota={<>Linhas destacadas: Brasil no quarto inferior. Percepções de pesquisas domiciliares e de especialistas; sem intervalo de incerteza. <a className="underline" href={internacional.fonte.url}>Fonte: World Justice Project, Rule of Law Index {internacional.edicao}.</a></>}/>;
}

/* -------------------------------------------------------------- consistência */
export function Consistencia(){
 const r=d.tribunais.filter(t=>t.ramo==='estadual').sort((a,b)=>b.recorribilidadeExterna-a.recorribilidadeExterna);
 const existe='Os dados públicos agregados mostram contestação, espera por uma regra comum e percepção de tratamento igual. A medida direta, a dispersão das decisões entre varas que recebem casos por sorteio, exige dados processuais por vara e ainda não está integrada.';
 const naoMedido='Taxa de procedência por vara e assunto, taxa de reforma em segundo grau e tempo até a fixação de cada tese. Essas medidas exigem movimentos processuais por vara no DataJud, com validação dos códigos de julgamento e de recurso. Quando integradas, mostrarão distribuições e unidades, nunca listas nominais de juízes ordenadas por resultado.';
 return <PaginaPainel rota={BASE_JUDICIARIO+'/consistencia'} principal={false}
  abertura={abertura('consistencia',{lead:'Previsibilidade é parte da Justiça: casos parecidos deveriam ter respostas parecidas. Veja o que os dados públicos já mostram sobre contestação, espera por uma regra comum e percepção de tratamento igual.',unidade:'%, processos e escores de 0 a 1',fonte:`${FONTE}; WJP, Rule of Law Index ${internacional.edicao}`,limite:'que outra vara decidiria diferente: recorrer é contestar, não prova erro, e a dispersão das decisões entre varas sorteadas ainda não é medida.'})}
  figuras={<>
   <FiguraAnalitica id="recorribilidade" pergunta="Quanto cada decisão é contestada?" subtitulo={`Recorribilidade externa no primeiro grau, fase de conhecimento · % · Tribunais de Justiça, ${d.ano}`} natureza="OBSERVADO" idioma="pt"
    proveniencia={fichaCnj({indicador:'Recorribilidade externa no primeiro grau, por tribunal',natureza:'OBSERVADO',unidade:'%',paginas:'327 e 329',formula:'Processos com recurso a uma instância superior ÷ processos sentenciados no primeiro grau, fase de conhecimento × 100',limitacoes:['O próprio CNJ alerta que as grandes variações entre tribunais podem refletir o uso inadequado dos movimentos processuais no DataJud.']})}
    comoInterpretar="Recorribilidade externa: processos com recurso a uma instância superior em relação aos sentenciados no primeiro grau, fase de conhecimento. Recorribilidade interna e os índices dos TRFs e TRTs estão nas fichas dos tribunais e no CSV."
    naoConcluir="Recorrer é contestar; não prova que a decisão estava errada nem que outra vara decidiria diferente, e as grandes variações podem refletir o registro dos movimentos no DataJud."
    tabela={{colunas:['Tribunal','Recorribilidade externa (%)'],linhas:r.map(t=>[t.sigla,t.recorribilidadeExterna]),casas:[null,1],limite:r.length}}>
    {legado(<figure className={s.chart}><figcaption>Recorribilidade externa no primeiro grau, fase de conhecimento · Tribunais de Justiça · {d.ano} · %</figcaption>{r.map(t=><div className={s.barRow} key={t.id}><Link href={BASE_JUDICIARIO+'/tribunais/'+t.id} prefetch={false}>{t.sigla}</Link><div className={s.track} role="img" aria-label={`${t.sigla}: ${n(t.recorribilidadeExterna,1)}%`}><div className={s.bar} style={{width:2*t.recorribilidadeExterna+'%'}}/></div><span className={s.value}>{n(t.recorribilidadeExterna,1)}%</span></div>)}<p className={s.scale}>Escala de 0 a 50%. O próprio CNJ alerta que as grandes variações entre tribunais podem refletir o uso inadequado dos movimentos processuais no DataJud.</p></figure>)}
   </FiguraAnalitica>
   <FiguraAnalitica id="regra-comum" pergunta="Processos à espera de uma regra comum" subtitulo={`Dois recortes do acervo pendente · % do acervo · Brasil, dezembro de ${d.ano}`} natureza="OBSERVADO" idioma="pt"
    proveniencia={fichaCnj({indicador:'Acervo suspenso e execuções fiscais no acervo pendente',natureza:'OBSERVADO',unidade:'milhões de processos; % do acervo pendente',paginas:'214 e 229',limitacoes:[d.acervo.nota]})}
    comoInterpretar="Parte do acervo fica suspensa até um tribunal superior fixar a tese que valerá para todos os casos iguais: é a forma institucional de buscar consistência, e ela tem custo de tempo."
    naoConcluir="Os dois recortes não se somam, e o tempo de espera por cada tese ainda não é medido neste recorte."
    tabela={{colunas:['Recorte','Processos (milhões)','% do acervo pendente'],linhas:[['Suspensos, sobrestados ou em arquivo provisório',d.acervo.suspensos.processosMilhoes,d.acervo.suspensos.percentualPendentes],['Execuções fiscais',d.acervo.execucaoFiscal.processosMilhoes,d.acervo.execucaoFiscal.percentualPendentes]],casas:[null,1,1]}}>
    {legado(<AcervoParadoJudiciario/>)}
   </FiguraAnalitica>
   <Recolhido id="laboratorio" aberto nivelTitulo={2} titulo="Como medir se casos iguais têm decisões iguais." resumo="Dentro de uma comarca, varas de mesma competência recebem processos por sorteio. Se cada vara recebe, em média, a mesma mistura de casos, a diferença de taxa de procedência que sobra além do acaso indica dependência de quem julga. O modelo abaixo mostra só a conta do acaso.">
    <div className="pb-6"><LaboratorioConsistencia/></div>
   </Recolhido>
  </>}
  tabelas={<TabelaWjp id="tratamento-igual" ids={['f_7_2','f_8_4','f_8_7']} legenda="Igualdade de tratamento" titulo="Tratamento igual, na percepção medida pelo WJP." lead="Ausência de discriminação na Justiça civil e imparcialidade do sistema criminal, em pesquisas com a população e com especialistas."/>}
  notas={{id:'o-que-existe',titulo:'O que existe e o que falta',itens:[{termo:'O que existe e o que falta',definicao:existe},{termo:'Ainda não medido aqui',definicao:naoMedido}]}}
  metodo={<Metodo><Fonte pagina="327 e 329">Recorribilidade interna e os índices dos TRFs e TRTs estão nas fichas dos tribunais e no CSV.</Fonte><Fonte pagina="214 e 229"/><p>A posição do Brasil no WJP usa a mediana dos outros países com valor, com peso igual por país. <Link className="underline" href={BASE_JUDICIARIO+'/metodos#internacional'}>Instrumento, edição e reprodução</Link>.</p></Metodo>}
 />;
}

/* ------------------------------------------------------------------ criminal */
export function Criminal(){
 const c=d.criminal;
 return <PaginaPainel rota={BASE_JUDICIARIO+'/criminal'} principal={false}
  abertura={abertura('criminal',{universo:'Justiça Estadual e comparação com outros países',unidade:'processos e escores de 0 a 1',fonte:`${FONTE}; WJP, Rule of Law Index ${internacional.edicao}`,limite:'quantas pessoas estão presas ou respondem a processo: execução penal conta processos, e uma pessoa pode ter mais de uma; o recorte não traz presos provisórios, tempo criminal por tribunal nem dados de segurança pública.'})}
  numeros={[
   {rotulo:'Casos novos criminais na Justiça Estadual',valor:c.casosNovosEstadualMilhoes,formato:'decimal',casas:1,unidade:'milhões',periodo:String(d.ano),fonte:fonteCnj(String(c.pagina)),natureza:'OBSERVADO',nota:`${n(c.estadualPercentualCriminal,1)}% da demanda criminal do país; sem execuções penais.`},
   {rotulo:'Execuções penais pendentes',valor:c.execucoesPenaisPendentesMilhoes,formato:'decimal',casas:1,unidade:'milhões',periodo:'dezembro de '+d.ano,recorte:'Justiça Estadual',fonte:fonteCnj(String(c.pagina)),natureza:'OBSERVADO'},
   {rotulo:'Penas privativas de liberdade em execução',valor:c.privativasMilhoes,formato:'decimal',casas:1,unidade:'milhão',periodo:String(d.ano),fonte:fonteCnj(String(c.pagina)),natureza:'OBSERVADO',nota:`${n(c.privativasPercentual,1)}% das execuções pendentes; alternativas: ${n(c.alternativasMil,1)} mil (${n(c.alternativasPercentual,1)}%).`},
   {rotulo:'Execuções penais iniciadas',valor:c.execucoesPenaisIniciadasMil,formato:'decimal',casas:1,unidade:'mil',periodo:String(d.ano),fonte:fonteCnj(String(c.pagina)),natureza:'OBSERVADO',nota:'Processos de execução, não pessoas.'},
  ]}
  notaNumeros="Dados de execução penal não cadastrados no DataJud vêm do SEEU, segundo a fonte."
  tabelas={<TabelaWjp id="wjp-criminal" ids={['f_8_1','f_8_2','f_8_3','f_8_4','f_8_5','f_8_6','f_8_7']} legenda="Justiça criminal" titulo="Como o Brasil se situa na Justiça criminal?" lead="Subfatores criminais do WJP: investigação, julgamento, sistema prisional, imparcialidade, corrupção, influência indevida e direitos do acusado."/>}
  notas={{id:'onde-consultar',titulo:'Onde consultar mais',nota:<>O CNJ mantém painéis próprios, ainda não integrados a este observatório, com dados por tribunal e unidade. Endereços publicados no relatório (<a className="underline" href={linkCnj('585')}>{fonteCnj('585 e 586')}</a>); conteúdo dos painéis não verificado nesta página.</>,itens:[
   {termo:<a className="underline" href="https://justica-em-numeros.cnj.jus.br/painel-violencia-contra-mulher">Violência contra a mulher</a>,definicao:'Processos, medidas protetivas, audiências e julgamentos, conforme o CNJ.'},
   {termo:<a className="underline" href="https://justica-em-numeros.cnj.jus.br/painel-juri">Mapa do Júri</a>,definicao:'Crimes dolosos contra a vida: processos aguardando julgamento, pronúncias e sessões.'},
  ]}}
  metodo={<Metodo><Fonte pagina={String(c.pagina)}>Dados de execução penal não cadastrados no DataJud vêm do SEEU, segundo a fonte.</Fonte><p>Este recorte não traz presos provisórios, tempo de tramitação criminal por tribunal nem dados de segurança pública. Execução penal conta processos, não pessoas: uma pessoa pode ter mais de uma execução.</p><p>SEEU: Sistema Eletrônico de Execução Unificado. DataJud: Base Nacional de Dados do Poder Judiciário.</p></Metodo>}
 />;
}

/* ------------------------------------------------------------------ comparar */
export function Comparar(){
 return <PaginaPainel rota={BASE_JUDICIARIO+'/comparar'} principal={false}
  abertura={abertura('comparar',{universo:'57 tribunais, comparados dentro de cada ramo',unidade:'meses',limite:'uma classificação geral entre ramos nem uma conclusão causal de eficiência: composição da demanda e metas oficiais não estão integradas, e porte e IPC-Jus têm universos próprios.'})}
  figuras={<FiguraAnalitica id="comparacao" pergunta="Como um tribunal se situa entre seus pares?" subtitulo={`Duração dos baixados ou idade dos pendentes · meses · tribunais do ramo e porte escolhidos, ${d.ano}`} natureza="OBSERVADO" idioma="pt"
   proveniencia={fichaCnj({indicador:'Tempos publicados por tribunal, porte, despesa, congestionamento e IPC-Jus',natureza:'OBSERVADO',unidade:'meses; R$; %',paginas:'333, 40–41, 313/384/440 e 353/407/473',limitacoes:['A mediana entre tribunais dá o mesmo peso a cada tribunal; não representa a mediana dos processos nem a duração média nacional.']})}
   comoInterpretar="Os indicadores são de 2025; os tempos totais de 2021 a 2025 estão nas fichas e no capítulo Tempo."
   naoConcluir="Composição da demanda e metas oficiais não estão integradas; porte e IPC-Jus são os oficiais da edição e têm universos próprios, por isso não há classificação geral entre ramos nem conclusão causal de eficiência."
   tabela={{naFigura:'no resumo com todos os tribunais do recorte, logo abaixo das halteres, com a duração dos baixados, a idade dos pendentes e o link de cada ficha.'}}>
   <ComparadorJudiciario tribunais={d.tribunais} fonte={d.fonte.url} ano={d.ano}/>
  </FiguraAnalitica>}
  metodo={<Metodo><Fonte pagina="333"/><p>Os indicadores são de 2025; os tempos totais de 2021 a 2025 estão nas fichas e no capítulo Tempo. Composição da demanda e metas oficiais não estão integradas. Porte e IPC-Jus são os oficiais da edição e têm universos próprios; por isso não há classificação geral entre ramos nem conclusão causal de eficiência.</p></Metodo>}
 />;
}

/* ------------------------------------------------------------- internacional */
export function Internacional(){
 return <PaginaPainel rota={BASE_JUDICIARIO+'/internacional'} principal={false}
  abertura={{...abertura('internacional',{periodo:'edição '+internacional.edicao,universo:`${internacional.cobertura.paises} países e jurisdições`,unidade:'escore de 0 a 1',fonte:`WJP · Rule of Law Index · edição ${internacional.edicao}`,limite:'o efeito dos tribunais ou de uma reforma: os escores medem experiências e percepções, não percentuais de pessoas, meses de espera nem taxas de decisões cumpridas, e diferenças pequenas não demonstram significância.'}),
   fontesDatasSiglas:<><p><a className="underline" href={internacional.fonte.url}>Planilha do próprio World Justice Project, fixada no commit fonte</a>, edição adotada {internacional.edicao}; captura e hash conferidos em {dataBR(internacional.fonte.verificadoEm,'pt')}. SHA-256: <span className="break-all">{internacional.fonte.sha256}</span>.</p><p>WJP: World Justice Project. CNJ: Conselho Nacional de Justiça. CEPEJ: Comissão Europeia para a Eficiência da Justiça.</p></>}}
  figuras={<FiguraAnalitica id="comparacao" pergunta="Como a Justiça brasileira se compara à de outros países?" subtitulo={`Escores WJP · escala de 0 a 1 · ${internacional.cobertura.paises} países e jurisdições, edição ${internacional.edicao}`} natureza="OBSERVADO" idioma="pt"
   proveniencia={fichaWjp('Escores de Justiça civil e criminal do Rule of Law Index')}
   comoInterpretar="Selecione uma pergunta, o indicador, a referência e até três países. A referência é a mediana dos outros países elegíveis com valor, sem o Brasil e com peso igual por país."
   naoConcluir="O índice não isola o efeito dos tribunais ou de uma reforma, e não é percentual de pessoas, duração em meses nem taxa de decisões cumpridas; sem intervalos de incerteza, diferenças pequenas não demonstram significância."
   tabela={{naFigura:'nos resumos dos países selecionados e dos países da edição, logo abaixo das barras, com o escore e a diferença para a mediana.'}}>
   <PainelInternacionalJudiciario dados={internacional}/>
  </FiguraAnalitica>}
  metodo={<><p>Os escores WJP de 0 a 1 vêm de pesquisas domiciliares e de questionários de especialistas. Região e renda vêm da linha da edição adotada. {internacional.fonte.notaEdicao}</p><p>Definições, reprodução e arquivos em <Link className="underline" href={BASE_JUDICIARIO+'/metodos#internacional'}>Dados e método</Link>.</p></>}
 />;
}
