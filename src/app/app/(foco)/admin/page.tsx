import { ResumoAtualizacoes } from "@/components/admin/QuadroAtualizacoes";
import { lerQuadro } from "@/lib/operacoes/quadro";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { fmtDate, fmtDateTime, fmtNumber } from "@/lib/format";
import { getAdminStats } from "@/lib/adminStats";
import { sectionLabel } from "@/lib/telemetry";
import { AREAS_ATUACAO, NIVEIS_CARGO, PERFIS_USO, TIPOS_INSTITUICAO, rotuloDe } from "@/lib/perfilOpcoes";
import { PageTitle, SectionHeading } from "@/components/ui/SectionHeading";
import { EmptyState } from "@/components/ui/States";
import { BarrasRanking, ColunasDiarias, Funil, Indicador } from "@/components/admin/Graficos";
import { UsoPaginas } from "@/components/admin/UsoPaginas";
import { getBuscasDoPeriodo, getUsoDoPeriodo } from "@/lib/uso/painel";
import { UsoBusca } from "@/components/admin/UsoBusca";

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
  ACCESS_PENDING: "Código pendente (legado)",
  WAITLIST: "Lista de espera (legado)",
  COMPLETE: "Completo",
};

const SUGESTAO_LABELS: Record<string, string> = {
  analise: "Nova análise ou indicador",
  dado: "Correção ou dúvida sobre dado",
  usabilidade: "Usabilidade e navegação",
  outra: "Outra sugestão",
};

