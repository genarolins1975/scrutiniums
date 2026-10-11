import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoMark } from '@/components/ui/Logo';
import { NavegacaoObservatorios } from '@/components/observatorios/NavegacaoObservatorios';
import './contas.css';
export const metadata: Metadata = {title:'Contas Públicas Federais',description:'Orçamento, custos, entregas e evidências de resultados. Projeto metodológico do Observatório Brasileiro de Contas Públicas.',robots:{index:false,follow:true},alternates:{canonical:'/contas-publicas'}};
export default function Layout({children}:{children:React.ReactNode}) {
 return <div className="cp-root"><a className="cp-skip" href="#conteudo-contas">Ir para o conteúdo</a><header className="cp-header"><div className="cp-wrap cp-brand"><Link href="/" aria-label="Scrutiniums: página inicial"><LogoMark size={24}/><span>Scrutiniums</span></Link><span>Contas Públicas · Governo Federal</span></div><div className="cp-wrap"><NavegacaoObservatorios atual="contas"/></div></header><nav className="cp-wrap cp-local" aria-label="Contas Públicas"><Link href="/contas-publicas">Visão do projeto</Link><Link href="/contas-publicas#capitulos">Capítulos</Link><Link href="/contas-publicas/dados">Indicadores e fontes</Link><Link href="/contas-publicas/metodologia">Como interpretar</Link></nav>{children}<footer className="cp-wrap cp-footer"><p>Scrutiniums · Informação aberta, método verificável.</p><Link href="/eficiencia-estatal">Explore os serviços ao cidadão no OBEE →</Link><p>Versão inicial de estruturação. Séries fiscais ainda não integradas.</p></footer></div>;
}
