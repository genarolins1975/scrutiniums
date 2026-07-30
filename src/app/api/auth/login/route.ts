import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmail, nextStepPath, safeInternalPath } from "@/lib/onboarding";
import { verifyPassword, PASSWORD_MAX_LENGTH } from "@/lib/password";
import { createSession } from "@/lib/session";
import { checkRateLimit, POLICIES, requestIp } from "@/lib/ratelimit";
import type { OnboardingStatus } from "@/lib/schema";

export const runtime = "nodejs";

/**
 * Login principal por e-mail + senha. Falhas respondem SEMPRE o mesmo 401
 * genérico — e-mail inexistente, conta sem senha (usuário antigo) e senha
 * errada são indistinguíveis (anti-enumeração). A senha NUNCA é logada.
 * Sucesso cria a sessão e devolve nextStepPath(status): onboarding
 * incompleto é retomado da etapa correta.
 */

const GENERIC_ERROR = "E-mail ou senha inválidos.";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  // Destino pós-login (?de= repassado por /entrar). Validado no servidor:
  // apenas caminho interno; qualquer outro valor é ignorado.
  de: z.string().max(512).optional(),
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
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  const { email, password, de } = parsed.data;

  const ip = requestIp(req);
  const perIp = checkRateLimit(`login-pwd:ip:${ip}`, POLICIES.loginPerIp);
  if (!perIp.allowed) return rateLimited(perIp.retryAfterMs);
  const perEmail = checkRateLimit(`login-pwd:email:${email}`, POLICIES.loginPerEmail);
  if (!perEmail.allowed) return rateLimited(perEmail.retryAfterMs);

  const user = await findUserByEmail(email);
  // verifyPassword retorna false para hash null/malformado: usuário
  // inexistente ou sem senha cai no mesmo 401 genérico.
  const valid = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !valid) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  await createSession(user.id);

  // Destino solicitado só vale para conta com onboarding completo;
  // onboarding pendente sempre retoma da etapa correta.
  const status = user.onboardingStatus as OnboardingStatus;
  const next =
    status === "COMPLETE" ? safeInternalPath(de) ?? nextStepPath(status) : nextStepPath(status);

  return NextResponse.json({ ok: true, next });
}
