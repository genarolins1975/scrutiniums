import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, POLICIES, requestIp } from "@/lib/ratelimit";
import { sendTransactionalEmail } from "@/lib/mailer";
import { trackEvent } from "@/lib/events";
import { emailConfirmacao, pedirAssinatura, PERIODICIDADES, RESPOSTA_GENERICA } from "@/lib/assinaturaResumo";

export const runtime = "nodejs";

/**
 * Pedido de assinatura do resumo, sem conta. Exige o consentimento marcado e
 * responde sempre a mesma mensagem: nada revela se o endereço já assina. O
 * envio de e-mail só acontece pelo link de confirmação.
 */
const bodySchema = z.object({
  email: z.string().trim().email().max(254),
  periodicidade: z.enum(PERIODICIDADES),
  consentimento: z.literal(true),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Informe um e-mail válido, a periodicidade e marque o consentimento." },
      { status: 400 },
    );
  }
  const { email, periodicidade } = parsed.data;
  const porIp = checkRateLimit(`assinatura:ip:${requestIp(req)}`, POLICIES.assinaturaPorIp);
  const porEmail = checkRateLimit(`assinatura:email:${email.toLowerCase()}`, POLICIES.assinaturaPorEmail);
  if (!porIp.allowed) {
    return NextResponse.json({ error: "Muitos pedidos. Tente novamente mais tarde." }, { status: 429 });
  }
  // limite por endereço estourado: resposta genérica, sem novo e-mail (não revela nada)
  if (porEmail.allowed) {
    const agora = new Date();
    const { token } = await pedirAssinatura(email, periodicidade, agora);
    const msg = emailConfirmacao(periodicidade, token);
    await sendTransactionalEmail({ to: email, subject: msg.subject, text: msg.text });
    await trackEvent("resumo_assinatura_pedida");
  }
  return NextResponse.json({ mensagem: RESPOSTA_GENERICA }, { status: 202 });
}
