import Link from 'next/link';
import {AvisoAtualidadeRTN} from './AvisoAtualidadeRTN';
import {DADOS,fiscalAcumulado} from '@/lib/contas-publicas/dados';
import rap from '@/lib/contas-publicas/snapshots/rap.json';
import {somarRAP} from '@/lib/contas-publicas/rap-modelo';
import {moeda,participacao} from '@/lib/contas-publicas/formato';
import {origemSIOP,origemRTN,origemRAP} from '@/lib/contas-publicas/proveniencia';
import {Proveniencia} from './Proveniencia';
export function RespostasIniciais(){
 const orcamento=DADOS.orcamento.find(b=>b.ano===2025)!;
 const divida=orcamento.grupos.filter(g=>['2','6'].includes(g.codigo)).reduce((s,g)=>s+g.pago,0);
 const fiscal=fiscalAcumulado(2025,12)!;
 const saldo=somarRAP(rap.registros.filter(r=>r.periodo==='000/2026')).saldo;
 const respostas=[
  {pergunta:'Quanto foi pago do orçamento de 2025?',valor:moeda(orcamento.total.pago,'reais'),recorte:'2025 · orçamento do exercício · sem restos a pagar',nota:`Juros e amortização: ${participacao(divida,orcamento.total.pago)}. Inclui refinanciamento. Pagamentos de compromissos de anos anteriores (restos a pagar) ficam separados.`,href:'execucao',acao:'Explorar os pagamentos',origem:origemSIOP(2025)},
  {pergunta:'As receitas cobriram as despesas, sem os juros?',valor:moeda(Math.abs(fiscal.resultado),'milhoes'),recorte:`2025 · ${fiscal.resultado<0?'déficit primário':'superávit primário'} · Governo Central`,nota:'Receita líquida menos despesa primária, sem juros. Não é o resultado nominal nem a apuração da meta fiscal.',href:'panorama',acao:'Entender o resultado',origem:origemRTN('Janeiro a dezembro de 2025')},
  {pergunta:'Quanto ficou para pagar nos anos seguintes?',valor:moeda(saldo,'reais'),recorte:'Abertura de 2026 · restos a pagar',nota:'Saldo de compromissos de exercícios anteriores. Esta posição não mede pagamentos feitos durante 2026.',href:'restos-a-pagar',acao:'Acompanhar os compromissos',origem:{...origemRAP('Abertura de 2026'),perimetro:'União · todos os órgãos da Base Geral · despesas primárias e financeiras'}}
 ];
 return <><section id="respostas" className="cp-answers" aria-label="Três respostas para começar">{respostas.map(r=><article key={r.href}><h2>{r.pergunta}</h2><strong className="cp-answer-value">{r.valor}</strong><p className="cp-answer-period">{r.recorte}</p><p>{r.nota}</p><Link href={`/contas-publicas/${r.href}`}>{r.acao} →</Link><details><summary>Fonte e recorte</summary><Proveniencia {...r.origem}/></details></article>)}</section><AvisoAtualidadeRTN/></>;
}
