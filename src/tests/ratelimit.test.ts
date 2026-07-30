import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, POLICIES, type RateLimitPolicy } from "@/lib/ratelimit";

// Chaves únicas por teste: o armazenamento é um Map em memória no módulo.
let seq = 0;
function uniqueKey(): string {
  return `test-key-${Date.now()}-${seq++}`;
}

const POLICY: RateLimitPolicy = { windowMs: 60_000, max: 3, backoffBaseMs: 1_000 };

describe("ratelimit.checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("permite até max requisições na janela", () => {
    const key = uniqueKey();
    for (let i = 0; i < POLICY.max; i++) {
      const r = checkRateLimit(key, POLICY);
      expect(r.allowed).toBe(true);
      expect(r.retryAfterMs).toBe(0);
    }
  });

  it("bloqueia a requisição seguinte ao estouro com retryAfterMs > 0", () => {
    const key = uniqueKey();
    for (let i = 0; i < POLICY.max; i++) checkRateLimit(key, POLICY);
    const blocked = checkRateLimit(key, POLICY);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(POLICY.backoffBaseMs); // 1º estouro: base × 2^0
  });

  it("mantém o bloqueio enquanto blockedUntil não passa", () => {
    const key = uniqueKey();
    for (let i = 0; i <= POLICY.max; i++) checkRateLimit(key, POLICY);
    vi.advanceTimersByTime(400);
    const stillBlocked = checkRateLimit(key, POLICY);
    expect(stillBlocked.allowed).toBe(false);
    expect(stillBlocked.retryAfterMs).toBe(POLICY.backoffBaseMs - 400);
  });

  it("aplica backoff progressivo: retryAfterMs cresce a cada novo estouro", () => {
    const key = uniqueKey();
    for (let i = 0; i < POLICY.max; i++) checkRateLimit(key, POLICY);

    const first = checkRateLimit(key, POLICY); // estouro 1 → base × 2^0
    expect(first.allowed).toBe(false);

    vi.advanceTimersByTime(first.retryAfterMs + 1);
    const second = checkRateLimit(key, POLICY); // estouro 2 → base × 2^1
    expect(second.allowed).toBe(false);
    expect(second.retryAfterMs).toBeGreaterThan(first.retryAfterMs);
    expect(second.retryAfterMs).toBe(POLICY.backoffBaseMs * 2);

    vi.advanceTimersByTime(second.retryAfterMs + 1);
    const third = checkRateLimit(key, POLICY); // estouro 3 → base × 2^2
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(second.retryAfterMs);
    expect(third.retryAfterMs).toBe(POLICY.backoffBaseMs * 4);
  });

  it("reseta o contador quando a janela expira", () => {
    const key = uniqueKey();
    for (let i = 0; i < POLICY.max; i++) {
      expect(checkRateLimit(key, POLICY).allowed).toBe(true);
    }
    // Sem estourar: avança além da janela e a cota volta ao início.
    vi.advanceTimersByTime(POLICY.windowMs + 1);
    for (let i = 0; i < POLICY.max; i++) {
      expect(checkRateLimit(key, POLICY).allowed).toBe(true);
    }
  });

  it("chaves diferentes têm cotas independentes", () => {
    const a = uniqueKey();
    const b = uniqueKey();
    for (let i = 0; i <= POLICY.max; i++) checkRateLimit(a, POLICY);
    expect(checkRateLimit(a, POLICY).allowed).toBe(false);
    expect(checkRateLimit(b, POLICY).allowed).toBe(true);
  });
});

describe("ratelimit.POLICIES", () => {
  it("todas as políticas têm janela, max e backoff positivos", () => {
    for (const policy of Object.values(POLICIES)) {
      expect(policy.windowMs).toBeGreaterThan(0);
      expect(policy.max).toBeGreaterThan(0);
      expect(policy.backoffBaseMs).toBeGreaterThan(0);
    }
  });
});
