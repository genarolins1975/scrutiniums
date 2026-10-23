import type {Metadata} from 'next';
import Link from 'next/link';
import {judiciario as d} from '@/lib/eficiencia/judiciario/dados';
import {internacionalJudiciario as i} from '@/lib/eficiencia/judiciario/internacional-dados';
import {BASE_JUDICIARIO,CAPITULOS} from '@/lib/eficiencia/judiciario/modelo';
import {n,duracao} from '@/lib/eficiencia/justica/modelo';
import {estiloJudiciario as s} from '@/components/eficiencia/judiciario/Editoria';
import {JornadaJudiciario} from '@/components/eficiencia/judiciario/Jornada';
import {BuscaTribunalJudiciario,RamosEntradaJudiciario} from '@/components/eficiencia/judiciario/ExplorarEntrada';
import {HalteresTribunais} from '@/components/eficiencia/judiciario/Halteres';
import {PerguntasJudiciario,type PerguntaEntrada} from '@/components/eficiencia/judiciario/Respostas';
import {EntradaInternacionalJudiciario} from '@/components/eficiencia/judiciario/EntradaInternacional';
import {FiguraAnalitica,PaginaPainel} from '@/components/painel';
import {Recolhido} from '@/components/observatorios/Recolhido';
import {fichaDaFigura} from '@/lib/eficiencia/fichaDaFigura';
import {TEMAS_EFICIENCIA} from '@/lib/eficiencia/temas';
export const dynamic='force-static';
export const metadata:Metadata={title:'Por dentro da Justiça',description:'Quanto a Justiça demora, quanto custa por habitante e se a espera depende de onde você mora. 57 tribunais, o acervo parado e a comparação com 143 países.',alternates:{canonical:BASE_JUDICIARIO}};
/**
 * Entrada do Judiciário no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026). A primeira tela responde ao leitor: a pergunta, os
 * quatro números de escala na faixa do kit e a busca da ficha do tribunal como primeira ação. Logo depois, as perguntas com resposta curta
 * e a lista de capítulos (todo capítulo a um clique); as halteres dos 27 TJs são a figura principal (âncora #endereco, que a verificação do
 * Judiciário lê), e o modelo didático da jornada, a comparação internacional e os três ramos seguem abertos em blocos do molde. A linha de
 * escopo vira o limite; "Para ler com confiança" e os três passaportes vão inteiros para o método.
 */
