import Link from 'next/link';
import {CabecalhoEntrada} from '@/components/eficiencia/CabecalhoEntrada';
import './seguranca-alimentar.css';
export default function LayoutAlimentar({children}:{children:React.ReactNode}){return <><CabecalhoEntrada/><div className="saa-shell"><nav className="saa-breadcrumb" aria-label="Caminho da página"><Link href="/eficiencia-estatal">Eficiência Estatal</Link><span aria-hidden="true">/</span><Link href="/eficiencia-estatal/seguranca-alimentar">Segurança alimentar</Link></nav><main id="conteudo">{children}</main></div></>}
