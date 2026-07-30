import Link from "next/link";
import { LogoWordmark } from "@/components/ui/Logo";

const NAV = [
  { href: "/#plataforma", label: "Plataforma" },
  { href: "/#publicos", label: "Para quem" },
  { href: "/fontes", label: "Fontes" },
  { href: "/metodologia", label: "Metodologia" },
  { href: "/glossario", label: "Glossário" },
];

export function PublicHeader() {
  return (
    <header className="border-b border-linha bg-marfim">
      <div className="mx-auto flex max-w-page items-center justify-between gap-6 px-6 py-5">
        <Link href="/" aria-label="Scrutiniums — página inicial">
          <LogoWordmark />
        </Link>
        <nav aria-label="Navegação principal" className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="rotulo text-carvao-muted hover:text-bronze">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/entrar" className="rotulo hidden text-carvao-muted hover:text-bronze sm:block">
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className="rotulo inline-flex min-h-[44px] items-center border border-carvao px-5 text-carvao hover:bg-carvao hover:text-marfim"
          >
            Criar acesso gratuito
          </Link>
        </div>
      </div>
      <nav
        aria-label="Navegação principal (celular)"
        className="tabela-scroll flex gap-6 border-t border-linha px-6 py-3 md:hidden"
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
