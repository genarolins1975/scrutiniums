'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {BASE_JUDICIARIO,CAPITULOS} from '@/lib/eficiencia/judiciario/modelo';
import s from './Judiciario.module.css';
const CURTOS={panorama:'Panorama',internacional:'Outros países',recursos:'Recursos',tempo:'Tempo',filas:'Filas',entrega:'Entrega',acesso:'Acesso',comparar:'Comparar',metodos:'Método'};
export function NavegacaoJudiciario(){const path=usePathname();return <nav className={s.nav} aria-label="Judiciário"><Link href={BASE_JUDICIARIO} aria-current={path===BASE_JUDICIARIO?'page':undefined}>Início</Link>{CAPITULOS.map(([slug,nome])=><Link key={slug} href={BASE_JUDICIARIO+'/'+slug} title={nome} aria-current={path===BASE_JUDICIARIO+'/'+slug?'page':undefined}>{CURTOS[slug]}</Link>)}</nav>;}
