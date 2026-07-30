import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByVerifiedPhone } from "@/lib/onboarding";
import { toE164 } from "@/lib/phone";
import { startPhoneVerification } from "@/lib/twilio";
import { checkRateLimit, POLICIES, requestIp } from "@/lib/ratelimit";
import { maskPhone } from "@/lib/crypto";
import {
  LOGIN_PHONE_COOKIE,
  readSignedPhoneCookie,
  setSignedPhoneCookie,
} from "@/components/onboarding/signedEmailCookie";

export const runtime = "nodejs";

/**
 * Início do login sem senha por SMS (também cobre recuperação de acesso).
 * Só envia código quando existe usuário com aquele telefone VERIFICADO,
 * mas a resposta é SEMPRE genérica e idêntica (200) para bloquear
 * enumeração de contas — inclusive quando o envio do SMS falha.
 */

const GENERIC_MESSAGE = "Se o telefone estiver cadastrado, enviamos um código por SMS.";

const bodySchema = z.union([
  z.object({
    country: z.string().length(2),
    phone: z.string().min(5).max(30),
  }),
  // Reenvio: o telefone pendente (E.164) vem do cookie httpOnly assinado.
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

  let e164: string | null;
  if ("resend" in parsed.data) {
    e164 = readSignedPhoneCookie(LOGIN_PHONE_COOKIE);
  } else {
    e164 = toE164(parsed.data.country.toUpperCase(), parsed.data.phone);
  }
  if (!e164) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const ip = requestIp(req);
  const perIp = checkRateLimit(`login-start:ip:${ip}`, POLICIES.otpStartPerIp);
  if (!perIp.allowed) return rateLimited(perIp.retryAfterMs);
  const perPhone = checkRateLimit(`login-start:phone:${e164}`, POLICIES.otpStartPerPhone);
  if (!perPhone.allowed) return rateLimited(perPhone.retryAfterMs);
  const resendGap = checkRateLimit(`login-start:resend:${e164}`, POLICIES.resendMinInterval);
  if (!resendGap.allowed) return rateLimited(resendGap.retryAfterMs);

  const user = await findUserByVerifiedPhone(e164);
  if (user) {
    const result = await startPhoneVerification(e164);
    if (!result.ok) {
      // Falha de envio não pode alterar a resposta (anti-enumeração):
      // registra com telefone mascarado e segue com a mensagem genérica.
      console.error(`[entrar] falha ao enviar SMS para ${maskPhone(e164)}`);
    }
  }
  // Telefone não cadastrado ou não verificado: nenhum SMS, mesma resposta.

  setSignedPhoneCookie(LOGIN_PHONE_COOKIE, e164);
  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
}
