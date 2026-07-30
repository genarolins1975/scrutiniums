import Link from "next/link";
import { cookies } from "next/headers";
import { LogoWordmark } from "@/components/ui/Logo";
import { getSessionUser } from "@/lib/session";

const NAV = [
  { href: "/#plataforma", label: "Plataforma" },
  { href: "/#publicos", label: "Para quem" },
  { href: "/fontes", label: "Fontes" },
  { href: "/metodologia", label: "Metodologia" },
  { href: "/glossario", label: "Glossário" },
];

/**
 * Cabeçalho público com ações de autenticação sensíveis à sessão:
 * visitante vê "Entrar"/"Criar acesso"; usuário com onboarding completo
 * vê "Minha conta"/"Observatório" (caminho de volta à área logada).
 * A leitura da sessão é server-side (sem fetch no cliente).
 */
export async function PublicHeader() {
  // cookies() FORA do try: em prerender estático o Next lança
  // DynamicServerError aqui, que precisa propagar para a página ser
  // tratada como dinâmica (um catch aqui congelaria o header no estado
  // de visitante). A consulta ao banco só acontece se houver cookie.
  const hasSessionCookie = cookies().has("scrutiniums_session");
  let authenticated = false;
  if (hasSessionCookie) {
    try {
      const user = await getSessionUser();
      authenticated = user?.onboardingStatus === "COMPLETE";
    } catch {
      // Banco indisponível ou sessão ilegível: trata como visitante.
      authenticated = false;
    }
  }
  return <PublicHeaderView authenticated={authenticated} />;
}

/** Variante presentacional (estática) — usada também na página 404. */
export function PublicHeaderView({ authenticated = false }: { authenticated?: boolean }) {
  return (
    <header className="border-b border-linha bg-marfim">
      <div className="mx-auto flex max-w-page items-center justify-between gap-6 px-6 py-5">
        <Link
          href="/"
          aria-label="Scrutiniums — página inicial"
          className="inline-flex min-h-[44px] items-center"
        >
          <LogoWordmark />
        </Link>
        <nav aria-label="Navegação principal" className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted hover:text-bronze"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <Link
            href={authenticated ? "/app/conta" : "/entrar"}
            className="rotulo hidden min-h-[44px] items-center text-carvao-muted hover:text-bronze sm:inline-flex"
          >
            {authenticated ? "Minha conta" : "Entrar"}
          </Link>
          <Link
            href={authenticated ? "/observatorio" : "/cadastro"}
            className="rotulo inline-flex min-h-[44px] items-center border border-carvao px-5 text-carvao hover:bg-carvao hover:text-marfim"
          >
            {authenticated ? "Observatório" : "Criar acesso"}
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
            className="rotulo inline-flex min-h-[44px] items-center whitespace-nowrap text-carvao-muted hover:text-bronze"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
