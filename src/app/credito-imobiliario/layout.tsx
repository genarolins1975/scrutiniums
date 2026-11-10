import "../custo-de-vida/custo-de-vida.css";
import type { Metadata } from "next";
import { ParaIrAlem } from "@/components/observatorios/ParaIrAlem";
import { mapaParaIrAlem } from "@/lib/observatorios/mapaParaIrAlem";
import { Footer } from "@/components/layout/Footer";
import { DESCRICAO_MORADIA } from "@/lib/familias/credito-imobiliario";

export const metadata: Metadata = {
  title: {
    default: "Crédito imobiliário e moradia · Moradia",
    template: "%s · Moradia · Scrutiniums",
  },
  description: DESCRICAO_MORADIA,
};

/**
 * Casca do painel Crédito imobiliário e moradia (Observatório das Famílias, coleção Moradia), a mesma do painel Dívida das famílias.
 * O painel exige conta: a rota não consta de src/lib/rotasPublicas.ts. O cabeçalho é da página.
 */
export default function CreditoImobiliarioLayout({ children }: { children: React.ReactNode }) {
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
