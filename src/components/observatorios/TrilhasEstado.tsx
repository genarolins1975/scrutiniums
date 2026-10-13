import Link from 'next/link';
import Image from 'next/image';
import styles from './EntradaEstado.module.css';

export function IconeEstado({tipo}:{tipo:'recursos'|'territorio'|'servicos'}) {
 return <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{tipo==='recursos'?<><path d="M7 17 24 7l17 10H7ZM9 39h30M12 21v13m8-13v13m8-13v13m8-13v13M7 35h34"/><path d="M22 12h4"/></>:tipo==='territorio'?<><path d="m6 11 12-4 12 5 12-4v29l-12 4-12-5-12 4V11Zm12-4v29m12-24v29"/><circle cx="25" cy="23" r="5"/><path d="m22 27 3 5 3-5"/></>:<><circle cx="24" cy="13" r="6"/><path d="M14 37v-7a10 10 0 0 1 20 0v7M8 39h32M6 22h5m26 0h5M10 10l4 4m20 0 4-4"/></>}</svg>;
}
type Trilha = {titulo:string;texto:string;href:string};
type Tema = 'obee' | 'federal' | 'estadual';

/** Cada tema tem um tríptico exclusivo, na mesma ordem dos três destinos. */
export function TrilhasEstado({tema,itens,label='Escolha seu caminho de leitura'}:{tema:Tema;label?:string;itens:[Trilha,Trilha,Trilha]}) {
 const arte=`/estado/arte/${tema}-gravura-v1.webp`;
 return <nav className={styles.illustrated} aria-label={label}>
  <div className={styles.illustratedHeading}><p>Explore por uma pergunta</p><span>Escolha um caminho para aprofundar a leitura.</span></div>
  <div className={styles.illustratedLinks}>{itens.map((i,index)=>{
   return <Link key={i.href} href={i.href}>
    <span className={styles.scene} aria-hidden="true">
     <Image src={arte} alt="" width={2172} height={724} unoptimized loading="lazy" className={styles.sceneImage} style={{left:`-${index*100}%`}}/>
    </span>
    <span className={styles.journeyText}><span className={styles.journeyIndex}>0{index+1}<span aria-hidden="true">↗</span></span><strong>{i.titulo}</strong><small>{i.texto}</small></span>
   </Link>;
  })}</div><p className={styles.illustrationNote}>Ilustrações conceituais; não representam dados nem obras avaliadas. Fontes e recortes estão identificados nos painéis.</p>
 </nav>;
}
