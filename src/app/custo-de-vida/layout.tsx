import "./custo-de-vida.css";
import type { Metadata } from "next";
import { ParaIrAlem } from "@/components/observatorios/ParaIrAlem";
import { mapaParaIrAlem } from "@/lib/observatorios/mapaParaIrAlem";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: {
    default: "Inflação por cidade",
    template: "%s · Custo de vida · Scrutiniums",
  },
  description:
    "A inflação do IPCA em cada uma das 16 áreas pesquisadas pelo IBGE e no Brasil, no índice geral e nos nove grupos de despesa, mês a mês desde 2020, com fonte, período e ressalvas em cada número.",
};

/**
 * Casca do painel Inflação por cidade (Observatório das Famílias, coleção Custo de vida), que o próprio observatório
 * mantém (pipeline/inflacao, public/inflacao). O painel exige conta: a rota não consta de src/lib/rotasPublicas.ts, e a
 * consulta por cidade nasce fechada, preparada na LEVA_2. O cabeçalho é de cada página, porque marca a página atual.
 */
export default function CustoDeVidaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dominio-familias flex min-h-screen flex-col bg-papel">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:border focus:border-bronze focus:bg-superficie focus:px-4 focus:text-sm focus:text-carvao"
      >
        Pular para o conteúdo
      </a>
      <div className="flex-1">{children}</div>
      <ParaIrAlem mapa={mapaParaIrAlem()} />
      <Footer />
    </div>
  );
}
