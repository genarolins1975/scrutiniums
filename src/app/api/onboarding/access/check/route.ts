import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/session";
import { updateUser } from "@/lib/onboarding";
import { isValidAccessCode } from "@/lib/access";
import { checkRateLimit, POLICIES, requestIp } from "@/lib/ratelimit";
import { trackEvent } from "@/lib/events";

export const runtime = "nodejs";

/**
 * Etapa final: validação do código de acesso (acesso antecipado).
 * Sessão obrigatória em ACCESS_PENDING ou WAITLIST (quem está na lista de
 * espera pode entrar assim que receber um código). Código válido →
 * COMPLETE + "onboarding_completed". Erro sempre genérico: a resposta
 * nunca revela quais códigos existem nem quantos são.
 */

const GENERIC_ERROR = "Código inválido.";

const bodySchema = z.object({ code: z.string().min(1).max(64) });

function rateLimited(retryAfterMs: number) {
  return NextResponse.json(
    { error: "Muitas tentativas. Aguarde e tente novamente." },
    { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) } },
  );
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || (user.onboardingStatus !== "ACCESS_PENDING" && user.onboardingStatus !== "WAITLIST")) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
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

  const perUser = checkRateLimit(`access-check:user:${user.id}`, POLICIES.accessCheck);
  if (!perUser.allowed) return rateLimited(perUser.retryAfterMs);
  const perIp = checkRateLimit(`access-check:ip:${requestIp(req)}`, POLICIES.accessCheck);
  if (!perIp.allowed) return rateLimited(perIp.retryAfterMs);

  if (!isValidAccessCode(parsed.data.code)) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  await updateUser(user.id, { onboardingStatus: "COMPLETE" });
  await trackEvent("onboarding_completed", user.id);

  return NextResponse.json({ ok: true, next: "/observatorio" });
}
