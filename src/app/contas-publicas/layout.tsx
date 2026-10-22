import type { Metadata } from 'next';
import { ParaIrAlem } from "@/components/observatorios/ParaIrAlem";
import { mapaParaIrAlem } from "@/lib/observatorios/mapaParaIrAlem";
import Link from 'next/link';
import { CabecalhoPlataforma } from '@/components/layout/CabecalhoPlataforma';
import { NavegacaoColecao } from '@/components/layout/NavegacaoColecao';
import './contas.css';
export const metadata: Metadata = {title:{default:'Contas Federais',template:'%s · Contas Federais · Scrutiniums'},description:'Orçamento, custos, entregas e evidências de resultados. Projeto metodológico da coleção Contas Federais, do Observatório das Contas Públicas.',robots:{index:false,follow:true},alternates:{canonical:'/contas-publicas'}};
export default function Layout({children}:{children:React.ReactNode}) {
 return <div className="cp-root"><a className="cp-skip" href="#conteudo-contas">Ir para o conteúdo</a><header className="cp-header">{/* barra comum da plataforma e a navegação da coleção (NavegacaoColecao), a mesma de toda coleção */}<CabecalhoPlataforma colecao="contas" destinoConta="/contas-publicas"/><NavegacaoColecao colecao="federais"/></header>{children}<ParaIrAlem mapa={mapaParaIrAlem()} /><footer className="cp-wrap cp-footer"><p>Scrutiniums · Informação aberta, método verificável.</p><Link href="/eficiencia-estatal">Explore os serviços ao cidadão no OBEE →</Link><Link href="/sobre">Sobre a Scrutiniums</Link><p>Versão em desenvolvimento. Orçamento, despesa por área, previdência e INSS, plano e execução, resultado fiscal, dívida bruta e rigidez, gastos tributários, restos a pagar, entregas físicas e custos agregados; fontes e datas identificadas em cada painel.</p></footer></div>;
}
