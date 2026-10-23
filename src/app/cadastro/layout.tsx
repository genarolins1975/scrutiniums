import Link from "next/link";
import { LogoWordmark } from "@/components/ui/Logo";
import { SeletorIdiomaPublico } from "@/components/i18n/SeletorIdiomaPublico";

/**
 * Concha do onboarding: uma etapa por vez, coluna estreita centrada
 * sobre fundo marfim, cartão papel com linha fina. Sem navegação
 * completa para manter o foco na etapa atual.
 */
export default function CadastroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-papel">
      <header className="border-b border-linha">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-x-6 px-6 py-5">
          <Link href="/" aria-label="Scrutiniums — página inicial">
            <LogoWordmark />
          </Link>
          <Link href="/entrar" className="rotulo min-h-[44px] py-3 text-carvao-muted hover:text-bronze">
            Entrar
          </Link>
          <SeletorIdiomaPublico />
        </div>
      </header>

      <main className="flex flex-1 justify-center px-6 py-12 md:py-20">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="border-t border-linha">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-2 px-6 py-5">
          <p className="text-xs text-mineral">scrutiniums.com</p>
          <p className="text-xs text-mineral">
            <Link href="/termos" className="hover:text-bronze">Termos de uso</Link>
            {" · "}
            <Link href="/privacidade" className="hover:text-bronze">Privacidade</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