export default function EntradaJudiciario(){
 const estaduais=d.tribunais.filter(t=>t.ramo==='estadual');
 const porTempo=[...estaduais].sort((a,b)=>a.tempoBaixados-b.tempoBaixados);
 const rapido=porTempo[0],lentos=porTempo.filter(t=>t.tempoBaixados===porTempo.at(-1)!.tempoBaixados);
 const capita=[...estaduais].sort((a,b)=>a.despesaPorHabitante!-b.despesaPorHabitante!);
 const estadual=d.ramos.find(r=>r.id==='estadual')!;
 const {suspensos,execucaoFiscal}=d.acervo;
 const melhoraram=estaduais.filter(t=>t.historico[0].idadePendentes!==null&&t.idadePendentes<t.historico[0].idadePendentes).length;
 const recorr=[...estaduais].sort((a,b)=>a.recorribilidadeExterna-b.recorribilidadeExterna);
 const brasil=i.paises.find(p=>p.iso3==='BRA')!;
 const imparcial=brasil.escores[i.colunas.indexOf('f_8_4')]!;
 const posicaoImparcial=i.paises.filter(p=>{const v=p.escores[i.colunas.indexOf('f_8_4')];return v!==null&&v>imparcial;}).length+1;
 const perguntas:PerguntaEntrada[]=[
  {tema:'comparar',pergunta:'A espera depende de onde eu moro?',valor:`${rapido.tempoBaixados} a ${lentos[0].tempoBaixados} meses`,resposta:`Duração média dos processos baixados nos 27 Tribunais de Justiça. ${rapido.sigla} é o menor; ${lentos.map(t=>t.sigla).join(' e ')}, os maiores. Composição dos casos não controlada.`,fonte:`CNJ, Justiça em Números ${d.edicao} · ${d.ano} · p. 333`,href:BASE_JUDICIARIO+'/comparar',acao:'Comparar os tribunais'},
  {tema:'execucao',pergunta:'Ganhei. Quanto tempo até levar?',valor:duracao(estadual.execucao),resposta:'Idade média dos processos pendentes na fase de execução da Justiça Estadual, contra '+duracao(estadual.conhecimento)+' na fase de conhecimento. É o tempo já decorrido, não o que falta esperar.',fonte:`CNJ, Justiça em Números ${d.edicao} · ${d.ano} · p. 24`,href:BASE_JUDICIARIO+'/tempo#execucao',acao:'Ver a execução por tribunal'},
  {tema:'filas',pergunta:'Quem ocupa a Justiça?',valor:`${n(suspensos.percentualPendentes,1)}% parados`,resposta:`${n(suspensos.processosMilhoes,1)} milhões de processos aguardam um evento externo, como uma tese de tribunal superior. Execuções fiscais são cerca de ${n(execucaoFiscal.percentualPendentes)}% do acervo. Os recortes não se somam.`,fonte:`CNJ, Justiça em Números ${d.edicao} · ${d.ano} · p. ${suspensos.pagina} e ${execucaoFiscal.pagina}`,href:BASE_JUDICIARIO+'/filas#acervo',acao:'Ver o acervo parado'},
  {tema:'recursos',pergunta:'Quanto custa para cada pessoa?',valor:`R$ ${n(d.porHabitante.valor,2)}`,resposta:`Despesa por habitante em ${d.ano}, ${n(d.porHabitante.pib,1)}% do PIB. Nos Tribunais de Justiça, vai de R$ ${n(capita[0].despesaPorHabitante,1)} (${capita[0].sigla}) a R$ ${n(capita.at(-1)!.despesaPorHabitante,1)} (${capita.at(-1)!.sigla}).`,fonte:`CNJ, Justiça em Números ${d.edicao} · ${d.ano} · p. ${d.porHabitante.pagina} e 113`,href:BASE_JUDICIARIO+'/recursos#por-habitante',acao:'Ver o custo por habitante'},
  {tema:'tempo',pergunta:'Os tempos melhoraram?',valor:`${melhoraram} de 27`,resposta:`Tribunais de Justiça em que a idade média do acervo pendente era menor em ${d.ano} do que em ${d.historicoTempos.anos[0]}. Cada edição publica valores calculados com os dados da época.`,fonte:`CNJ, Justiça em Números ${d.historicoTempos.edicoes[0].edicao} a ${d.edicao}`,href:BASE_JUDICIARIO+'/tempo#evolucao',acao:'Ver a evolução por tribunal'},
  {tema:'consistencia',pergunta:'Casos iguais recebem decisões iguais?',valor:`${n(recorr[0].recorribilidadeExterna,1)}% a ${n(recorr.at(-1)!.recorribilidadeExterna,1)}%`,resposta:'Parcela das sentenças de primeiro grau levadas a uma instância superior, entre os Tribunais de Justiça. Contestar não prova erro; a dispersão entre varas ainda não é medida.',fonte:`CNJ, Justiça em Números ${d.edicao} · ${d.ano} · p. 329`,href:BASE_JUDICIARIO+'/consistencia',acao:'Ver o que se sabe e como medir'},
  {tema:'criminal',pergunta:'Como a Justiça responde ao crime?',valor:`${n(d.criminal.execucoesPenaisPendentesMilhoes,1)} milhões`,resposta:`Execuções penais pendentes na Justiça Estadual em dezembro de ${d.ano}, ${n(d.criminal.privativasPercentual,1)}% de penas privativas de liberdade. Processos, não pessoas.`,fonte:`CNJ, Justiça em Números ${d.edicao} · ${d.ano} · p. ${d.criminal.pagina}`,href:BASE_JUDICIARIO+'/criminal',acao:'Ver a Justiça criminal'},
  {tema:'internacional',pergunta:'Todos são tratados igualmente?',valor:`${posicaoImparcial}º de ${i.cobertura.paises}`,resposta:'Posição do Brasil em imparcialidade do sistema criminal na pesquisa do World Justice Project. É percepção medida por pesquisa, não taxa administrativa.',fonte:`WJP, Rule of Law Index · edição ${i.edicao} · fator 8.4`,href:BASE_JUDICIARIO+'/internacional',acao:'Comparar com outros países'},
  {tema:'acesso',pergunta:'Onde há assistência jurídica?',valor:`${n(d.ramos.reduce((a,r)=>a+r.cejuscs,0))} centros`,resposta:'Centros de solução de conflitos nos três ramos. A presença da Defensoria Pública é consultada por comarca, com território e população próprios.',fonte:`CNJ, Justiça em Números ${d.edicao} · ${d.ano} · p. 233`,href:BASE_JUDICIARIO+'/acesso',acao:'Ver acesso e Defensorias'},
 ];
 const numerosJornada=[
  {valor:`${n(d.nacional.novosMilhoes,1)} milhões`,legenda:`casos novos no país em ${d.ano}; processos, não pessoas.`},
  {valor:duracao(estadual.conhecimento),legenda:'idade média dos pendentes na fase de conhecimento da Justiça Estadual.'},
  {valor:`${n(d.nacional.conciliacao,1)}%`,legenda:'das sentenças e decisões terminativas homologaram acordo no país.'},
  null,
  {valor:duracao(estadual.execucao),legenda:'idade média dos pendentes na fase de execução da Justiça Estadual.'},
  null,
 ];
 const fonte=(p:string)=>`CNJ, Justiça em Números ${d.edicao}, p. ${p}`;
 const ficha=fichaDaFigura({indicador:'Duração média dos processos baixados e idade média dos pendentes, por Tribunal de Justiça',natureza:'OBSERVADO',orgao:'CNJ',conjunto:'Justiça em Números '+d.edicao,recurso:'Relatório integral em PDF, figura da p. 333',url:d.fonte.url,unidade:'meses',frequencia:'Anual (edição do Justiça em Números)',
  referencia:{inicio:String(d.ano),fim:String(d.ano)},capturadoEm:d.capturadoEm,sha256:d.fonte.sha256,snapshot:'public/eficiencia/judiciario/snapshot.json',versao:'snapshot do Judiciário, versão '+d.versao,limitacoes:['Médias publicadas por tribunal; não medem qualidade jurídica nem preveem o prazo de um caso.','Assuntos e proporção de execuções não controlados.'],notas:d.fonte.referencia+'. Localizadores: '+d.fonte.localizadores});
 const LINK='inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao';
 return <PaginaPainel rota={BASE_JUDICIARIO} principal={false}
  abertura={{grupo:TEMAS_EFICIENCIA.judiciario.nome,acento:'obee',titulo:'Quanto a Justiça demora, quanto custa e de que depende?',
   lead:<>Tempos, custos e acervo de 57 tribunais da Justiça Estadual, Federal e do Trabalho, com a referência nacional do CNJ e a comparação com {i.cobertura.paises} países.</>,
   acao:<div className="space-y-1"><BuscaTribunalJudiciario compacta tribunais={d.tribunais.map(({id,sigla,ramo,uf})=>({id,sigla,ramo,uf}))}/><p className="flex flex-wrap gap-x-6"><a className={LINK} href="#endereco">A espera no seu estado ↓</a><Link className={LINK} href={BASE_JUDICIARIO+'/comparar'}>Comparar tribunais</Link></p></div>,
   recorte:{periodo:'ano-base '+d.ano,universo:'57 tribunais da Justiça Estadual, Federal e do Trabalho',unidade:'meses, processos e reais',fonte:`CNJ, Justiça em Números ${d.edicao}; WJP, Rule of Law Index ${i.edicao}`},
   limite:<>que os três ramos sejam todo o Judiciário (a referência nacional abrange outros segmentos), nem que uma baixa processual comprove o cumprimento do direito. <Link className="underline" href={BASE_JUDICIARIO+'/metodos#cobertura'}>Ver cobertura completa.</Link></>}}
  numeros={[
   {rotulo:'Duração média dos processos baixados',valor:d.nacional.tempoBaixados,valorTexto:duracao(d.nacional.tempoBaixados),unidade:'',periodo:String(d.ano),recorte:'Brasil, média nacional publicada',fonte:fonte('24'),natureza:'OBSERVADO',nota:`Com execuções fiscais, que duraram ${duracao(d.nacional.tempoBaixadosFiscal)}. Não é prazo individual.`},
   {rotulo:'Processos pendentes em dezembro',valor:d.nacional.pendentesMilhoes,formato:'decimal',casas:1,unidade:'milhões',periodo:'dezembro de '+d.ano,fonte:fonte('22 e '+suspensos.pagina),natureza:'OBSERVADO',nota:`${n(suspensos.processosMilhoes,1)} milhões (${n(suspensos.percentualPendentes,1)}%) suspensos, sobrestados ou em arquivo provisório.`},
   {rotulo:'Despesa por habitante',valor:d.porHabitante.valor,formato:'reais',casas:2,unidade:'por habitante',periodo:String(d.ano),fonte:fonte(String(d.porHabitante.pagina)),natureza:'OBSERVADO',nota:`${n(d.porHabitante.pib,1)}% do PIB; R$ ${n(d.porHabitante.semInativos,2)} sem aposentadorias e pensões.`},
   {rotulo:'Diferença entre Tribunais de Justiça',valorTexto:`${rapido.tempoBaixados} a ${lentos[0].tempoBaixados}`,formato:'texto',unidade:'meses',periodo:String(d.ano),recorte:`duração média dos baixados de ${rapido.sigla} a ${lentos.map(t=>t.sigla).join(' e ')}`,fonte:fonte('333'),natureza:'CALCULADO',nota:'Assuntos não controlados.'},
  ]}
  notaNumeros="Volumes arredondados como publicados; cada medida mantém seu universo."
  navegacaoLocal={<div className="mt-10 space-y-10"><PerguntasJudiciario itens={perguntas}/>
   <section className={s.chapterList} aria-label="Todos os capítulos do Judiciário"><p className={`rotulo ${s.eyebrow}`}>Todos os capítulos</p><ul>{CAPITULOS.map(([slug,nome,pergunta])=><li key={slug}><Link href={BASE_JUDICIARIO+'/'+slug}><strong>{nome}</strong><span>{pergunta}</span></Link></li>)}</ul></section></div>}
  figuras={<>
   <FiguraAnalitica id="endereco" pergunta="A espera depende de onde você mora?" subtitulo={`Duração média dos baixados e idade média dos pendentes · meses · 27 Tribunais de Justiça, ${d.ano}`} natureza="OBSERVADO" idioma="pt" proveniencia={ficha}
    comoInterpretar="As duas medidas ficam juntas: um tribunal que encerra processos antigos aumenta a primeira e reduz a segunda. Toque na sigla para abrir a ficha do tribunal."
    naoConcluir="Médias publicadas por tribunal não medem qualidade jurídica nem preveem o prazo de um caso; a composição dos casos não é controlada."
    tabela={{titulo:`Tribunais de Justiça · ${d.ano} · meses`,colunas:['Tribunal','UF','Duração média dos baixados','Idade média dos pendentes'],linhas:[...estaduais].sort((a,b)=>a.sigla.localeCompare(b.sigla,'pt-BR')).map(t=>[t.sigla,t.uf,t.tempoBaixados,t.idadePendentes]),casas:[null,null,0,0],limite:estaduais.length}}>
    <div data-figura-legado=""><HalteresTribunais linhas={estaduais.map(({id,sigla,uf,tempoBaixados,idadePendentes})=>({id,sigla,uf,tempoBaixados,idadePendentes}))} alternar titulo="Duração dos baixados e idade dos pendentes nos Tribunais de Justiça" ano={d.ano}/></div>
   </FiguraAnalitica>
   <Recolhido id="do-conflito-ao-cumprimento" aberto nivelTitulo={2} titulo="Do conflito ao cumprimento" resumo="Um modelo didático das etapas de um processo, com o número oficial que existe para cada uma."><div className="pb-6"><JornadaJudiciario semCabecalho numeros={numerosJornada}/></div></Recolhido>
   <Recolhido id="todos-sao-tratados-igualmente" aberto nivelTitulo={2} titulo="Todos são tratados igualmente?" resumo={`Brasil e outros países: a posição do Brasil em cinco subfatores do World Justice Project, entre ${i.cobertura.paises} países.`}><div className="pb-6"><EntradaInternacionalJudiciario/></div></Recolhido>
   <Recolhido id="tres-ramos" aberto nivelTitulo={2} titulo="Três ramos, contextos diferentes" resumo="Selecione um ramo para conhecer seu recorte; as comparações entre tribunais acontecem dentro de cada ramo."><div className="pb-6"><RamosEntradaJudiciario semCabecalho ramos={d.ramos} contagens={Object.fromEntries(d.ramos.map(r=>[r.id,d.tribunais.filter(t=>t.ramo===r.id).length]))} ano={d.ano}/></div></Recolhido>
  </>}
  metodo={<>
   <p className="font-medium text-carvao">Fonte à vista. Limites também.</p>
   <p>Os dados brasileiros vêm do CNJ, Justiça em Números {d.edicao}, ano-base {d.ano}. As comparações internacionais usam a edição {i.edicao} do WJP. Uma baixa processual não comprova cumprimento do direito; os escores WJP têm outro instrumento e universo.</p>
   <p>Fonte dos números: <a className="underline" href={`${d.fonte.url}#page=22`}>CNJ, Justiça em Números {d.edicao}, p. 22–24, 64 e 333</a> · ano-base {d.ano}. Volumes arredondados como publicados; cada medida mantém seu universo.</p>
   <p>Este recorte reúne três ramos. A referência nacional abrange outros segmentos; os três ramos não são apresentados como todo o Judiciário.</p>
   <p><span className="font-medium text-carvao">O que está coberto?</span> 57 tribunais de três ramos; despesas dos ramos e de 51 TJs/TRTs; despesa por habitante nacional e dos 27 TJs como publicada; acervo suspenso e execução fiscal nacionais; série financeira real de 2009–2025 e conciliação nacional de 2015–2025. Comparação internacional WJP com {i.cobertura.paises} países e jurisdições, edição {i.edicao}. Cada análise identifica unidade, período e universo.</p>
   <p><span className="font-medium text-carvao">O que os dados ainda não mostram?</span> Indicadores por tribunal anteriores a 2025 além dos tempos totais, despesa por TRF, dispersão das decisões entre varas, composição completa da demanda e eventos de cumprimento não estão integrados. Ausência não vira zero nem estimativa.</p>
   <p><span className="font-medium text-carvao">Fonte, atualidade e reprodução.</span> Original obtido na Biblioteca Digital e no portal do CNJ em 17/10/2026, com checksum idêntico; o portal lista a edição {d.edicao} como a mais recente. Edições de 2022 a 2025 conferidas da mesma forma para as séries por tribunal. Métodos e arquivos completos permanecem disponíveis na página de dados.</p>
   <p><Link className="underline" href={BASE_JUDICIARIO+'/metodos'}>Consultar dados e método</Link></p>
  </>}
 />;
}
