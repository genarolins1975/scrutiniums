import Link from "next/link";
import { LogoWordmark } from "@/components/ui/Logo";

const NAV = [
  { href: "/app", label: "Visão geral" },
  { href: "/app/atividade", label: "Atividade setorial" },
  { href: "/app/risco", label: "Risco de crédito" },
  { href: "/app/regulatorio", label: "Regulatório" },
  { href: "/glossario", label: "Glossário" },
  { href: "/fontes", label: "Fontes" },
];

/** Cabeçalho interno da plataforma (área autenticada). */
export function AppHeader({ userLabel }: { userLabel?: string }) {
  return (
    <header className="border-b border-linha bg-marfim">
      <div className="mx-auto flex max-w-page items-center justify-between gap-6 px-6 py-4">
        <Link href="/app" aria-label="Scrutiniums — visão geral">
          <LogoWordmark />
        </Link>
        <nav aria-label="Navegação da plataforma" className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="rotulo text-carvao-muted hover:text-bronze">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-5">
          <Link href="/app/conta" className="rotulo text-carvao-muted hover:text-bronze">
            {userLabel ?? "Conta"}
          </Link>
          <form action="/api/auth/sair" method="post">
            <button type="submit" className="rotulo min-h-[44px] text-mineral hover:text-bronze">
              Sair
            </button>
          </form>
        </div>
      </div>
      <nav
        aria-label="Navegação da plataforma (celular)"
        className="tabela-scroll flex gap-6 border-t border-linha px-6 py-3 lg:hidden"
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rotulo whitespace-nowrap text-carvao-muted hover:text-bronze"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
