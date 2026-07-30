import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

// Banco PGlite EM MEMÓRIA exclusivo deste processo de teste (pool "forks":
// um processo por arquivo). Definido ANTES de importar qualquer módulo que
// toque em src/lib/db (import dinâmico no beforeAll).
process.env.DATABASE_URL = "pglite-memory:";

let startEmailVerification: typeof import("@/lib/onboarding").startEmailVerification;
let checkEmailCode: typeof import("@/lib/onboarding").checkEmailCode;
let registerContactEmail: typeof import("@/lib/onboarding").registerContactEmail;
let PRIVACY_VERSION: typeof import("@/lib/onboarding").PRIVACY_VERSION;
let nextStepPath: typeof import("@/lib/onboarding").nextStepPath;
let db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>;
let schema: typeof import("@/lib/db").schema;
let hashToken: typeof import("@/lib/crypto").hashToken;

beforeAll(async () => {
  const onboarding = await import("@/lib/onboarding");
  startEmailVerification = onboarding.startEmailVerification;
  checkEmailCode = onboarding.checkEmailCode;
  registerContactEmail = onboarding.registerContactEmail;
  PRIVACY_VERSION = onboarding.PRIVACY_VERSION;
  nextStepPath = onboarding.nextStepPath;
  const dbModule = await import("@/lib/db");
  db = await dbModule.getDb();
  schema = dbModule.schema;
  ({ hashToken } = await import("@/lib/crypto"));
});

function spyInfo() {
  return vi.spyOn(console, "info").mockImplementation(() => {});
}
let infoSpy: ReturnType<typeof spyInfo>;
beforeEach(() => {
  vi.restoreAllMocks();
  infoSpy = spyInfo();
});

/** Extrai do log de desenvolvimento o código enviado por e-mail. */
function lastMailedCode(): string {
  const calls = infoSpy.mock.calls
    .map((args) => String(args[0]))
    .filter((line) => line.includes("[dev-mail]"));
  const match = calls.at(-1)?.match(/:\s*(\d{6})\s*$/);
  if (!match) throw new Error("código não encontrado no log de dev-mail");
  return match[1];
}

function tokensOf(userId: string) {
  return db
    .select()
    .from(schema.verificationTokens)
    .where(eq(schema.verificationTokens.userId, userId));
}

