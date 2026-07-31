import { afterEach, describe, expect, it } from "vitest";
import { isAdmin } from "@/lib/admin";
import { conviteEmail } from "@/lib/mailer";

// isAdmin lê process.env.ADMIN_EMAILS a cada chamada, então cada teste
// define a lista que precisa e o afterEach restaura o ambiente.

const ORIGINAL = process.env.ADMIN_EMAILS;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = ORIGINAL;
});

describe("admin.isAdmin", () => {
  it("aceita e-mail presente na lista", () => {
    process.env.ADMIN_EMAILS = "dono@scrutiniums.com,socio@scrutiniums.com";
    expect(isAdmin({ email: "dono@scrutiniums.com" })).toBe(true);
    expect(isAdmin({ email: "socio@scrutiniums.com" })).toBe(true);
  });

  it("rejeita e-mail ausente da lista", () => {
    process.env.ADMIN_EMAILS = "dono@scrutiniums.com";
    expect(isAdmin({ email: "outro@scrutiniums.com" })).toBe(false);
    expect(isAdmin({ email: "" })).toBe(false);
  });

  it("lista vazia ou ausente: ninguém é admin (fechado por padrão)", () => {
    process.env.ADMIN_EMAILS = "";
    expect(isAdmin({ email: "dono@scrutiniums.com" })).toBe(false);

    delete process.env.ADMIN_EMAILS;
    expect(isAdmin({ email: "dono@scrutiniums.com" })).toBe(false);
  });

  it("compara case-insensitive nos dois lados", () => {
    process.env.ADMIN_EMAILS = "Dono@Scrutiniums.com";
    expect(isAdmin({ email: "dono@scrutiniums.com" })).toBe(true);
    expect(isAdmin({ email: "DONO@SCRUTINIUMS.COM" })).toBe(true);
  });

  it("tolera espaços na lista e na entrada (trim)", () => {
    process.env.ADMIN_EMAILS = "  dono@scrutiniums.com , socio@scrutiniums.com  ";
    expect(isAdmin({ email: "  dono@scrutiniums.com  " })).toBe(true);
    expect(isAdmin({ email: "socio@scrutiniums.com" })).toBe(true);
  });

  it("vírgulas sobrando não tornam e-mail vazio admin", () => {
    process.env.ADMIN_EMAILS = ",dono@scrutiniums.com,,";
    expect(isAdmin({ email: "" })).toBe(false);
    expect(isAdmin({ email: "   " })).toBe(false);
    expect(isAdmin({ email: "dono@scrutiniums.com" })).toBe(true);
  });

  it("usuário nulo ou indefinido nunca é admin", () => {
    process.env.ADMIN_EMAILS = "dono@scrutiniums.com";
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});

describe("mailer.conviteEmail", () => {
  it("tem o assunto institucional do convite", () => {
    const { subject } = conviteEmail("SCRUT-2026");
    expect(subject).toBe("Seu acesso à Scrutiniums foi liberado");
  });

  it("contém o código de acesso em linha própria", () => {
    const { text } = conviteEmail("SCRUT-2026");
    expect(text.split("\n")).toContain("SCRUT-2026");
  });

  it("contém o link de entrada e a instrução da etapa de acesso", () => {
    const { text } = conviteEmail("SCRUT-2026");
    expect(text).toContain("https://scrutiniums.com/entrar");
    expect(text).toContain("etapa de acesso");
    expect(text).toContain("Scrutiniums · 100% gratuito · sem assinatura · sem cobrança");
  });

  it("é texto puro, sem HTML", () => {
    const { subject, text } = conviteEmail("SCRUT-2026");
    expect(text).not.toMatch(/<[a-z!/][^>]*>/i);
    expect(subject).not.toMatch(/<[a-z!/][^>]*>/i);
  });
});
