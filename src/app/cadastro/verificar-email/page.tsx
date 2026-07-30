import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { nextStepPath } from "@/lib/onboarding";
import type { OnboardingStatus } from "@/lib/schema";
import { maskEmail } from "@/lib/crypto";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { VerificarEmailForm } from "@/components/onboarding/VerificarEmailForm";
import {
  ONBOARDING_EMAIL_COOKIE,
  readSignedEmailCookie,
} from "@/components/onboarding/signedEmailCookie";

export const metadata: Metadata = { title: "Verifique seu e-mail" };
export const dynamic = "force-dynamic";

/** Etapa 1 (verificação): código de 6 dígitos enviado ao e-mail pendente. */
export default async function VerificarEmailPage() {
  const user = await getSessionUser();
  if (user && user.onboardingStatus !== "EMAIL_PENDING") {
    redirect(nextStepPath(user.onboardingStatus as OnboardingStatus));
  }

  const email = readSignedEmailCookie(ONBOARDING_EMAIL_COOKIE);
  if (!email) {
    redirect("/cadastro");
  }

  return (
    <section className="border border-linha bg-papel p-8 md:p-10">
      <StepIndicator current={1} />
      <h1 className="mt-6 font-serif text-3xl text-carvao">Verifique seu e-mail</h1>
      <div className="mt-8">
        <VerificarEmailForm maskedEmail={maskEmail(email)} />
      </div>
    </section>
  );
}
