import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";

/** Hash SHA-256 para tokens e códigos. Nunca gravar valores em claro. */
export function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/** Código numérico de 6 dígitos criptograficamente aleatório. */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Mascara telefone E.164 para exibição: +55 •• •••••-4321 */
export function maskPhone(e164: string): string {
  const last4 = e164.slice(-4);
  // Extrai o DDI real (1 a 3 dígitos) sem depender de país fixo.
  const parsed = parsePhoneNumberFromString(e164);
  const cc = parsed ? `+${parsed.countryCallingCode}` : e164.slice(0, 3);
  return `${cc} •• •••••-${last4}`;
}

/** Mascara e-mail para logs e auditoria: g•••@g•••.com */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  return `${user[0]}•••@${domain[0]}•••${domain.slice(domain.lastIndexOf("."))}`;
}
