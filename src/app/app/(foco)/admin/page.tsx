import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { maskPhone } from "@/lib/crypto";
import { fmtDate, fmtDateTime, fmtNumber } from "@/lib/format";
import { getAdminStats } from "@/lib/adminStats";
import { sectionLabel } from "@/lib/telemetry";
import { AREAS_ATUACAO, NIVEIS_CARGO, TIPOS_INSTITUICAO, rotuloDe } from "@/lib/perfilOpcoes";
import { PageTitle, SectionHeading } from "@/components/ui/SectionHeading";
import { EmptyState } from "@/components/ui/States";
import { ConviteForm } from "@/components/admin/ConviteForm";
import { BarrasRanking, ColunasDiarias, Funil, Indicador } from "@/components/admin/Graficos";

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

// Estatísticas mudam a cada acesso: nunca servir versão estática.
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  EMAIL_PENDING: "E-mail pendente",
  PHONE_PENDING: "SMS pendente",
  PROFILE_PENDING: "Perfil pendente",
  ACCESS_PENDING: "Código pendente",
  WAITLIST: "Lista de espera",
  COMPLETE: "Completo",
};

const AUDIT_LABELS: Record<string, string> = {
  EMAIL_CHANGE_REQUESTED: "Troca de e-mail solicitada",
  EMAIL_CHANGED: "E-mail alterado",
  PHONE_CHANGE_REQUESTED: "Troca de telefone solicitada",
  PHONE_CHANGED: "Telefone alterado",
  SESSION_REVOKED: "Sessões encerradas",
  PASSWORD_CHANGED: "Senha alterada",
  ACCOUNT_DELETED: "Conta excluída",
};

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="rotulo px-3 py-3 text-left text-mineral">
      {children}
    </th>
  );
}

/**
 * Painel de administração (restrito a ADMIN_EMAILS): visão geral de uso,
 * atividade diária, seções mais visitadas, funil de onboarding, usuários,
 * lista de espera, convites e auditoria. Usuário autenticado que não é
 * admin recebe 404 — a rota não é revelada.
 */
