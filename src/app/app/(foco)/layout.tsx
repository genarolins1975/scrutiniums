import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { isAdmin } from "@/lib/admin";
import { navegacaoDaConta } from "@/lib/observatorios/navegacaoColecao";
import { getSessionUser } from "@/lib/session";

/**
 * Grupo de foco (escolha do painel, Conta, Administração): a mesma barra comum dos observatórios, sem observatório marcado,
 * e, no lugar da navegação de uma coleção, a navegação da conta (Encontre o painel, Conta, Admin para quem administra) com o
 * "Sair". Iniciativa 2 do parecer de UX de 21/10/2026: um só cabeçalho em toda superfície, no lugar do antigo cabeçalho de foco.
 * A autenticação é garantida pelo layout pai de /app.
 */
export default async function FocoLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <div className="flex min-h-screen flex-col">
      <header>
        <CabecalhoPlataforma observatorio={null} destinoConta="/app/conta" />
        <NavegacaoColecao
          nav={navegacaoDaConta(isAdmin(user))}
          acoes={
            <form action="/api/auth/sair" method="post" className="flex">
              <button type="submit" className="flex min-h-[44px] items-center px-3 text-sm text-carvao-muted hover:text-carvao">
                Sair
              </button>
            </form>
          }
        />
      </header>
      <main className="w-full flex-1">{children}</main>
      <footer className="border-t border-linha">
        <div className="mx-auto max-w-page px-6 py-5">
          <p className="text-xs text-mineral">
            Sua conta é gratuita. Não existem planos, assinaturas ou cobranças.
          </p>
        </div>
      </footer>
    </div>
  );
}
