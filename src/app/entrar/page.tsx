import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { nextStepPath } from "@/lib/onboarding";
import type { OnboardingStatus } from "@/lib/schema";
import { LogoWordmark } from "@/components/ui/Logo";
import { EntrarForm } from "@/components/onboarding/EntrarForm";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

/**
 * Entrada sem senha por código SMS no telefone verificado. O mesmo fluxo
 * cobre recuperação de acesso: não existe senha para redefinir.
 */
export default async function EntrarPage() {
  const user = await getSessionUser();
  if (user) {
    redirect(nextStepPath(user.onboardingStatus as OnboardingStatus));
  }

  return (
    <div className="flex min-h-screen flex-col bg-marfim">
      <header className="border-b border-linha">
        <div className="mx-auto flex max-w-page items-center justify-between px-6 py-5">
          <Link href="/" aria-label="Scrutiniums — página inicial">
            <LogoWordmark />
          </Link>
          <Link href="/cadastro" className="rotulo min-h-[44px] py-3 text-carvao-muted hover:text-bronze">
            Criar acesso gratuito
          </Link>
        </div>
      </header>

      <main className="flex flex-1 justify-center px-6 py-12 md:py-20">
        <div className="w-full max-w-md">
          <section className="border border-linha bg-papel p-8 md:p-10">
            <h1 className="font-serif text-3xl text-carvao">Entrar</h1>
            <p className="mt-3 text-sm text-carvao-muted">
              Enviamos um código por SMS para o telefone cadastrado.
            </p>
            <p className="mt-2 text-sm text-mineral">
              Perdeu o acesso? O mesmo código por SMS recupera sua conta.
            </p>
            <div className="mt-8">
              <EntrarForm />
            </div>
          </section>
        </div>
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
