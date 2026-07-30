import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { updateUser } from "@/lib/onboarding";
import { toE164 } from "@/lib/phone";
import { maskPhone } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { trackEvent } from "@/lib/events";
import { checkPhoneVerification } from "@/lib/twilio";
import { checkRateLimit, POLICIES } from "@/lib/ratelimit";

/**
 * Confirma o código SMS e efetiva a troca de telefone.
 * Somente status "approved" grava o novo número.
 */
const bodySchema = z.object({
  country: z.string().trim().length(2),
  phone: z.string().trim().min(6).max(20),
  code: z.string().trim().regex(/^\d{6}$/),
});

const GENERIC_ERROR = "Código inválido ou expirado. Confira o código e tente novamente.";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão inválida. Entre novamente." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const phoneE164 = toE164(parsed.data.country, parsed.data.phone);
  if (!phoneE164) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const limit = checkRateLimit(`otp-check-phone:${phoneE164}`, POLICIES.otpCheckPerPhone);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." },
      { status: 429 },
    );
  }

  const result = await checkPhoneVerification(phoneE164, parsed.data.code);
  if (result.status !== "approved") {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // Revalida unicidade no momento da gravação (corrida entre start e check).
  const db = await getDb();
  const existingRows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.phoneE164, phoneE164))
    .limit(1);
  const existing = existingRows[0];
  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  try {
    await updateUser(user.id, { phoneE164, phoneVerifiedAt: new Date() });
  } catch {
    // Violação de unicidade ou falha de gravação: nunca detalhar.
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  await audit(user.id, "PHONE_CHANGED", maskPhone(phoneE164));
  await trackEvent("phone_verified", user.id);

  return NextResponse.json({ ok: true });
}
