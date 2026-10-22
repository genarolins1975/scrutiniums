import type { Metadata } from "next";
import { ParaIrAlem } from "@/components/observatorios/ParaIrAlem";
import { mapaParaIrAlem } from "@/lib/observatorios/mapaParaIrAlem";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import "./estados.css";
export const metadata: Metadata = {
 title: "Contas Estaduais (piloto)",
 description: "Orçamento, serviços e resultados dos governos estaduais: catálogo de indicadores, cobertura e evidências rastreáveis.",
 alternates: { canonical: "/contas-publicas-estaduais" }, robots: { index: false, follow: true },
};
export default function Layout({ children }: { children: React.ReactNode }) {
 return <div className="ce-root">
 <a className="ce-skip" href="#conteudo-estados">Ir ao conteúdo</a>
 {/* barra comum e a navegação da coleção (NavegacaoColecao): as seções da página, o método e a etapa piloto */}
 <header className="ce-cabecalho"><CabecalhoPlataforma colecao="estados" destinoConta="/contas-publicas-estaduais" /><NavegacaoColecao colecao="estaduais" /></header>
 {children}
 <ParaIrAlem mapa={mapaParaIrAlem()} />
 <footer className="ce-footer"><span>Scrutiniums · Evidências para decisões melhores</span><a href="#metodo">Versão, origem e limites desta etapa ↑</a><a href="/sobre">Sobre a Scrutiniums</a></footer>
 </div>;
}
