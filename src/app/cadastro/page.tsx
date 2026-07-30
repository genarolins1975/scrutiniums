import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { nextStepPath } from "@/lib/onboarding";
import type { OnboardingStatus } from "@/lib/schema";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { CadastroEmailForm } from "@/components/onboarding/CadastroEmailForm";
import {
  ONBOARDING_EMAIL_COOKIE,
  readSignedEmailCookie,
} from "@/components/onboarding/signedEmailCookie";

export const metadata: Metadata = { title: "Crie seu acesso gratuito" };
export const dynamic = "force-dynamic";

/**
 * Etapa 1: e-mail de contato (sem código de verificação).
 * Retomada: com sessão, redireciona pela máquina de estados; sem sessão
 * mas com cookie assinado de onboarding, segue direto para o telefone.
 */
export default async function CadastroPage() {
  const user = await getSessionUser();
  if (user && user.onboardingStatus !== "EMAIL_PENDING") {
    redirect(nextStepPath(user.onboardingStatus as OnboardingStatus));
  }
  if (!user && readSignedEmailCookie(ONBOARDING_EMAIL_COOKIE)) {
    redirect("/cadastro/telefone");
  }

  return (
    <section className="border border-linha bg-papel p-8 md:p-10">
      <StepIndicator current={1} />
      <h1 className="mt-6 font-serif text-3xl text-carvao">Crie seu acesso gratuito</h1>
      <p className="mt-3 text-sm text-carvao-muted">Informe seu e-mail de contato para começar.</p>
      <div className="mt-8">
        <CadastroEmailForm />
      </div>
    </section>
  );
}
