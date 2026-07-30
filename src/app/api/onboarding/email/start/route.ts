import { NextResponse } from "next/server";
import { z } from "zod";
import {
  PRIVACY_VERSION,
  findUserByEmail,
  startEmailVerification,
  updateUser,
} from "@/lib/onboarding";
import { checkRateLimit, POLICIES, requestIp } from "@/lib/ratelimit";
import { trackEvent } from "@/lib/events";
import {
  ONBOARDING_EMAIL_COOKIE,
  readSignedEmailCookie,
  setSignedEmailCookie,
} from "@/components/onboarding/signedEmailCookie";

export const runtime = "nodejs";

/**
 * Início da verificação de e-mail (etapa 1 do onboarding).
 * Resposta SEMPRE genérica (200) para bloquear enumeração de contas —
 * inclusive quando o e-mail já pertence a um cadastro COMPLETO
 * (nesse caso nenhum código de cadastro é enviado; o acesso é por /entrar).
 */

const GENERIC_MESSAGE = "Se o e-mail for válido, enviamos um código.";

const bodySchema = z.union([
  z.object({
    email: z.string().email().max(254),
    termsAccepted: z.literal(true),
    marketingOptIn: z.boolean().optional(),
  }),
  // Reenvio: o e-mail pendente vem do cookie httpOnly assinado.
  z.object({ resend: z.literal(true) }),
]);

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
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const isResend = "resend" in parsed.data;
  const rawEmail = isResend
    ? readSignedEmailCookie(ONBOARDING_EMAIL_COOKIE)
    : (parsed.data as { email: string }).email;
  if (!rawEmail || !z.string().email().max(254).safeParse(rawEmail).success) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const email = rawEmail.toLowerCase().trim();
  const ip = requestIp(req);

  const perIp = checkRateLimit(`email-start:ip:${ip}`, POLICIES.emailStartPerIp);
  if (!perIp.allowed) return rateLimited(perIp.retryAfterMs);
  const perEmail = checkRateLimit(`email-start:email:${email}`, POLICIES.emailStartPerEmail);
  if (!perEmail.allowed) return rateLimited(perEmail.retryAfterMs);
  const resendGap = checkRateLimit(`email-start:resend:${email}`, POLICIES.resendMinInterval);
  if (!resendGap.allowed) return rateLimited(resendGap.retryAfterMs);

  const existing = findUserByEmail(email);
  const isNew = !existing;

  if (existing && existing.onboardingStatus === "COMPLETE") {
    // Conta completa: não enviar código de cadastro nem revelar existência.
    // O cookie é definido mesmo assim para manter o fluxo indistinguível.
    setSignedEmailCookie(ONBOARDING_EMAIL_COOKIE, email);
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }

  const { userId } = await startEmailVerification(email, "EMAIL_VERIFY");

  if (isNew && userId && !isResend) {
    const data = parsed.data as { marketingOptIn?: boolean };
    updateUser(userId, {
      termsAcceptedAt: new Date(),
      privacyVersion: PRIVACY_VERSION,
      marketingOptIn: data.marketingOptIn === true,
    });
    await trackEvent("onboarding_started", userId);
  }

  setSignedEmailCookie(ONBOARDING_EMAIL_COOKIE, email);
  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
}
