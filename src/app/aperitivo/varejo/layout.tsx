import type { ReactNode } from "react";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { Footer } from "@/components/layout/Footer";
import { ROTA_VAREJO } from "@/lib/varejo/paginas";

/**
 * Casca da versão aperitivo do Varejo, servida a quem não tem sessão no endereço público /varejo (princípio do aperitivo,
 * 20/10/2026). Mesma barra comum da coleção, sem a navegação dos painéis e sem o bloco "Para ir além": a página aperitivo não
 * leva a outras páginas com conta; o convite do fim diz o que a conta acrescenta.
 */
export default function LayoutAperitivoVarejo({ children }: { children: ReactNode }) {
  return (
    <div className="dominio-gas flex min-h-screen flex-col bg-papel">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:border focus:border-carvao focus:bg-superficie focus:px-4 focus:text-sm focus:text-carvao">
        Ir para o conteúdo
      </a>
      <CabecalhoPlataforma observatorio="economia" destinoConta={ROTA_VAREJO} />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
