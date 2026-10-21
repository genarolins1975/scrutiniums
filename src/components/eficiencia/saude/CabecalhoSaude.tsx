import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { ROTA_ENTRADA } from "@/lib/eficiencia/saude/rotas";
import { NavegacaoSaude } from "./NavegacaoSaude";

/**
 * Cabeçalho do módulo Saúde: a barra comum da plataforma e, abaixo dela, o caminho (observatório, que volta à entrada com os
 * temas, e o módulo) e a navegação das visões.
 */
export function CabecalhoSaude() {
  return (
    <header className="grade-pagina border-b border-linha bg-superficie">
      <CabecalhoPlataforma colecao="eficiencia" destinoConta={ROTA_ENTRADA} />
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-1 sm:px-6">
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
