import "../../gas-natural/gas.css";
import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { RodapeColecao } from "@/components/layout/RodapeColecao";

export const metadata: Metadata = {
  title: { default: "Gás de cozinha", template: "%s · Gás Natural · Scrutiniums" },
};

/**
 * Casca da versão aperitivo do Gás de cozinha, servida a quem não tem sessão no endereço público
 * /gas-natural/gas-de-cozinha (princípio do aperitivo, 20/10/2026). Mesmos tokens e acabamento do Gás Natural (gas.css),
 * sem o bloco "Para ir além". O rodapé da coleção fica, porque leva a marca da parceria técnica com o FGV CERI, presente com e
 * sem sessão; os destinos dele que pedem conta levam o selo "com conta".
 */
export default function AperitivoGasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dominio-gas flex min-h-screen flex-col bg-papel">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:border focus:border-gas focus:bg-superficie focus:px-4 focus:text-sm focus:text-carvao"
      >
        Pular para o conteúdo
      </a>
      <div className="flex-1">{children}</div>
      <RodapeColecao colecao="gas" />
      <Footer />
    </div>
  );
}
