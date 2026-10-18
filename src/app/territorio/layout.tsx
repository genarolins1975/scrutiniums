import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { ParaIrAlem } from "@/components/observatorios/ParaIrAlem";
import { mapaParaIrAlem } from "@/lib/observatorios/mapaParaIrAlem";

export const metadata: Metadata = {
  title: {
    default: "Observatório do Território e Clima",
    template: "%s · Território e Clima · Scrutiniums",
  },
  robots: { index: false },
};

/**
 * Casca dos painéis mantidos pelo próprio Observatório do Território e Clima, com
 * pipeline e gold próprios (pipeline/territorio, public/territorio). Exigem conta,
 * como os demais painéis: a rota não consta de src/lib/rotasPublicas.ts.
 */
export default function TerritorioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-papel">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:border focus:border-obee focus:bg-superficie focus:px-4 focus:text-sm focus:text-carvao"
      >
        Pular para o conteúdo
      </a>
      <PublicHeader />
      <div id="conteudo" className="flex-1">{children}</div>
      <ParaIrAlem mapa={mapaParaIrAlem()} />
      <Footer />
    </div>
  );
}
