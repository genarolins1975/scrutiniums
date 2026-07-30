import { describe, expect, it } from "vitest";
import { COUNTRIES, toE164 } from "@/lib/phone";

describe("phone.toE164", () => {
  it("normaliza celular brasileiro para E.164", () => {
    expect(toE164("BR", "11987654321")).toBe("+5511987654321");
  });

  it("aceita formatação com máscara e espaços", () => {
    expect(toE164("BR", "(11) 98765-4321")).toBe("+5511987654321");
  });

  it("retorna null para número inválido no país", () => {
    expect(toE164("BR", "123")).toBeNull();
    expect(toE164("BR", "999999999999999")).toBeNull();
    expect(toE164("BR", "abc")).toBeNull();
  });

  it("normaliza números de Portugal (PT)", () => {
    expect(toE164("PT", "912345678")).toBe("+351912345678");
  });

  it("normaliza números dos Estados Unidos (US)", () => {
    expect(toE164("US", "2025550123")).toBe("+12025550123");
  });

  it("número válido em um país pode ser inválido em outro", () => {
    // Celular BR de 11 dígitos não é um número válido nos EUA.
    expect(toE164("US", "11987654321")).toBeNull();
  });
});

describe("phone.COUNTRIES", () => {
  it("contém BR, PT e US com DDIs corretos", () => {
    const byCode = new Map(COUNTRIES.map((c) => [c.code, c.ddi]));
    expect(byCode.get("BR")).toBe("+55");
    expect(byCode.get("PT")).toBe("+351");
    expect(byCode.get("US")).toBe("+1");
  });

  it("não tem códigos duplicados", () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
