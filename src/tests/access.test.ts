import { afterEach, describe, expect, it } from "vitest";
import { isValidAccessCode } from "@/lib/access";

// isValidAccessCode lê process.env.ACCESS_CODES a cada chamada, então cada
// teste define a lista que precisa e o afterEach restaura o ambiente.

const ORIGINAL = process.env.ACCESS_CODES;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ACCESS_CODES;
  else process.env.ACCESS_CODES = ORIGINAL;
});

describe("access.isValidAccessCode", () => {
  it("aceita código presente na lista", () => {
    process.env.ACCESS_CODES = "SCRUT-2026,CONVIDADO-01";
    expect(isValidAccessCode("SCRUT-2026")).toBe(true);
    expect(isValidAccessCode("CONVIDADO-01")).toBe(true);
  });

  it("rejeita código ausente da lista sem revelar nada", () => {
    process.env.ACCESS_CODES = "SCRUT-2026,CONVIDADO-01";
    expect(isValidAccessCode("SCRUT-2027")).toBe(false);
    expect(isValidAccessCode("QUALQUER")).toBe(false);
    expect(isValidAccessCode("")).toBe(false);
  });

  it("lista vazia ou ausente: nenhum código é válido (acesso fechado por padrão)", () => {
    process.env.ACCESS_CODES = "";
    expect(isValidAccessCode("SCRUT-2026")).toBe(false);

    delete process.env.ACCESS_CODES;
    expect(isValidAccessCode("SCRUT-2026")).toBe(false);
    expect(isValidAccessCode("")).toBe(false);
  });

  it("compara case-insensitive nos dois lados", () => {
    process.env.ACCESS_CODES = "Scrut-2026";
    expect(isValidAccessCode("scrut-2026")).toBe(true);
    expect(isValidAccessCode("SCRUT-2026")).toBe(true);
    expect(isValidAccessCode("sCrUt-2026")).toBe(true);
  });

  it("tolera espaços na lista e na entrada (trim)", () => {
    process.env.ACCESS_CODES = "  SCRUT-2026 , CONVIDADO-01  ";
    expect(isValidAccessCode("  scrut-2026  ")).toBe(true);
    expect(isValidAccessCode("convidado-01")).toBe(true);
    // Espaço interno não é removido: o código precisa bater após o trim.
    expect(isValidAccessCode("SCRUT - 2026")).toBe(false);
  });

  it("vírgulas sobrando não criam código vazio válido", () => {
    process.env.ACCESS_CODES = ",SCRUT-2026,,";
    expect(isValidAccessCode("")).toBe(false);
    expect(isValidAccessCode("   ")).toBe(false);
    expect(isValidAccessCode("SCRUT-2026")).toBe(true);
  });
});
