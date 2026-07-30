import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { toE164 } from "@/lib/phone";
import { startPhoneVerification } from "@/lib/twilio";
import { checkRateLimit, POLICIES, requestIp } from "@/lib/ratelimit";
import { trackEvent } from "@/lib/events";
import { maskPhone } from "@/lib/crypto";

export const runtime = "nodejs";

/**
 * Envio do código SMS (etapa 2). Sessão obrigatória em PHONE_PENDING.
 * Política explícita: telefone já verificado por OUTRA conta é rejeitado
 * com mensagem genérica — nunca associamos contas nem alteramos dados
 * silenciosamente. Logs apenas com telefone mascarado; código nunca
 * armazenado nem logado aqui.
 */

const GENERIC_PHONE_ERROR = "Não foi possível usar este telefone.";

const bodySchema = z.object({
  country: z.string().length(2),
  phone: z.string().min(5).max(30),
});

function rateLimited(retryAfterMs: number) {
  return NextResponse.json(
    { error: "Muitas tentativas. Aguarde e tente novamente." },
    { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) } },
  );
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.onboardingStatus !== "PHONE_PENDING") {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: GENERIC_PHONE_ERROR }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_PHONE_ERROR }, { status: 400 });
  }

  const e164 = toE164(parsed.data.country.toUpperCase(), parsed.data.phone);
  if (!e164) {
    return NextResponse.json({ error: GENERIC_PHONE_ERROR }, { status: 400 });
  }

  // Telefone já verificado por outra conta: rejeição genérica.
  const conflict = db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.phoneE164, e164),
        ne(schema.users.id, user.id),
        isNotNull(schema.users.phoneVerifiedAt),
      ),
    )
    .limit(1)
    .all()[0];
  if (conflict) {
    console.warn(`[onboarding] telefone em conflito: ${maskPhone(e164)}`);
    return NextResponse.json({ error: GENERIC_PHONE_ERROR }, { status: 400 });
  }

  const ip = requestIp(req);
  const perIp = checkRateLimit(`otp-start:ip:${ip}`, POLICIES.otpStartPerIp);
  if (!perIp.allowed) return rateLimited(perIp.retryAfterMs);
  const perPhone = checkRateLimit(`otp-start:phone:${e164}`, POLICIES.otpStartPerPhone);
  if (!perPhone.allowed) return rateLimited(perPhone.retryAfterMs);
  const resendGap = checkRateLimit(`otp-start:resend:${e164}`, POLICIES.resendMinInterval);
  if (!resendGap.allowed) return rateLimited(resendGap.retryAfterMs);

  const result = await startPhoneVerification(e164);
  if (!result.ok) {
    if (result.reason === "rate_limited") {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde e tente novamente." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
    console.error(`[onboarding] falha ao enviar SMS para ${maskPhone(e164)}`);
    return NextResponse.json(
      { error: "Não foi possível enviar o código agora. Tente novamente." },
      { status: 502 },
    );
  }

  await trackEvent("phone_verification_requested", user.id);
  return NextResponse.json({ ok: true, masked: maskPhone(e164) });
}
