import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PerfilForm } from "@/components/onboarding/PerfilForm";
import { cpfObrigatorioParaTelefone } from "@/lib/cpf-telefone";

process.env.DATABASE_URL = "pglite-memory:";
const mocks = vi.hoisted(() => ({ session: vi.fn(), createSession: vi.fn(), email: vi.fn(), check: vi.fn(), start: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionUser: mocks.session, createSession: mocks.createSession }));
vi.mock("@/lib/twilio", () => ({ checkPhoneVerification: mocks.check, startPhoneVerification: mocks.start }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined, delete: vi.fn() }) }));
vi.mock("@/components/onboarding/signedEmailCookie", () => ({
  ONBOARDING_EMAIL_COOKIE: "onboarding_email", readSignedEmailCookie: mocks.email, clearSignedEmailCookie: vi.fn(),
}));

let db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>;
let schema: typeof import("@/lib/db").schema;
let profile: typeof import("@/app/api/onboarding/profile/route").POST;
let phoneCheck: typeof import("@/app/api/onboarding/phone/check/route").POST;
let phoneStart: typeof import("@/app/api/onboarding/phone/start/route").POST;
let changeStart: typeof import("@/app/api/conta/telefone/start/route").POST;
let changeCheck: typeof import("@/app/api/conta/telefone/check/route").POST;
let completeProfile: typeof import("@/lib/onboarding").completeProfile;
let serial = 0;
const dados = { password: "senha-de-teste-123", orgType: "outra", orgArea: "outra", orgRole: "outro", uf: "EX" };
const req = (body: unknown) => new Request("http://localhost/api/teste", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeAll(async () => {
  const modulo = await import("@/lib/db"); db = await modulo.getDb(); schema = modulo.schema;
  ({ POST: profile } = await import("@/app/api/onboarding/profile/route"));
  ({ POST: phoneCheck } = await import("@/app/api/onboarding/phone/check/route"));
  ({ POST: phoneStart } = await import("@/app/api/onboarding/phone/start/route"));
  ({ POST: changeStart } = await import("@/app/api/conta/telefone/start/route"));
  ({ POST: changeCheck } = await import("@/app/api/conta/telefone/check/route"));
  ({ completeProfile } = await import("@/lib/onboarding"));
});
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("SMS_PAISES_PERMITIDOS", "BR,PT,US");
  mocks.email.mockReturnValue(null);
  mocks.check.mockResolvedValue({ status: "approved" });
  mocks.start.mockResolvedValue({ ok: true });
  await db.delete(schema.users);
});
async function usuario(phone: string | null, verified = true, status = "PROFILE_PENDING") {
  const id = "internacional-" + ++serial;
  const [user] = await db.insert(schema.users).values({ id, email: id + "@example.invalid", phoneE164: phone,
    phoneVerifiedAt: phone && verified ? new Date() : null, onboardingStatus: status, createdAt: new Date(), updatedAt: new Date(),
  }).returning();
  return user;
}
async function ler(id: string) { return (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0]; }

