import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Tokens de link assinados por HMAC com propósito fixo (`${payload}.${mac}`),
 * sem login e sem e-mail na URL. Segredo: COOKIE_SECRET; sem ele em produção,
 * nenhum token é emitido nem aceito. Usado pela saída do boletim mensal e pela
 * assinatura do resumo (confirmação e descadastro).
 */
function segredo(): string {
  const s = process.env.COOKIE_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") return "";
  return "dev-cookie-secret-inseguro";
}

const mac = (proposito: string, payload: string) => createHmac("sha256", segredo()).update(`${proposito}.${payload}`).digest("hex");

export function assinarToken(proposito: string, payload: string): string {
  return `${payload}.${mac(proposito, payload)}`;
}

export function verificarToken(proposito: string, token: string): string | null {
  if (!segredo()) return null;
  const separador = token.lastIndexOf(".");
  if (separador <= 0) return null;
  const payload = token.slice(0, separador);
  const recebido = token.slice(separador + 1);
  const esperado = mac(proposito, payload);
  if (recebido.length !== esperado.length) return null;
  if (!timingSafeEqual(Buffer.from(recebido, "utf-8"), Buffer.from(esperado, "utf-8"))) return null;
  return payload;
}
