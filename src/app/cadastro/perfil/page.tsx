import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { nextStepPath } from "@/lib/onboarding";
import type { OnboardingStatus } from "@/lib/schema";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { PerfilForm } from "@/components/onboarding/PerfilForm";

export const metadata: Metadata = { title: "Crie sua senha e complete seu perfil" };
export const dynamic = "force-dynamic";

/** Etapa 3: senha, empresa e cargo. Sem sessão → /cadastro; etapa diferente → redireciona. */
export default async function PerfilPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/cadastro");
  }
  if (user.onboardingStatus !== "PROFILE_PENDING") {
    redirect(nextStepPath(user.onboardingStatus as OnboardingStatus));
  }

  return (
    <section className="border border-linha bg-papel p-8 md:p-10">
      <StepIndicator current={3} />
      <h1 className="mt-6 font-serif text-3xl text-carvao">Crie sua senha e complete seu perfil</h1>
      <div className="mt-8">
        <PerfilForm />
      </div>
    </section>
  );
}
