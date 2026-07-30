import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { nextStepPath } from "@/lib/onboarding";
import { getSessionUser } from "@/lib/session";
import type { OnboardingStatus } from "@/lib/schema";

/**
 * Camada da área autenticada: exige sessão válida e onboarding completo.
 * Sem usuário → /entrar; onboarding pendente → etapa correspondente.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");

  const status = user.onboardingStatus as OnboardingStatus;
  if (status !== "COMPLETE") redirect(nextStepPath(status));

  const userLabel = user.email.split("@")[0];

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader userLabel={userLabel} />
      <main className="mx-auto w-full max-w-page flex-1 px-6 py-10">{children}</main>
      <footer className="border-t border-linha">
        <div className="mx-auto max-w-page px-6 py-5">
          <p className="text-xs text-mineral">
            Dados com fontes, período e limitações declaradas em cada painel.
          </p>
        </div>
      </footer>
    </div>
  );
}
