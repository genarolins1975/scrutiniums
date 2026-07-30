import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Cookie httpOnly assinado (HMAC-SHA256) para guardar o e-mail pendente
 * entre a etapa de envio e a de verificação do código.
 * Nunca colocar e-mail em URL: sempre cookie ou corpo de POST.
 */

export const ONBOARDING_EMAIL_COOKIE = "onboarding_email";
export const LOGIN_EMAIL_COOKIE = "login_email";

const MAX_AGE_SECONDS = 30 * 60; // 30 minutos

function secret(): string {
  return (
    process.env.COOKIE_SECRET ??
    process.env.SESSION_SECRET ??
    // Fallback apenas para desenvolvimento local.
    "scrutiniums-dev-cookie-secret"
  );
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function setSignedEmailCookie(name: string, email: string): void {
  const normalized = email.toLowerCase().trim();
  const payload = `${Buffer.from(normalized, "utf8").toString("base64url")}.${sign(normalized)}`;
  cookies().set(name, payload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function readSignedEmailCookie(name: string): string | null {
  const raw = cookies().get(name)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  let email: string;
  try {
    email = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = sign(email);
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return email;
}

export function clearSignedEmailCookie(name: string): void {
  cookies().delete(name);
}
