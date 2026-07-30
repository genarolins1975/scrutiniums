/**
 * Envio de e-mail transacional.
 * Com RESEND_API_KEY configurada, envia via API do Resend (produção).
 * Sem provedor: em desenvolvimento registra o código no log do servidor
 * (e-mail mascarado); em produção NUNCA loga o código, apenas o erro.
 */
import { maskEmail } from "./crypto";

const SUBJECTS: Record<string, string> = {
  EMAIL_VERIFY: "Seu código de verificação",
  LOGIN: "Seu código de acesso",
  RECOVERY: "Seu código de recuperação",
};

function emailText(code: string, purpose: string): string {
  const acao =
    purpose === "EMAIL_VERIFY"
      ? "concluir seu cadastro"
      : "entrar na plataforma";
  return [
    `Seu código para ${acao} na Scrutiniums:`,
    "",
    code,
    "",
    "O código expira em 15 minutos. Se você não solicitou, ignore esta mensagem.",
    "",
    "Scrutiniums · 100% gratuito · sem assinatura · sem cobrança",
  ].join("\n");
}

async function sendViaResend(email: string, code: string, purpose: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const from = process.env.MAIL_FROM ?? "Scrutiniums <acesso@scrutiniums.com>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `${SUBJECTS[purpose] ?? "Seu código"} · Scrutiniums`,
        text: emailText(code, purpose),
      }),
    });
    if (!res.ok) {
      // Nunca logar o código nem o e-mail integral.
      console.error(`[mail] falha no envio (${purpose}) para ${maskEmail(email)}: HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch {
    console.error(`[mail] erro de rede no envio (${purpose}) para ${maskEmail(email)}`);
    return false;
  }
}

export async function sendEmailCode(email: string, code: string, purpose: string): Promise<void> {
  const sent = await sendViaResend(email, code, purpose);
  if (sent) return;

  if (process.env.NODE_ENV === "production") {
    // Sem provedor configurado (ou falha): nunca logar o código em produção.
    if (!process.env.RESEND_API_KEY) {
      console.error(`[mail] RESEND_API_KEY não configurada; código (${purpose}) não enviado para ${maskEmail(email)}`);
    }
    return;
  }
  console.info(`[dev-mail] (${purpose}) código para ${maskEmail(email)}: ${code}`);
}
