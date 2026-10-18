import "./gas.css";
import { ParaIrAlem } from "@/components/observatorios/ParaIrAlem";
import { mapaParaIrAlem } from "@/lib/observatorios/mapaParaIrAlem";
import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { RodapeGas } from "@/components/gas/RodapeGas";

export const metadata: Metadata = {
  title: {
    default: "Observatório Brasileiro de Gás Natural",
    template: "%s · Gás Natural · Scrutiniums",
  },
  description:
    "Produção, aproveitamento, importação, preços na cadeia, botijão, GNV e transporte de gás no Brasil, a partir de dados abertos da ANP, do IBGE, do Banco Central, do Comex Stat e do Banco Mundial, com fonte, período e natureza em cada número.",
};

/**
 * Casca do domínio Gás Natural. Os painéis exigem conta, como os demais (src/lib/rotasPublicas.ts); a página de método é
 * pública. O cabeçalho é de cada página, porque marca a pergunta atual.
 */
export default function GasNaturalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dominio-gas flex min-h-screen flex-col bg-papel">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:border focus:border-gas focus:bg-superficie focus:px-4 focus:text-sm focus:text-carvao"
      >
        Pular para o conteúdo
      </a>
      <div className="flex-1">{children}</div>
      <RodapeGas />
      <ParaIrAlem mapa={mapaParaIrAlem()} />
      <Footer />
    </div>
  );
}
