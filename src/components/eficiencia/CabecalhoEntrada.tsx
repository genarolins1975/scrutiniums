import Link from "next/link";
import { NavegacaoObservatorios } from "@/components/observatorios/NavegacaoObservatorios";
import { SwitcherObservatorio } from "@/components/layout/SwitcherObservatorio";
import { LogoMark } from "@/components/ui/Logo";

/**
 * Cabeçalho da entrada do observatório: marca, nome e nada de navegação de painel. No celular o nome por extenso dá lugar ao
 * seletor de observatório, que guarda os destinos da lista de observatórios (oculta abaixo de 640 px).
 */
export function CabecalhoEntrada() {
  return (
    <header className="border-b border-linha bg-superficie">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-6">
        <Link href="/" aria-label="Scrutiniums: página inicial" className="inline-flex min-h-[44px] min-w-[44px] items-center gap-2.5">
          <LogoMark size={20} />
          <span className="hidden font-serif text-base uppercase tracking-wide2 text-carvao sm:inline">Scrutiniums</span>
        </Link>
        <span aria-hidden="true" className="h-5 w-px bg-linha" />
        <div className="sm:hidden">
          <SwitcherObservatorio atual="eficiencia" />
        </div>
        <p className="hidden text-sm text-carvao-muted sm:block">
          <span aria-hidden="true" className="mr-2 inline-block h-2 w-2 bg-obee align-middle" />
          Observatório Brasileiro de Eficiência Estatal
        </p>
      </div>
      <div className="mx-auto hidden max-w-page border-t border-linha px-4 sm:block sm:px-6"><NavegacaoObservatorios atual="eficiencia" /></div>
    </header>
  );
}
