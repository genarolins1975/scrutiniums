import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { nextStepPath, safeInternalPath } from "@/lib/onboarding";
import type { OnboardingStatus } from "@/lib/schema";
import { LogoWordmark } from "@/components/ui/Logo";
import { EntrarSenhaForm } from "@/components/onboarding/EntrarSenhaForm";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

/**
 * Login principal: e-mail + senha (senha criada na etapa 3 do cadastro).
 * O código por SMS permanece como alternativa e recuperação em /entrar/sms.
 */
export default async function EntrarPage({
  searchParams,
}: {
  searchParams?: { de?: string };
}) {
  // Destino pós-login (?de=...) definido pelo middleware ao barrar rota
  // protegida; validado como caminho interno antes de qualquer uso.
  const de = safeInternalPath(searchParams?.de) ?? undefined;

  const user = await getSessionUser();
  if (user) {
    const status = user.onboardingStatus as OnboardingStatus;
    redirect(status === "COMPLETE" ? de ?? nextStepPath(status) : nextStepPath(status));
  }

  return (
    <div className="flex min-h-screen flex-col bg-marfim">
      <header className="border-b border-linha">
        <div className="mx-auto flex max-w-page items-center justify-between px-6 py-5">
          <Link href="/" aria-label="Scrutiniums — página inicial">
            <LogoWordmark />
          </Link>
          <Link href="/cadastro" className="rotulo min-h-[44px] py-3 text-carvao-muted hover:text-bronze">
            Criar acesso
          </Link>
        </div>
      </header>

      <main className="flex flex-1 justify-center px-6 py-12 md:py-20">
        <div className="w-full max-w-md">
          <section className="border border-linha bg-papel p-8 md:p-10">
            <h1 className="font-serif text-3xl text-carvao">Entrar</h1>
            <p className="mt-3 text-sm text-carvao-muted">
              Use o e-mail e a senha da sua conta.
            </p>
            <div className="mt-8">
              <EntrarSenhaForm de={de} />
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
