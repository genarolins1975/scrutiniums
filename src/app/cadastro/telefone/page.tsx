import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { nextStepPath } from "@/lib/onboarding";
import type { OnboardingStatus } from "@/lib/schema";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { TelefoneForm } from "@/components/onboarding/TelefoneForm";

export const metadata: Metadata = { title: "Confirme seu telefone" };
export const dynamic = "force-dynamic";

/** Etapa 2: SMS. Sem sessão → /cadastro; etapa diferente → redireciona. */
export default async function TelefonePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/cadastro");
  }
  if (user.onboardingStatus !== "PHONE_PENDING") {
    redirect(nextStepPath(user.onboardingStatus as OnboardingStatus));
  }

  return (
    <section className="border border-linha bg-papel p-8 md:p-10">
      <StepIndicator current={2} />
      <h1 className="mt-6 font-serif text-3xl text-carvao">Confirme seu telefone</h1>
      <p className="mt-3 text-sm text-carvao-muted">Enviaremos um código por SMS.</p>
      <div className="mt-8">
        <TelefoneForm />
      </div>
    </section>
  );
}
