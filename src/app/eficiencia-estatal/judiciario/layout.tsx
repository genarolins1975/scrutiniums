import Link from 'next/link';
import {CabecalhoJudiciario} from '@/components/eficiencia/judiciario/Cabecalho';
import {NavegacaoJudiciario} from '@/components/eficiencia/judiciario/Navegacao';
import s from '@/components/eficiencia/judiciario/Judiciario.module.css';
export default function Layout({children}:{children:React.ReactNode}){return <><CabecalhoJudiciario/><main id="conteudo" className={s.shell}><div className={s.contextLinks}><Link href="/eficiencia-estatal">Parte do OBEE</Link><Link href="/eficiencia-estatal/acesso-justica">Acesso à Justiça e Defensorias</Link></div><NavegacaoJudiciario/>{children}</main></>;}
