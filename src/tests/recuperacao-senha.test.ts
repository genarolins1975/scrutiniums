import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { OnboardingStatus, User } from "@/lib/schema";

const jarra = vi.hoisted(() => new Map<string, string>());
const twilio = vi.hoisted(() => ({ check: vi.fn() }));
// Somente transporte e SMS: cookies assinados, sessão, senha e banco são reais.
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (nome: string) => jarra.has(nome) ? { name: nome, value: jarra.get(nome)! } : undefined,
    set: (nome: string, valor: string) => { jarra.set(nome, valor); },
    delete: (nome: string) => { jarra.delete(nome); },
  }),
}));
vi.mock("@/lib/twilio", () => ({ checkPhoneVerification: twilio.check }));

const SESSAO = "scrutiniums_session";
const TELEFONE = "+5511912345678";
const SENHA_ANTIGA = "senha-antiga-sintetica";
const SENHA_NOVA = "senha-nova-sintetica";
const CONFIRMADO = new Date("2026-01-01T12:00:00Z");

let db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>;
let schema: typeof import("@/lib/db").schema;
let sessao: typeof import("@/lib/session");
let cookies: typeof import("@/components/onboarding/signedEmailCookie");
let senha: typeof import("@/lib/password");
let conferirCodigo: typeof import("@/app/api/auth/entrar/check/route").POST;
let trocarSenha: typeof import("@/app/api/conta/senha/route").POST;
let serial = 0;

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "pglite-memory:");
  vi.stubEnv("COOKIE_SECRET", "segredo-sintetico-do-teste-recuperacao");
  const modulo = await import("@/lib/db");
  schema = modulo.schema;
  db = await modulo.getDb();
  sessao = await import("@/lib/session");
  cookies = await import("@/components/onboarding/signedEmailCookie");
  senha = await import("@/lib/password");
  ({ POST: conferirCodigo } = await import("@/app/api/auth/entrar/check/route"));
  ({ POST: trocarSenha } = await import("@/app/api/conta/senha/route"));
});

async function limpar() {
  jarra.clear();
  await db.delete(schema.auditLogs);
  await db.delete(schema.sessions);
  await db.delete(schema.users);
}
beforeEach(async () => {
  await limpar();
  twilio.check.mockReset().mockResolvedValue({ status: "approved" });
});
afterAll(async () => {
  try { if (db) await limpar(); }
  finally { vi.unstubAllEnvs(); }
});

async function usuario(onboardingStatus: OnboardingStatus = "COMPLETE"): Promise<User> {
  const id = `recuperacao-${++serial}`;
  const [user] = await db.insert(schema.users).values({
    id, email: `${id}@example.invalid`, phoneE164: TELEFONE, phoneVerifiedAt: CONFIRMADO,
    passwordHash: await senha.hashPassword(SENHA_ANTIGA),
    onboardingStatus, createdAt: CONFIRMADO, updatedAt: CONFIRMADO,
  }).returning();
  return user;
}

async function ler(id: string): Promise<User> {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  if (!user) throw new Error("Usuário sintético não encontrado");
  return user;
}

function post(url: string, corpo: unknown) {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `198.51.100.${serial}` },
    body: JSON.stringify(corpo),
  });
}

/** Código SMS aprovado no fluxo real de /api/auth/entrar/check. */
async function entrarPorSms(corpo: Record<string, unknown>) {
  cookies.setSignedPhoneCookie(cookies.LOGIN_PHONE_COOKIE, TELEFONE);
  const res = await conferirCodigo(post("/api/auth/entrar/check", { code: "123456", ...corpo }));
  return { status: res.status, corpo: await res.json() };
}

