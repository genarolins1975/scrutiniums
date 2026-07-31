import { and, desc, eq, gt, gte, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { VIEW_EVENT_PREFIX } from "./telemetry";
import type { OnboardingStatus } from "./schema";

/**
 * Agregações do painel de administração. Server-only.
 * Nenhum dado sensível sai daqui além do e-mail (o painel é restrito a
 * ADMIN_EMAILS e o e-mail é o identificador operacional da conta).
 * Dias são calculados no fuso America/Sao_Paulo — o painel é lido do Brasil
 * e um corte em UTC deslocaria as noites para o dia seguinte.
 */

const TIMEZONE = "America/Sao_Paulo";
export const DIAS_SERIE = 30;

// en-CA → YYYY-MM-DD estável, usado como chave de bucket diário.
const diaFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE });
const rotuloFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
});

export function diaLocal(date: Date): string {
  return diaFmt.format(date);
}

export type PontoDiario = { dia: string; rotulo: string; valor: number };
export type SecaoRanking = {
  secao: string;
  visitas30d: number;
  usuarios30d: number;
  visitasTotal: number;
};
export type EtapaFunil = { rotulo: string; valor: number };
export type UsuarioRecente = {
  id: string;
  email: string;
  status: string;
  company: string | null;
  jobTitle: string | null;
  orgType: string | null;
  orgArea: string | null;
  orgRole: string | null;
  uf: string | null;
  createdAt: Date;
};
export type RegistroAuditoria = {
  id: string;
  email: string | null;
  action: string;
  detail: string | null;
  createdAt: Date;
};

export type AdminStats = {
  visaoGeral: {
    totalUsuarios: number;
    novos7d: number;
    novos30d: number;
    acessoCompleto: number;
    listaEspera: number;
    emOnboarding: number;
    sessoesAtivas: number;
    usuariosAtivos7d: number;
    visitas30d: number;
  };
  visitasPorDia: PontoDiario[];
  sessoesPorDia: PontoDiario[];
  ranking: SecaoRanking[];
  funil: EtapaFunil[];
  falhasVerificacao30d: number;
  convitesEnviadosTotal: number;
  usuariosRecentes: UsuarioRecente[];
  auditoria: RegistroAuditoria[];
};

/** Últimos N dias (fuso local), do mais antigo ao mais recente. */
function janelaDias(agora: Date, n: number): { dia: string; rotulo: string }[] {
  const out: { dia: string; rotulo: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(agora.getTime() - i * 24 * 60 * 60 * 1000);
    out.push({ dia: diaFmt.format(d), rotulo: rotuloFmt.format(d) });
  }
  return out;
}

function serieDiaria(
  janela: { dia: string; rotulo: string }[],
  datas: Date[],
): PontoDiario[] {
  const contagem = new Map<string, number>();
  for (const d of datas) {
    const chave = diaFmt.format(d);
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }
  return janela.map((j) => ({ ...j, valor: contagem.get(j.dia) ?? 0 }));
}

const STATUS_ONBOARDING: OnboardingStatus[] = [
  "EMAIL_PENDING",
  "PHONE_PENDING",
  "PROFILE_PENDING",
  "ACCESS_PENDING",
];

