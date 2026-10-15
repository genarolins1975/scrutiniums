import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POLICIES } from "@/lib/ratelimit";

let start: typeof import("@/lib/twilio").startPhoneVerification;
let check: typeof import("@/lib/twilio").checkPhoneVerification;
beforeAll(async () => {
  vi.stubEnv("TWILIO_ACCOUNT_SID", ""); vi.stubEnv("TWILIO_AUTH_TOKEN", ""); vi.stubEnv("TWILIO_VERIFY_SERVICE_SID", "");
  ({ startPhoneVerification: start, checkPhoneVerification: check } = await import("@/lib/twilio"));
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("SMS_PAISES_PERMITIDOS", "BR,PT,US");
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("proteção comum a todos os envios SMS", () => {
  it("rejeita país desabilitado e não cria uma verificação simulada", async () => {
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    vi.stubEnv("SMS_PAISES_PERMITIDOS", "BR");
    expect(await start("+351912345678")).toEqual({ ok: false, reason: "invalid" });
    expect(await check("+351912345678", "123456")).toEqual({ status: "failed" });
    expect(console.info).not.toHaveBeenCalled();
  });

  it("limita números diferentes do mesmo prefixo antes de atingir o teto do país", async () => {
    vi.setSystemTime(new Date("2030-01-02T00:00:00Z"));
    for (let i = 0; i < POLICIES.smsPorPrefixo.max; i++) {
      expect(await start("+351912345" + String(100 + i))).toEqual({ ok: true });
    }
    expect(await start("+351912345999")).toEqual({ ok: false, reason: "rate_limited" });
    expect(await start("+351913456789")).toEqual({ ok: true });
    expect(console.info).toHaveBeenCalledTimes(POLICIES.smsPorPrefixo.max + 1);
  });

  it("também limita o país quando se alternam prefixos válidos", async () => {
    vi.setSystemTime(new Date("2030-01-03T00:00:00Z"));
    const prefixos = ["11", "21", "31", "41", "51", "61"];
    for (let i = 0; i < POLICIES.smsPorPais.max; i++) {
      expect(await start(`+55${prefixos[i % prefixos.length]}98765${String(1000 + i)}`)).toEqual({ ok: true });
    }
    expect(await start("+5571987654321")).toEqual({ ok: false, reason: "rate_limited" });
    expect(await start("+12025550123")).toEqual({ ok: true });
  });

  it("não emite OTP simulado em produção sem credenciais", async () => {
    vi.setSystemTime(new Date("2030-01-04T00:00:00Z"));
    vi.stubEnv("NODE_ENV", "production");
    expect(await start("+12025550123")).toEqual({ ok: false, reason: "error" });
    expect(await check("+12025550123", "123456")).toEqual({ status: "failed" });
    expect(console.info).not.toHaveBeenCalled();
  });
});
