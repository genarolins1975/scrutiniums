import Link from 'next/link';
import {CabecalhoPlataforma} from '@/components/layout/CabecalhoPlataforma';
import {BASE_JUDICIARIO} from '@/lib/eficiencia/judiciario/modelo';
import s from './Judiciario.module.css';

/** Cabeçalho do módulo: a barra comum da plataforma (marca, seletor, abas dos seis observatórios e conta) e o nome do módulo, que volta ao início dele. */
export function CabecalhoJudiciario(){return <header className={s.platformHeader}><CabecalhoPlataforma colecao="eficiencia" destinoConta={BASE_JUDICIARIO}/><div className={s.platformInner}><Link className={s.platformTitle} href={BASE_JUDICIARIO}>Judiciário</Link></div></header>;}
