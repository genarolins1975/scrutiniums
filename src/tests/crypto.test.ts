import { describe, expect, it } from "vitest";
import { generateOtp, hashToken, maskEmail, maskPhone } from "@/lib/crypto";

describe("crypto", () => {
  describe("hashToken", () => {
    it("é determinístico para a mesma entrada", () => {
      expect(hashToken("123456")).toBe(hashToken("123456"));
      expect(hashToken("123456")).not.toBe(hashToken("123457"));
    });

    it("produz 64 caracteres hexadecimais (SHA-256)", () => {
      expect(hashToken("qualquer coisa")).toMatch(/^[0-9a-f]{64}$/);
      expect(hashToken("")).toMatch(/^[0-9a-f]{64}$/);
    });

    it("corresponde ao SHA-256 conhecido de 'abc'", () => {
      expect(hashToken("abc")).toBe(
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      );
    });
  });

  describe("generateOtp", () => {
    it("sempre retorna exatamente 6 dígitos", () => {
      for (let i = 0; i < 500; i++) {
        expect(generateOtp()).toMatch(/^\d{6}$/);
      }
    });
  });

  describe("maskPhone", () => {
    it("mascara telefone BR mantendo DDI e últimos 4 dígitos", () => {
      expect(maskPhone("+5511987654321")).toBe("+55 •• •••••-4321");
    });

    it("nunca expõe os dígitos do meio", () => {
      const masked = maskPhone("+5511987654321");
      expect(masked).not.toContain("98765");
      expect(masked.endsWith("4321")).toBe(true);
    });
  });

  describe("maskEmail", () => {
    it("mascara usuário e domínio preservando o TLD", () => {
      expect(maskEmail("genaro@gmail.com")).toBe("g•••@g•••.com");
      expect(maskEmail("ana.silva@empresa.com.br")).toBe("a•••@e•••.br");
    });

    it("retorna máscara total para valores sem domínio", () => {
      expect(maskEmail("sem-arroba")).toBe("•••");
    });

    it("não contém o e-mail original", () => {
      expect(maskEmail("genaro@gmail.com")).not.toContain("genaro");
    });
  });
});