export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  if (!isAdmin(user)) notFound();

  const db = await getDb();
  const [stats, waitlisted] = await Promise.all([
    getAdminStats(),
    db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        phoneE164: schema.users.phoneE164,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.onboardingStatus, "WAITLIST"))
      .orderBy(schema.users.createdAt),
  ]);
  const vg = stats.visaoGeral;

  return (
    <div className="mx-auto w-full max-w-page px-6 py-12">
      <PageTitle
        label="Área restrita"
        title="Administração"
        description="Uso da plataforma, funil de cadastro, lista de espera, convites e auditoria — atualizado a cada acesso."
      />

      <div className="mt-12 space-y-14">
        <section aria-label="Visão geral" className="border border-linha bg-papel p-8">
          <SectionHeading number="01" label="Indicadores" title="Visão geral" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Indicador rotulo="Usuários" valor={fmtNumber(vg.totalUsuarios)} detalhe="Contas criadas" />
            <Indicador
              rotulo="Acesso completo"
              valor={fmtNumber(vg.acessoCompleto)}
              detalhe="Onboarding concluído"
            />
            <Indicador
              rotulo="Lista de espera"
              valor={fmtNumber(vg.listaEspera)}
              detalhe="Aguardando convite"
            />
            <Indicador
              rotulo="Em onboarding"
              valor={fmtNumber(vg.emOnboarding)}
              detalhe="Cadastro em andamento"
            />
            <Indicador rotulo="Novos · 7 dias" valor={fmtNumber(vg.novos7d)} detalhe="Contas criadas na semana" />
            <Indicador rotulo="Novos · 30 dias" valor={fmtNumber(vg.novos30d)} detalhe="Contas criadas no mês" />
            <Indicador
              rotulo="Ativos · 7 dias"
              valor={fmtNumber(vg.usuariosAtivos7d)}
              detalhe="Usuários com visita na semana"
            />
            <Indicador
              rotulo="Sessões ativas"
              valor={fmtNumber(vg.sessoesAtivas)}
              detalhe="Dispositivos conectados"
            />
          </div>
        </section>

        <section aria-label="Atividade diária" className="border border-linha bg-papel p-8">
          <SectionHeading number="02" label="Engajamento" title="Atividade diária" />
          <div className="grid gap-10 lg:grid-cols-2">
            <ColunasDiarias
              pontos={stats.visitasPorDia}
              titulo="Visitas a seções · 30 dias"
              descricaoVazia="Sem visitas registradas — a medição começa nesta versão."
            />
            <ColunasDiarias
              pontos={stats.sessoesPorDia}
              titulo="Sessões iniciadas · 30 dias"
              descricaoVazia="Nenhum login no período."
            />
          </div>
          <p className="mt-6 text-xs text-mineral">
            Visitas contam aberturas de seção na área logada (Observatório e Painéis), sem qualquer
            dado pessoal: apenas a seção e o momento. Dias no fuso de Brasília.
          </p>
        </section>

        <section aria-label="Seções mais visitadas" className="border border-linha bg-papel p-8">
          <SectionHeading number="03" label="Navegação" title="Seções mais visitadas" />
          {stats.ranking.length === 0 ? (
            <EmptyState
              title="Ainda não há visitas registradas"
              description="A medição de navegação por seção começa nesta versão. Os primeiros acessos aparecem aqui em instantes."
            />
          ) : (
            <BarrasRanking
              itens={stats.ranking.slice(0, 12).map((r) => ({
                rotulo: sectionLabel(r.secao),
                valor: r.visitas30d,
                detalhe: `${fmtNumber(r.usuarios30d)} usuário${r.usuarios30d === 1 ? "" : "s"} · ${fmtNumber(r.visitasTotal)} desde o início`,
              }))}
            />
          )}
          {stats.ranking.length > 0 && (
            <p className="mt-6 text-xs text-mineral">
              Janela de 30 dias, com o acumulado desde o início ao lado. Visitas de todas as contas,
              inclusive administradores.
            </p>
          )}
        </section>

        <section aria-label="Funil de onboarding" className="border border-linha bg-papel p-8">
          <SectionHeading number="04" label="Aquisição" title="Funil de onboarding" />
          <Funil etapas={stats.funil} />
          <p className="mt-6 text-xs text-mineral">
            Eventos acumulados desde o lançamento. {fmtNumber(stats.falhasVerificacao30d)} falha
            {stats.falhasVerificacao30d === 1 ? "" : "s"} de verificação por SMS nos últimos 30 dias ·{" "}
            {fmtNumber(stats.convitesEnviadosTotal)} convite
            {stats.convitesEnviadosTotal === 1 ? "" : "s"} enviado
            {stats.convitesEnviadosTotal === 1 ? "" : "s"} desde o início.
          </p>
        </section>

        <section aria-label="Usuários recentes" className="border border-linha bg-papel p-8">
          <SectionHeading number="05" label="Contas" title="Usuários recentes" />
          {stats.usuariosRecentes.length === 0 ? (
            <EmptyState title="Nenhuma conta criada ainda" description="Os cadastros aparecem aqui." />
          ) : (
            <div className="tabela-scroll overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-linha">
                    <Th>E-mail</Th>
                    <Th>Situação</Th>
                    <Th>Instituição</Th>
                    <Th>Atuação</Th>
                    <Th>Cadastro em</Th>
                  </tr>
                </thead>
                <tbody>
                  {stats.usuariosRecentes.map((u) => (
                    <tr key={u.id} className="border-b border-linha">
                      <td className="px-3 py-3 text-carvao">{u.email}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`rotulo ${u.status === "COMPLETE" ? "text-sucesso" : u.status === "WAITLIST" ? "text-bronze" : "text-mineral"}`}
                        >
                          {STATUS_LABELS[u.status] ?? u.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-carvao-muted">
                        {u.orgType
                          ? `${rotuloDe(TIPOS_INSTITUICAO, u.orgType)}${u.uf ? ` · ${u.uf}` : ""}`
                          : u.company || "—"}
                      </td>
                      <td className="px-3 py-3 text-carvao-muted">
                        {u.orgArea
                          ? `${rotuloDe(AREAS_ATUACAO, u.orgArea)} · ${rotuloDe(NIVEIS_CARGO, u.orgRole)}`
                          : u.jobTitle || "—"}
                      </td>
                      <td className="px-3 py-3 text-carvao-muted">{fmtDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-label="Lista de espera" className="border border-linha bg-papel p-8">
          <SectionHeading number="06" label="Acesso antecipado" title="Lista de espera" />
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
                      <Th>E-mail</Th>
                      <Th>Telefone</Th>
                      <Th>Cadastro em</Th>
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
          <SectionHeading number="07" label="Convites" title="Enviar convites" />
          <p className="mb-8 max-w-prose2 text-sm text-carvao-muted">
            Cada pessoa da lista de espera recebe um e-mail informando que o acesso antecipado foi
            liberado, com o código de acesso e as instruções de entrada.
          </p>
          <ConviteForm />
        </section>

        <section aria-label="Auditoria" className="border border-linha bg-papel p-8">
          <SectionHeading number="08" label="Segurança" title="Auditoria de mudanças sensíveis" />
          {stats.auditoria.length === 0 ? (
            <EmptyState
              title="Nenhum registro de auditoria"
              description="Trocas de e-mail, telefone e senha, encerramento de sessões e exclusões de conta ficam registradas aqui."
            />
          ) : (
            <div className="tabela-scroll overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-linha">
                    <Th>Quando</Th>
                    <Th>Conta</Th>
                    <Th>Ação</Th>
                    <Th>Detalhe</Th>
                  </tr>
                </thead>
                <tbody>
                  {stats.auditoria.map((r) => (
                    <tr key={r.id} className="border-b border-linha">
                      <td className="whitespace-nowrap px-3 py-3 text-carvao-muted">
                        {fmtDateTime(r.createdAt)}
                      </td>
                      <td className="px-3 py-3 text-carvao">{r.email ?? "—"}</td>
                      <td className="px-3 py-3 text-carvao">{AUDIT_LABELS[r.action] ?? r.action}</td>
                      <td className="px-3 py-3 text-carvao-muted">{r.detail ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
