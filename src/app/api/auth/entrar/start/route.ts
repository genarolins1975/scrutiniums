import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmail, startEmailVerification } from "@/lib/onboarding";
import { checkRateLimit, POLICIES, requestIp } from "@/lib/ratelimit";
import {
  LOGIN_EMAIL_COOKIE,
  readSignedEmailCookie,
  setSignedEmailCookie,
} from "@/components/onboarding/signedEmailCookie";

export const runtime = "nodejs";

/**
 * Início do login sem senha (também cobre recuperação de acesso).
 * Só envia código quando o usuário existe com e-mail verificado, mas a
 * resposta é SEMPRE genérica (200) para bloquear enumeração de contas.
 */

const GENERIC_MESSAGE = "Se o e-mail for válido, enviamos um código de acesso.";

const bodySchema = z.union([
  z.object({ email: z.string().email().max(254) }),
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

  const rawEmail =
    "resend" in parsed.data
      ? readSignedEmailCookie(LOGIN_EMAIL_COOKIE)
      : (parsed.data as { email: string }).email;
  if (!rawEmail || !z.string().email().max(254).safeParse(rawEmail).success) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const email = rawEmail.toLowerCase().trim();
  const ip = requestIp(req);

  const perIp = checkRateLimit(`login-start:ip:${ip}`, POLICIES.emailStartPerIp);
  if (!perIp.allowed) return rateLimited(perIp.retryAfterMs);
  const perEmail = checkRateLimit(`login-start:email:${email}`, POLICIES.emailStartPerEmail);
  if (!perEmail.allowed) return rateLimited(perEmail.retryAfterMs);
  const resendGap = checkRateLimit(`login-start:resend:${email}`, POLICIES.resendMinInterval);
  if (!resendGap.allowed) return rateLimited(resendGap.retryAfterMs);

  const user = await findUserByEmail(email);
  if (user && user.emailVerifiedAt) {
    await startEmailVerification(email, "LOGIN");
  }
  // E-mail inexistente ou não verificado: nenhum código, mesma resposta.

  setSignedEmailCookie(LOGIN_EMAIL_COOKIE, email);
  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
}
