import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { toE164 } from "@/lib/phone";
import { checkPhoneVerification } from "@/lib/twilio";
import { updateUser } from "@/lib/onboarding";
import { checkRateLimit, POLICIES } from "@/lib/ratelimit";
import { trackEvent } from "@/lib/events";
import { maskPhone } from "@/lib/crypto";

export const runtime = "nodejs";

/**
 * Conferência do código SMS (etapa 2). SOMENTE status "approved" conclui
 * a etapa; qualquer outro resultado devolve erro genérico. O código nunca
 * é persistido nem logado.
 */

const GENERIC_ERROR = "Código inválido ou expirado.";

const bodySchema = z.object({
  country: z.string().length(2),
  phone: z.string().min(5).max(30),
  code: z.string().regex(/^\d{6}$/),
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
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const e164 = toE164(parsed.data.country.toUpperCase(), parsed.data.phone);
  if (!e164) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const perPhone = checkRateLimit(`otp-check:phone:${e164}`, POLICIES.otpCheckPerPhone);
  if (!perPhone.allowed) return rateLimited(perPhone.retryAfterMs);

  const result = await checkPhoneVerification(e164, parsed.data.code);
  if (result.status !== "approved") {
    await trackEvent("verification_failed", user.id);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // Reconfere conflito no momento da gravação (corrida entre contas).
  const db = await getDb();
  const conflictRows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.phoneE164, e164),
        ne(schema.users.id, user.id),
        isNotNull(schema.users.phoneVerifiedAt),
      ),
    )
    .limit(1);
  const conflict = conflictRows[0];
  if (conflict) {
    console.warn(`[onboarding] telefone em conflito na gravação: ${maskPhone(e164)}`);
    return NextResponse.json({ error: "Não foi possível usar este telefone." }, { status: 400 });
  }

  try {
    await updateUser(user.id, {
      phoneE164: e164,
      phoneVerifiedAt: new Date(),
      onboardingStatus: "PROFILE_PENDING",
    });
  } catch {
    // Violação de unicidade (telefone reivindicado em paralelo): erro genérico.
    return NextResponse.json({ error: "Não foi possível usar este telefone." }, { status: 400 });
  }

  await trackEvent("phone_verified", user.id);
  return NextResponse.json({ ok: true, next: "/cadastro/perfil" });
}
