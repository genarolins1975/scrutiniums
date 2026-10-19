import type { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { nextStepPath } from "@/lib/onboarding";
import type { OnboardingStatus } from "@/lib/schema";
import { maskPhone } from "@/lib/crypto";
import { LogoWordmark } from "@/components/ui/Logo";
import { EntrarVerificarForm } from "@/components/onboarding/EntrarVerificarForm";
import { SeletorIdiomaPublico } from "@/components/i18n/SeletorIdiomaPublico";
import { metadadosPortuguesComAlternativas } from "@/lib/i18n-metadata";
import {
  LOGIN_PHONE_COOKIE,
  readSignedPhoneCookie,
} from "@/components/onboarding/signedEmailCookie";

const metadadosOriginais: Metadata = { title: "Código de acesso" };
export const dynamic = "force-dynamic";

export async function generateMetadata(_props: { params?: Record<string, string> }, parent: ResolvingMetadata): Promise<Metadata> {
  return metadadosPortuguesComAlternativas("/entrar/sms/verificar", metadadosOriginais, await parent);
}

/**
 * Segunda tela do login por SMS: código de 6 dígitos enviado por SMS.
 * Com ?recuperar=1, o código leva à definição de nova senha.
 */
export default async function EntrarSmsVerificarPage({
  searchParams,
}: {
  searchParams?: { recuperar?: string };
} = {}) {
  const recuperar = searchParams?.recuperar === "1";
  const user = await getSessionUser();
  if (user && !recuperar) {
    redirect(nextStepPath(user.onboardingStatus as OnboardingStatus));
  }

  const phone = readSignedPhoneCookie(LOGIN_PHONE_COOKIE);
  if (!phone) {
    redirect(recuperar ? "/entrar/sms?recuperar=1" : "/entrar/sms");
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
              {recuperar ? "Recuperar acesso" : "Código de acesso"}
            </h1>
            <p className="mt-3 text-sm text-carvao-muted">
              Enviamos um código de acesso por SMS ao telefone cadastrado.
            </p>
            <div className="mt-8">
              <EntrarVerificarForm
                maskedPhone={maskPhone(phone)}
                {...(recuperar ? { recuperar: true } : {})}
              />
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
