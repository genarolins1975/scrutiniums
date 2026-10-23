import { spawn, type ChildProcess } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * O build de produção servido por `next start`, com uma sessão de teste num banco PGlite próprio, para os testes que conferem o
 * HTML e as medidas das páginas como o leitor as recebe, com e sem sessão (o mesmo arranjo de ux-orcamentos-cromo.test.ts).
 * Sem build (.next/BUILD_ID) não há servidor: o teste que o usa fica ignorado, e com EXIGIR_BUILD_HTML=1 (CI) reprova.
 */
export const raiz = process.cwd();
export const temBuild = existsSync(join(raiz, ".next/BUILD_ID"));
export const exigirBuild = process.env.EXIGIR_BUILD_HTML === "1";

export type ServidorProducao = {
  origem: string;
  cookie: string;
  /** Cookie de sessão assinado para outro token, de uma sessão que `preparar` gravou no banco. */
  assinar: (token: string) => string;
  parar: () => Promise<void>;
};

/** Dados a mais para a conta de teste, gravados antes de o servidor abrir o banco (o PGlite é de um processo só). */
export type PrepararConta = (db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>, schema: typeof import("@/lib/db").schema, userId: string) => Promise<void>;

export async function subirServidor(prefixo: string, preparar?: PrepararConta): Promise<ServidorProducao> {
  const temporario = await mkdtemp(join(tmpdir(), `scrutiniums-${prefixo}-`));
  const segredo = randomBytes(32).toString("hex");
  const token = randomBytes(32).toString("hex");
  const expira = new Date(Date.now() + 3_600_000);
  const exp = Math.floor(expira.getTime() / 1000);
  const assinar = (t: string) => `${exp}.${t}.${createHmac("sha256", segredo).update(`${exp}.${t}`).digest("hex")}`;
  const cookie = assinar(token);
  process.env.DATABASE_URL = `pglite://${join(temporario, "db")}`;
  const { getDb, schema } = await import("@/lib/db");
  const db = await getDb();
  const agora = new Date();
  const id = `${prefixo}-qa`;
  await db.insert(schema.users).values({ id, email: `${id}@example.invalid`, emailVerifiedAt: agora, phoneVerifiedAt: agora, onboardingStatus: "COMPLETE", createdAt: agora, updatedAt: agora });
  await db.insert(schema.sessions).values({ id: `${id}-sessao`, userId: id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: expira, createdAt: agora });
  if (preparar) await preparar(db, schema, id);
  await (db as unknown as { $client: { close: () => Promise<void> } }).$client.close();
  const ambiente: NodeJS.ProcessEnv = { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: process.env.DATABASE_URL, COOKIE_SECRET: segredo };
  for (const k of ["PATH", "LANG", "LC_ALL", "TZ", "TMPDIR", "TEMP", "TMP", "NODE_EXTRA_CA_CERTS"]) if (process.env[k] !== undefined) ambiente[k] = process.env[k];
  const filho: ChildProcess = spawn(process.execPath, [join(raiz, "node_modules/next/dist/bin/next"), "start", "--hostname", "localhost", "--port", "0"], { cwd: raiz, env: ambiente, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  const juntar = (c: Buffer) => {
    logs = (logs + c.toString()).slice(-64_000);
  };
  filho.stdout!.on("data", juntar);
  filho.stderr!.on("data", juntar);
  let origem = "";
  for (let i = 0; i < 150 && !origem; i++) {
    if (filho.exitCode !== null) throw new Error(`Next encerrou: ${logs}`);
    const achado = logs.match(/http:\/\/localhost:\d+/);
    if (achado) {
      try {
        if ((await fetch(`${achado[0]}/api/auth/eu`)).status === 401) origem = achado[0];
      } catch {
        /* ainda subindo */
      }
    }
    if (!origem) await new Promise((r) => setTimeout(r, 300));
  }
  if (!origem) throw new Error(`Next não ficou pronto: ${logs}`);
  return {
    origem,
    cookie,
    assinar,
    parar: async () => {
      if (filho.exitCode === null) filho.kill("SIGTERM");
      await rm(temporario, { recursive: true, force: true });
    },
  };
}

/** HTML de uma rota, com ou sem sessão, sem seguir redirecionamento (uma página fechada sem sessão responde 307). */
export async function htmlDe(s: ServidorProducao, rota: string, comSessao: boolean): Promise<{ status: number; html: string }> {
  const r = await fetch(s.origem + rota, { redirect: "manual", headers: comSessao ? { cookie: `scrutiniums_session=${s.cookie}` } : {} });
  return { status: r.status, html: await r.text() };
}
