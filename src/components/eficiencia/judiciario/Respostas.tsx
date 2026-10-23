import Link from 'next/link';
import {judiciario as d} from '@/lib/eficiencia/judiciario/dados';
import {n,duracao} from '@/lib/eficiencia/justica/modelo';
import {IconeJudiciario,type TemaFiguraJudiciario} from './Figuras';
import {SetaJudiciario} from './Editoria';
import s from './Judiciario.module.css';

export type PerguntaEntrada={tema:TemaFiguraJudiciario;pergunta:string;valor:string;resposta:string;fonte:string;href:string;acao:string};

/** Caminhos por pergunta: cada cartão traz a resposta curta, o número que a prova e sua fonte. */
export function PerguntasJudiciario({itens}:{itens:PerguntaEntrada[]}){
 return <section className={s.questionPaths} aria-labelledby="perguntas-titulo"><div className={s.sectionIntro}><p className={`rotulo ${s.eyebrow}`}>Comece pela sua pergunta</p><h2 id="perguntas-titulo">Perguntas da sociedade.<br/>Uma resposta curta para cada.</h2><p>Cada resposta tem número, ano e página da fonte. O capítulo mostra a distribuição, a tabela e os limites.</p></div>
 <div className={s.questionGrid}>{itens.map(i=><article key={i.pergunta} className={s.questionCard}><IconeJudiciario tema={i.tema}/><h3>{i.pergunta}</h3><p className={s.questionValue}>{i.valor}</p><p>{i.resposta}</p><p className={s.questionSource}>{i.fonte}</p><Link href={i.href}>{i.acao}<SetaJudiciario/></Link></article>)}</div></section>;
}

/** Dois recortes publicados separadamente sobre o mesmo acervo: barras independentes, nunca somadas. */
export function AcervoParadoJudiciario(){
 const {suspensos,execucaoFiscal}=d.acervo,total=d.nacional.pendentesMilhoes;
 const barras=[
  {nome:'Suspensos, sobrestados ou em arquivo provisório',parte:suspensos.percentualPendentes,rotulo:`${n(suspensos.processosMilhoes,1)} milhões · ${n(suspensos.percentualPendentes,1)}%`,nota:'Aguardam repercussão geral no STF, recurso repetitivo no STJ, IRDR, precatório, captura de réu ou outra causa.',pagina:suspensos.pagina},
  {nome:'Execuções fiscais',parte:execucaoFiscal.percentualPendentes,rotulo:`cerca de ${n(execucaoFiscal.percentualPendentes)}% · ${n(execucaoFiscal.processosMilhoes,1)} milhões`,nota:`O poder público cobrando dívidas. ${n(execucaoFiscal.percentualExecucoes)}% das execuções pendentes; congestionamento de ${n(execucaoFiscal.congestionamento,1)}%; quando baixadas, duraram ${duracao(d.nacional.tempoBaixadosFiscal)}.`,pagina:execucaoFiscal.pagina},
 ];
 return <figure className={s.stoppedStock}><figcaption><strong>Dois recortes do acervo pendente</strong><span>Brasil · dezembro de {d.ano} · cada barra sobre o total de {n(total,1)} milhões de processos pendentes</span></figcaption>
  {barras.map((b,i)=><div className={s.stoppedRow} key={b.nome}><p><strong>{b.nome}</strong><span>{b.rotulo}</span></p><div className={s.stoppedTrack} role="img" aria-label={`${b.nome}: ${b.rotulo} do acervo pendente`}><i data-serie={i} style={{width:b.parte+'%'}}/></div><p className={s.figureNote}>{b.nota} p. {b.pagina}.</p></div>)}
  <p className={s.figureNote}>{d.acervo.nota} Escala de zero a 100% do acervo.</p>
 </figure>;
}