const AUDIT_LABELS: Record<string, string> = {
  EMAIL_CHANGE_REQUESTED: "Troca de e-mail solicitada",
  EMAIL_CHANGED: "E-mail alterado",
  PHONE_CHANGE_REQUESTED: "Troca de telefone solicitada",
  PHONE_CHANGED: "Telefone alterado",
  SESSION_REVOKED: "Sessões encerradas",
  PASSWORD_CHANGED: "Senha alterada",
  PASSWORD_RESET: "Senha redefinida",
  ACCOUNT_DELETED: "Conta excluída",
  TAREFA_OPERACIONAL_ALTERADA: "Tarefa operacional alterada",
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
 * atividade diária, uso agregado por observatório e por página (inclusive sem
 * conta, quando ligado), seções mais visitadas, funil de onboarding, usuários,
 * sugestões e auditoria. Usuário autenticado que não é admin recebe 404 —
 * a rota não é revelada.
 */
export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  if (!isAdmin(user)) notFound();

  const [stats, uso, busca, atualizacoes] = await Promise.all([getAdminStats(), getUsoDoPeriodo(), getBuscasDoPeriodo(), lerQuadro()]);
  const vg = stats.visaoGeral;

  return (
    <div className="mx-auto w-full max-w-page px-6 py-12">
      <PageTitle
        label="Área restrita"
        title="Administração"
        description="Uso da plataforma, funil de cadastro, usuários, sugestões e auditoria — atualizado a cada acesso."
      />

      <ResumoAtualizacoes linhas={atualizacoes} />

      <div className="mt-12 space-y-14">
        <section aria-label="Visão geral" className="border border-linha bg-papel p-8">
          <SectionHeading label="Indicadores" title="Visão geral" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Indicador rotulo="Usuários" valor={fmtNumber(vg.totalUsuarios)} detalhe="Contas criadas" />
            <Indicador
              rotulo="Acesso completo"
              valor={fmtNumber(vg.acessoCompleto)}
              detalhe="Onboarding concluído"
            />
            <Indicador
              rotulo="Sugestões · 30 dias"
              valor={fmtNumber(stats.sugestoes30d)}
              detalhe={`${fmtNumber(stats.sugestoesTotal)} desde o início`}
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
          <SectionHeading label="Engajamento" title="Atividade diária" />
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
          <dl className="mt-8 grid gap-4 border-t border-linha pt-6 sm:grid-cols-3">
            {([
              ["Crédito", stats.visitasPorDominio.credito],
              ["Setor Elétrico", stats.visitasPorDominio.energia],
              ["Plataforma (conta e escolha)", stats.visitasPorDominio.plataforma],
            ] as const).map(([rotulo, valor]) => (
              <div key={rotulo}>
                <dt className="rotulo text-mineral">Visitas 30 dias · {rotulo}</dt>
                <dd className="mt-1 font-serif text-2xl text-carvao">{fmtNumber(valor)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-xs text-mineral">
            Visitas contam aberturas de seção por usuários com sessão, nos observatórios, sem
            qualquer dado pessoal: apenas a seção, o domínio e o momento. Dias no fuso de Brasília.
          </p>
        </section>

        <UsoPaginas uso={uso} />

        <UsoBusca busca={busca} />

        <section aria-label="Seções mais visitadas" className="border border-linha bg-papel p-8">
          <SectionHeading label="Navegação" title="Seções mais visitadas" />
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
                detalhe: `${r.dominio === "agro" ? "Usuários não identificados" : `${fmtNumber(r.usuarios30d)} usuário${r.usuarios30d === 1 ? "" : "s"}`} · ${fmtNumber(r.visitasTotal)} desde o início`,
              }))}
            />
          )}
          {stats.ranking.length > 0 && (
            <p className="mt-6 text-xs text-mineral">
              Janela de 30 dias, com o acumulado desde o início ao lado. Visitas de todas as contas,
              inclusive administradores. No Agronegócio, visitas são agregadas sem identificação;
              não entram na contagem de usuários ativos.
            </p>
          )}
        </section>

        <section aria-label="Funil de onboarding" className="border border-linha bg-papel p-8">
          <SectionHeading label="Aquisição" title="Funil de onboarding" />
          <Funil etapas={stats.funil} />
          <p className="mt-6 text-xs text-mineral">
            Eventos acumulados desde o lançamento. {fmtNumber(stats.falhasVerificacao30d)} falha
            {stats.falhasVerificacao30d === 1 ? "" : "s"} de verificação por SMS nos últimos 30 dias.
            O cadastro não exige mais código de acesso: o perfil completo conclui o onboarding.
          </p>
        </section>

        <section aria-label="Usuários recentes" className="border border-linha bg-papel p-8">
          <SectionHeading label="Contas" title="Usuários recentes" />
          {stats.perfisUso.length > 0 && (
            <div className="mb-10">
              <h3 className="mb-4 font-serif text-xl text-carvao">Perfil de uso das contas completas</h3>
              <BarrasRanking
                itens={stats.perfisUso.map((p) => ({
                  rotulo: p.perfilUso ? rotuloDe(PERFIS_USO, p.perfilUso) : "Sem registro (conta anterior à pergunta)",
                  valor: p.contas,
                  detalhe: `${fmtNumber((p.contas / stats.visaoGeral.acessoCompleto) * 100, 1)}%`,
                }))}
              />
              <p className="mt-4 text-xs text-mineral">
                Contas com cadastro completo, por perfil de uso declarado. Contas concluídas antes de o
                cadastro perguntar o perfil de uso aparecem sem registro, não em outra categoria.
              </p>
            </div>
          )}
          {stats.usuariosRecentes.length === 0 ? (
            <EmptyState title="Nenhuma conta criada ainda" description="Os cadastros aparecem aqui." />
          ) : (
            <div className="tabela-scroll overflow-x-auto" role="region" aria-label="Cadastros recentes" tabIndex={0}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-linha">
                    <Th>E-mail</Th>
                    <Th>Situação</Th>
                    <Th>Perfil de uso</Th>
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
                          className={`rotulo ${u.status === "COMPLETE" ? "text-sucesso" : u.status === "WAITLIST" ? "text-bronze-dark" : "text-mineral"}`}
                        >
                          {STATUS_LABELS[u.status] ?? u.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-carvao-muted">
                        {u.perfilUso ? rotuloDe(PERFIS_USO, u.perfilUso) : u.status === "COMPLETE" ? "Sem registro" : "—"}
                        {u.uf ? ` · ${u.uf}` : ""}
                      </td>
                      <td className="px-3 py-3 text-carvao-muted">
                        {u.orgType ? rotuloDe(TIPOS_INSTITUICAO, u.orgType) : u.company || "—"}
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
          <h3 className="mt-10 font-serif text-xl text-carvao">Últimos acessos</h3>
          <p className="mt-2 text-sm text-mineral">
            Cada entrada na plataforma, por senha, código SMS ou ao concluir o cadastro, da mais recente para a
            mais antiga.
          </p>
          {stats.acessosRecentes.length === 0 ? (
            <EmptyState title="Nenhum acesso registrado" description="As entradas na plataforma aparecem aqui." />
          ) : (
            <div className="tabela-scroll mt-4 overflow-x-auto" role="region" aria-label="Últimos acessos" tabIndex={0}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-linha">
                    <Th>Quando</Th>
                    <Th>Conta</Th>
                  </tr>
                </thead>
                <tbody>
                  {stats.acessosRecentes.map((a) => (
                    <tr key={a.id} className="border-b border-linha">
                      <td className="whitespace-nowrap px-3 py-3 text-carvao-muted">{fmtDateTime(a.createdAt)}</td>
                      <td className="px-3 py-3 text-carvao">{a.email ?? "conta removida"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-label="Sugestões" className="border border-linha bg-papel p-8">
          <SectionHeading label="Feedback" title="Sugestões dos usuários" />
          {stats.sugestoesRecentes.length === 0 ? (
            <EmptyState
              title="Nenhuma sugestão ainda"
              description="As sugestões enviadas na aba do Observatório aparecem aqui, com conta e data."
            />
          ) : (
            <>
              <p className="mb-6 text-sm text-mineral">
                {fmtNumber(stats.sugestoes30d)} nos últimos 30 dias ·{" "}
                {fmtNumber(stats.sugestoesTotal)} desde o início. Exibindo as{" "}
                {stats.sugestoesRecentes.length} mais recentes.
              </p>
              <ul className="space-y-4">
                {stats.sugestoesRecentes.map((sg) => (
                  <li key={sg.id} className="border border-linha bg-marfim p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <span className="rotulo text-bronze-dark">{SUGESTAO_LABELS[sg.categoria] ?? sg.categoria}</span>
                      <span className="text-xs text-mineral">
                        {sg.email ?? "conta removida"} · {fmtDateTime(sg.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-carvao">{sg.texto}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section aria-label="Auditoria" className="border border-linha bg-papel p-8">
          <SectionHeading label="Segurança" title="Auditoria de mudanças sensíveis" />
          {stats.auditoria.length === 0 ? (
            <EmptyState
              title="Nenhum registro de auditoria"
              description="Trocas de e-mail, telefone e senha, encerramento de sessões e exclusões de conta ficam registradas aqui."
            />
          ) : (
            <div className="tabela-scroll overflow-x-auto" role="region" aria-label="Auditoria de mudanças" tabIndex={0}>
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
