'use client';
import type {ReactNode} from 'react';
import {snapshot,ANOS,dividaPrimaria,primarios} from '@/lib/contas-estaduais/dados';
import {comparar} from '@/lib/contas-estaduais/comparacao';
import {BandeiraEstadual} from './TerritoriosEstaduais';
import {IconeEstado} from '@/components/observatorios/TrilhasEstado';
import styles from '@/components/observatorios/EntradaEstado.module.css';

const numero=(n:number|null)=>n===null?'Não conferido':n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
/** `rotulo`: o rótulo de contexto acima do H1 (RotuloContexto), montado pela página no servidor. */
export function AberturaEstadual({uf,ano,selecionar,rotulo}:{uf:string;ano:number;selecionar:(uf:string,ano:number,abrirFicha?:boolean)=>void;rotulo?:ReactNode}){
 const estado=snapshot.ufs.find(u=>u.uf===uf)!;
 const execucao=comparar(ano,'CE-04','Todas',true).linhas.find(l=>l.uf===uf)?.valor??null;
 const divida=dividaPrimaria(uf,ano)?.valores.percentual_declarado??null;
 return <section className={styles.opening} aria-labelledby="titulo-estadual"><div>{rotulo}<h1 id="titulo-estadual" className={styles.title}>Como estão as contas do seu estado?</h1><p className={styles.lead}>Compare o orçamento, o financiamento e a dívida dos governos estaduais. Escolha um território e acompanhe os recursos até as evidências de entrega.</p><div className={styles.actions}><a href="#comparacao" className={styles.primary}>Comparar os estados <span aria-hidden="true">→</span></a><a href="#ficha">Explorar a ficha de {uf} ↓</a></div><div className={styles.readingKey}><IconeEstado tipo="territorio"/><p><strong>Comparações com contexto</strong>Mesma medida, mesmo período. Valores maiores não significam, sozinhos, melhor gestão.</p></div></div>
 <div className={styles.panel}><div className={styles.panelHead}><div><p className={`rotulo ${styles.eyebrow}`}>27 territórios para explorar</p><h2>Comece pelo seu estado.</h2></div><label>Ano da abertura<select value={ano} onChange={e=>selecionar(uf,Number(e.target.value))}>{ANOS.map(a=><option key={a} value={a}>{a}{a===2026?' · parcial':''}</option>)}</select></label></div>
 <div className={styles.flags} role="group" aria-label="Escolher território na abertura">{snapshot.ufs.slice().sort((a,b)=>a.uf.localeCompare(b.uf)).map(u=><button type="button" key={u.uf} aria-label={`${u.nome} (${u.uf})`} aria-pressed={uf===u.uf} onClick={()=>selecionar(u.uf,ano)}><BandeiraEstadual uf={u.uf}/><span>{u.uf}</span></button>)}</div><p className={styles.note}>Selecione uma bandeira · ordem alfabética, sem classificação.</p>
 <div className={styles.stateIdentity}><BandeiraEstadual uf={uf}/><div><h2>{estado.nome}</h2><p className={styles.period}>{estado.regiao} · {ano}{ano===2026?' · parcial':''}</p></div></div>
 <dl className={styles.fiscalPair}><div><dt>Orçamento liquidado /<br/>dotação atualizada</dt><dd className={execucao===null?styles.missing:undefined}>{numero(execucao)}</dd><small>{execucao===null?'Sem fonte conferida neste ano':'RREO · janeiro a dezembro'}</small></div><div><dt>Dívida líquida /<br/>RCL ajustada</dt><dd className={divida===null?styles.missing:undefined}>{numero(divida)}</dd><small>{divida===null?'Sem fonte conferida neste ano':`RGF · ${ano===2026?'1º':'3º'} quadrimestre`}</small></div></dl>
 <div className={styles.panelFoot}><p className={styles.note}>Fonte: Tesouro / Siconfi · respostas originais conferidas, captura em {primarios.captura.split('-').reverse().join('/')}. Liquidação é um estágio contábil; não atesta a qualidade da entrega.{uf==='DF'?' O DF reúne competências estaduais e municipais.':''}</p><a href="#ficha">Abrir valores, referências e fontes de {uf} →</a></div>
 </div></section>;
}
