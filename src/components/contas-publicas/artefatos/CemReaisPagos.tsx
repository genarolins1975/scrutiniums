'use client';
import {useState} from 'react';
import Link from 'next/link';
import {DADOS} from '@/lib/contas-publicas/dados';
import {numero,moeda} from '@/lib/contas-publicas/formato';
import {origemSIOP} from '@/lib/contas-publicas/proveniencia';
import {parcelasPagas} from '@/lib/contas-publicas/cemReais';
import {Proveniencia} from './Proveniencia';
import {ReguaCem} from './ReguaCem';
export function CemReaisPagos(){
 const [ano,setAno]=useState(2025);const b=DADOS.orcamento.find(b=>b.ano===ano)!;
 const parcelas=parcelasPagas(ano)!;
 return <figure className="cp-artifact" aria-labelledby="cem-pagos"><figcaption><div className="cp-section-head"><div><p className="rotulo cp-eyebrow">Composição dos pagamentos</p><h2 id="cem-pagos">Para onde vai cada R$ 100 pagos?</h2><p className="cp-note">{ano} · Orçamento Fiscal e da Seguridade Social da União · valores nominais.</p></div><label className="cp-select">Exercício da régua<select value={ano} onChange={e=>setAno(Number(e.target.value))}><option value={2025}>2025 · encerrado</option><option value={2026}>2026 · parcial</option></select></label></div></figcaption><ReguaCem parcelas={parcelas}/><p className="cp-reading">Total pago: <strong>{moeda(b.total.pago,'reais')}</strong>. Bronze identifica juros e amortização. A amortização inclui refinanciamento. Os pagamentos de restos a pagar são acompanhados separadamente. Esta régua reparte por grupo de despesa (o que se compra); a repartição por área, como saúde e educação, está em <Link href="/contas-publicas/por-area">Despesa por área →</Link></p><p className="cp-note">{ano===2026?'2026 está em andamento. Este recorte não é comparável ao ano completo de 2025.':'2025 é um exercício completo.'}</p><details className="cp-exact"><summary>Conferir os valores exatos</summary><table className="cp-table"><caption>Pagamentos por grupo · R$ correntes</caption><thead><tr><th scope="col">Grupo</th><th scope="col">Valor pago</th></tr></thead><tbody>{parcelas.map(p=><tr key={p.id}><th scope="row">{p.nome}</th><td>{numero(p.valor,0)}</td></tr>)}</tbody></table></details><Proveniencia {...origemSIOP(ano)}/></figure>;
}
