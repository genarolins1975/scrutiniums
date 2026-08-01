import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { nextStepPath, updateUser } from "@/lib/onboarding";
import { trackEvent } from "@/lib/events";
import type { OnboardingStatus } from "@/lib/schema";

export const dynamic = "force-dynamic";

/**
 * Rota LEGADA da etapa de código de acesso, mantida apenas para links
 * antigos e contas retardatárias: a exigência de código foi extinta.
 * Quem chega em ACCESS_PENDING ou WAITLIST é promovido a COMPLETE na hora
 * e segue para o Observatório; os demais vão para a etapa correta.
 */
export default async function AcessoPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/entrar");
  }
  const status = user.onboardingStatus as OnboardingStatus;
  if (status === "ACCESS_PENDING" || status === "WAITLIST") {
    await updateUser(user.id, { onboardingStatus: "COMPLETE" });
    await trackEvent("onboarding_completed", user.id);
    redirect("/observatorio");
  }
  redirect(nextStepPath(status));
}
