/**
 * Sobe `next start` sobre o build existente com banco PGlite temporário, COOKIE_SECRET efêmero e
 * uma sessão de verdade no banco, para conferir páginas com e sem conta sem tocar em produção.
 *
 * Mesmo procedimento de scripts/obee/judiciario-verificacao.mjs e scripts/agro/verificacao.mjs
 * (usuário e sessão inseridos pelo db.ts do projeto, cookie no formato de src/lib/sessionCookie.ts),
 * num módulo importável. O cookie assinado sozinho (scripts/sessao-auditoria.mjs) passa pelo
 * middleware, mas a barra comum consulta /api/auth/eu e mostraria "Entrar" numa captura "com sessão".
 *
 * Uso:
 *   const servidor = await subirServidorLocal();
 *   // servidor.origem, servidor.cookie ({ name, value, url }), servidor.logs()
 *   await servidor.encerrar();
 * Nenhum dado ou credencial de produção; a origem é sempre localhost.
 */
import { spawn } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
export const NOME_COOKIE = "scrutiniums_session";

export async function subirServidorLocal({ raiz = RAIZ, usuario = "evidencias-local", preparar = null, administrador = false, estadoOperacoes = null } = {}) {
  if (!existsSync(join(raiz, ".next/BUILD_ID"))) throw new Error("Sem build em .next: rode npm run build antes.");
  const temporario = await mkdtemp(join(tmpdir(), "scrutiniums-local-"));
  const pastaBundle = await mkdtemp(join(raiz, "node_modules/.servidor-local-"));
  const segredo = randomBytes(32).toString("hex");
  const token = randomBytes(32).toString("hex");
  const expira = new Date(Date.now() + 3_600_000);
  const exp = Math.floor(expira.getTime() / 1000);
  const valor = `${exp}.${token}.${createHmac("sha256", segredo).update(`${exp}.${token}`).digest("hex")}`;
  const bancoUrl = "pglite://" + join(temporario, "db");
  let filho;
  const encerrar = async () => {
    if (filho && filho.exitCode === null) filho.kill("SIGTERM");
    await rm(temporario, { recursive: true, force: true });
    await rm(pastaBundle, { recursive: true, force: true });
  };
  try {
    const anterior = process.env.DATABASE_URL;
    process.env.DATABASE_URL = bancoUrl;
    const { build } = await import("vite");
    await build({ root: raiz, configFile: false, envFile: false, publicDir: false, logLevel: "silent",
      build: { ssr: join(raiz, "src/lib/db.ts"), outDir: pastaBundle, emptyOutDir: false, minify: false,
        rollupOptions: { output: { format: "cjs", entryFileNames: "db.cjs" } } } });
    const { getDb, schema } = require(join(pastaBundle, "db.cjs"));
    const db = await getDb();
    const agora = new Date();
    await db.insert(schema.users).values({ id: usuario, email: `${usuario}@example.invalid`, emailVerifiedAt: agora,
      phoneVerifiedAt: agora, onboardingStatus: "COMPLETE", createdAt: agora, updatedAt: agora });
    await db.insert(schema.sessions).values({ id: `${usuario}-sessao`, userId: usuario,
      tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: expira, createdAt: agora });
    // dados a mais da conta (recortes, avisos), gravados antes de o servidor abrir o banco
    if (preparar) await preparar(db, schema, usuario);
    await db.$client.close();
    // Duas auditorias sequenciais no mesmo processo precisam de bancos distintos.
    // O db.ts usa uma Promise global; a instância encerrada não pode ser reutilizada.
    delete globalThis.__scrutiniumsDb;
    if (anterior === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = anterior;

    const env = { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: bancoUrl, COOKIE_SECRET: segredo };
    // Auditoria local do ADM: só a conta sintética; nunca herda a lista ou o banco de produção.
    if (estadoOperacoes) env.OPERACOES_ESTADO_LOCAL = estadoOperacoes;
    if (administrador) env.ADMIN_EMAILS = `${usuario}@example.invalid`;
    for (const k of ["PATH", "LANG", "LC_ALL", "TZ", "TMPDIR", "TEMP", "TMP", "NODE_EXTRA_CA_CERTS", "NODE_OPTIONS"]) if (process.env[k] !== undefined) env[k] = process.env[k];
    // localhost, não 127.0.0.1: o Next usa localhost nos redirects internos e o cookie não pode trocar de host
    filho = spawn(process.execPath, [join(raiz, "node_modules/next/dist/bin/next"), "start", "--hostname", "localhost", "--port", "0"],
      { cwd: raiz, env, stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    const coletar = (b) => { logs = (logs + b).slice(-64000); };
    filho.stdout.on("data", coletar);
    filho.stderr.on("data", coletar);
    let origem = "";
    for (let i = 0; i < 200; i++) {
      if (filho.exitCode !== null) throw new Error("O Next encerrou antes de responder:\n" + logs);
      origem = logs.match(/http:\/\/localhost:\d+/)?.[0] ?? "";
      if (origem) {
        try { if ((await fetch(origem + "/api/auth/eu", { signal: AbortSignal.timeout(2000) })).status === 401) break; } catch { /* ainda subindo */ }
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!origem) throw new Error("O Next não informou a origem local:\n" + logs);
    const comSessao = await fetch(origem + "/api/auth/eu", { headers: { cookie: `${NOME_COOKIE}=${valor}` } });
    // /api/auth/eu responde 204 com sessão e 401 sem (src/app/api/auth/eu/route.ts)
    if (comSessao.status !== 204) throw new Error(`A sessão local não foi reconhecida (/api/auth/eu respondeu ${comSessao.status}).`);
    return { origem, cookie: { name: NOME_COOKIE, value: valor, url: origem, httpOnly: true, sameSite: "Lax", secure: false }, logs: () => logs, encerrar };
  } catch (erro) {
    await encerrar();
    throw erro;
  }
}
