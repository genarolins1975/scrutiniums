'use client';
import {useState} from 'react';
import Link from 'next/link';
import {CAPITULOS_PUBLICADOS,PAINEL_AREAS} from '@/lib/contas-publicas/catalogo';
/** Palavras da busca que levam ao painel complementar de despesa por área (não é capítulo). */
const TERMOS_AREAS='área áreas função funções saúde educação previdência assistência defesa dívida juros para onde vai o dinheiro gasto por área';
/** Palavras a mais por capítulo, para a busca achar o tema pelo nome comum. */
const TERMOS:Record<string,string>={riscos:'dívida bruta divida pib rigidez obrigatórias emendas',beneficios:'renúncia renúncias isenção isenções gasto tributário gastos tributários desoneração simples nacional',planejamento:'lei orçamentária original dotação inicial créditos autorizado desvio plano',execucao:'pagamentos pago empenho liquidação',panorama:'déficit superávit resultado primário receita',['restos-a-pagar']:'rap restos a pagar',custos:'custo custos pessoal',metas:'metas entregas físicas'};
import styles from './IndiceFederal.module.css';

const normalizar=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
/**
 * Índice dos capítulos das Contas Federais. Só os capítulos com dados (Onda 3): os em preparação ficam fora da
 * navegação, sem cartão nem filtro que os anuncie; o desenho deles segue registrado no catálogo.
 */
export function IndiceFederal(){
 const [busca,setBusca]=useState('');
 const areas=normalizar(PAINEL_AREAS.titulo+' '+PAINEL_AREAS.pergunta+' '+TERMOS_AREAS).includes(normalizar(busca));
 const capitulos=CAPITULOS_PUBLICADOS.filter(c=>normalizar(c.titulo+' '+c.pergunta+' '+c.etapa+' '+(TERMOS[c.id]??'')).includes(normalizar(busca)));
 return <><div className={styles.tools}><label>Encontre uma pergunta<input type="search" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Dívida, renúncias, metas…"/></label></div><p className={styles.count} role="status">{capitulos.length} de {CAPITULOS_PUBLICADOS.length} capítulos com dados{areas?' e o painel complementar de despesa por área':''} · cobertura e limitações próprias.</p>
 <div className={styles.grid}>{areas&&<article><div className={styles.meta}><span>Complemento do Panorama</span><span className={styles.available}>Dados disponíveis</span></div><h3>{PAINEL_AREAS.titulo}</h3><p>{PAINEL_AREAS.pergunta}</p><p className={styles.detail}>Cada R$ 100 pagos por área de governo desde 2000, com a dívida à parte e o detalhe por subfunção.</p><Link href={PAINEL_AREAS.href}>Explorar o painel <span aria-hidden="true">→</span></Link></article>}{capitulos.map(c=><article key={c.id}><div className={styles.meta}><span>{String(CAPITULOS_PUBLICADOS.indexOf(c)+1).padStart(2,'0')} / {c.etapa}</span><span className={styles.available}>Dados disponíveis</span></div><h3>{c.titulo}</h3><p>{c.pergunta}</p><p className={styles.detail}>{c.entrega}</p><Link href={`/contas-publicas/${c.id}`}>Explorar o painel <span aria-hidden="true">→</span></Link></article>)}</div>
 {capitulos.length===0&&!areas&&<div className={styles.empty}><p>Nenhum capítulo com esse termo.</p><button type="button" onClick={()=>setBusca('')}>Limpar busca</button></div>}</>;
}
