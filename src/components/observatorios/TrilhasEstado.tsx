import Link from 'next/link';
import styles from './EntradaEstado.module.css';

export function IconeEstado({tipo}:{tipo:'recursos'|'territorio'|'servicos'}) {
 return <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{tipo==='recursos'?<><path d="M7 17 24 7l17 10H7ZM9 39h30M12 21v13m8-13v13m8-13v13m8-13v13M7 35h34"/><path d="M22 12h4"/></>:tipo==='territorio'?<><path d="m6 11 12-4 12 5 12-4v29l-12 4-12-5-12 4V11Zm12-4v29m12-24v29"/><circle cx="25" cy="23" r="5"/><path d="m22 27 3 5 3-5"/></>:<><circle cx="24" cy="13" r="6"/><path d="M14 37v-7a10 10 0 0 1 20 0v7M8 39h32M6 22h5m26 0h5M10 10l4 4m20 0 4-4"/></>}</svg>;
}
export function TrilhasEstado({itens,label='Escolha seu caminho de leitura'}:{label?:string;itens:{titulo:string;texto:string;href:string;icone:'recursos'|'territorio'|'servicos'}[]}) {
 return <nav className={styles.journeys} aria-label={label}>{itens.map(i=><Link key={i.href} href={i.href}><IconeEstado tipo={i.icone}/><span><strong>{i.titulo}</strong><small>{i.texto}</small></span><span aria-hidden="true">↗</span></Link>)}</nav>;
}
