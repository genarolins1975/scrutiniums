/**
 * Rate limiting em memória com backoff progressivo.
 * Suficiente para instância única; em produção multi-instância,
 * trocar o armazenamento por Redis mantendo a mesma interface.
 */
type Bucket = { count: number; windowStart: number; blockedUntil: number };

// Em globalThis: o dev server do Next compila cada rota como módulo separado
// e os buckets precisam ser únicos por processo.
const globalForRl = globalThis as unknown as { __rlBuckets?: Map<string, Bucket> };
const buckets = (globalForRl.__rlBuckets ??= new Map<string, Bucket>());

export type RateLimitPolicy = {
  windowMs: number;
  max: number;
  /** Multiplicador de bloqueio progressivo a cada estouro. */
  backoffBaseMs: number;
};

export const POLICIES = {
  otpStartPerPhone: { windowMs: 60 * 60 * 1000, max: 5, backoffBaseMs: 30_000 },
  otpStartPerIp: { windowMs: 60 * 60 * 1000, max: 15, backoffBaseMs: 30_000 },
  otpCheckPerPhone: { windowMs: 10 * 60 * 1000, max: 8, backoffBaseMs: 30_000 },
  emailStartPerEmail: { windowMs: 60 * 60 * 1000, max: 6, backoffBaseMs: 30_000 },
  emailStartPerIp: { windowMs: 60 * 60 * 1000, max: 20, backoffBaseMs: 30_000 },
  resendMinInterval: { windowMs: 30_000, max: 1, backoffBaseMs: 30_000 },
} satisfies Record<string, RateLimitPolicy>;

export function checkRateLimit(key: string, policy: RateLimitPolicy): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { count: 0, windowStart: now, blockedUntil: 0 };

  if (now < bucket.blockedUntil) {
    return { allowed: false, retryAfterMs: bucket.blockedUntil - now };
  }
  if (now - bucket.windowStart > policy.windowMs) {
    bucket.count = 0;
    bucket.windowStart = now;
  }
  bucket.count += 1;
  if (bucket.count > policy.max) {
    const overflows = bucket.count - policy.max;
    bucket.blockedUntil = now + policy.backoffBaseMs * 2 ** Math.min(overflows - 1, 6);
    buckets.set(key, bucket);
    return { allowed: false, retryAfterMs: bucket.blockedUntil - now };
  }
  buckets.set(key, bucket);
  return { allowed: true, retryAfterMs: 0 };
}

/** Extrai IP do request atrás de proxy. */
export function requestIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}
