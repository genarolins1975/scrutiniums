import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Garante o modo dev simulado: sem credenciais Twilio no ambiente.
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_VERIFY_SERVICE_SID;

// Import dinâmico: o módulo lê as variáveis de ambiente na carga.
let startPhoneVerification: typeof import("@/lib/twilio").startPhoneVerification;
let checkPhoneVerification: typeof import("@/lib/twilio").checkPhoneVerification;

beforeAll(async () => {
  const twilio = await import("@/lib/twilio");
  startPhoneVerification = twilio.startPhoneVerification;
  checkPhoneVerification = twilio.checkPhoneVerification;
});

function spyInfo() {
  return vi.spyOn(console, "info").mockImplementation(() => {});
}
let infoSpy: ReturnType<typeof spyInfo>;
beforeEach(() => {
  vi.restoreAllMocks();
  infoSpy = spyInfo();
});

/** Extrai o código do log de desenvolvimento "[dev-verify] ...: 123456". */
function lastDevCode(): string {
  const lines = infoSpy.mock.calls
    .map((args) => String(args[0]))
    .filter((line) => line.includes("[dev-verify]"));
  const match = lines.at(-1)?.match(/:\s*(\d{6})\s*$/);
  if (!match) throw new Error("código não encontrado no log de dev-verify");
  return match[1];
}

describe("twilio em modo dev simulado", () => {
  it("start retorna { ok: true } sem credenciais configuradas", async () => {
    const result = await startPhoneVerification("+5511911110001");
    expect(result).toEqual({ ok: true });
  });

  it("loga o código com telefone mascarado, nunca o número completo", async () => {
    await startPhoneVerification("+5511911110002");
    const line = infoSpy.mock.calls.map((a) => String(a[0])).find((l) => l.includes("[dev-verify]"));
    expect(line).toBeDefined();
    expect(line).toContain("+55 •• •••••-0002");
    expect(line).not.toContain("+5511911110002");
    expect(line).toMatch(/:\s*\d{6}\s*$/);
  });

  it("check sem start prévio → expired", async () => {
    const result = await checkPhoneVerification("+5511999990000", "123456");
    expect(result.status).toBe("expired");
  });

  it("código errado → pending (permite nova tentativa)", async () => {
    await startPhoneVerification("+5511911110003");
    const code = lastDevCode();
    const wrong = code === "000000" ? "000001" : "000000";
    const result = await checkPhoneVerification("+5511911110003", wrong);
    expect(result.status).toBe("pending");
  });

  it("código correto (capturado do log) → approved; reuso → expired", async () => {
    await startPhoneVerification("+5511911110004");
    const code = lastDevCode();

    const first = await checkPhoneVerification("+5511911110004", code);
    expect(first.status).toBe("approved");

    // A pendência é consumida na aprovação: reutilizar o código falha.
    const second = await checkPhoneVerification("+5511911110004", code);
    expect(second.status).toBe("expired");
  });

  it("falha após exceder o limite de tentativas", async () => {
    await startPhoneVerification("+5511911110005");
    const code = lastDevCode();
    const wrong = code === "000000" ? "000001" : "000000";

    for (let i = 0; i < 5; i++) {
      const r = await checkPhoneVerification("+5511911110005", wrong);
      expect(r.status).toBe("pending");
    }
    const locked = await checkPhoneVerification("+5511911110005", wrong);
    expect(locked.status).toBe("failed");
  });
});
