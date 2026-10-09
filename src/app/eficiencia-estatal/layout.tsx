import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: {
    default: "Observatório Brasileiro de Eficiência Estatal",
    template: "%s · Eficiência Estatal · Scrutiniums",
  },
  description:
    "Indicadores públicos sobre recursos, atendimento e resultados do Estado brasileiro, com definição, fonte, período e limitações declarados em cada número.",
};

/**
 * Casca do domínio OBEE. Público para leitura, como os demais observatórios
 * (o middleware só protege /app). Na etapa inicial há um único painel.
 */
export default function EficienciaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dominio-obee flex min-h-screen flex-col bg-papel text-obee-tinta">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:border focus:border-obee focus:bg-superficie focus:px-4 focus:text-sm focus:text-obee-tinta"
      >
        Pular para o conteúdo
      </a>
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
