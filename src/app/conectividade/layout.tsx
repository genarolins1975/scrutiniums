import "@/components/conectividade/conectividade.css";
import type { Metadata } from "next";
import { ParaIrAlem } from "@/components/observatorios/ParaIrAlem";
import { mapaParaIrAlem } from "@/lib/observatorios/mapaParaIrAlem";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: {
    default: "Conectividade",
    template: "%s · Conectividade · Scrutiniums",
  },
  description:
    "Banda larga fixa, linhas móveis e cobertura 4G e 5G por município, estado e no Brasil, cada medida só onde a Anatel a publica, pelos dados abertos da Anatel, com fonte, período e ressalvas em cada número.",
};

/**
 * Casca do painel Conectividade (Observatório de Energia e Infraestrutura, coleção Conectividade), mantido pelo próprio
 * observatório (pipeline/conectividade, public/conectividade). O painel exige conta: sem sessão, o endereço público
 * /conectividade serve a versão aperitivo (src/app/aperitivo/conectividade) por rewrite do middleware. O cabeçalho é de
 * cada página, porque marca a página atual.
 */
export default function ConectividadeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dominio-conectividade flex min-h-screen flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:border focus:border-carvao focus:bg-superficie focus:px-4 focus:text-sm focus:text-carvao"
      >
        Pular para o conteúdo
      </a>
      <div className="flex-1">{children}</div>
      <ParaIrAlem mapa={mapaParaIrAlem()} />
      <Footer />
    </div>
  );
}
