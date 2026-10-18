import Link from "next/link";
import { cookies } from "next/headers";
import { LogoWordmark } from "@/components/ui/Logo";
import { getSessionUser } from "@/lib/session";
import { AbasCabecalho } from "@/components/layout/AbasCabecalho";
import { LinkConta } from "@/components/layout/LinkConta";
import { DetalhesFechaveis } from "@/components/layout/DetalhesFechaveis";
import { SeletorIdiomaPublico } from "@/components/i18n/SeletorIdiomaPublico";
import { TEXTOS_LAYOUT } from "@/i18n/paginas/layout";
import { hrefNoIdioma } from "@/lib/i18n-href";
import type { Idioma } from "@/lib/idioma";

// Abas do cabeçalho: os seis observatórios do registro e a imprensa (navCabecalho). Cada
// aba leva à página aberta do observatório (/perguntas/<id>), para quem tem conta e para
// quem não tem. As abas ficam numa segunda linha, que quebra em vez de rolar.
// No celular a quebra levava quatro linhas: abaixo de 640 px os observatórios ficam num
// seletor ("Observatórios ▾") com a lista inteira, e Imprensa e Entrar seguem à vista.

/**
 * Cabeçalho público com ações de autenticação sensíveis à sessão:
 * visitante vê "Entrar"/"Criar acesso"; usuário com onboarding completo
 * vê "Minha conta"/"Observatórios" (caminho de volta à escolha de observatório).
 * A leitura da sessão é server-side (sem fetch no cliente).
 */
export async function PublicHeader({ idioma = "pt" }: { idioma?: Idioma } = {}) {
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
  return <PublicHeaderView authenticated={authenticated} idioma={idioma} />;
}

/** Variante presentacional (estática) — usada também na página 404. */
export function PublicHeaderView({ authenticated = false, idioma = "pt" }: { authenticated?: boolean; idioma?: Idioma }) {
  const t = TEXTOS_LAYOUT[idioma];
  const conta = { visitante: { href: hrefNoIdioma("/entrar", idioma), rotulo: t.entrar }, logado: { href: "/app/conta", rotulo: t.minhaConta } };
  const acesso = { visitante: { href: hrefNoIdioma("/cadastro", idioma), rotulo: t.criarAcesso }, logado: { href: "/app/observatorios", rotulo: t.observatorios } };
  return (
    <header className="border-b border-linha bg-marfim">
      <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:gap-x-6 sm:px-6 sm:py-5">
        <Link
          href={hrefNoIdioma("/", idioma)}
          aria-label={t.inicio}
          className="inline-flex min-h-[44px] items-center"
        >
          <LogoWordmark />
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <LinkConta
            autenticado={authenticated}
            {...conta}
            className="rotulo hidden min-h-[44px] items-center text-carvao-muted hover:text-bronze sm:inline-flex"
          />
          <LinkConta
            autenticado={authenticated}
            {...acesso}
            className="rotulo inline-flex min-h-[44px] items-center whitespace-nowrap border border-carvao px-5 text-carvao hover:bg-carvao hover:text-marfim"
          />
        </div>
      </div>
      <nav aria-label={t.navegacaoPrincipal} className="mx-auto flex max-w-page flex-wrap gap-x-5 border-t border-linha px-4 py-1.5 sm:gap-x-6 sm:px-6">
        <DetalhesFechaveis className="group relative sm:hidden">
          <summary className="rotulo flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 whitespace-nowrap text-carvao hover:text-bronze [&::-webkit-details-marker]:hidden">
            {t.observatorios}
            <span aria-hidden="true" className="text-[0.7em] motion-safe:transition-transform group-open:rotate-180">▾</span>
          </summary>
          {/* o painel ocupa a largura útil (fixo, 1rem de margem) para não sair da tela */}
          <div className="fixed inset-x-4 z-40 mt-1 hidden flex-col border border-linha bg-superficie p-2 shadow-[0_8px_24px_rgba(26,29,33,0.12)] group-open:flex">
            <AbasCabecalho idioma={idioma} soObservatorios className="flex min-h-[44px] items-center px-3 text-sm text-carvao hover:bg-papel" />
          </div>
        </DetalhesFechaveis>
        <div className="hidden sm:contents">
          <AbasCabecalho idioma={idioma} className="rotulo inline-flex min-h-[44px] items-center whitespace-nowrap text-carvao-muted hover:text-bronze" />
        </div>
        <Link href={hrefNoIdioma("/imprensa", idioma)} className="rotulo inline-flex min-h-[44px] items-center whitespace-nowrap text-carvao-muted hover:text-bronze sm:hidden">
          {t.imprensa}
        </Link>
        {/* no celular o "Entrar" da linha de cima não cabe; fica com as abas */}
        <LinkConta
          autenticado={authenticated}
          {...conta}
          className="rotulo inline-flex min-h-[44px] items-center whitespace-nowrap text-carvao hover:text-bronze sm:hidden"
        />
        <SeletorIdiomaPublico idioma={idioma} />
      </nav>
    </header>
  );
}