describe("cadastro com telefone verificado no servidor", () => {
  it("conclui estrangeiro sem CPF, guarda null e mantém unicidade por telefone", async () => {
    const user = await usuario("+351912345678"); mocks.session.mockResolvedValue(user);
    expect((await profile(req(dados))).status).toBe(200);
    expect(await ler(user.id)).toMatchObject({ cpf: null, phoneE164: user.phoneE164, onboardingStatus: "COMPLETE" });
    const outro = await usuario("+12025550123"); mocks.session.mockResolvedValue(outro);
    expect((await profile(req(dados))).status).toBe(200);
    expect((await ler(outro.id)).cpf).toBeNull(); // dois nulls permitidos pelo índice real
    await expect(usuario(user.phoneE164)).rejects.toThrow();
  });

  it("não dispensa CPF brasileiro por idioma, país ou telefone enviados no corpo", async () => {
    const user = await usuario("+5511987654321"); mocks.session.mockResolvedValue(user);
    expect((await profile(req({ ...dados, country: "PT", phone: "+351912345678", idioma: "en" }))).status).toBe(400);
    expect((await ler(user.id)).onboardingStatus).toBe("PROFILE_PENDING");
    expect((await profile(req({ ...dados, cpf: "529.982.247-25" }))).status).toBe(200);
    expect((await ler(user.id)).cpf).toBe("52998224725");
  });

  it.each([null, "+351912345678"])("não conclui sem telefone verificado: %s", async (phone) => {
    const user = await usuario(phone, false); mocks.session.mockResolvedValue(user);
    expect((await profile(req(dados))).status).toBe(401);
    expect((await ler(user.id)).passwordHash).toBeNull();
  });

  it("não coleta CPF enviado indevidamente no cadastro estrangeiro", async () => {
    const user = await usuario("+351912345678"); mocks.session.mockResolvedValue(user);
    expect((await profile(req({ ...dados, cpf: "52998224725" }))).status).toBe(400);
    expect((await ler(user.id)).cpf).toBeNull();
  });

  it("a restrição real do banco resolve cadastros concorrentes com o mesmo CPF", async () => {
    const a = await usuario("+5511987654321"), b = await usuario("+5521987654321");
    mocks.session.mockResolvedValueOnce(a).mockResolvedValueOnce(b);
    const resultados = await Promise.all([profile(req({ ...dados, cpf: "52998224725" })), profile(req({ ...dados, cpf: "52998224725" }))]);
    expect(resultados.map((r) => r.status).sort()).toEqual([200, 409]);
    expect([await ler(a.id), await ler(b.id)].filter((u) => u.onboardingStatus === "COMPLETE")).toHaveLength(1);
  });

  it("uma gravação antiga não conclui perfil após mudança do telefone", async () => {
    const user = await usuario("+351912345678");
    await db.update(schema.users).set({ phoneE164: "+5511987654321" }).where(eq(schema.users.id, user.id));
    expect(await completeProfile(user, { ...dados, passwordHash: "hash-sintetico", cpf: null })).toBe(false);
    expect((await ler(user.id)).onboardingStatus).toBe("PROFILE_PENDING");
  });

  it("não altera a apresentação do formulário brasileiro e omite o campo estrangeiro", () => {
    expect(renderToStaticMarkup(createElement(PerfilForm, { exigeCpf: true }))).toContain('name="cpf"');
    const estrangeiro = renderToStaticMarkup(createElement(PerfilForm, { exigeCpf: false }));
    expect(estrangeiro).not.toContain('name="cpf"');
    expect(estrangeiro).toContain("não exige CPF");
    expect(cpfObrigatorioParaTelefone({ phoneE164: "+5511987654321", phoneVerifiedAt: new Date() })).toBe(true);
  });
});

describe("confirmação de telefone e proteção de troca", () => {
  it("só approved avança e cria sessão; a confirmação estrangeira não preenche CPF", async () => {
    const user = await usuario(null, false, "PHONE_PENDING"); mocks.session.mockResolvedValue(user);
    mocks.check.mockResolvedValueOnce({ status: "pending" });
    const body = { country: "PT", phone: "912345678", code: "123456" };
    expect((await phoneCheck(req(body))).status).toBe(400);
    expect(mocks.createSession).not.toHaveBeenCalled();
    expect((await ler(user.id)).phoneE164).toBeNull();
    expect((await phoneCheck(req(body))).status).toBe(200);
    expect(await ler(user.id)).toMatchObject({ phoneE164: "+351912345678", cpf: null, onboardingStatus: "PROFILE_PENDING" });
    expect(mocks.createSession).toHaveBeenCalledOnce();
    // Mesmo snapshot de sessão: segunda confirmação não rebaixa nem troca o número.
    expect((await phoneCheck(req({ ...body, phone: "913456789" }))).status).toBe(409);
    expect((await ler(user.id)).phoneE164).toBe("+351912345678");
  });

  it("duas contas não conseguem reivindicar o mesmo telefone simultaneamente", async () => {
    const a = await usuario(null, false, "PHONE_PENDING"), b = await usuario(null, false, "PHONE_PENDING");
    mocks.session.mockResolvedValueOnce(a).mockResolvedValueOnce(b);
    const body = { country: "US", phone: "2025550123", code: "123456" };
    const respostas = await Promise.all([phoneCheck(req(body)), phoneCheck(req(body))]);
    expect(respostas.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(mocks.createSession).toHaveBeenCalledOnce();
  });

  it("bloqueia país real não permitido antes de qualquer chamada ao provedor", async () => {
    vi.stubEnv("SMS_PAISES_PERMITIDOS", "");
    const user = await usuario(null, false, "PHONE_PENDING"); mocks.session.mockResolvedValue(user);
    const body = { country: "BR", phone: "+351912345678", code: "123456" };
    expect((await phoneStart(req(body))).status).toBe(400);
    expect((await phoneCheck(req(body))).status).toBe(400);
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.check).not.toHaveBeenCalled();
  });

  it("não contorna CPF trocando estrangeiro por +55 após concluir o cadastro", async () => {
    const user = await usuario("+351912345678", true, "COMPLETE"); mocks.session.mockResolvedValue(user);
    const body = { country: "PT", phone: "+5511987654321", code: "123456" };
    expect((await changeStart(req(body))).status).toBe(400);
    expect((await changeCheck(req(body))).status).toBe(400);
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.check).not.toHaveBeenCalled();
    expect((await ler(user.id)).phoneE164).toBe("+351912345678");
  });
});
