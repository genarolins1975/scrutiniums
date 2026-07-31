/**
 * Envio de e-mail transacional.
 * Com RESEND_API_KEY configurada, envia via API do Resend (produção).
 * Sem provedor: em desenvolvimento registra o conteúdo no log do servidor
 * (e-mail mascarado); em produção NUNCA loga o conteúdo, apenas o erro.
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

/**
 * Template do convite da lista de espera (função pura, texto simples —
 * sem HTML). O código de acesso aparece em linha própria.
 */
export function conviteEmail(accessCode: string): { subject: string; text: string } {
  return {
    subject: "Seu acesso à Scrutiniums foi liberado",
    text: [
      "Prezado(a),",
      "",
      "Seu acesso antecipado à Scrutiniums foi liberado. Este é o seu código de acesso:",
      "",
      accessCode,
      "",
      "Para entrar, acesse https://scrutiniums.com/entrar e identifique-se com",
      "seu e-mail e senha (ou pelo código por SMS, caso tenha esquecido a senha).",
      "Em seguida, informe o código acima na etapa de acesso.",
      "",
      "Scrutiniums · 100% gratuito · sem assinatura · sem cobrança",
    ].join("\n"),
  };
}

/** POST na API do Resend. Nunca loga conteúdo nem e-mail integral. */
async function postResend(
  to: string,
  subject: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY ausente" };
  const from = process.env.MAIL_FROM ?? "Scrutiniums <acesso@scrutiniums.com>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) {
      console.error(`[mail] falha no envio para ${maskEmail(to)}: HTTP ${res.status}`);
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch {
    console.error(`[mail] erro de rede no envio para ${maskEmail(to)}`);
    return { ok: false, error: "erro de rede" };
  }
}

/**
 * Envio genérico de e-mail transacional (texto puro) via Resend.
 * Sem RESEND_API_KEY → { sent: false, error: "RESEND_API_KEY ausente" };
 * neste caso, em desenvolvimento o corpo é registrado no log com o
 * e-mail mascarado (envio simulado). Em produção, NUNCA logamos conteúdo.
 */
export async function sendTransactionalEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ sent: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[dev-mail] para ${maskEmail(to)} · assunto: ${subject}\n${text}`,
      );
    } else {
      console.error(
        `[mail] RESEND_API_KEY não configurada; e-mail não enviado para ${maskEmail(to)}`,
      );
    }
    return { sent: false, error: "RESEND_API_KEY ausente" };
  }
  const result = await postResend(to, subject, text);
  return result.ok ? { sent: true } : { sent: false, error: result.error };
}

export async function sendEmailCode(email: string, code: string, purpose: string): Promise<void> {
  const subject = `${SUBJECTS[purpose] ?? "Seu código"} · Scrutiniums`;
  if (process.env.RESEND_API_KEY) {
    const result = await postResend(email, subject, emailText(code, purpose));
    if (result.ok) return;
  }

  if (process.env.NODE_ENV === "production") {
    // Sem provedor configurado (ou falha): nunca logar o código em produção.
    if (!process.env.RESEND_API_KEY) {
      console.error(`[mail] RESEND_API_KEY não configurada; código (${purpose}) não enviado para ${maskEmail(email)}`);
    }
    return;
  }
  console.info(`[dev-mail] (${purpose}) código para ${maskEmail(email)}: ${code}`);
}