export async function getAdminStats(agora = new Date()): Promise<AdminStats> {
  const db = await getDb();
  const corte7d = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const corte30d = new Date(agora.getTime() - DIAS_SERIE * 24 * 60 * 60 * 1000);
  const janela = janelaDias(agora, DIAS_SERIE);

  const [usuariosStatus, sessoesAtivasRows, sessoes30d, eventosTotais, eventos30d, usuariosRecentes, auditoriaRows] =
    await Promise.all([
      db
        .select({ status: schema.users.onboardingStatus, createdAt: schema.users.createdAt })
        .from(schema.users),
      db
        .select({ total: sql<number>`count(*)` })
        .from(schema.sessions)
        .where(and(isNull(schema.sessions.revokedAt), gt(schema.sessions.expiresAt, agora))),
      db
        .select({ createdAt: schema.sessions.createdAt })
        .from(schema.sessions)
        .where(gte(schema.sessions.createdAt, corte30d)),
      db
        .select({ name: schema.productEvents.name, total: sql<number>`count(*)` })
        .from(schema.productEvents)
        .groupBy(schema.productEvents.name),
      db
        .select({
          name: schema.productEvents.name,
          userId: schema.productEvents.userId,
          createdAt: schema.productEvents.createdAt,
        })
        .from(schema.productEvents)
        .where(gte(schema.productEvents.createdAt, corte30d)),
      db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          status: schema.users.onboardingStatus,
          company: schema.users.company,
          jobTitle: schema.users.jobTitle,
          orgType: schema.users.orgType,
          orgArea: schema.users.orgArea,
          orgRole: schema.users.orgRole,
          uf: schema.users.uf,
          createdAt: schema.users.createdAt,
        })
        .from(schema.users)
        .orderBy(desc(schema.users.createdAt))
        .limit(12),
      db
        .select({
          id: schema.auditLogs.id,
          email: schema.users.email,
          action: schema.auditLogs.action,
          detail: schema.auditLogs.detail,
          createdAt: schema.auditLogs.createdAt,
        })
        .from(schema.auditLogs)
        .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
        .orderBy(desc(schema.auditLogs.createdAt))
        .limit(15),
    ]);

  // ---- Usuários e status
  const totalUsuarios = usuariosStatus.length;
  const porStatus = new Map<string, number>();
  let novos7d = 0;
  let novos30d = 0;
  for (const u of usuariosStatus) {
    porStatus.set(u.status, (porStatus.get(u.status) ?? 0) + 1);
    if (u.createdAt >= corte7d) novos7d++;
    if (u.createdAt >= corte30d) novos30d++;
  }
  const emOnboarding = STATUS_ONBOARDING.reduce((acc, s) => acc + (porStatus.get(s) ?? 0), 0);

  // ---- Eventos: totais all-time por nome
  const totalPorNome = new Map<string, number>();
  for (const e of eventosTotais) totalPorNome.set(e.name, Number(e.total));
  const totalNome = (nome: string) => totalPorNome.get(nome) ?? 0;

  // ---- Eventos 30d: visitas, ranking, usuários ativos, falhas
  const visitas30dRows = eventos30d.filter((e) => e.name.startsWith(VIEW_EVENT_PREFIX));
  const porSecao = new Map<string, { visitas: number; usuarios: Set<string> }>();
  const ativos7d = new Set<string>();
  for (const e of visitas30dRows) {
    const secao = e.name.slice(VIEW_EVENT_PREFIX.length);
    const atual = porSecao.get(secao) ?? { visitas: 0, usuarios: new Set<string>() };
    atual.visitas++;
    if (e.userId) atual.usuarios.add(e.userId);
    porSecao.set(secao, atual);
    if (e.userId && e.createdAt >= corte7d) ativos7d.add(e.userId);
  }
  const ranking: SecaoRanking[] = Array.from(porSecao.entries())
    .map(([secao, v]) => ({
      secao,
      visitas30d: v.visitas,
      usuarios30d: v.usuarios.size,
      visitasTotal: totalNome(`${VIEW_EVENT_PREFIX}${secao}`),
    }))
    .sort((a, b) => b.visitas30d - a.visitas30d);

  const falhasVerificacao30d = eventos30d.filter((e) => e.name === "verification_failed").length;

  // ---- Funil de onboarding (all-time, baseado em eventos)
  const funil: EtapaFunil[] = [
    { rotulo: "Cadastro iniciado", valor: totalNome("onboarding_started") },
    { rotulo: "E-mail informado", valor: totalNome("email_verified") },
    { rotulo: "Telefone confirmado por SMS", valor: totalNome("phone_verified") },
    { rotulo: "Perfil completo", valor: totalNome("profile_completed") },
    { rotulo: "Onboarding concluído", valor: totalNome("onboarding_completed") },
  ];

  return {
    visaoGeral: {
      totalUsuarios,
      novos7d,
      novos30d,
      acessoCompleto: porStatus.get("COMPLETE") ?? 0,
      listaEspera: porStatus.get("WAITLIST") ?? 0,
      emOnboarding,
      sessoesAtivas: Number(sessoesAtivasRows[0]?.total ?? 0),
      usuariosAtivos7d: ativos7d.size,
      visitas30d: visitas30dRows.length,
    },
    visitasPorDia: serieDiaria(janela, visitas30dRows.map((e) => e.createdAt)),
    sessoesPorDia: serieDiaria(janela, sessoes30d.map((s) => s.createdAt)),
    ranking,
    funil,
    falhasVerificacao30d,
    convitesEnviadosTotal: totalNome("waitlist_invited"),
    usuariosRecentes,
    auditoria: auditoriaRows,
  };
}
