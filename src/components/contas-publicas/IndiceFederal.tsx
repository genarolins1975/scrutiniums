'use client';
import {useState} from 'react';
import Link from 'next/link';
import {CAPITULOS,INDICADORES,PAINEL_AREAS} from '@/lib/contas-publicas/catalogo';
/** Palavras da busca que levam ao painel complementar de despesa por área (não é capítulo). */
const TERMOS_AREAS='área áreas função funções saúde educação previdência assistência defesa dívida juros para onde vai o dinheiro gasto por área';
import styles from './IndiceFederal.module.css';

const normalizar=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const comDados=(id:string)=>id==='custos'||INDICADORES.some(i=>i.capitulo===id&&i.status==='integracao-parcial');
export function IndiceFederal(){
 const [busca,setBusca]=useState(''),[filtro,setFiltro]=useState('todos');
 const areas=filtro!=='preparacao'&&normalizar(PAINEL_AREAS.titulo+' '+PAINEL_AREAS.pergunta+' '+TERMOS_AREAS).includes(normalizar(busca));
 const capitulos=CAPITULOS.filter(c=>(filtro==='todos'||comDados(c.id)===(filtro==='dados'))&&normalizar(c.titulo+' '+c.pergunta+' '+c.etapa).includes(normalizar(busca)));
 return <><div className={styles.tools}><label>Encontre uma pergunta<input type="search" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Dívida, custos, metas…"/></label><fieldset><legend>Disponibilidade</legend>{[['todos','Todos'],['dados','Com dados'],['preparacao','Em preparação']].map(([v,t])=><button type="button" key={v} aria-pressed={filtro===v} onClick={()=>setFiltro(v)}>{t}</button>)}</fieldset></div><p className={styles.count} role="status">{capitulos.length} de {CAPITULOS.length} capítulos{areas?' e o painel complementar de despesa por área':''} · cobertura e limitações próprias.</p>
 <div className={styles.grid}>{areas&&<article><div className={styles.meta}><span>Complemento do Panorama</span><span className={styles.available}>Dados disponíveis</span></div><h3>{PAINEL_AREAS.titulo}</h3><p>{PAINEL_AREAS.pergunta}</p><p className={styles.detail}>Cada R$ 100 pagos por área de governo desde 2000, com a dívida à parte e o detalhe por subfunção.</p><Link href={PAINEL_AREAS.href}>Explorar o painel <span aria-hidden="true">→</span></Link></article>}{capitulos.map(c=><article key={c.id}><div className={styles.meta}><span>{String(CAPITULOS.indexOf(c)+1).padStart(2,'0')} / {c.etapa}</span><span className={comDados(c.id)?styles.available:styles.pending}>{comDados(c.id)?'Dados disponíveis':'Em preparação'}</span></div><h3>{c.titulo}</h3><p>{c.pergunta}</p><p className={styles.detail}>{c.entrega}</p><Link href={`/contas-publicas/${c.id}`}>{comDados(c.id)?'Explorar o painel':'Conhecer a proposta'} <span aria-hidden="true">→</span></Link></article>)}</div>
 {capitulos.length===0&&!areas&&<div className={styles.empty}><p>Nenhum capítulo neste recorte.</p><button type="button" onClick={()=>{setBusca('');setFiltro('todos');}}>Limpar busca e filtro</button></div>}</>;
}
