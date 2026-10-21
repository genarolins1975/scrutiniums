import type { Metadata } from "next";
import { ParaIrAlem } from "@/components/observatorios/ParaIrAlem";
import { mapaParaIrAlem } from "@/lib/observatorios/mapaParaIrAlem";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  // a Eficiência Estatal reparte os temas entre coleções de vários observatórios: cada tema tem o seu layout com o modelo
  // "Página · Coleção · Scrutiniums" (modeloDeTitulo); aqui só a Síntese das capitais e o modelo neutro da plataforma
  title: {
    default: "Síntese das capitais",
    template: "%s · Scrutiniums",
  },
  description:
    "Indicadores públicos sobre recursos, atendimento e resultados do Estado brasileiro, com definição, fonte, período e limitações declarados em cada número.",
};

/**
 * Casca do domínio OBEE. Os painéis exigem conta, como nos demais observatórios;
 * a entrada (retrato das capitais) e as páginas de método são abertas
 * (src/lib/rotasPublicas.ts).
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
      <ParaIrAlem mapa={mapaParaIrAlem()} />
      <Footer />
    </div>
  );
}
