import type {Metadata} from 'next';
import Link from 'next/link';
import {judiciario as d} from '@/lib/eficiencia/judiciario/dados';
import {internacionalJudiciario as i} from '@/lib/eficiencia/judiciario/internacional-dados';
import {BASE_JUDICIARIO,CAPITULOS} from '@/lib/eficiencia/judiciario/modelo';
import {n,duracao} from '@/lib/eficiencia/justica/modelo';
import {SetaJudiciario,FonteJudiciario,estiloJudiciario as s} from '@/components/eficiencia/judiciario/Editoria';
import {JornadaJudiciario} from '@/components/eficiencia/judiciario/Jornada';
import {BuscaTribunalJudiciario,RamosEntradaJudiciario} from '@/components/eficiencia/judiciario/ExplorarEntrada';
import {HalteresTribunais} from '@/components/eficiencia/judiciario/Halteres';
import {PerguntasJudiciario,type PerguntaEntrada} from '@/components/eficiencia/judiciario/Respostas';
import {EntradaInternacionalJudiciario} from '@/components/eficiencia/judiciario/EntradaInternacional';
export const dynamic='force-static';
export const metadata:Metadata={title:'Por dentro da Justiça · Judiciário brasileiro',description:'Quanto a Justiça demora, quanto custa por habitante e se a espera depende de onde você mora. 57 tribunais, o acervo parado e a comparação com 143 países.',alternates:{canonical:BASE_JUDICIARIO}};
export default function EntradaJudiciario(){
 const estaduais=d.tribunais.filter(t=>t.ramo==='estadual');
 const porTempo=[...estaduais].sort((a,b)=>a.tempoBaixados-b.tempoBaixados);
 const rapido=porTempo[0],lentos=porTempo.filter(t=>t.tempoBaixados===porTempo.at(-1)!.tempoBaixados);
 const capita=[...estaduais].sort((a,b)=>a.despesaPorHabitante!-b.despesaPorHabitante!);
 const estadual=d.ramos.find(r=>r.id==='estadual')!;
 const {suspensos,execucaoFiscal}=d.acervo;
 const brasil=i.paises.find(p=>p.iso3==='BRA')!;
 const imparcial=brasil.escores[i.colunas.indexOf('f_8_4')]!;
 const posicaoImparcial=i.paises.filter(p=>{const v=p.escores[i.colunas.indexOf('f_8_4')];return v!==null&&v>imparcial;}).length+1;
 const perguntas:PerguntaEntrada[]=[
  {tema:'comparar',pergunta:'A espera depende de onde eu moro?',valor:`${rapido.tempoBaixados} a ${lentos[0].tempoBaixados} meses`,resposta:`Duração média dos processos baixados nos 27 Tribunais de Justiça. ${rapido.sigla} é o menor; ${lentos.map(t=>t.sigla).join(' e ')}, os maiores. Composição dos casos não controlada.`,fonte:`CNJ, Justiça em Números ${d.edicao} · ${d.ano} · p. 333`,href:BASE_JUDICIARIO+'/comparar',acao:'Comparar os tribunais'},
  {tema:'execucao',pergunta:'Ganhei. Quanto tempo até levar?',valor:duracao(estadual.execucao),resposta:'Idade média dos processos pendentes na fase de execução da Justiça Estadual, contra '+duracao(estadual.conhecimento)+' na fase de conhecimento. É o tempo já decorrido, não o que falta esperar.',fonte:`CNJ, Justiça em Números ${d.edicao} · ${d.ano} · p. 24`,href:BASE_JUDICIARIO+'/tempo?medida=execucao',acao:'Ver os tempos por fase'},
  {tema:'filas',pergunta:'Quem ocupa a Justiça?',valor:`${n(suspensos.percentualPendentes,1)}% parados`,resposta:`${n(suspensos.processosMilhoes,1)} milhões de processos aguardam um evento externo, como uma tese de tribunal superior. Execuções fiscais são cerca de ${n(execucaoFiscal.percentualPendentes)}% do acervo. Os recortes não se somam.`,fonte:`CNJ, Justiça em Números ${d.edicao} · ${d.ano} · p. ${suspensos.pagina} e ${execucaoFiscal.pagina}`,href:BASE_JUDICIARIO+'/filas#acervo',acao:'Ver o acervo parado'},
  {tema:'recursos',pergunta:'Quanto custa para cada pessoa?',valor:`R$ ${n(d.porHabitante.valor,2)}`,resposta:`Despesa por habitante em ${d.ano}, ${n(d.porHabitante.pib,1)}% do PIB. Nos Tribunais de Justiça, vai de R$ ${n(capita[0].despesaPorHabitante,1)} (${capita[0].sigla}) a R$ ${n(capita.at(-1)!.despesaPorHabitante,1)} (${capita.at(-1)!.sigla}).`,fonte:`CNJ, Justiça em Números ${d.edicao} · ${d.ano} · p. ${d.porHabitante.pagina} e 113`,href:BASE_JUDICIARIO+'/recursos#por-habitante',acao:'Ver o custo por habitante'},
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
 return <>
  <section className={s.hero} aria-labelledby="judiciario-titulo">
   <div className={s.heroCopy}><p className={s.eyebrow}>Observatório Brasileiro do Judiciário</p><h1 id="judiciario-titulo">Quanto a Justiça <em>demora</em>, quanto custa e de que depende?</h1><p className={s.heroLead}>Tempos, custos e acervo de 57 tribunais da Justiça Estadual, Federal e do Trabalho, com a referência nacional do CNJ e a comparação com {i.cobertura.paises} países.</p><div className={s.heroActions}><a className={s.primaryButton} href="#endereco">A espera no seu estado<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><path d="M8 2v12M3 9l5 5 5-5"/></svg></a><Link className={s.textLink} href={BASE_JUDICIARIO+'/comparar'}>Comparar tribunais<SetaJudiciario/></Link></div></div>
   <div className={s.heroReading}><p className={s.eyebrow}>Brasil, em uma leitura · {d.ano}</p><dl>
    <div><dt>Duração média dos processos baixados</dt><dd>{duracao(d.nacional.tempoBaixados)}</dd><dd>Média nacional publicada; com execuções fiscais, que duraram {duracao(d.nacional.tempoBaixadosFiscal)}. Não é prazo individual · p. 24</dd></div>
    <div><dt>Processos pendentes em dezembro</dt><dd>{n(d.nacional.pendentesMilhoes,1)} milhões</dd><dd>{n(suspensos.processosMilhoes,1)} milhões ({n(suspensos.percentualPendentes,1)}%) suspensos, sobrestados ou em arquivo provisório · p. 22 e {suspensos.pagina}</dd></div>
    <div><dt>Despesa por habitante</dt><dd>R$ {n(d.porHabitante.valor,2)}</dd><dd>{n(d.porHabitante.pib,1)}% do PIB; R$ {n(d.porHabitante.semInativos,2)} sem aposentadorias e pensões · p. {d.porHabitante.pagina}</dd></div>
    <div><dt>Diferença entre Tribunais de Justiça</dt><dd>{rapido.tempoBaixados} a {lentos[0].tempoBaixados} meses</dd><dd>Duração média dos baixados de {rapido.sigla} a {lentos.map(t=>t.sigla).join(' e ')}; assuntos não controlados · p. 333</dd></div>
   </dl><FonteJudiciario pagina="22–24, 64 e 333">Volumes arredondados como publicados; cada medida mantém seu universo.</FonteJudiciario></div>
  </section>
  <section id="endereco" className={s.addressSection} aria-labelledby="endereco-titulo"><div className={s.sectionIntro}><p className={s.eyebrow}>Mesma Justiça Estadual, outro endereço</p><h2 id="endereco-titulo">A espera depende<br/>de onde você mora?</h2><p>Duração média dos processos baixados e idade média dos que continuam pendentes, nos 27 Tribunais de Justiça. As duas medidas ficam juntas: um tribunal que encerra processos antigos aumenta a primeira e reduz a segunda.</p><p>Toque na sigla para abrir a ficha do tribunal.</p></div>
   <HalteresTribunais linhas={estaduais.map(({id,sigla,uf,tempoBaixados,idadePendentes})=>({id,sigla,uf,tempoBaixados,idadePendentes}))} alternar titulo="Duração dos baixados e idade dos pendentes nos Tribunais de Justiça" ano={d.ano}/>
   <FonteJudiciario pagina="333">Médias publicadas por tribunal; não medem qualidade jurídica nem preveem o prazo de um caso.</FonteJudiciario>
  </section>
  <BuscaTribunalJudiciario tribunais={d.tribunais.map(({id,sigla,ramo,uf})=>({id,sigla,ramo,uf}))}/>
  <JornadaJudiciario numeros={numerosJornada}/>
  <PerguntasJudiciario itens={perguntas}/>
  <EntradaInternacionalJudiciario/>
  <RamosEntradaJudiciario ramos={d.ramos} contagens={Object.fromEntries(d.ramos.map(r=>[r.id,d.tribunais.filter(t=>t.ramo===r.id).length]))} ano={d.ano}/>
  <p className={s.scopeLine}>Este recorte reúne três ramos. A referência nacional abrange outros segmentos; os três ramos não são apresentados como todo o Judiciário. <Link href={BASE_JUDICIARIO+'/metodos#cobertura'}>Ver cobertura completa.</Link></p>
  <nav className={s.chapterList} aria-label="Todos os capítulos do Judiciário"><p className={s.eyebrow}>Todos os capítulos</p><ul>{CAPITULOS.map(([slug,nome,pergunta])=><li key={slug}><Link href={BASE_JUDICIARIO+'/'+slug}><strong>{nome}</strong><span>{pergunta}</span></Link></li>)}</ul></nav>
  <section className={s.methodFooter} aria-labelledby="confianca-titulo"><div><p className={s.eyebrow}>Para ler com confiança</p><h2 id="confianca-titulo">Fonte à vista.<br/>Limites também.</h2><p>Os dados brasileiros vêm do CNJ, Justiça em Números {d.edicao}, ano-base {d.ano}. As comparações internacionais usam a edição {i.edicao} do WJP. Uma baixa processual não comprova cumprimento do direito; os escores WJP têm outro instrumento e universo.</p><Link className={s.textLink} href={BASE_JUDICIARIO+'/metodos'}>Consultar dados e método<SetaJudiciario/></Link></div><div><details className={s.passport}><summary>O que está coberto?</summary><p>57 tribunais de três ramos; despesas dos ramos e de 51 TJs/TRTs; despesa por habitante nacional e dos 27 TJs como publicada; acervo suspenso e execução fiscal nacionais; série financeira real de 2009–2025 e conciliação nacional de 2015–2025. Comparação internacional WJP com {i.cobertura.paises} países e jurisdições, edição {i.edicao}. Cada análise identifica unidade, período e universo.</p></details><details className={s.passport}><summary>O que os dados ainda não mostram?</summary><p>Histórico individual dos tribunais, despesa por TRF, consistência das decisões entre varas, composição completa da demanda e eventos de cumprimento não estão integrados. Ausência não vira zero nem estimativa.</p></details><details className={s.passport}><summary>Fonte, atualidade e reprodução</summary><p>Original da Biblioteca Digital do CNJ obtido e checksum conferido em 17/10/2026. Edição mais recente e revisões posteriores não foram confirmadas, pois o portal principal retorna 403. Métodos e arquivos completos permanecem disponíveis na página de dados.</p><Link className={s.textLink} href={BASE_JUDICIARIO+'/metodos'}>Conferir fontes e arquivos<SetaJudiciario/></Link></details></div></section>
 </>;
}
