import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";
import { NavegacaoPainel } from "./NavegacaoPainel";

/**
 * Cabeçalho do OBEE: marca Scrutiniums e nome do observatório, discretos, e a navegação do painel. Nada de metodologia
 * ou de etapa de construção antes do dado.
 */
export function CabecalhoObee() {
  return (
    <header className="border-b border-linha bg-superficie">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-3 sm:px-6">
        <Link href="/" aria-label="Scrutiniums: página inicial" className="inline-flex min-h-[44px] items-center gap-2.5">
          <LogoMark size={20} />
          <span className="hidden font-serif text-base uppercase tracking-wide2 text-carvao sm:inline">Scrutiniums</span>
        </Link>
        <span aria-hidden="true" className="h-5 w-px bg-linha" />
        <p className="text-sm text-carvao-muted">
          <span aria-hidden="true" className="mr-2 inline-block h-2 w-2 bg-obee align-middle" />
          Observatório Brasileiro de Eficiência Estatal
        </p>
      </div>
      <NavegacaoPainel />
    </header>
  );
}
