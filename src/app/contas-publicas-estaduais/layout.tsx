import type { Metadata } from "next";
import { LogoMark } from "@/components/ui/Logo";
import { NavegacaoObservatorios } from "@/components/observatorios/NavegacaoObservatorios";
import "./estados.css";
export const metadata: Metadata = {
 title: "Contas Públicas Estaduais · Piloto",
 description: "Orçamento, serviços e resultados dos governos estaduais: catálogo de indicadores, cobertura e evidências rastreáveis.",
 alternates: { canonical: "/contas-publicas-estaduais" }, robots: { index: false, follow: true },
};
export default function Layout({ children }: { children: React.ReactNode }) {
 return <div className="ce-root">
 <a className="ce-skip" href="#conteudo-estados">Ir ao conteúdo</a>
 <header className="ce-header"><a className="ce-brand" href="/"><LogoMark size={22} /><span>Scrutiniums</span></a><span className="ce-header-name">Observatório Brasileiro de Contas Públicas</span><span className="ce-edition">Estados · Piloto</span></header>
 <div className="ce-nav"><NavegacaoObservatorios atual="estados" /></div>
 <nav className="ce-nav" aria-label="Nesta página"><a href="#comparacao">Panorama dos estados</a><a href="#ficha">Ficha estadual</a><a href="#provas">Seis fichas de prova</a><a href="#cobertura">Cobertura</a><a href="#catalogo">48 indicadores</a><a href="#metodo">Método e fontes</a></nav>
 {children}
 <footer className="ce-footer"><span>Scrutiniums · Evidências para decisões melhores</span><a href="#metodo">Versão, origem e limites desta etapa ↑</a><a href="/sobre">Sobre a Scrutiniums</a></footer>
 </div>;
}
