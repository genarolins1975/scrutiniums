import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Cookies httpOnly assinados (HMAC-SHA256) para guardar um valor pendente
 * entre etapas do cadastro/login (e-mail de contato ou telefone E.164).
 * Nunca colocar e-mail ou telefone em URL: sempre cookie ou corpo de POST.
 * O formato assinado é o mesmo para e-mail e telefone (base64url + HMAC),
 * preservando a compatibilidade com cookies emitidos pelo cadastro.
 */

export const ONBOARDING_EMAIL_COOKIE = "onboarding_email";
export const LOGIN_PHONE_COOKIE = "login_phone";

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

function setSignedCookie(name: string, value: string): void {
  const payload = `${Buffer.from(value, "utf8").toString("base64url")}.${sign(value)}`;
  cookies().set(name, payload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

function readSignedCookie(name: string): string | null {
  const raw = cookies().get(name)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  let value: string;
  try {
    value = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = sign(value);
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return value;
}

export function setSignedEmailCookie(name: string, email: string): void {
  setSignedCookie(name, email.toLowerCase().trim());
}

export function readSignedEmailCookie(name: string): string | null {
  return readSignedCookie(name);
}

export function clearSignedEmailCookie(name: string): void {
  cookies().delete(name);
}

/** Helpers análogos para o telefone E.164 pendente do login por SMS. */
export function setSignedPhoneCookie(name: string, phoneE164: string): void {
  setSignedCookie(name, phoneE164.trim());
}

export function readSignedPhoneCookie(name: string): string | null {
  return readSignedCookie(name);
}

export function clearSignedPhoneCookie(name: string): void {
  cookies().delete(name);
}
