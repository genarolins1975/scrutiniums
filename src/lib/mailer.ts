/**
 * Envio de e-mail transacional. Em desenvolvimento, registra no log
 * do servidor com e-mail mascarado. Em produção, integrar provedor
 * via variáveis de ambiente (SMTP_*). Códigos NUNCA são logados em produção.
 */
import { maskEmail } from "./crypto";

export async function sendEmailCode(email: string, code: string, purpose: string): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    if (process.env.SMTP_HOST) {
      // Ponto de integração com o provedor SMTP configurado.
      // Mantido sem implementação até definição do provedor de e-mail.
      return;
    }
    // Sem provedor configurado: nunca logar o código em produção.
    console.error(`[mail] SMTP não configurado; código (${purpose}) não enviado para ${maskEmail(email)}`);
    return;
  }
  console.info(`[dev-mail] (${purpose}) código para ${maskEmail(email)}: ${code}`);
}
