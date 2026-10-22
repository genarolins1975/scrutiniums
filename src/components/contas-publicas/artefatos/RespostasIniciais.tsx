import Link from 'next/link';
import {AvisoAtualidadeRTN} from './AvisoAtualidadeRTN';
import {respostasIniciais} from '@/lib/contas-publicas/entrada';
import {Proveniencia} from './Proveniencia';
export function RespostasIniciais(){
 const respostas=respostasIniciais();
 return <><section id="respostas" className="cp-answers" aria-label="Três respostas para começar">{respostas.map(r=><article key={r.href}><h2>{r.pergunta}</h2><strong className="cp-answer-value">{r.valor}</strong><p className="cp-answer-period">{r.recorte}</p><p>{r.nota}</p><Link href={`/contas-publicas/${r.href}`}>{r.acao} →</Link><details><summary>Fonte e recorte</summary><Proveniencia {...r.origem}/></details></article>)}</section><AvisoAtualidadeRTN/></>;
}
