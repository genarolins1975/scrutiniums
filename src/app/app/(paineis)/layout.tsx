import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { getSessionUser } from "@/lib/session";
import { isAdmin } from "@/lib/admin";

/** Grupo de painéis analíticos: navegação completa da plataforma. */
export default async function PaineisLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");

  const userLabel = user.email.split("@")[0];

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader userLabel={userLabel} showAdmin={isAdmin(user)} />
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
