import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByVerifiedPhone, nextStepPath } from "@/lib/onboarding";
import { createSession } from "@/lib/session";
import { checkPhoneVerification } from "@/lib/twilio";
import { checkRateLimit, POLICIES, requestIp } from "@/lib/ratelimit";
import { trackEvent } from "@/lib/events";
import type { OnboardingStatus } from "@/lib/schema";
import {
  clearSignedPhoneCookie,
  LOGIN_PHONE_COOKIE,
  readSignedPhoneCookie,
  setRecuperacaoSenhaCookie,
} from "@/components/onboarding/signedEmailCookie";

export const runtime = "nodejs";

/**
 * Conferência do código SMS de acesso (login sem senha). Ao aprovar,
 * cria a sessão e devolve nextStepPath(status): onboarding incompleto
 * é retomado da etapa correta. Erros sempre genéricos.
 * Com `recuperar` (esqueci minha senha) e cadastro completo, abre a janela
 * de 10 minutos para definir nova senha sem a atual e leva direto a ela.
 */

const GENERIC_ERROR = "Código inválido ou expirado.";

const bodySchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  recuperar: z.boolean().optional(),
});

function rateLimited(retryAfterMs: number) {
  return NextResponse.json(
    { error: "Muitas tentativas. Aguarde e tente novamente." },
    { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) } },
  );
}

export async function POST(req: Request) {
  const e164 = readSignedPhoneCookie(LOGIN_PHONE_COOKIE);
  if (!e164) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

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

  const ip = requestIp(req);
  const perIp = checkRateLimit(`login-check:ip:${ip}`, POLICIES.otpCheckPerPhone);
  if (!perIp.allowed) return rateLimited(perIp.retryAfterMs);
  const perPhone = checkRateLimit(`login-check:phone:${e164}`, POLICIES.otpCheckPerPhone);
  if (!perPhone.allowed) return rateLimited(perPhone.retryAfterMs);

  const result = await checkPhoneVerification(e164, parsed.data.code);
  if (result.status !== "approved") {
    await trackEvent("verification_failed");
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const user = await findUserByVerifiedPhone(e164);
  if (!user) {
    // Telefone sem conta verificada: nunca deveria ter código aprovado,
    // mas o erro segue genérico de qualquer forma.
    await trackEvent("verification_failed");
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  await createSession(user.id);
  clearSignedPhoneCookie(LOGIN_PHONE_COOKIE);

  const status = user.onboardingStatus as OnboardingStatus;
  // Cadastro incompleto retoma a etapa pendente, onde a senha é criada; conta
  // antiga sem senha a define direto em Conta, sem precisar da janela.
  if (parsed.data.recuperar && status === "COMPLETE") {
    if (user.passwordHash) setRecuperacaoSenhaCookie(user.id);
    return NextResponse.json({ ok: true, next: "/app/conta#senha" });
  }

  return NextResponse.json({ ok: true, next: nextStepPath(status) });
}
