import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/session";
import { nextStepPath, safeInternalPath } from "@/lib/onboarding";
import type { OnboardingStatus } from "@/lib/schema";
import type { Idioma } from "@/lib/idioma";
import { hrefNoIdioma } from "@/lib/i18n-href";
import { maskPhone } from "@/lib/crypto";
import { opcoesPaisSms } from "@/lib/politica-sms";
import { LogoWordmark } from "@/components/ui/Logo";
import { EntrarSenhaForm } from "@/components/onboarding/EntrarSenhaForm";
import { EntrarForm } from "@/components/onboarding/EntrarForm";
import { EntrarVerificarForm } from "@/components/onboarding/EntrarVerificarForm";
import { SeletorIdiomaPublico } from "@/components/i18n/SeletorIdiomaPublico";
import { LOGIN_PHONE_COOKIE, readSignedPhoneCookie } from "@/components/onboarding/signedEmailCookie";
import { TEXTOS_ENTRAR } from "@/i18n/paginas/entrar";

/**
 * Páginas da entrada (/entrar, /entrar/sms, /entrar/sms/verificar) nos dois
 * idiomas. As páginas do App Router chamam estas funções com o idioma do
 * endereço; os destinos depois do login (cadastro pendente, área logada)
 * continuam os mesmos, só em português.
 */
function Moldura({ idioma, children }: { idioma: Idioma; children: ReactNode }) {
  const t = TEXTOS_ENTRAR[idioma];
  return (
    <div className="flex min-h-screen flex-col bg-papel">
      <header className="border-b border-linha">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-x-6 px-6 py-5">
          <Link href={hrefNoIdioma("/", idioma)} aria-label={t.marcaRotulo}>
            <LogoWordmark />
          </Link>
          <Link href={hrefNoIdioma("/cadastro", idioma)} className="rotulo min-h-[44px] py-3 text-carvao-muted hover:text-bronze">
            {t.criarAcesso}
          </Link>
          <SeletorIdiomaPublico idioma={idioma} />
        </div>
      </header>

      <main className="flex flex-1 justify-center px-6 py-12 md:py-20">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="border-t border-linha">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-2 px-6 py-5">
          <p className="text-xs text-mineral">scrutiniums.com</p>
          <p className="text-xs text-mineral">
            <Link href={hrefNoIdioma("/termos", idioma)} className="hover:text-bronze">{t.termos}</Link>
            {" · "}
            <Link href={hrefNoIdioma("/privacidade", idioma)} className="hover:text-bronze">{t.privacidade}</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Login principal: e-mail + senha (senha criada na etapa 3 do cadastro).
 * O código por SMS permanece como alternativa em /entrar/sms, e o link
 * "Esqueci minha senha" abre a recuperação em /entrar/sms?recuperar=1.
 */
export async function PaginaEntrar({ idioma, searchParams }: { idioma: Idioma; searchParams?: { de?: string } }) {
  // Destino pós-login (?de=...) definido pelo middleware ao barrar rota
  // protegida; validado como caminho interno antes de qualquer uso.
  const de = safeInternalPath(searchParams?.de) ?? undefined;

  const user = await getSessionUser();
  if (user) {
    const status = user.onboardingStatus as OnboardingStatus;
    redirect(status === "COMPLETE" ? de ?? nextStepPath(status) : nextStepPath(status));
  }

  const t = TEXTOS_ENTRAR[idioma];
  return Moldura({
    idioma,
    children: (
      <>
        <section className="border border-linha bg-papel p-8 md:p-10">
          <h1 className="font-serif text-3xl text-carvao">{t.titulo}</h1>
          {de ? (
            <p className="mt-3 text-sm leading-relaxed text-carvao-muted">{t.introducaoComDestino}</p>
          ) : (
            <p className="mt-3 text-sm text-carvao-muted">{t.introducao}</p>
          )}
          <div className="mt-8">
            <EntrarSenhaForm de={de} idioma={idioma} />
          </div>
        </section>
        {de && <p className="mt-6 text-center text-sm leading-relaxed text-carvao-muted">{t.semConta}</p>}
      </>
    ),
  });
}

/**
 * Entrada alternativa por código SMS no telefone verificado. Com
 * ?recuperar=1 (link "Esqueci minha senha" de /entrar), o código leva
 * direto à definição de nova senha em /app/conta, sem pedir a atual.
 */
export async function PaginaEntrarSms({ idioma, searchParams }: { idioma: Idioma; searchParams?: { recuperar?: string } }) {
  const recuperar = searchParams?.recuperar === "1";
  const user = await getSessionUser();
  // Recuperação pode ser reiniciada já logado (janela vencida em Conta).
  if (user && !recuperar) {
    redirect(nextStepPath(user.onboardingStatus as OnboardingStatus));
  }

  const t = TEXTOS_ENTRAR[idioma];
  return Moldura({
    idioma,
    children: (
      <section className="border border-linha bg-papel p-8 md:p-10">
        <h1 className="font-serif text-3xl text-carvao">{recuperar ? t.tituloRecuperar : t.tituloSms}</h1>
        {recuperar ? (
          <p className="mt-3 text-sm leading-relaxed text-carvao-muted">{t.introducaoRecuperar}</p>
        ) : (
          <>
            <p className="mt-3 text-sm text-carvao-muted">{t.introducaoSms}</p>
            <p className="mt-2 text-sm text-mineral">
              {t.esqueceuSenha}{" "}
              <Link
                href={hrefNoIdioma("/entrar/sms?recuperar=1", idioma)}
                className="text-bronze-dark underline underline-offset-4 hover:text-carvao"
              >
                {t.recuperarAcesso}
              </Link>
            </p>
          </>
        )}
        <div className="mt-8">
          <EntrarForm paises={opcoesPaisSms(idioma)} idioma={idioma} {...(recuperar ? { recuperar: true } : {})} />
        </div>
      </section>
    ),
  });
}

/**
 * Segunda tela do login por SMS: código de 6 dígitos enviado por SMS.
 * Com ?recuperar=1, o código leva à definição de nova senha.
 */
export async function PaginaVerificarSms({ idioma, searchParams }: { idioma: Idioma; searchParams?: { recuperar?: string } }) {
  const recuperar = searchParams?.recuperar === "1";
  const user = await getSessionUser();
  if (user && !recuperar) {
    redirect(nextStepPath(user.onboardingStatus as OnboardingStatus));
  }

  const phone = readSignedPhoneCookie(LOGIN_PHONE_COOKIE);
  if (!phone) {
    redirect(hrefNoIdioma(recuperar ? "/entrar/sms?recuperar=1" : "/entrar/sms", idioma));
  }

  const t = TEXTOS_ENTRAR[idioma];
  return Moldura({
    idioma,
    children: (
      <section className="border border-linha bg-papel p-8 md:p-10">
        <h1 className="font-serif text-3xl text-carvao">{recuperar ? t.tituloRecuperar : t.tituloVerificar}</h1>
        <p className="mt-3 text-sm text-carvao-muted">{t.introducaoVerificar}</p>
        <div className="mt-8">
          <EntrarVerificarForm
            maskedPhone={maskPhone(phone)}
            idioma={idioma}
            {...(recuperar ? { recuperar: true } : {})}
          />
        </div>
      </section>
    ),
  });
}
