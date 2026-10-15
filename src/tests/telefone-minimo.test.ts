import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { digitosMinimosTelefone } from "@/lib/telefone-minimo";

/**
 * Com SMS_PAISES_PERMITIDOS liberando países de numeração curta (Islândia,
 * sete dígitos), o formulário não pode barrar no navegador o que o servidor
 * aceitaria. O Brasil mantém o mínimo de oito dígitos.
 */
describe("mínimo de dígitos do telefone no navegador", () => {
  it("Brasil exige oito; demais países deixam a validade para o servidor", () => {
    expect(digitosMinimosTelefone("BR")).toBe(8);
    expect(digitosMinimosTelefone("br")).toBe(8);
    expect(digitosMinimosTelefone("IS")).toBeLessThanOrEqual(7);
  });

  it("os formulários de cadastro e de entrada por SMS usam a regra por país", () => {
    for (const f of ["src/components/onboarding/TelefoneForm.tsx", "src/components/onboarding/EntrarForm.tsx"]) {
      const s = readFileSync(join(process.cwd(), f), "utf-8");
      expect(s).toContain("digitosMinimosTelefone(country)");
      expect(s).not.toMatch(/length < 8\b/);
    }
  });
});
