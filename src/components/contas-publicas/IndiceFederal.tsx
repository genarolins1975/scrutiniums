'use client';
import {useState} from 'react';
import Link from 'next/link';
import {CAPITULOS,INDICADORES} from '@/lib/contas-publicas/catalogo';
import styles from './IndiceFederal.module.css';

const normalizar=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const comDados=(id:string)=>id==='custos'||INDICADORES.some(i=>i.capitulo===id&&i.status==='integracao-parcial');
export function IndiceFederal(){
 const [busca,setBusca]=useState(''),[filtro,setFiltro]=useState('todos');
 const capitulos=CAPITULOS.filter(c=>(filtro==='todos'||comDados(c.id)===(filtro==='dados'))&&normalizar(c.titulo+' '+c.pergunta+' '+c.etapa).includes(normalizar(busca)));
 return <><div className={styles.tools}><label>Encontre uma pergunta<input type="search" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Dívida, custos, metas…"/></label><fieldset><legend>Disponibilidade</legend>{[['todos','Todos'],['dados','Com dados'],['preparacao','Em preparação']].map(([v,t])=><button type="button" key={v} aria-pressed={filtro===v} onClick={()=>setFiltro(v)}>{t}</button>)}</fieldset></div><p className={styles.count} role="status">{capitulos.length} de {CAPITULOS.length} capítulos · cobertura e limitações próprias.</p>
 <div className={styles.grid}>{capitulos.map(c=><article key={c.id}><div className={styles.meta}><span>{String(CAPITULOS.indexOf(c)+1).padStart(2,'0')} / {c.etapa}</span><span className={comDados(c.id)?styles.available:styles.pending}>{comDados(c.id)?'Dados disponíveis':'Em preparação'}</span></div><h3>{c.titulo}</h3><p>{c.pergunta}</p><p className={styles.detail}>{c.entrega}</p><Link href={`/contas-publicas/${c.id}`}>{comDados(c.id)?'Explorar o painel':'Conhecer a proposta'} <span aria-hidden="true">→</span></Link></article>)}</div>
 {capitulos.length===0&&<div className={styles.empty}><p>Nenhum capítulo neste recorte.</p><button type="button" onClick={()=>{setBusca('');setFiltro('todos');}}>Limpar busca e filtro</button></div>}</>;
}
