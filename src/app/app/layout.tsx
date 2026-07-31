import { redirect } from "next/navigation";
import { nextStepPath } from "@/lib/onboarding";
import { getSessionUser } from "@/lib/session";
import type { OnboardingStatus } from "@/lib/schema";

/**
 * Camada da área autenticada: exige sessão válida e onboarding completo.
 * Sem usuário → /entrar; onboarding pendente → etapa correspondente.
 * O chrome (cabeçalho/rodapé) fica nos grupos de rota: (paineis) usa a
 * navegação completa; (foco) usa cabeçalho mínimo (Conta, Administração).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");

  const status = user.onboardingStatus as OnboardingStatus;
  if (status !== "COMPLETE") redirect(nextStepPath(status));

  return <>{children}</>;
}
