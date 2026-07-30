import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { toE164 } from "@/lib/phone";
import { maskPhone } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { trackEvent } from "@/lib/events";
import { startPhoneVerification } from "@/lib/twilio";
import { checkRateLimit, POLICIES, requestIp } from "@/lib/ratelimit";

/**
 * Inicia a troca de telefone da conta: envia código SMS para o novo número.
 * Nunca loga o telefone integral; erros genéricos para não revelar
 * se um número pertence a outra conta.
 */
const bodySchema = z.object({
  country: z.string().trim().length(2),
  phone: z.string().trim().min(6).max(20),
});

// Mesma mensagem para número inválido e número em uso por outra conta.
const GENERIC_ERROR =
  "Não foi possível iniciar a verificação para este número. Confira o número e tente novamente.";

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

  if (phoneE164 === user.phoneE164) {
    return NextResponse.json(
      { error: "Este já é o telefone confirmado da sua conta. Informe um número diferente." },
      { status: 400 },
    );
  }

  const ip = requestIp(req);
  const ipLimit = checkRateLimit(`otp-start-ip:${ip}`, POLICIES.otpStartPerIp);
  const phoneLimit = checkRateLimit(`otp-start-phone:${phoneE164}`, POLICIES.otpStartPerPhone);
  if (!ipLimit.allowed || !phoneLimit.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." },
      { status: 429 },
    );
  }

  // Telefone de outra conta: mesma resposta genérica do número inválido.
  const existing = db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.phoneE164, phoneE164))
    .limit(1)
    .all()[0];
  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const result = await startPhoneVerification(phoneE164);
  if (!result.ok) {
    if (result.reason === "rate_limited") {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  audit(user.id, "PHONE_CHANGE_REQUESTED", maskPhone(phoneE164));
  await trackEvent("phone_verification_requested", user.id);

  return NextResponse.json({ ok: true });
}
