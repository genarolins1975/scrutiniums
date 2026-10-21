import {DADOS,fiscalAcumulado} from '@/lib/contas-publicas/dados';
import {moeda} from '@/lib/contas-publicas/formato';

const mesNome=(mes:number)=>new Intl.DateTimeFormat('pt-BR',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2026,mes-1,1)));

/**
 * Resposta curta do Panorama na primeira tela (diagnóstico de layout de 20/10/2026, item 9): receita, despesa e saldo
 * do último ano completo da série do RTN. Sem ano completo na série, não mostra nada; o painel abaixo segue com os recortes.
 */
export function ResumoFiscalAbertura(){
 const [anoRef,mesRef]=DADOS.referenciaRTN.split('-').map(Number);
 const ano=mesRef===12?anoRef:anoRef-1;
 const v=fiscalAcumulado(ano,12);
 if(!v)return null;
 const itens=[
  {nome:'Receita primária líquida',valor:v.receitaLiquida,nota:'receita total menos transferências por repartição de receita'},
  {nome:'Despesa primária',valor:v.despesa,nota:'sem juros da dívida'},
  {nome:`${v.resultado<0?'Déficit':'Superávit'} primário`,valor:Math.abs(v.resultado),nota:'receita líquida menos despesa'},
 ];
 return <section className="cp-resumo" aria-labelledby="resumo-fiscal">
  <h2 id="resumo-fiscal">Em {ano}, de janeiro a dezembro</h2>
  <dl>{itens.map((it,i)=><div key={it.nome} className={i===2?(v.resultado<0?'cp-resumo-saldo cp-resumo-deficit':'cp-resumo-saldo'):undefined}><dt>{it.nome}</dt><dd><strong>{moeda(it.valor,'milhoes')}</strong><span>{it.nota}</span></dd></div>)}</dl>
  <p className="cp-note">Governo Central, valores correntes. Fonte: Tesouro Nacional, Resultado do Tesouro Nacional, série até {mesNome(mesRef)} de {anoRef}. Esse saldo não atesta cumprimento da meta fiscal. <a href="#fiscal-observado">Outros períodos e o caminho da receita ao saldo ↓</a></p>
 </section>;
}
