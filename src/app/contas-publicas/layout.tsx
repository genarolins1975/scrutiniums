import type { Metadata } from 'next';
import { ParaIrAlem } from "@/components/observatorios/ParaIrAlem";
import { mapaParaIrAlem } from "@/lib/observatorios/mapaParaIrAlem";
import { Footer } from '@/components/layout/Footer';
import { CabecalhoPlataforma } from '@/components/layout/CabecalhoPlataforma';
import { NavegacaoColecao } from '@/components/layout/NavegacaoColecao';
import './contas.css';
export const metadata: Metadata = {title:{default:'Contas Federais',template:'%s · Contas Federais · Scrutiniums'},description:'Orçamento, custos, entregas e evidências de resultados. Projeto metodológico da coleção Contas Federais, do Observatório das Contas Públicas.',robots:{index:false,follow:true},alternates:{canonical:'/contas-publicas'}};
export default function Layout({children}:{children:React.ReactNode}) {
 return <div className="cp-root"><a className="cp-skip" href="#conteudo-contas">Ir para o conteúdo</a><header className="cp-header">{/* barra comum da plataforma e a navegação da coleção (NavegacaoColecao), a mesma de toda coleção */}<CabecalhoPlataforma colecao="contas" destinoConta="/contas-publicas"/><NavegacaoColecao colecao="federais"/></header>{/* rodapé comum da plataforma (Iniciativa 4, 22/10/2026): o rodapé próprio saiu; a cobertura que ele listava está no método da entrada */}{children}<ParaIrAlem mapa={mapaParaIrAlem()} /><Footer compacto/></div>;
}
