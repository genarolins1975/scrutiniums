import path from "path";
import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/**
 * Conexão única com o banco (dialeto PostgreSQL nos dois ambientes):
 * - Produção (Vercel/Neon/Supabase): DATABASE_URL postgres:// ou postgresql://
 *   com drizzle-orm/node-postgres (Pool do pg).
 * - Desenvolvimento local e testes: PGlite (Postgres embarcado, sem instalar
 *   nada) com drizzle-orm/pglite. Persistência em ./.pglite por padrão,
 *   diretório customizado via DATABASE_URL=pglite://caminho, ou banco em
 *   memória via DATABASE_URL=pglite-memory: (usado pelos testes).
 *
 * TODO acesso deve passar por getDb(): a Promise singleton em globalThis
 * garante que a migração idempotente rodou antes de qualquer consulta e
 * sobrevive ao hot reload do Next.
 */

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const globalForDb = globalThis as unknown as {
  __scrutiniumsDb?: Promise<Db>;
};

function shouldUseSsl(url: string): boolean {
  return url.includes("sslmode=require") || process.env.PGSSL === "1";
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL ?? "";

  let db: Db;
  if (/^postgres(ql)?:\/\//.test(url)) {
    // Produção: Postgres gerenciado via node-postgres.
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({
      connectionString: url,
      ssl: shouldUseSsl(url) ? { rejectUnauthorized: false } : undefined,
    });
    db = drizzle(pool, { schema }) as unknown as Db;
  } else {
    // Desenvolvimento e testes: PGlite (Postgres embarcado).
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const client = url.startsWith("pglite-memory:")
      ? new PGlite() // em memória: isolamento por processo de teste
      : new PGlite(
          path.resolve(process.cwd(), url.startsWith("pglite://") ? url.slice("pglite://".length) : "./.pglite"),
        );
    db = drizzle(client, { schema }) as unknown as Db;
  }

  await migrate(db);
  return db;
}

/** Migração idempotente (CREATE TABLE IF NOT EXISTS) aplicada na primeira conexão. */
async function migrate(db: Db): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      email_verified_at TIMESTAMPTZ,
      phone_e164 TEXT UNIQUE,
      phone_verified_at TIMESTAMPTZ,
      company TEXT,
      job_title TEXT,
      onboarding_status TEXT NOT NULL DEFAULT 'EMAIL_PENDING',
      terms_accepted_at TIMESTAMPTZ,
      privacy_version TEXT,
      marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )`,
    // Coluna adicionada depois do lançamento: senha (hash scrypt) opcional.
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`,
    // Perfil estruturado + CPF (unicidade de conta por pessoa; nunca exibido integral).
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS org_type TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS org_area TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS org_role TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS uf TEXT`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cpf ON users(cpf) WHERE cpf IS NOT NULL`,
    `CREATE TABLE IF NOT EXISTS verification_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_verification_user ON verification_tokens(user_id, purpose)`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TIMESTAMPTZ NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)`,
    `CREATE TABLE IF NOT EXISTS product_events (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_events_name ON product_events(name)`,
    // Sugestões dos usuários (lidas no painel de administração).
    `CREATE TABLE IF NOT EXISTS suggestions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      categoria TEXT NOT NULL,
      texto TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_suggestions_created ON suggestions(created_at)`,
    // Fim do acesso antecipado por código: contas paradas na etapa do código
    // ou na lista de espera são promovidas a acesso completo (idempotente).
    `UPDATE users SET onboarding_status = 'COMPLETE'
      WHERE onboarding_status IN ('ACCESS_PENDING', 'WAITLIST')`,
  ];
  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
}

/**
 * Ponto único de acesso ao banco. A Promise é cacheada em globalThis:
 * chamadas concorrentes aguardam a mesma inicialização (migração incluída).
 */
export function getDb(): Promise<Db> {
  if (!globalForDb.__scrutiniumsDb) {
    globalForDb.__scrutiniumsDb = createDb().catch((err) => {
      // Falha de conexão/migração não fica cacheada: a próxima chamada tenta de novo.
      globalForDb.__scrutiniumsDb = undefined;
      throw err;
    });
  }
  return globalForDb.__scrutiniumsDb;
}

export { schema };

export function newId(): string {
  return crypto.randomUUID();
}
