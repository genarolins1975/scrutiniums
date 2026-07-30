/**
 * Integração server-side com Twilio Verify.
 * As credenciais existem SOMENTE no servidor (variáveis de ambiente).
 * O frontend nunca acessa a API da Twilio nem recebe credenciais.
 *
 * Sem credenciais configuradas (desenvolvimento), opera em modo simulado:
 * o código é registrado apenas no log do servidor, nunca persistido.
 */
import twilio from "twilio";
import { maskPhone } from "./crypto";

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

const isConfigured = Boolean(ACCOUNT_SID && AUTH_TOKEN && VERIFY_SERVICE_SID);

// Modo dev: mantém pendências em memória. Nunca usado em produção.
const devPending = new Map<string, { code: string; expiresAt: number; attempts: number }>();
const DEV_TTL_MS = 10 * 60 * 1000;
const DEV_MAX_ATTEMPTS = 5;

function client() {
  return twilio(ACCOUNT_SID!, AUTH_TOKEN!);
}

export type VerifyStartResult = { ok: true } | { ok: false; reason: "rate_limited" | "invalid" | "error" };
export type VerifyCheckResult = { status: "approved" | "pending" | "expired" | "failed" };

export async function startPhoneVerification(phoneE164: string): Promise<VerifyStartResult> {
  if (!isConfigured) {
    const { generateOtp } = await import("./crypto");
    const code = generateOtp();
    devPending.set(phoneE164, { code, expiresAt: Date.now() + DEV_TTL_MS, attempts: 0 });
    // Log de desenvolvimento: telefone mascarado, nunca em produção.
    console.info(`[dev-verify] código para ${maskPhone(phoneE164)}: ${code}`);
    return { ok: true };
  }
  try {
    await client()
      .verify.v2.services(VERIFY_SERVICE_SID!)
      .verifications.create({ to: phoneE164, channel: "sms" });
    return { ok: true };
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 429) return { ok: false, reason: "rate_limited" };
    if (status === 400) return { ok: false, reason: "invalid" };
    console.error("[twilio] falha ao iniciar verificação", { status });
    return { ok: false, reason: "error" };
  }
}

export async function checkPhoneVerification(
  phoneE164: string,
  code: string,
): Promise<VerifyCheckResult> {
  if (!isConfigured) {
    const pending = devPending.get(phoneE164);
    if (!pending) return { status: "expired" };
    if (Date.now() > pending.expiresAt) {
      devPending.delete(phoneE164);
      return { status: "expired" };
    }
    pending.attempts += 1;
    if (pending.attempts > DEV_MAX_ATTEMPTS) {
      devPending.delete(phoneE164);
      return { status: "failed" };
    }
    if (pending.code === code) {
      devPending.delete(phoneE164);
      return { status: "approved" };
    }
    return { status: "pending" };
  }
  try {
    const result = await client()
      .verify.v2.services(VERIFY_SERVICE_SID!)
      .verificationChecks.create({ to: phoneE164, code });
    if (result.status === "approved") return { status: "approved" };
    return { status: "pending" };
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    // 404: verificação expirada ou inexistente
    if (status === 404) return { status: "expired" };
    console.error("[twilio] falha no verification check", { status });
    return { status: "failed" };
  }
}
