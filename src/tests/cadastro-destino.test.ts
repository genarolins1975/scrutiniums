import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Quem é barrado num painel e se cadastra volta ao painel pedido: o middleware
 * grava o destino em cookie e a etapa final do cadastro o devolve como `next`.
 */
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n)! } : undefined),
    delete: (n: string) => jar.delete(n),
  }),
}));
vi.mock("@/lib/session", () => ({ getSessionUser: vi.fn(async () => ({ id: "u1", onboardingStatus: "PROFILE_PENDING", phoneE164: "+5511987654321", phoneVerifiedAt: new Date("2026-01-01") })) }));
vi.mock("@/lib/onboarding", async (orig) => ({
  ...(await orig<typeof import("@/lib/onboarding")>()),
  findUserByCpf: vi.fn(async () => null),
  completeProfile: vi.fn(async () => true),
}));
vi.mock("@/lib/password", async (orig) => ({ ...(await orig<typeof import("@/lib/password")>()), hashPassword: vi.fn(async () => "hash") }));
vi.mock("@/lib/events", () => ({ trackEvent: vi.fn(async () => undefined) }));

import { POST } from "@/app/api/onboarding/profile/route";
import { AREAS_SET, NIVEIS_SET, TIPOS_SET } from "@/lib/perfilOpcoes";

const corpo = () =>
  new Request("http://x/api/onboarding/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      password: "senha-forte-123",
      cpf: "529.982.247-25",
      orgType: [...TIPOS_SET][0],
      orgArea: [...AREAS_SET][0],
      orgRole: [...NIVEIS_SET][0],
      uf: "SP",
    }),
  });

describe("cadastro devolve ao painel pedido", () => {
  beforeEach(() => jar.clear());

  it("sem destino guardado, segue para a escolha de observatório", async () => {
    const r = await POST(corpo());
    expect(r.status).toBe(200);
    expect((await r.json()).next).toBe("/app/observatorios");
  });

  it("com destino interno, volta a ele (com o recorte) e limpa o cookie", async () => {
    jar.set("scrutiniums_destino", "/observatorio/pix?seg=pf");
    const r = await POST(corpo());
    expect(r.status).toBe(200);
    expect((await r.json()).next).toBe("/observatorio/pix?seg=pf");
    expect(jar.has("scrutiniums_destino")).toBe(false);
  });

  it("destino externo é ignorado", async () => {
    jar.set("scrutiniums_destino", "//malicioso.example/x");
    const r = await POST(corpo());
    expect(r.status).toBe(200);
    expect((await r.json()).next).toBe("/app/observatorios");
  });
});
