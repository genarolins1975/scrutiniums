import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { nextStepPath } from "@/lib/onboarding";
import type { OnboardingStatus } from "@/lib/schema";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { CadastroEmailForm } from "@/components/onboarding/CadastroEmailForm";

export const metadata: Metadata = { title: "Crie seu acesso gratuito" };
export const dynamic = "force-dynamic";

/** Etapa 1: e-mail. Usuário com sessão em etapa posterior é redirecionado. */
export default async function CadastroPage() {
  const user = await getSessionUser();
  if (user && user.onboardingStatus !== "EMAIL_PENDING") {
    redirect(nextStepPath(user.onboardingStatus as OnboardingStatus));
  }

  return (
    <section className="border border-linha bg-papel p-8 md:p-10">
      <StepIndicator current={1} />
      <h1 className="mt-6 font-serif text-3xl text-carvao">Crie seu acesso gratuito</h1>
      <p className="mt-3 text-sm text-carvao-muted">Informe seu e-mail para começar.</p>
      <div className="mt-8">
        <CadastroEmailForm />
      </div>
    </section>
  );
}
