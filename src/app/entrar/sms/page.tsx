import type { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { opcoesPaisSms } from "@/lib/politica-sms";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { nextStepPath } from "@/lib/onboarding";
import type { OnboardingStatus } from "@/lib/schema";
import { LogoWordmark } from "@/components/ui/Logo";
import { EntrarForm } from "@/components/onboarding/EntrarForm";
import { SeletorIdiomaPublico } from "@/components/i18n/SeletorIdiomaPublico";
import { metadadosPortuguesComAlternativas } from "@/lib/i18n-metadata";

const metadadosOriginais: Metadata = { title: "Entrar com código por SMS" };
export const dynamic = "force-dynamic";

export async function generateMetadata(_props: { params?: Record<string, string> }, parent: ResolvingMetadata): Promise<Metadata> {
  return metadadosPortuguesComAlternativas("/entrar/sms", metadadosOriginais, await parent);
}

/**
 * Entrada alternativa por código SMS no telefone verificado. Com
 * ?recuperar=1 (link "Esqueci minha senha" de /entrar), o código leva
 * direto à definição de nova senha em /app/conta, sem pedir a atual.
 */
export default async function EntrarSmsPage({
  searchParams,
}: {
  searchParams?: { recuperar?: string };
} = {}) {
  const recuperar = searchParams?.recuperar === "1";
  const user = await getSessionUser();
  if (user) {
    redirect(nextStepPath(user.onboardingStatus as OnboardingStatus));
  }

  return (
    <div className="flex min-h-screen flex-col bg-marfim">
      <header className="border-b border-linha">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-x-6 px-6 py-5">
          <Link href="/" aria-label="Scrutiniums — página inicial">
            <LogoWordmark />
          </Link>
          <Link href="/cadastro" className="rotulo min-h-[44px] py-3 text-carvao-muted hover:text-bronze">
            Criar acesso
          </Link>
          <SeletorIdiomaPublico />
        </div>
      </header>

      <main className="flex flex-1 justify-center px-6 py-12 md:py-20">
        <div className="w-full max-w-md">
          <section className="border border-linha bg-papel p-8 md:p-10">
            <h1 className="font-serif text-3xl text-carvao">
              {recuperar ? "Recuperar acesso" : "Entrar com código por SMS"}
            </h1>
            {recuperar ? (
              <p className="mt-3 text-sm leading-relaxed text-carvao-muted">
                Informe o telefone cadastrado. Enviamos um código por SMS e, ao confirmá-lo,
                você define uma nova senha.
              </p>
            ) : (
              <>
                <p className="mt-3 text-sm text-carvao-muted">
                  Enviamos um código por SMS para o telefone cadastrado.
                </p>
                <p className="mt-2 text-sm text-mineral">
                  Esqueceu a senha?{" "}
                  <Link
                    href="/entrar/sms?recuperar=1"
                    className="text-bronze-dark underline underline-offset-4 hover:text-carvao"
                  >
                    Recuperar acesso
                  </Link>
                </p>
              </>
            )}
            <div className="mt-8">
              <EntrarForm paises={opcoesPaisSms()} {...(recuperar ? { recuperar: true } : {})} />
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
