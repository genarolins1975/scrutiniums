import "@/components/conectividade/conectividade.css";
import type { ReactNode } from "react";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { Footer } from "@/components/layout/Footer";
import { ROTA_CONECTIVIDADE } from "@/lib/conectividade/paginas";

/**
 * Casca da versão aperitivo da Conectividade, servida a quem não tem sessão no endereço público /conectividade
 * (princípio do aperitivo, 20/10/2026). Mesmos tokens e barra comum do painel, sem o bloco "Para ir além": a página
 * aperitivo não leva a outras páginas do painel; o convite do fim diz o que a conta acrescenta.
 */
export default function LayoutAperitivoConectividade({ children }: { children: ReactNode }) {
  return (
    <div className="dominio-conectividade flex min-h-screen flex-col">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:border focus:border-carvao focus:bg-superficie focus:px-4 focus:text-sm focus:text-carvao">
        Ir para o conteúdo
      </a>
      <CabecalhoPlataforma observatorio="energia-e-infraestrutura" destinoConta={ROTA_CONECTIVIDADE} />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
