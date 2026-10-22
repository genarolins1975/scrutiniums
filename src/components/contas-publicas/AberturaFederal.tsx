'use client';
import {useState} from 'react';
import {DADOS,ESTAGIOS,type Estagio} from '@/lib/contas-publicas/dados';
import {moeda} from '@/lib/contas-publicas/formato';
import {origemSIOP} from '@/lib/contas-publicas/proveniencia';
import {Proveniencia} from './artefatos/Proveniencia';
import styles from '@/components/observatorios/EntradaEstado.module.css';

/** O que fica para trás em cada passo da cascata, na ordem: dotação, empenho, liquidação, pagamento. */
const PARADA=['não empenhados','empenhados e não liquidados','liquidados e não pagos'];
const porcento=(r:number)=>`${(r*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;

/**
 * A cascata do orçamento federal, da dotação ao pagamento, com o exercício escolhido pelo leitor. Era o painel escuro da abertura;
 * no molde único (Iniciativa 4, 22/10/2026) os quatro números do exercício encerrado vão para a escala da entrada
 * (escalaFederal) e a cascata, com o exercício parcial e os valores exatos, fica num bloco recolhido.
 */
export function CascataFederal(){
 const [ano,setAno]=useState(2025);
 const base=DADOS.orcamento.find(b=>b.ano===ano)!;
 const origem=origemSIOP(ano);
 const etapas:Estagio[]=['atualizada','empenhado','liquidado','pago'];
 const max=Math.max(...etapas.map(e=>base.total[e]));
 const [dot,emp,liq,pag]=etapas.map(e=>base.total[e]);
 // a cascata só vale com os estágios encaixados; se um ano vier fora disso, voltam as quatro barras na escala comum
 const encaixados=dot>0&&dot>=emp&&emp>=liq&&liq>=pag&&pag>=0;
 const camadas=[{id:'atualizada' as Estagio,valor:dot,classe:styles.camadaDotacao},{id:'empenhado' as Estagio,valor:emp,classe:styles.camadaEmpenho},{id:'liquidado' as Estagio,valor:liq,classe:styles.camadaLiquidado},{id:'pago' as Estagio,valor:pag,classe:styles.camadaPago}];
 // o .opening dava duas colunas (título e painel); aqui fica só a cascata, numa coluna
 return <div className={styles.opening} style={{gridTemplateColumns:"minmax(0,1fr)",paddingTop:0}}>
  <figure className={styles.panel} aria-labelledby="federal-estagios"><figcaption className={styles.panelHead}><div><p className={styles.eyebrow}>O orçamento em movimento</p><h2 id="federal-estagios">Da autorização ao pagamento</h2><p className={styles.period}>União · {ano} · R$ nominais</p></div><label>Exercício da abertura<select value={ano} onChange={e=>setAno(Number(e.target.value))}><option value={2025}>2025 · encerrado</option><option value={2026}>2026 · parcial</option></select></label></figcaption>
  {encaixados?<div className={styles.plot}>
   {/* diagnóstico de layout de 20/10/2026, item 9: uma cascata só no lugar das quatro barras quase cheias. Os estágios são encaixados
       (o pago está no liquidado, que está no empenhado, dentro da dotação), e a barra mostra onde o dinheiro para em cada passo. */}
   <div className={styles.cascata} role="img" aria-label={`Da dotação de ${moeda(dot,'reais')}: ${moeda(emp,'reais')} empenhados, ${moeda(liq,'reais')} liquidados e ${moeda(pag,'reais')} pagos no exercício`}>
    {camadas.map(c=><span key={c.id} className={c.classe} style={{width:`${c.valor/dot*100}%`}}/>)}
   </div>
   <dl className={styles.cascataLista}>{camadas.map((c,i)=><div key={c.id}><dt><i className={c.classe} aria-hidden="true"/>{ESTAGIOS.find(x=>x.id===c.id)!.nome}</dt><dd><strong>{moeda(c.valor,'reais')}</strong><span>{i===0?'limite autorizado no ano':`${porcento(c.valor/dot)} da dotação · ${moeda(camadas[i-1].valor-c.valor,'reais')} ${PARADA[i-1]}`}</span></dd></div>)}</dl>
  </div>:<div className={styles.plot}>{etapas.map((e,i)=><div className={i===0?styles.reference:undefined} key={e}><div className={styles.plotRow}><div className={styles.plotLabel}><span>{ESTAGIOS.find(s=>s.id===e)!.nome}</span><strong>{moeda(base.total[e],'reais')}</strong></div><div className={styles.track} aria-hidden="true"><span style={{width:`${max>0?base.total[e]/max*100:0}%`}}/></div></div></div>)}<div className={styles.axis}><span>0</span><span>Escala comum · {moeda(max,'reais')}</span></div></div>}
  <div className={styles.panelFoot}><p className={styles.note}>Fonte: SIOP · {origem.referencia}.</p><p className={styles.note}>Orçamentos Fiscal e da Seguridade Social. Inclui juros, amortização e refinanciamento; pagamentos de restos a pagar ficam separados. Os estágios não se somam{encaixados?': cada um está dentro do anterior':''}.</p><p className={styles.note}>{ano===2026?'Ano parcial: não comparar diretamente com o total de 2025.':'Exercício completo de 2025.'} Liquidação e pagamento não comprovam entrega ou impacto.</p><details><summary>Fonte, corte e valores exatos</summary><Proveniencia {...origem}/><dl>{etapas.map(e=><div key={e}><dt>{ESTAGIOS.find(s=>s.id===e)!.nome}</dt><dd>R$ {base.total[e].toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</dd></div>)}</dl></details></div></figure>
 </div>;
}
