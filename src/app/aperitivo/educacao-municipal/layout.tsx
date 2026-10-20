import "@/components/educacao/educacao.css";
import type { ReactNode } from "react";
import { CabecalhoEducacao } from "@/components/educacao/CabecalhoEducacao";
import { Footer } from "@/components/layout/Footer";

/**
 * Casca da versão aperitivo da Educação nos municípios, servida a quem não tem sessão no endereço público
 * /educacao-municipal (princípio do aperitivo, 20/10/2026). Mesmos tokens e barra comum do painel, sem a navegação da
 * coleção nem o bloco "Para ir além": a página aperitivo não leva a outras páginas do painel; o convite do fim diz o
 * que a conta acrescenta.
 */
export default function LayoutAperitivoEducacao({ children }: { children: ReactNode }) {
  return (
    <div className="dominio-obee edm-raiz flex min-h-screen flex-col">
      <a className="edm-pular" href="#conteudo-educacao">Ir para o conteúdo</a>
      <CabecalhoEducacao navegacao={false} />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
