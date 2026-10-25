import { describe, expect, it } from "vitest";
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
});