describe("Esqueci minha senha: código SMS abre a troca sem a senha atual", () => {
  it("modo recuperar leva à seção de senha da conta e abre a janela", async () => {
    const user = await usuario();
    const r = await entrarPorSms({ recuperar: true });
    expect(r).toEqual({ status: 200, corpo: { ok: true, next: "/app/conta#senha" } });
    expect(jarra.has(cookies.RECUPERACAO_SENHA_COOKIE)).toBe(true);
    expect(cookies.recuperacaoSenhaValida(user.id)).toBe(true);
    expect((await sessao.getSessionUser())?.id).toBe(user.id);
  });

  it("login comum por SMS não abre a janela", async () => {
    await usuario();
    const r = await entrarPorSms({});
    expect(r.corpo.next).toBe("/app/observatorios");
    expect(jarra.has(cookies.RECUPERACAO_SENHA_COOKIE)).toBe(false);
  });

  it("cadastro incompleto retoma a etapa pendente sem abrir a janela", async () => {
    await usuario("PROFILE_PENDING");
    const r = await entrarPorSms({ recuperar: true });
    expect(r.corpo.next).toBe("/cadastro/perfil");
    expect(jarra.has(cookies.RECUPERACAO_SENHA_COOKIE)).toBe(false);
  });

  it("código recusado não abre a janela", async () => {
    await usuario();
    twilio.check.mockResolvedValue({ status: "pending" });
    const r = await entrarPorSms({ recuperar: true });
    expect(r.status).toBe(400);
    expect(jarra.has(cookies.RECUPERACAO_SENHA_COOKIE)).toBe(false);
  });

  it("define a nova senha sem a atual, uma única vez, e encerra as outras sessões", async () => {
    const user = await usuario();
    await sessao.createSession(user.id); // outro dispositivo, com a senha antiga
    const outro = jarra.get(SESSAO);
    await entrarPorSms({ recuperar: true });

    const res = await trocarSenha(post("/api/conta/senha", { newPassword: SENHA_NOVA }));
    expect(res.status).toBe(200);

    const depois = await ler(user.id);
    expect(await senha.verifyPassword(SENHA_NOVA, depois.passwordHash)).toBe(true);
    expect(await senha.verifyPassword(SENHA_ANTIGA, depois.passwordHash)).toBe(false);
    expect(jarra.has(cookies.RECUPERACAO_SENHA_COOKIE)).toBe(false);

    // Este dispositivo segue logado; o outro perdeu a sessão.
    expect((await sessao.getSessionUser())?.id).toBe(user.id);
    const atual = jarra.get(SESSAO);
    jarra.set(SESSAO, outro!);
    expect(await sessao.getSessionUser()).toBeNull();
    jarra.set(SESSAO, atual!);

    const auditoria = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.userId, user.id));
    expect(auditoria.map((a) => [a.action, a.detail])).toEqual([["PASSWORD_RESET", "sms"]]);

    // A janela é de uso único: nova troca volta a exigir a senha atual.
    const segunda = await trocarSenha(post("/api/conta/senha", { newPassword: "outra-senha-sintetica" }));
    expect(segunda.status).toBe(400);
  });

  it("sem a janela, conta com senha continua exigindo a senha atual", async () => {
    const user = await usuario();
    await entrarPorSms({});
    const res = await trocarSenha(post("/api/conta/senha", { newPassword: SENHA_NOVA }));
    expect(res.status).toBe(400);
    expect(await senha.verifyPassword(SENHA_ANTIGA, (await ler(user.id)).passwordHash)).toBe(true);
  });

  it("janela vencida ou de outra conta não vale", async () => {
    const user = await usuario();
    const agora = Date.now();
    cookies.setRecuperacaoSenhaCookie(user.id, agora - cookies.RECUPERACAO_SENHA_TTL_MS - 1);
    expect(cookies.recuperacaoSenhaValida(user.id, agora)).toBe(false);

    cookies.setRecuperacaoSenhaCookie("outra-conta", agora);
    expect(cookies.recuperacaoSenhaValida(user.id, agora)).toBe(false);

    // Assinatura de outro cookie do módulo não serve como janela.
    cookies.setSignedPhoneCookie(cookies.LOGIN_PHONE_COOKIE, `${user.id}|${agora + 60_000}`);
    jarra.set(cookies.RECUPERACAO_SENHA_COOKIE, jarra.get(cookies.LOGIN_PHONE_COOKIE)!);
    expect(cookies.recuperacaoSenhaValida(user.id, agora)).toBe(false);
  });
});
