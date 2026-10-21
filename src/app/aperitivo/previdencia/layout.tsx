import "../../contas-publicas/contas.css";
import "@/components/previdencia/previdencia.css";
import type { ReactNode } from "react";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { Footer } from "@/components/layout/Footer";
import { ROTA_PREVIDENCIA } from "@/lib/previdencia/paginas";

/**
 * Casca da versão aperitivo da Previdência e INSS, servida a quem não tem sessão no endereço público
 * /contas-publicas/previdencia (princípio do aperitivo, 20/10/2026). Mesmos tokens e barra comum das Contas Federais
 * (contas.css, CabecalhoPlataforma), sem a navegação do módulo nem o bloco "Para ir além": a página aperitivo não leva a
 * outras páginas do painel; o convite do fim diz o que a conta acrescenta.
 */
export default function LayoutAperitivoPrevidencia({ children }: { children: ReactNode }) {
  return (
    <div className="cp-root pv-root flex min-h-screen flex-col">
      <a className="cp-skip" href="#conteudo-previdencia">Ir para o conteúdo</a>
      <header className="cp-header">
        <CabecalhoPlataforma colecao="contas" destinoConta={ROTA_PREVIDENCIA} />
      </header>
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
