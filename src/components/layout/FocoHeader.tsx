import Link from "next/link";
import { LogoWordmark } from "@/components/ui/Logo";
import { SwitcherObservatorio } from "@/components/layout/SwitcherObservatorio";

/**
 * Cabeçalho mínimo para páginas de foco (Escolha do observatório, Conta,
 * Administração): a marca, o seletor de observatório, a conta e a saída.
 */
export function FocoHeader({ titulo }: { titulo?: string }) {
  return (
    <header className="border-b border-linha bg-marfim">
      <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-3 px-4 py-4 sm:gap-6 sm:px-6">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            href="/app/observatorios"
            aria-label="Scrutiniums: escolher observatório"
            className="inline-flex min-h-[44px] items-center"
          >
            <LogoWordmark />
          </Link>
          {titulo && (
            <span className="rotulo hidden text-mineral sm:inline" aria-hidden="true">
              {titulo}
            </span>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-4 sm:gap-6">
          <SwitcherObservatorio atual={null} />
          <Link
            href="/app/conta"
            className="rotulo hidden min-h-[44px] min-w-[44px] items-center justify-center text-carvao-muted hover:text-bronze sm:inline-flex"
          >
            Conta
          </Link>
          <form action="/api/auth/sair" method="post">
            <button type="submit" className="rotulo min-h-[44px] min-w-[44px] px-1 text-mineral hover:text-bronze">
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
