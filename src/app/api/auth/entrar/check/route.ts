import { NextResponse } from "next/server";
import { z } from "zod";
import { checkEmailCode, findUserByEmail, nextStepPath } from "@/lib/onboarding";
import { createSession } from "@/lib/session";
import { checkRateLimit, POLICIES, requestIp } from "@/lib/ratelimit";
import { trackEvent } from "@/lib/events";
import type { OnboardingStatus } from "@/lib/schema";
import {
  clearSignedEmailCookie,
  LOGIN_EMAIL_COOKIE,
  readSignedEmailCookie,
} from "@/components/onboarding/signedEmailCookie";

export const runtime = "nodejs";

/**
 * Conferência do código de acesso (login sem senha). Ao aprovar,
 * cria a sessão e devolve nextStepPath(status): onboarding incompleto
 * é retomado da etapa correta. Erros sempre genéricos.
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

  const email = readSignedEmailCookie(LOGIN_EMAIL_COOKIE);
  if (!email) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const ip = requestIp(req);
  const perIp = checkRateLimit(`login-check:ip:${ip}`, POLICIES.otpCheckPerPhone);
  if (!perIp.allowed) return rateLimited(perIp.retryAfterMs);
  const perEmail = checkRateLimit(`login-check:email:${email}`, POLICIES.otpCheckPerPhone);
  if (!perEmail.allowed) return rateLimited(perEmail.retryAfterMs);

  const user = findUserByEmail(email);
  if (!user) {
    await trackEvent("verification_failed");
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const result = checkEmailCode(user.id, "LOGIN", parsed.data.code);
  if (result !== "approved") {
    await trackEvent("verification_failed", user.id);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  await createSession(user.id);
  clearSignedEmailCookie(LOGIN_EMAIL_COOKIE);

  return NextResponse.json({
    ok: true,
    next: nextStepPath(user.onboardingStatus as OnboardingStatus),
  });
}
