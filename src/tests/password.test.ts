import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/password";

describe("password (scrypt)", () => {
  describe("hashPassword", () => {
    it("produz o formato scrypt:N:r:p:saltHex:hashHex com os parâmetros esperados", async () => {
      const stored = await hashPassword("senha1234");
      const parts = stored.split(":");
      expect(parts).toHaveLength(6);
      expect(parts[0]).toBe("scrypt");
      expect(parts[1]).toBe("16384");
      expect(parts[2]).toBe("8");
      expect(parts[3]).toBe("1");
      expect(parts[4]).toMatch(/^[0-9a-f]{32}$/); // salt de 16 bytes
      expect(parts[5]).toMatch(/^[0-9a-f]{64}$/); // chave de 32 bytes
    });

    it("gera salts diferentes: hashes distintos para a mesma senha", async () => {
      const a = await hashPassword("senha1234");
      const b = await hashPassword("senha1234");
      expect(a).not.toBe(b);
    });

    it("rejeita senha menor que o mínimo", async () => {
      await expect(hashPassword("a".repeat(PASSWORD_MIN_LENGTH - 1))).rejects.toThrow();
    });

    it("rejeita senha maior que o máximo", async () => {
      await expect(hashPassword("a".repeat(PASSWORD_MAX_LENGTH + 1))).rejects.toThrow();
    });

    it("aceita senhas exatamente nos limites (8 e 72)", async () => {
      const min = await hashPassword("a".repeat(PASSWORD_MIN_LENGTH));
      const max = await hashPassword("a".repeat(PASSWORD_MAX_LENGTH));
      await expect(verifyPassword("a".repeat(PASSWORD_MIN_LENGTH), min)).resolves.toBe(true);
      await expect(verifyPassword("a".repeat(PASSWORD_MAX_LENGTH), max)).resolves.toBe(true);
    });
  });

  describe("verifyPassword", () => {
    it("aprova a senha correta", async () => {
      const stored = await hashPassword("senha1234");
      await expect(verifyPassword("senha1234", stored)).resolves.toBe(true);
    });

    it("reprova senha errada", async () => {
      const stored = await hashPassword("senha1234");
      await expect(verifyPassword("senha5678", stored)).resolves.toBe(false);
      await expect(verifyPassword("Senha1234", stored)).resolves.toBe(false);
      await expect(verifyPassword("", stored)).resolves.toBe(false);
    });

    it("retorna false para stored null/undefined/vazio", async () => {
      await expect(verifyPassword("senha1234", null)).resolves.toBe(false);
      await expect(verifyPassword("senha1234", undefined)).resolves.toBe(false);
      await expect(verifyPassword("senha1234", "")).resolves.toBe(false);
    });

    it("retorna false para stored malformado, sem lançar", async () => {
      const casos = [
        "bcrypt:whatever",
        "scrypt:16384:8:1", // partes faltando
        "scrypt:16384:8:1:zz:zz", // hex inválido
        "scrypt:abc:8:1:aabb:ccdd", // N não numérico
        "scrypt:0:8:1:aabb:ccdd", // N inválido
        "scrypt:16383:8:1:aabb:ccdd", // N não potência de 2
        "scrypt:16384:8:1:aabb:ccdd:extra", // partes demais
        "scrypt:16384:8:1::", // salt/hash vazios
        "lixo qualquer",
      ];
      for (const stored of casos) {
        await expect(verifyPassword("senha1234", stored)).resolves.toBe(false);
      }
    });

    it("suporta unicode e senhas com espaços", async () => {
      const stored = await hashPassword("coração móvel 12345");
      await expect(verifyPassword("coração móvel 12345", stored)).resolves.toBe(true);
      await expect(verifyPassword("coracao movel 12345", stored)).resolves.toBe(false);
    });
  });
});
