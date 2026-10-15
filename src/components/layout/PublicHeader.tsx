import Link from "next/link";
import { cookies } from "next/headers";
import { LogoWordmark } from "@/components/ui/Logo";
import { getSessionUser } from "@/lib/session";
import { AbasCabecalho } from "@/components/layout/AbasCabecalho";
import { SeletorIdiomaPublico } from "@/components/i18n/SeletorIdiomaPublico";

// Abas do cabeçalho: os observatórios do registro e a imprensa (navCabecalho). Quem tem
// conta vai ao painel; o visitante, à seção do observatório na página inicial.
// Com sete observatórios as abas não cabem na linha da marca nem a 1440 px: ficam
// sempre numa segunda linha, que quebra em vez de rolar, para nenhuma aba ficar escondida.

/**
 * Cabeçalho público com ações de autenticação sensíveis à sessão:
 * visitante vê "Entrar"/"Criar acesso"; usuário com onboarding completo
 * vê "Minha conta"/"Observatórios" (caminho de volta à escolha de observatório).
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
        <div className="flex items-center gap-4">
          <Link
            href={authenticated ? "/app/conta" : "/entrar"}
            className="rotulo hidden min-h-[44px] items-center text-carvao-muted hover:text-bronze sm:inline-flex"
          >
            {authenticated ? "Minha conta" : "Entrar"}
          </Link>
          <Link
            href={authenticated ? "/app/observatorios" : "/cadastro"}
            className="rotulo inline-flex min-h-[44px] items-center whitespace-nowrap border border-carvao px-5 text-carvao hover:bg-carvao hover:text-marfim"
          >
            {authenticated ? "Observatórios" : "Criar acesso"}
          </Link>
        </div>
      </div>
      <nav aria-label="Navegação principal" className="mx-auto flex max-w-page flex-wrap gap-x-6 border-t border-linha px-6 py-1.5">
        <AbasCabecalho logadoNoServidor={authenticated} className="rotulo inline-flex min-h-[44px] items-center whitespace-nowrap text-carvao-muted hover:text-bronze" />
        {/* no celular o "Entrar" da linha de cima não cabe; fica com as abas */}
        <Link
          href={authenticated ? "/app/conta" : "/entrar"}
          className="rotulo inline-flex min-h-[44px] items-center whitespace-nowrap text-carvao hover:text-bronze sm:hidden"
        >
          {authenticated ? "Minha conta" : "Entrar"}
        </Link>
        <SeletorIdiomaPublico />
      </nav>
    </header>
  );
}
