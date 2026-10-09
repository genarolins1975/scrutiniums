import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";
import { ROTA_ENTRADA } from "@/lib/eficiencia/saude/rotas";
import { NavegacaoSaude } from "./NavegacaoSaude";

/** Cabeçalho do módulo Saúde: marca Scrutiniums, observatório (volta à entrada com os temas) e a navegação das visões. */
export function CabecalhoSaude() {
  return (
    <header className="border-b border-linha bg-superficie">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-3 sm:px-6">
        <Link href="/" aria-label="Scrutiniums: página inicial" className="inline-flex min-h-[44px] min-w-[44px] items-center gap-2.5">
          <LogoMark size={20} />
          <span className="hidden font-serif text-base uppercase tracking-wide2 text-carvao sm:inline">Scrutiniums</span>
        </Link>
        <span aria-hidden="true" className="h-5 w-px bg-linha" />
        <p className="min-w-0 text-sm text-carvao-muted">
          <span aria-hidden="true" className="mr-2 inline-block h-2 w-2 bg-obee align-middle" />
          <Link href={ROTA_ENTRADA} className="inline-flex min-h-[44px] items-center underline-offset-4 hover:underline">
            <span className="sm:hidden">Eficiência Estatal</span>
            <span className="hidden sm:inline">Observatório Brasileiro de Eficiência Estatal</span>
          </Link>
          <span aria-hidden="true" className="mx-2">
            /
          </span>
          <span className="text-obee-tinta">Saúde nas capitais</span>
        </p>
      </div>
      <NavegacaoSaude />
    </header>
  );
}
