import Link from "next/link";
import { LogoWordmark } from "@/components/ui/Logo";

/**
 * Cabeçalho mínimo para páginas de foco (Conta, Administração): sem a
 * navegação de painéis, que é irrelevante nesse contexto. Apenas a marca,
 * o caminho de volta ao Observatório e a saída.
 */
export function FocoHeader({ titulo }: { titulo?: string }) {
  return (
    <header className="border-b border-linha bg-marfim">
      <div className="mx-auto flex max-w-page items-center justify-between gap-6 px-6 py-4">
        <div className="flex items-center gap-5">
          <Link
            href="/observatorio"
            aria-label="Scrutiniums — voltar ao Observatório"
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
        <div className="flex items-center gap-6">
          <Link
            href="/observatorio"
            className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted hover:text-bronze"
          >
            ← Observatório
          </Link>
          <form action="/api/auth/sair" method="post">
            <button type="submit" className="rotulo min-h-[44px] text-mineral hover:text-bronze">
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
