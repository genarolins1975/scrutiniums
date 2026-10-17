import Link from 'next/link';
import {CabecalhoEntrada} from '@/components/eficiencia/CabecalhoEntrada';
import {NavegacaoJudiciario} from '@/components/eficiencia/judiciario/Navegacao';
import s from '@/components/eficiencia/judiciario/Judiciario.module.css';
export default function Layout({children}:{children:React.ReactNode}){return <><CabecalhoEntrada/><main id="conteudo" className={s.shell}><div className={s.breadcrumb}><Link href="/eficiencia-estatal">← Panorama do OBEE</Link><Link href="/eficiencia-estatal/acesso-justica">Acesso à Justiça e Defensorias</Link></div><NavegacaoJudiciario/>{children}</main></>;}
