/**
 * Cookie de sessão assinado, verificável no edge (Web Crypto) sem banco.
 * Formato: "<expEpochSeg>.<token>.<hmacHex>", com
 * hmac = HMAC-SHA256(`${exp}.${token}`, COOKIE_SECRET).
 * O token continua aleatório e hasheado no banco para revogação; a
 * assinatura e a expiração barram cookies forjados ou vencidos já no
 * middleware, antes de qualquer conteúdo protegido.
 * Compatível com Node e Edge Runtime (usa apenas crypto.subtle).
 */

function secret(): string {
  const s = process.env.COOKIE_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    // Sem segredo em produção nenhuma sessão deve validar.
    return "";
  }
  return "dev-cookie-secret-inseguro";
}

const enc = new TextEncoder();

async function hmacHex(payload: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Assina token + expiração no formato do cookie. Exige COOKIE_SECRET em produção. */
export async function signSessionCookie(token: string, expiresAt: Date): Promise<string> {
  if (!secret()) {
    throw new Error("COOKIE_SECRET não configurado: impossível emitir sessão em produção.");
  }
  const exp = Math.floor(expiresAt.getTime() / 1000);
  const payload = `${exp}.${token}`;
  const sig = await hmacHex(payload, secret());
  return `${payload}.${sig}`;
}

export type VerifiedSession = { token: string; exp: number };

/**
 * Verifica assinatura e expiração. Retorna null para valor malformado,
 * assinatura inválida, segredo ausente em produção ou cookie vencido.
 */
export async function verifySessionCookie(value: string | undefined | null): Promise<VerifiedSession | null> {
  if (!value) return null;
  const key = secret();
  if (!key) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [expStr, token, sig] = parts;
  if (!/^\d{1,12}$/.test(expStr) || !/^[0-9a-f]{16,128}$/i.test(token) || !/^[0-9a-f]{64}$/i.test(sig)) {
    return null;
  }
  const exp = Number(expStr);
  if (exp * 1000 <= Date.now()) return null;
  const expected = await hmacHex(`${expStr}.${token}`, key);
  if (!constantTimeEqualHex(expected, sig.toLowerCase())) return null;
  return { token, exp };
}
