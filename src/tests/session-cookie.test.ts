import { describe, expect, it } from "vitest";
import { signSessionCookie, verifySessionCookie } from "@/lib/sessionCookie";

const FUTURE = new Date(Date.now() + 60 * 60 * 1000);
const PAST = new Date(Date.now() - 60 * 1000);
const TOKEN = "a".repeat(64);

describe("sessionCookie", () => {
  it("assina e verifica um cookie válido", async () => {
    const value = await signSessionCookie(TOKEN, FUTURE);
    const verified = await verifySessionCookie(value);
    expect(verified).not.toBeNull();
    expect(verified!.token).toBe(TOKEN);
  });

  it("rejeita cookie vencido", async () => {
    const value = await signSessionCookie(TOKEN, PAST);
    expect(await verifySessionCookie(value)).toBeNull();
  });

  it("rejeita assinatura adulterada", async () => {
    const value = await signSessionCookie(TOKEN, FUTURE);
    const tampered = value.slice(0, -2) + (value.endsWith("00") ? "11" : "00");
    expect(await verifySessionCookie(tampered)).toBeNull();
  });

  it("rejeita token adulterado mantendo a assinatura", async () => {
    const value = await signSessionCookie(TOKEN, FUTURE);
    const parts = value.split(".");
    parts[1] = "b".repeat(64);
    expect(await verifySessionCookie(parts.join("."))).toBeNull();
  });

  it("rejeita expiração adulterada", async () => {
    const value = await signSessionCookie(TOKEN, FUTURE);
    const parts = value.split(".");
    parts[0] = String(Number(parts[0]) + 3600);
    expect(await verifySessionCookie(parts.join("."))).toBeNull();
  });

  it("rejeita formatos malformados e legado (token puro)", async () => {
    expect(await verifySessionCookie(null)).toBeNull();
    expect(await verifySessionCookie("")).toBeNull();
    expect(await verifySessionCookie(TOKEN)).toBeNull();
    expect(await verifySessionCookie("1.2")).toBeNull();
    expect(await verifySessionCookie("abc.def.ghi")).toBeNull();
    expect(await verifySessionCookie("999999999999999999." + TOKEN + "." + "0".repeat(64))).toBeNull();
  });
});
