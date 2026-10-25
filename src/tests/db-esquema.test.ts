import { describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

process.env.DATABASE_URL = "pglite-memory:";

/**
 * Esquema na primeira conexão (src/lib/db.ts, garantirEsquema): com a versão já registrada, a partida a frio faz uma consulta só,
 * em vez de reaplicar todos os comandos da migração; banco sem registro, ou com versão anterior, recebe a migração e passa a ter a
 * versão atual registrada.
 */
type Db = Awaited<ReturnType<typeof import("@/lib/db").getDb>>;

const linhas = async (db: Db, consulta: string) => (await db.execute(sql.raw(consulta)) as unknown as { rows: Record<string, unknown>[] }).rows;

/** O mesmo banco, contando cada execute. */
function contando(db: Db): { db: Db; total: () => number } {
  let n = 0;
  const espiao = new Proxy(db, {
    get(alvo, chave, receptor) {
      const valor = Reflect.get(alvo, chave, receptor);
      if (chave !== "execute") return valor;
      return (...args: unknown[]) => { n++; return (valor as (...a: unknown[]) => unknown).apply(alvo, args); };
    },
  });
  return { db: espiao, total: () => n };
}

describe("esquema na primeira conexão", () => {
  it("registra a versão aplicada e, com ela registrada, confere com uma consulta só", { timeout: 60_000 }, async () => {
    const mod = await import("@/lib/db");
    const db = await mod.getDb();
    expect(mod.VERSAO_ESQUEMA).toMatch(/^[0-9a-f]{16}$/);
    expect(await linhas(db, "SELECT versao FROM esquema_versoes")).toEqual([{ versao: mod.VERSAO_ESQUEMA }]);

    const espiao = contando(db);
    await mod.garantirEsquema(espiao.db);
    expect(espiao.total()).toBe(1);
  });

  it("banco sem o registro, ou com outra versão, recebe a migração e passa a ter a versão atual", { timeout: 60_000 }, async () => {
    const mod = await import("@/lib/db");
    const db = await mod.getDb();
    await db.execute(sql.raw("DROP TABLE esquema_versoes"));
    const semRegistro = contando(db);
    await mod.garantirEsquema(semRegistro.db);
    expect(semRegistro.total()).toBeGreaterThan(10);
    expect(await linhas(db, "SELECT versao FROM esquema_versoes")).toEqual([{ versao: mod.VERSAO_ESQUEMA }]);

    await db.execute(sql.raw("UPDATE esquema_versoes SET versao = 'anterior'"));
    const anterior = contando(db);
    await mod.garantirEsquema(anterior.db);
    expect(anterior.total()).toBeGreaterThan(10);
    expect((await linhas(db, "SELECT versao FROM esquema_versoes ORDER BY versao")).map((l) => l.versao).sort()).toEqual(["anterior", mod.VERSAO_ESQUEMA].sort());
  });

  it.each(["08006", "42501"])("propaga falha %s sem tentar migrar", async (code) => {
    const { garantirEsquema, getDb } = await import("@/lib/db");
    const db = await getDb();
    const erro = new Error("Falha do driver", { cause: Object.assign(new Error("Banco indisponível ou sem permissão"), { code }) });
    const executar = vi.spyOn(db, "execute").mockRejectedValue(erro);
    try {
      await expect(garantirEsquema(db)).rejects.toBe(erro);
      expect(executar).toHaveBeenCalledTimes(1);
    } finally {
      executar.mockRestore();
    }
  });

  it("não registra uma migração incompleta e permite nova tentativa", async () => {
    const { garantirEsquema, getDb, VERSAO_ESQUEMA } = await import("@/lib/db");
    const db = await getDb();
    await db.execute(sql.raw("DELETE FROM esquema_versoes"));
    const original = db.execute.bind(db);
    const erro = new Error("Migração interrompida");
    const executar = vi.spyOn(db, "execute")
      .mockImplementationOnce(original)
      .mockImplementationOnce(original)
      .mockRejectedValueOnce(erro);
    try {
      await expect(garantirEsquema(db)).rejects.toBe(erro);
    } finally {
      executar.mockRestore();
    }
    expect(await linhas(db, "SELECT versao FROM esquema_versoes")).toEqual([]);
    await garantirEsquema(db);
    expect(await linhas(db, "SELECT versao FROM esquema_versoes")).toEqual([{ versao: VERSAO_ESQUEMA }]);
  });

  it("só reaplica a promoção das contas legadas quando a versão está ausente", async () => {
    const { garantirEsquema, getDb } = await import("@/lib/db");
    const db = await getDb();
    await db.execute(sql`INSERT INTO users (id, email, onboarding_status, created_at, updated_at)
      VALUES ('legada-esquema', 'legada-esquema@example.invalid', 'WAITLIST', now(), now())`);
    await garantirEsquema(db);
    expect(await linhas(db, "SELECT onboarding_status FROM users WHERE id = 'legada-esquema'"))
      .toEqual([{ onboarding_status: "WAITLIST" }]);
    await db.execute(sql.raw("DELETE FROM esquema_versoes"));
    await garantirEsquema(db);
    expect(await linhas(db, "SELECT onboarding_status FROM users WHERE id = 'legada-esquema'"))
      .toEqual([{ onboarding_status: "COMPLETE" }]);
  });
});
