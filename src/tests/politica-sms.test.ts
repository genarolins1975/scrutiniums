import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { paisesSmsPermitidos, paisDoTelefone, smsPermitido, opcoesPaisSms } from "@/lib/politica-sms";
import { cpfObrigatorioParaTelefone } from "@/lib/cpf-telefone";
import { COUNTRIES, toE164 } from "@/lib/phone";

beforeEach(() => { vi.stubEnv("SMS_PAISES_PERMITIDOS", ""); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("política de SMS pelo país real", () => {
  it("permite só Brasil por padrão e falha fechado para configuração desconhecida", () => {
    expect(paisesSmsPermitidos()).toEqual(["BR"]);
    expect(smsPermitido("+5511987654321")).toBe(true);
    expect(smsPermitido("+351912345678")).toBe(false);
    expect(paisesSmsPermitidos(" BR,pt,PT ")).toEqual(["BR", "PT"]);
    expect(paisesSmsPermitidos("BR,ZZ")).toEqual([]);
    expect(paisesSmsPermitidos("BR,")).toEqual([]);
    expect(opcoesPaisSms().map((p) => p.code)).toEqual(["BR"]);
  });
  it("amplia o catálogo sem habilitar destinos e distingue países com o mesmo DDI", () => {
    expect(COUNTRIES.length).toBeGreaterThan(200);
    vi.stubEnv("SMS_PAISES_PERMITIDOS", "US,PT");
    expect(paisDoTelefone("+14165550123")).toBe("CA");
    expect(smsPermitido("+14165550123")).toBe(false);
    expect(smsPermitido("+12025550123")).toBe(true);
    expect(smsPermitido("+351912345678")).toBe(true);
    expect(smsPermitido("+5511987654321")).toBe(false);
    expect(opcoesPaisSms().map((p) => p.code).sort()).toEqual(["PT", "US"]);
  });
  it("não usa o país escolhido para dispensar CPF ou permitir um destino internacional", () => {
    const br = toE164("PT", "+5511987654321")!;
    expect(cpfObrigatorioParaTelefone({ phoneE164: br, phoneVerifiedAt: new Date() })).toBe(true);
    const pt = toE164("BR", "+351912345678")!;
    expect(smsPermitido(pt)).toBe(false);
    expect(toE164("ZZ", "123456789")).toBeNull();
    expect(toE164("BR", "texto +5511987654321 texto")).toBeNull();
  });
  it.each(["123", "+999123456789", "(11) 98765-4321"])("rejeita telefone não canônico: %s", (phoneE164) => {
    expect(smsPermitido(phoneE164)).toBe(false);
    expect(cpfObrigatorioParaTelefone({ phoneE164, phoneVerifiedAt: new Date() })).toBeNull();
  });
});
