import type { Metadata } from "next";
import { ParaIrAlem } from "@/components/observatorios/ParaIrAlem";
import { mapaParaIrAlem } from "@/lib/observatorios/mapaParaIrAlem";
import { Footer } from "@/components/layout/Footer";
import { MarcaRolagem } from "@/components/energia/MarcaRolagem";

export const metadata: Metadata = {
  title: {
    default: "Observatório Brasileiro do Saneamento",
    template: "%s · Saneamento · Scrutiniums",
  },
  description:
    "Acesso à água e ao esgoto nos 5.570 municípios, preço regulado, prestadores, reguladores, investimentos, planos e metas de universalização, com fonte, período e limitações em cada número.",
};

/**
 * Casca do domínio Saneamento. O cabeçalho é de cada página (marca o capítulo
 * ativo). A classe dominio-energia reaproveita o contrato visual dos
 * componentes de gráfico, mapa e tabela do Setor Elétrico (foco, bordas de
 * controle, rolagem de tabela); dominio-saneamento recebe os ajustes próprios.
 */
export default function SaneamentoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dominio-energia dominio-saneamento flex min-h-screen flex-col bg-papel">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:border focus:border-obee focus:bg-superficie focus:px-4 focus:text-sm focus:text-carvao"
      >
        Pular para o conteúdo
      </a>
      <MarcaRolagem />
      <div className="flex-1">{children}</div>
      <ParaIrAlem mapa={mapaParaIrAlem()} />
      <Footer compacto />
    </div>
  );
}
