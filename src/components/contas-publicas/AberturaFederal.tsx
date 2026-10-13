'use client';
import {useState} from 'react';
import Link from 'next/link';
import {DADOS,ESTAGIOS,type Estagio} from '@/lib/contas-publicas/dados';
import {moeda} from '@/lib/contas-publicas/formato';
import {origemSIOP} from '@/lib/contas-publicas/proveniencia';
import {Proveniencia} from './artefatos/Proveniencia';
import {IconeEstado} from '@/components/observatorios/TrilhasEstado';
import styles from '@/components/observatorios/EntradaEstado.module.css';

export function AberturaFederal(){
 const [ano,setAno]=useState(2025);
 const base=DADOS.orcamento.find(b=>b.ano===ano)!;
 const origem=origemSIOP(ano);
 const etapas:Estagio[]=['atualizada','empenhado','liquidado','pago'];
 const max=Math.max(...etapas.map(e=>base.total[e]));
 return <section className={styles.opening} aria-labelledby="titulo-federal">
  <div><p className={styles.eyebrow}>Contas Públicas / Governo Federal</p><h1 id="titulo-federal" className={styles.title}>Do orçamento<br/>à <em>entrega.</em></h1><p className={styles.lead}>Acompanhe o dinheiro público: o que foi autorizado, o que foi pago e quais entregas o governo informa.</p><div className={styles.actions}><Link className={styles.primary} href="/contas-publicas/execucao">Explorar o orçamento <span aria-hidden="true">→</span></Link><a href="#capitulos">Escolher uma pergunta ↓</a></div><div className={styles.readingKey}><IconeEstado tipo="recursos"/><p><strong>Recursos, entregas e resultados</strong>Três perspectivas para ler a gestão. Cada uma tem suas medidas e seus limites.</p></div></div>
  <figure className={styles.panel} aria-labelledby="federal-estagios"><figcaption className={styles.panelHead}><div><p className={styles.eyebrow}>O orçamento em movimento</p><h2 id="federal-estagios">Da autorização ao pagamento</h2><p className={styles.period}>União · {ano} · R$ nominais</p></div><label>Exercício da abertura<select value={ano} onChange={e=>setAno(Number(e.target.value))}><option value={2025}>2025 · encerrado</option><option value={2026}>2026 · parcial</option></select></label></figcaption>
  <div className={styles.plot}>{etapas.map((e,i)=><div className={i===0?styles.reference:undefined} key={e}><div className={styles.plotRow}><div className={styles.plotLabel}><span>{ESTAGIOS.find(s=>s.id===e)!.nome}</span><strong>{moeda(base.total[e],'reais')}</strong></div><div className={styles.track} aria-hidden="true"><span style={{width:`${max>0?base.total[e]/max*100:0}%`}}/></div></div></div>)}<div className={styles.axis}><span>0</span><span>Escala comum · {moeda(max,'reais')}</span></div></div>
  <div className={styles.panelFoot}><p className={styles.note}>Fonte: SIOP · {origem.referencia}.</p><p className={styles.note}>Orçamentos Fiscal e da Seguridade Social. Inclui juros, amortização e refinanciamento; pagamentos de restos a pagar ficam separados. Os estágios não se somam.</p><p className={styles.note}>{ano===2026?'Ano parcial: não comparar diretamente com o total de 2025.':'Exercício completo de 2025.'} Liquidação e pagamento não comprovam entrega ou impacto.</p><details><summary>Fonte, corte e valores exatos</summary><Proveniencia {...origem}/><dl>{etapas.map(e=><div key={e}><dt>{ESTAGIOS.find(s=>s.id===e)!.nome}</dt><dd>R$ {base.total[e].toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</dd></div>)}</dl></details></div></figure>
 </section>;
}
