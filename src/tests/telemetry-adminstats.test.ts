import { beforeAll, describe, expect, it } from "vitest";

// Banco PGlite EM MEMÓRIA exclusivo deste processo de teste (pool "forks").
process.env.DATABASE_URL = "pglite-memory:";

let trackView: typeof import("@/lib/telemetry").trackView;
let isViewSection: typeof import("@/lib/telemetry").isViewSection;
let sectionLabel: typeof import("@/lib/telemetry").sectionLabel;
let VIEW_SECTIONS: typeof import("@/lib/telemetry").VIEW_SECTIONS;
let getAdminStats: typeof import("@/lib/adminStats").getAdminStats;
let diaLocal: typeof import("@/lib/adminStats").diaLocal;
let DIAS_SERIE: typeof import("@/lib/adminStats").DIAS_SERIE;
let db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>;
let schema: typeof import("@/lib/db").schema;
let newId: typeof import("@/lib/db").newId;

beforeAll(async () => {
  ({ trackView, isViewSection, sectionLabel, VIEW_SECTIONS } = await import("@/lib/telemetry"));
  ({ getAdminStats, diaLocal, DIAS_SERIE } = await import("@/lib/adminStats"));
  const dbModule = await import("@/lib/db");
  db = await dbModule.getDb();
  schema = dbModule.schema;
  newId = dbModule.newId;
});

async function criarUsuario(email: string, status: string, createdAt = new Date()): Promise<string> {
  const id = newId();
  await db.insert(schema.users).values({
    id,
    email,
    onboardingStatus: status,
    createdAt,
    updatedAt: createdAt,
  });
  return id;
}

describe("telemetry: allowlist de seções", () => {
  it("aceita todas as seções declaradas e possui rótulo para cada uma", () => {
    for (const secao of VIEW_SECTIONS) {
      expect(isViewSection(secao)).toBe(true);
      expect(sectionLabel(secao)).not.toBe(secao); // rótulo humano definido
    }
  });

  it("rejeita seções fora da allowlist (nenhum caminho arbitrário no banco)", () => {
    for (const invalida of ["obs:x", "app:admin2", "../../etc", "", "view:obs:overview"]) {
      expect(isViewSection(invalida)).toBe(false);
    }
  });

  it("trackView grava seção válida e descarta inválida", async () => {
    const userId = await criarUsuario("t1@exemplo.com", "COMPLETE");
    expect(await trackView("obs:overview", userId)).toBe(true);
    expect(await trackView("secao-inventada", userId)).toBe(false);

    const eventos = await db.select().from(schema.productEvents);
    const nomes = eventos.map((e) => e.name);
    expect(nomes).toContain("view:obs:overview");
    expect(nomes.some((n) => n.includes("inventada"))).toBe(false);
  });
});

describe("adminStats: agregações do painel", () => {
  it("conta usuários por situação, visitas, ranking e funil", async () => {
    const agora = new Date();
    const u1 = await criarUsuario("a@exemplo.com", "COMPLETE");
    await criarUsuario("b@exemplo.com", "WAITLIST");
    await criarUsuario("c@exemplo.com", "PHONE_PENDING");

    await trackView("obs:overview", u1);
    await trackView("obs:overview", u1);
    await trackView("app:paineis", u1);
    for (const nome of ["onboarding_started", "email_verified", "phone_verified"] as const) {
      await db
        .insert(schema.productEvents)
        .values({ id: newId(), name: nome, userId: u1, createdAt: agora });
    }

    const stats = await getAdminStats(agora);
    // + usuários do teste anterior (mesmo banco em memória do arquivo)
    expect(stats.visaoGeral.totalUsuarios).toBeGreaterThanOrEqual(3);
    expect(stats.visaoGeral.listaEspera).toBe(1);
    expect(stats.visaoGeral.emOnboarding).toBeGreaterThanOrEqual(1);
    expect(stats.visaoGeral.usuariosAtivos7d).toBeGreaterThanOrEqual(1);

    const topo = stats.ranking[0];
    expect(topo.secao).toBe("obs:overview");
    expect(topo.visitas30d).toBeGreaterThanOrEqual(3); // 2 daqui + 1 do teste anterior
    expect(topo.usuarios30d).toBeGreaterThanOrEqual(1);

    expect(stats.funil[0]).toEqual({ rotulo: "Cadastro iniciado", valor: 1 });
    expect(stats.funil[2].valor).toBe(1);

    // Série diária: 30 pontos, com as visitas de hoje no último ponto.
    expect(stats.visitasPorDia).toHaveLength(DIAS_SERIE);
    const hoje = diaLocal(agora);
    const ultimo = stats.visitasPorDia[stats.visitasPorDia.length - 1];
    expect(ultimo.dia).toBe(hoje);
    expect(ultimo.valor).toBeGreaterThanOrEqual(4);
  });

  it("usuários recentes vêm em ordem decrescente de cadastro", async () => {
    const stats = await getAdminStats();
    const datas = stats.usuariosRecentes.map((u) => u.createdAt.getTime());
    const ordenado = [...datas].sort((a, b) => b - a);
    expect(datas).toEqual(ordenado);
  });
});