describe("onboarding.startEmailVerification", () => {
  it("cria usuário EMAIL_PENDING com e-mail normalizado", async () => {
    const { userId } = await startEmailVerification("  Novo@Exemplo.COM ", "EMAIL_VERIFY");
    expect(userId).not.toBe("");

    const users = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    const user = users[0];
    expect(user).toBeDefined();
    expect(user.email).toBe("novo@exemplo.com");
    expect(user.onboardingStatus).toBe("EMAIL_PENDING");
    expect(user.emailVerifiedAt).toBeNull();
  });

  it("grava apenas o hash do código: 64 hex, nunca o código em claro", async () => {
    const { userId } = await startEmailVerification("hash@exemplo.com", "EMAIL_VERIFY");
    const code = lastMailedCode();

    const tokens = await tokensOf(userId);
    expect(tokens).toHaveLength(1);
    const token = tokens[0];

    expect(token.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(token.tokenHash).not.toBe(code);
    expect(token.tokenHash).not.toContain(code);
    expect(token.tokenHash).toBe(hashToken(code)); // hash correto do código enviado
    expect(token.purpose).toBe("EMAIL_VERIFY");
    expect(token.usedAt).toBeNull();
    expect(token.attempts).toBe(0);
    expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("LOGIN para e-mail inexistente não cria usuário nem revela existência", async () => {
    const before = (await db.select().from(schema.users)).length;
    const { userId } = await startEmailVerification("fantasma@exemplo.com", "LOGIN");
    expect(userId).toBe("");
    expect((await db.select().from(schema.users)).length).toBe(before);
  });

  it("reaproveita usuário existente em novo start (não duplica)", async () => {
    const a = await startEmailVerification("repetido@exemplo.com", "EMAIL_VERIFY");
    const b = await startEmailVerification("repetido@exemplo.com", "EMAIL_VERIFY");
    expect(b.userId).toBe(a.userId);
    expect(await tokensOf(a.userId)).toHaveLength(2);
  });
});

describe("onboarding.checkEmailCode", () => {
  it("aprova o código correto uma única vez; reuso → expired", async () => {
    const { userId } = await startEmailVerification("aprova@exemplo.com", "EMAIL_VERIFY");
    const code = lastMailedCode();

    expect(await checkEmailCode(userId, "EMAIL_VERIFY", code)).toBe("approved");
    // Token marcado como usado: segunda tentativa com o mesmo código falha.
    expect(await checkEmailCode(userId, "EMAIL_VERIFY", code)).toBe("expired");

    const token = (await tokensOf(userId))[0];
    expect(token.usedAt).not.toBeNull();
  });

  it("rejeita código errado com invalid e conta a tentativa", async () => {
    const { userId } = await startEmailVerification("erra@exemplo.com", "EMAIL_VERIFY");
    const code = lastMailedCode();
    const wrong = code === "000000" ? "000001" : "000000";

    expect(await checkEmailCode(userId, "EMAIL_VERIFY", wrong)).toBe("invalid");
    expect((await tokensOf(userId))[0].attempts).toBe(1);

    // O código correto ainda funciona após um erro.
    expect(await checkEmailCode(userId, "EMAIL_VERIFY", code)).toBe("approved");
  });

  it("trava após 5 tentativas erradas, mesmo com o código correto depois", async () => {
    const { userId } = await startEmailVerification("trava@exemplo.com", "EMAIL_VERIFY");
    const code = lastMailedCode();
    const wrong = code === "000000" ? "000001" : "000000";

    for (let i = 0; i < 5; i++) {
      expect(await checkEmailCode(userId, "EMAIL_VERIFY", wrong)).toBe("invalid");
    }
    expect(await checkEmailCode(userId, "EMAIL_VERIFY", wrong)).toBe("locked");
    expect(await checkEmailCode(userId, "EMAIL_VERIFY", code)).toBe("locked");
  });

  it("retorna expired quando o token venceu (expires_at manipulado no banco)", async () => {
    const { userId } = await startEmailVerification("vencido@exemplo.com", "EMAIL_VERIFY");
    const code = lastMailedCode();

    await db
      .update(schema.verificationTokens)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(schema.verificationTokens.userId, userId));

    expect(await checkEmailCode(userId, "EMAIL_VERIFY", code)).toBe("expired");
  });

  it("retorna expired quando nunca houve start para o propósito", async () => {
    const { userId } = await startEmailVerification("soemail@exemplo.com", "EMAIL_VERIFY");
    expect(await checkEmailCode(userId, "LOGIN", "123456")).toBe("expired");
  });
});

describe("onboarding.registerContactEmail (cadastro somente-SMS)", () => {
  it("cria usuário direto em PHONE_PENDING, com aceite de termos e sem código", async () => {
    const { userId, created } = await registerContactEmail("  Contato@Exemplo.COM ", {
      marketingOptIn: true,
    });
    expect(created).toBe(true);

    const users = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    const user = users[0];
    expect(user).toBeDefined();
    expect(user.email).toBe("contato@exemplo.com");
    expect(user.onboardingStatus).toBe("PHONE_PENDING"); // nasce direto na etapa do telefone
    expect(user.emailVerifiedAt).toBeNull(); // e-mail é dado de contato, sem verificação
    expect(user.termsAcceptedAt).not.toBeNull();
    expect(user.privacyVersion).toBe(PRIVACY_VERSION);
    expect(user.marketingOptIn).toBe(true);

    // Nenhum código de verificação é criado no novo fluxo.
    expect(await tokensOf(userId)).toHaveLength(0);
  });

  it("reaproveita usuário existente sem duplicar nem rebaixar a etapa", async () => {
    const a = await registerContactEmail("contato2@exemplo.com", { marketingOptIn: false });
    const b = await registerContactEmail("contato2@exemplo.com", { marketingOptIn: false });
    expect(b.created).toBe(false);
    expect(b.userId).toBe(a.userId);
  });

  it("promove usuário legado EMAIL_PENDING para PHONE_PENDING", async () => {
    const { userId } = await startEmailVerification("legado@exemplo.com", "EMAIL_VERIFY");
    const { created } = await registerContactEmail("legado@exemplo.com", { marketingOptIn: false });
    expect(created).toBe(false);

    const users = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(users[0].onboardingStatus).toBe("PHONE_PENDING");
    expect(users[0].termsAcceptedAt).not.toBeNull();
  });
});

describe("onboarding.nextStepPath", () => {
  it("mapeia os 4 estados da máquina para as rotas corretas", () => {
    expect(nextStepPath("EMAIL_PENDING")).toBe("/cadastro");
    expect(nextStepPath("PHONE_PENDING")).toBe("/cadastro/telefone");
    expect(nextStepPath("PROFILE_PENDING")).toBe("/cadastro/perfil");
    expect(nextStepPath("COMPLETE")).toBe("/app");
  });
});
