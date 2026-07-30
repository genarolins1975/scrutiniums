import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

// Banco PGlite EM MEMÓRIA exclusivo deste processo de teste + modo dev
// simulado do Twilio. Definido ANTES de importar módulos que tocam em db.
process.env.DATABASE_URL = "pglite-memory:";
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_VERIFY_SERVICE_SID;

let startEmailVerification: typeof import("@/lib/onboarding").startEmailVerification;
let checkEmailCode: typeof import("@/lib/onboarding").checkEmailCode;
let updateUser: typeof import("@/lib/onboarding").updateUser;
let nextStepPath: typeof import("@/lib/onboarding").nextStepPath;
let startPhoneVerification: typeof import("@/lib/twilio").startPhoneVerification;
let checkPhoneVerification: typeof import("@/lib/twilio").checkPhoneVerification;
let db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>;
let schema: typeof import("@/lib/db").schema;

beforeAll(async () => {
  const onboarding = await import("@/lib/onboarding");
  startEmailVerification = onboarding.startEmailVerification;
  checkEmailCode = onboarding.checkEmailCode;
  updateUser = onboarding.updateUser;
  nextStepPath = onboarding.nextStepPath;
  ({ startPhoneVerification, checkPhoneVerification } = await import("@/lib/twilio"));
  const dbModule = await import("@/lib/db");
  db = await dbModule.getDb();
  schema = dbModule.schema;
});

async function getUser(userId: string) {
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  return rows[0];
}

function spyInfo() {
  return vi.spyOn(console, "info").mockImplementation(() => {});
}

function codeFromLog(spy: ReturnType<typeof spyInfo>, tag: string): string {
  const line = spy.mock.calls
    .map((args) => String(args[0]))
    .filter((l) => l.includes(tag))
    .at(-1);
  const match = line?.match(/:\s*(\d{6})\s*$/);
  if (!match) throw new Error(`código não encontrado no log ${tag}`);
  return match[1];
}

describe("máquina de estados do onboarding", () => {
  it("updateUser muda onboarding_status e atualiza updated_at", async () => {
    const { userId } = await startEmailVerification("transicao@exemplo.com", "EMAIL_VERIFY");
    expect((await getUser(userId)).onboardingStatus).toBe("EMAIL_PENDING");

    await updateUser(userId, { onboardingStatus: "PHONE_PENDING" });
    expect((await getUser(userId)).onboardingStatus).toBe("PHONE_PENDING");

    await updateUser(userId, { onboardingStatus: "PROFILE_PENDING" });
    expect((await getUser(userId)).onboardingStatus).toBe("PROFILE_PENDING");

    await updateUser(userId, { onboardingStatus: "ACCESS_PENDING" });
    expect((await getUser(userId)).onboardingStatus).toBe("ACCESS_PENDING");

    await updateUser(userId, { onboardingStatus: "COMPLETE" });
    const user = await getUser(userId);
    expect(user.onboardingStatus).toBe("COMPLETE");
    expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(user.createdAt.getTime());
  });

  it("ACCESS_PENDING → WAITLIST → COMPLETE (lista de espera que recebe código depois)", async () => {
    const { userId } = await startEmailVerification("espera@exemplo.com", "EMAIL_VERIFY");
    await updateUser(userId, { onboardingStatus: "ACCESS_PENDING" });
    expect(nextStepPath("ACCESS_PENDING")).toBe("/cadastro/acesso");

    // "Não tenho código": entra na lista de espera, mas continua na mesma rota.
    await updateUser(userId, { onboardingStatus: "WAITLIST" });
    expect((await getUser(userId)).onboardingStatus).toBe("WAITLIST");
    expect(nextStepPath("WAITLIST")).toBe("/cadastro/acesso");

    // Código de acesso recebido depois: entra na plataforma.
    await updateUser(userId, { onboardingStatus: "COMPLETE" });
    expect((await getUser(userId)).onboardingStatus).toBe("COMPLETE");
    expect(nextStepPath("COMPLETE")).toBe("/app");
  });

  it("fluxo simulado completo: usuário COMPLETE tem e-mail e telefone verificados", async () => {
    const infoSpy = spyInfo();
    const phone = "+5511987654321";

    // 1. EMAIL_PENDING: cadastro e verificação do e-mail.
    const { userId } = await startEmailVerification("completo@exemplo.com", "EMAIL_VERIFY");
    expect((await getUser(userId)).onboardingStatus).toBe("EMAIL_PENDING");
    expect(nextStepPath("EMAIL_PENDING")).toBe("/cadastro");

    const emailCode = codeFromLog(infoSpy, "[dev-mail]");
    expect(await checkEmailCode(userId, "EMAIL_VERIFY", emailCode)).toBe("approved");
    await updateUser(userId, { emailVerifiedAt: new Date(), onboardingStatus: "PHONE_PENDING" });

    // 2. PHONE_PENDING: verificação por SMS (modo dev simulado).
    expect(nextStepPath("PHONE_PENDING")).toBe("/cadastro/telefone");
    const start = await startPhoneVerification(phone);
    expect(start).toEqual({ ok: true });

    const smsCode = codeFromLog(infoSpy, "[dev-verify]");
    const check = await checkPhoneVerification(phone, smsCode);
    expect(check.status).toBe("approved");
    await updateUser(userId, {
      phoneE164: phone,
      phoneVerifiedAt: new Date(),
      onboardingStatus: "PROFILE_PENDING",
    });

    // 3. PROFILE_PENDING: dados de perfil e aceite dos termos.
    expect(nextStepPath("PROFILE_PENDING")).toBe("/cadastro/perfil");
    await updateUser(userId, {
      company: "Empresa Exemplo",
      jobTitle: "Analista",
      termsAcceptedAt: new Date(),
      onboardingStatus: "ACCESS_PENDING",
    });

    // 4. ACCESS_PENDING: código de acesso válido conclui o onboarding.
    expect(nextStepPath("ACCESS_PENDING")).toBe("/cadastro/acesso");
    process.env.ACCESS_CODES = "SCRUT-TESTE";
    const { isValidAccessCode } = await import("@/lib/access");
    expect(isValidAccessCode("scrut-teste")).toBe(true);
    await updateUser(userId, { onboardingStatus: "COMPLETE" });
    delete process.env.ACCESS_CODES;

    // 5. COMPLETE: invariantes do estado final.
    const user = await getUser(userId);
    expect(user.onboardingStatus).toBe("COMPLETE");
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.phoneVerifiedAt).not.toBeNull();
    expect(user.phoneE164).toBe(phone);
    expect(user.company).toBe("Empresa Exemplo");
    expect(user.termsAcceptedAt).not.toBeNull();
    expect(nextStepPath("COMPLETE")).toBe("/app");

    infoSpy.mockRestore();
  });
});
