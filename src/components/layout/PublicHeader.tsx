import Link from "next/link";
import { cookies } from "next/headers";
import { LogoWordmark } from "@/components/ui/Logo";
import { getSessionUser } from "@/lib/session";

// Navegação da plataforma: os três observatórios primeiro, depois a superfície
// citável de dados do Crédito. As demais páginas de cada domínio (resumo,
// metodologia, glossário, aprenda) ficam no rodapé e dentro de cada observatório.
// `soXl`: no cabeçalho de desktop o item só aparece a partir de 1280 px (com três observatórios a linha
// não cabe em 1024 px); a navegação rolável do celular mostra todos.
const NAV: { href: string; label: string; soXl?: boolean }[] = [
  { href: "/observatorio-do-credito", label: "Crédito" },
  { href: "/setor-eletrico", label: "Setor Elétrico" },
  { href: "/eficiencia-estatal", label: "Eficiência Estatal" },
  { href: "/dados", label: "Dados do crédito" },
  { href: "/#observatorios", label: "Plataforma", soXl: true },
  { href: "/#plataforma", label: "Método", soXl: true },
  { href: "/imprensa", label: "Imprensa" },
];

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
        <nav aria-label="Navegação principal" className="hidden items-center gap-6 lg:flex xl:gap-8">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rotulo min-h-[44px] items-center whitespace-nowrap text-carvao-muted hover:text-bronze ${item.soXl ? "hidden xl:inline-flex" : "inline-flex"}`}
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
            href={authenticated ? "/app/observatorios" : "/cadastro"}
            className="rotulo inline-flex min-h-[44px] items-center border border-carvao px-5 text-carvao hover:bg-carvao hover:text-marfim"
          >
            {authenticated ? "Observatórios" : "Criar acesso"}
          </Link>
        </div>
      </div>
      <nav
        aria-label="Navegação principal (celular)"
        className="tabela-scroll flex gap-6 border-t border-linha px-6 py-3 lg:hidden"
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
