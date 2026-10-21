import type { Metadata } from "next";
import { ParaIrAlem } from "@/components/observatorios/ParaIrAlem";
import { mapaParaIrAlem } from "@/lib/observatorios/mapaParaIrAlem";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import "./estados.css";
export const metadata: Metadata = {
 title: "Contas Estaduais (piloto)",
 description: "Orçamento, serviços e resultados dos governos estaduais: catálogo de indicadores, cobertura e evidências rastreáveis.",
 alternates: { canonical: "/contas-publicas-estaduais" }, robots: { index: false, follow: true },
};
export default function Layout({ children }: { children: React.ReactNode }) {
 return <div className="ce-root">
 <a className="ce-skip" href="#conteudo-estados">Ir ao conteúdo</a>
 <header className="ce-cabecalho"><CabecalhoPlataforma colecao="estados" destinoConta="/contas-publicas-estaduais" /></header>
 <nav className="ce-nav" aria-label="Navegação da coleção Contas Estaduais"><a href="#comparacao">Panorama dos estados</a><a href="#ficha">Ficha estadual</a><a href="#provas">Seis fichas de prova</a><a href="#cobertura">Cobertura</a><a href="#catalogo">48 indicadores</a><a href="#metodo">Método e fontes</a><span className="ce-edition">Estados · Piloto</span></nav>
 {children}
 <ParaIrAlem mapa={mapaParaIrAlem()} />
 <footer className="ce-footer"><span>Scrutiniums · Evidências para decisões melhores</span><a href="#metodo">Versão, origem e limites desta etapa ↑</a><a href="/sobre">Sobre a Scrutiniums</a></footer>
 </div>;
}
