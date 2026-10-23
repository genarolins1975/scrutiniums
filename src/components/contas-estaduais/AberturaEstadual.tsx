'use client';
import {useRouter} from 'next/navigation';
import {snapshot,ANOS} from '@/lib/contas-estaduais/dados';
import {BandeiraEstadual} from './TerritoriosEstaduais';
import styles from '@/components/observatorios/EntradaEstado.module.css';

/**
 * A escolha do território na entrada das Contas Estaduais: as 27 bandeiras e o ano. Era o painel da abertura; no molde único
 * (Iniciativa 4, 22/10/2026) o título e a frase vão para o EntradaColecao, os dois números do estado escolhido para a escala
 * (escalaEstadual, lida no servidor) e as bandeiras ficam no bloco "Para você". A escolha muda o endereço (?uf=&ano=), e a
 * página inteira acompanha.
 */
export function SeletorEstado({uf,ano,selecionar}:{uf:string;ano:number;selecionar:(uf:string,ano:number,abrirFicha?:boolean)=>void}){
 const estado=snapshot.ufs.find(u=>u.uf===uf)!;
 return <div className={styles.opening} style={{gridTemplateColumns:"minmax(0,1fr)",paddingTop:0}}><div className={styles.panel}><div className={styles.panelHead}><div><p className={`rotulo ${styles.eyebrow}`}>27 territórios para explorar</p><h3>Comece pelo seu estado.</h3></div><label>Ano<select value={ano} onChange={e=>selecionar(uf,Number(e.target.value))}>{ANOS.map(a=><option key={a} value={a}>{a}{a===2026?' · parcial':''}</option>)}</select></label></div>
 <div className={styles.flags} role="group" aria-label="Escolher território">{snapshot.ufs.slice().sort((a,b)=>a.uf.localeCompare(b.uf)).map(u=><button type="button" key={u.uf} aria-label={`${u.nome} (${u.uf})`} aria-pressed={uf===u.uf} onClick={()=>selecionar(u.uf,ano)}><BandeiraEstadual uf={u.uf}/><span>{u.uf}</span></button>)}</div><p className={styles.note}>Selecione uma bandeira · ordem alfabética, sem classificação.</p>
 <div className={styles.stateIdentity}><BandeiraEstadual uf={uf}/><div><p className={styles.stateName}>{estado.nome}</p><p className={styles.period}>{estado.regiao} · {ano}{ano===2026?' · parcial':''}</p></div></div>
 <div className={styles.panelFoot}><p className={styles.note}>Comparações com contexto: mesma medida, mesmo período. Valores maiores não significam, sozinhos, melhor gestão.{uf==='DF'?' O DF reúne competências estaduais e municipais.':''}</p><a href="#ficha">Abrir valores, referências e fontes de {uf} →</a></div>
 </div></div>;
}

/** As bandeiras no "Para você" da entrada: a escolha muda o endereço sem recarregar, e a escala e o painel acompanham. */
export function SeletorEstadoNaUrl({uf,ano}:{uf:string;ano:number}){
 const router=useRouter();
 const selecionar=(u:string,a:number,abrirFicha=false)=>{const url=new URL(window.location.href);url.searchParams.set('uf',u);url.searchParams.set('ano',String(a));url.hash=abrirFicha?'ficha':'';router.push(url.pathname+url.search+url.hash,{scroll:false});};
 return <SeletorEstado uf={uf} ano={ano} selecionar={selecionar}/>;
}
