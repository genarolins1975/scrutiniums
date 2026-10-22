import "../gas-natural/gas.css";
import type { Metadata } from "next";
import { ParaIrAlem } from "@/components/observatorios/ParaIrAlem";
import { mapaParaIrAlem } from "@/lib/observatorios/mapaParaIrAlem";
import { Footer } from "@/components/layout/Footer";
import { RodapeColecao } from "@/components/layout/RodapeColecao";

export const metadata: Metadata = {
  title: {
    default: "Combustíveis nos postos",
    template: "%s · Combustíveis · Scrutiniums",
  },
  description:
    "Preço médio de revenda da gasolina comum, do etanol hidratado e do óleo diesel por estado e no Brasil, mês a mês desde 2013, pelo Levantamento de Preços de Combustíveis da ANP, com fonte, período e ressalvas em cada número.",
};

/**
 * Casca da coleção Combustíveis (Observatório de Energia e Infraestrutura). Os painéis exigem conta: nenhuma rota daqui
 * consta de src/lib/rotasPublicas.ts fora da LEVA_2, e a consulta por estado nasce fechada. Os tokens visuais são os do Gás
 * Natural (gas.css), que mantém o pipeline e a gold; o cabeçalho é de cada página, porque marca a página atual.
 */
export default function CombustiveisLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dominio-gas flex min-h-screen flex-col bg-papel">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:border focus:border-gas focus:bg-superficie focus:px-4 focus:text-sm focus:text-carvao"
      >
        Pular para o conteúdo
      </a>
      <div className="flex-1">{children}</div>
      {/* rodapé da coleção, com a parceria técnica com o FGV CERI (Iniciativa 2: a marca saiu do cabeçalho) */}
      <RodapeColecao colecao="combustiveis" />
      <ParaIrAlem mapa={mapaParaIrAlem()} />
      <Footer />
    </div>
  );
}
