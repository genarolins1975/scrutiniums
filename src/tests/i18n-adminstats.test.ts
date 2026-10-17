import { beforeAll, describe, expect, it } from "vitest";
import type { AdminStats } from "@/lib/adminStats";

// PGlite real em memória, exclusivo deste arquivo no pool de forks.
process.env.DATABASE_URL = "pglite-memory:";

const AGORA = new Date("2026-10-14T15:00:00Z");
const ANTES_DA_MEIA_NOITE = new Date("2026-10-14T02:59:59Z");
const MEIA_NOITE = new Date("2026-10-14T03:00:00Z");
let getAdminStats: typeof import("@/lib/adminStats").getAdminStats;

beforeAll(async () => {
  ({ getAdminStats } = await import("@/lib/adminStats"));
  const { getDb, schema, newId } = await import("@/lib/db");
  const db = await getDb();
  const userId = newId();
  const cadastro = new Date("2026-10-12T15:00:00Z");

  await db.insert(schema.users).values({
    id: userId,
    email: "adminstats-i18n@example.test",
    onboardingStatus: "COMPLETE",
    createdAt: cadastro,
    updatedAt: cadastro,
  });
  await db.insert(schema.productEvents).values([
    { id: newId(), userId, name: "view:obs:overview", createdAt: ANTES_DA_MEIA_NOITE },
    { id: newId(), userId, name: "view:obs:overview", createdAt: MEIA_NOITE },
    { id: newId(), userId, name: "view:app:conta", createdAt: new Date("2026-10-14T03:00:01Z") },
  ]);
  await db.insert(schema.sessions).values(
    [ANTES_DA_MEIA_NOITE, MEIA_NOITE].map((createdAt) => ({
      id: newId(),
      userId,
      tokenHash: newId(),
      expiresAt: new Date("2026-10-15T15:00:00Z"),
      revokedAt: null,
      createdAt,
    })),
  );
});

function semRotulosDiarios({ visitasPorDia, sessoesPorDia, ...demais }: AdminStats) {
  return {
    ...demais,
    visitasPorDia: visitasPorDia.map(({ dia, valor }) => ({ dia, valor })),
    sessoesPorDia: sessoesPorDia.map(({ dia, valor }) => ({ dia, valor })),
  };
}

describe("idioma dos rótulos administrativos com agregações reais", () => {
  it("preserva dias de Brasília, contagens e demais dados ao apresentar as datas em inglês", async () => {
    const [padrao, pt, en] = await Promise.all([
      getAdminStats(AGORA),
      getAdminStats(AGORA, "pt"),
      getAdminStats(AGORA, "en"),
    ]);

    expect(padrao).toEqual(pt);
    expect(semRotulosDiarios(en)).toEqual(semRotulosDiarios(pt));

    for (const { resultado, rotulos } of [
      { resultado: padrao, rotulos: ["13/10", "14/10"] },
      { resultado: pt, rotulos: ["13/10", "14/10"] },
      { resultado: en, rotulos: ["Oct 13", "Oct 14"] },
    ]) {
      expect(resultado.visitasPorDia.slice(-2)).toEqual([
        { dia: "2026-10-13", rotulo: rotulos[0], valor: 1 },
        { dia: "2026-10-14", rotulo: rotulos[1], valor: 2 },
      ]);
      expect(resultado.sessoesPorDia.slice(-2)).toEqual([
        { dia: "2026-10-13", rotulo: rotulos[0], valor: 1 },
        { dia: "2026-10-14", rotulo: rotulos[1], valor: 1 },
      ]);
      for (const serie of [resultado.visitasPorDia, resultado.sessoesPorDia]) {
        expect(serie).toHaveLength(30);
        expect(serie[0].dia).toBe("2026-09-15");
        expect(serie.slice(0, -2).map(({ valor }) => valor)).toEqual(Array(28).fill(0));
      }
    }

    expect(pt.visaoGeral).toEqual({
      totalUsuarios: 1,
      novos7d: 1,
      novos30d: 1,
      acessoCompleto: 1,
      emOnboarding: 0,
      sessoesAtivas: 2,
      usuariosAtivos7d: 1,
      visitas30d: 3,
    });
    expect(pt.ranking).toEqual([
      { secao: "obs:overview", dominio: "credito", visitas30d: 2, usuarios30d: 1, visitasTotal: 2 },
      { secao: "app:conta", dominio: "plataforma", visitas30d: 1, usuarios30d: 1, visitasTotal: 1 },
    ]);
    expect(pt.visitasPorDominio).toEqual({
      credito: 2,
      energia: 0,
      eficiencia: 0,
      contas: 0,
      estados: 0,
      saneamento: 0,
      gas: 0,
      agro: 0,
      plataforma: 1,
    });
  });
});
