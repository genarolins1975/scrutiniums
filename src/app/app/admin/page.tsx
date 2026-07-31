import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { maskPhone } from "@/lib/crypto";
import { fmtDate } from "@/lib/format";
import { PageTitle, SectionHeading } from "@/components/ui/SectionHeading";
import { EmptyState } from "@/components/ui/States";
import { ConviteForm } from "@/components/admin/ConviteForm";

/**
 * A checagem de admin também roda aqui: generateMetadata resolve antes do
 * primeiro byte da resposta (o streaming do loading.tsx de /app faria o
 * notFound() do corpo chegar com status 200), garantindo 404 real para
 * usuário autenticado que não é admin.
 */
export async function generateMetadata(): Promise<Metadata> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  if (!isAdmin(user)) notFound();
  return { title: "Administração" };
}

// A lista de espera muda a cada cadastro: nunca servir versão estática.
export const dynamic = "force-dynamic";

/**
 * Painel de administração (restrito a ADMIN_EMAILS): lista de espera e
 * envio de convites com código de acesso. Usuário autenticado que não é
 * admin recebe 404 — a rota não é revelada.
 */
export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  if (!isAdmin(user)) notFound();

  const db = await getDb();
  const waitlisted = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      phoneE164: schema.users.phoneE164,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.onboardingStatus, "WAITLIST"))
    .orderBy(schema.users.createdAt);

  return (
    <div className="mx-auto w-full max-w-page px-6 py-12">
      <PageTitle
        label="Área restrita"
        title="Administração"
        description="Lista de espera do acesso antecipado e envio de convites por e-mail."
      />

      <div className="mt-12 space-y-14">
        <section aria-label="Lista de espera" className="border border-linha bg-papel p-8">
          <SectionHeading number="01" label="Acesso antecipado" title="Lista de espera" />
          {waitlisted.length === 0 ? (
            <EmptyState
              title="Ninguém aguardando no momento"
              description="Novos cadastros sem código de acesso aparecem aqui automaticamente."
            />
          ) : (
            <>
              <p className="mb-6 text-sm text-mineral">
                Total na lista de espera: <span className="text-carvao">{waitlisted.length}</span>
              </p>
              <div className="tabela-scroll overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-linha">
                      <th scope="col" className="rotulo px-3 py-3 text-left text-mineral">
                        E-mail
                      </th>
                      <th scope="col" className="rotulo px-3 py-3 text-left text-mineral">
                        Telefone
                      </th>
                      <th scope="col" className="rotulo px-3 py-3 text-left text-mineral">
                        Cadastro em
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitlisted.map((pessoa) => (
                      <tr key={pessoa.id} className="border-b border-linha">
                        <td className="px-3 py-3 text-carvao">{pessoa.email}</td>
                        <td className="px-3 py-3 text-carvao-muted">
                          {pessoa.phoneE164 ? maskPhone(pessoa.phoneE164) : "—"}
                        </td>
                        <td className="px-3 py-3 text-carvao-muted">{fmtDate(pessoa.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section aria-label="Enviar convites" className="border border-linha bg-papel p-8">
          <SectionHeading number="02" label="Convites" title="Enviar convites" />
          <p className="mb-8 max-w-prose2 text-sm text-carvao-muted">
            Cada pessoa da lista de espera recebe um e-mail informando que o acesso antecipado foi
            liberado, com o código de acesso e as instruções de entrada.
          </p>
          <ConviteForm />
        </section>
      </div>
    </div>
  );
}
