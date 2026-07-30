import { NextResponse } from "next/server";
import { z } from "zod";
import { registerContactEmail } from "@/lib/onboarding";
import { checkRateLimit, POLICIES, requestIp } from "@/lib/ratelimit";
import { trackEvent } from "@/lib/events";
import {
  ONBOARDING_EMAIL_COOKIE,
  setSignedEmailCookie,
} from "@/components/onboarding/signedEmailCookie";

export const runtime = "nodejs";

/**
 * Etapa 1 do onboarding (modelo somente-SMS): o e-mail é dado de contato,
 * NENHUM código é enviado. Cria o usuário (se não existir) já em
 * PHONE_PENDING, grava o cookie assinado onboarding_email e manda seguir
 * para a etapa do telefone. Resposta SEMPRE genérica (200) para bloquear
 * enumeração de contas — inclusive quando o e-mail já pertence a um
 * cadastro COMPLETO (a validação real acontece por SMS na etapa seguinte,
 * e o acesso de conta existente é por /entrar).
 */

const bodySchema = z.object({
  email: z.string().email().max(254),
  termsAccepted: z.literal(true),
  marketingOptIn: z.boolean().optional(),
});

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

  const email = parsed.data.email.toLowerCase().trim();
  const ip = requestIp(req);

  const perIp = checkRateLimit(`email-start:ip:${ip}`, POLICIES.emailStartPerIp);
  if (!perIp.allowed) return rateLimited(perIp.retryAfterMs);
  const perEmail = checkRateLimit(`email-start:email:${email}`, POLICIES.emailStartPerEmail);
  if (!perEmail.allowed) return rateLimited(perEmail.retryAfterMs);
  const resendGap = checkRateLimit(`email-start:resend:${email}`, POLICIES.resendMinInterval);
  if (!resendGap.allowed) return rateLimited(resendGap.retryAfterMs);

  const { userId, created } = await registerContactEmail(email, {
    marketingOptIn: parsed.data.marketingOptIn === true,
  });

  if (created) {
    await trackEvent("onboarding_started", userId);
  }

  // Cookie definido em todos os casos (conta nova, incompleta ou completa)
  // para manter o fluxo indistinguível — anti-enumeração.
  setSignedEmailCookie(ONBOARDING_EMAIL_COOKIE, email);
  return NextResponse.json({ ok: true, next: "/cadastro/telefone" });
}
