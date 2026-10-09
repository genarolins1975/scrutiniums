import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";

/** Cabeçalho da entrada do observatório: marca, nome e nada de navegação de painel. */
export function CabecalhoEntrada() {
  return (
    <header className="border-b border-linha bg-superficie">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-6">
        <Link href="/" aria-label="Scrutiniums: página inicial" className="inline-flex min-h-[44px] min-w-[44px] items-center gap-2.5">
          <LogoMark size={20} />
          <span className="hidden font-serif text-base uppercase tracking-wide2 text-carvao sm:inline">Scrutiniums</span>
        </Link>
        <span aria-hidden="true" className="h-5 w-px bg-linha" />
        <p className="text-sm text-carvao-muted">
          <span aria-hidden="true" className="mr-2 inline-block h-2 w-2 bg-obee align-middle" />
          Observatório Brasileiro de Eficiência Estatal
        </p>
      </div>
    </header>
  );
}
