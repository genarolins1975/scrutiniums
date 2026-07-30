import { NextResponse } from "next/server";
import { z } from "zod";
import { checkEmailCode, findUserByEmail, nextStepPath, updateUser } from "@/lib/onboarding";
import { createSession } from "@/lib/session";
import { checkRateLimit, POLICIES, requestIp } from "@/lib/ratelimit";
import { trackEvent } from "@/lib/events";
import type { OnboardingStatus } from "@/lib/schema";
import {
  clearSignedEmailCookie,
  ONBOARDING_EMAIL_COOKIE,
  readSignedEmailCookie,
} from "@/components/onboarding/signedEmailCookie";

export const runtime = "nodejs";

/**
 * Confere o código de verificação de e-mail (etapa 1).
 * Erros sempre genéricos ("Código inválido ou expirado"): não revelam
 * se o e-mail existe, se a conta está completa ou o motivo exato da falha.
 */

const GENERIC_ERROR = "Código inválido ou expirado.";

const bodySchema = z.object({ code: z.string().regex(/^\d{6}$/) });

function rateLimited(retryAfterMs: number) {
  return NextResponse.json(
    { error: "Muitas tentativas. Aguarde e tente novamente." },
    { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) } },
  );
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const email = readSignedEmailCookie(ONBOARDING_EMAIL_COOKIE);
  if (!email) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const ip = requestIp(req);
  const perIp = checkRateLimit(`email-check:ip:${ip}`, POLICIES.otpCheckPerPhone);
  if (!perIp.allowed) return rateLimited(perIp.retryAfterMs);
  const perEmail = checkRateLimit(`email-check:email:${email}`, POLICIES.otpCheckPerPhone);
  if (!perEmail.allowed) return rateLimited(perEmail.retryAfterMs);

  const user = await findUserByEmail(email);
  if (!user || user.onboardingStatus === "COMPLETE") {
    // Conta inexistente ou já completa (fluxo de cadastro não se aplica).
    await trackEvent("verification_failed", user?.id);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const result = await checkEmailCode(user.id, "EMAIL_VERIFY", parsed.data.code);
  if (result !== "approved") {
    await trackEvent("verification_failed", user.id);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // Retomável: se o usuário já passou desta etapa antes, preserva o progresso.
  const status: OnboardingStatus =
    user.onboardingStatus === "EMAIL_PENDING"
      ? "PHONE_PENDING"
      : (user.onboardingStatus as OnboardingStatus);

  await updateUser(user.id, { emailVerifiedAt: new Date(), onboardingStatus: status });
  await createSession(user.id);
  await trackEvent("email_verified", user.id);
  clearSignedEmailCookie(ONBOARDING_EMAIL_COOKIE);

  return NextResponse.json({ ok: true, next: nextStepPath(status) });
}
