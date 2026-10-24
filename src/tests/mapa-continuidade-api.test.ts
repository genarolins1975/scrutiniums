import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/conta/ultimo-acesso/route";
import { getSessionUser } from "@/lib/session";
import { COOKIE_OBSERVATORIO, VALIDADE_ULTIMO_ACESSO } from "@/lib/observatorios/ultimoAcesso";

vi.mock("@/lib/session", () => ({ getSessionUser: vi.fn() }));
const sessao = vi.mocked(getSessionUser);
const origem = "https://scrutiniums.com";
function pedido(caminho: unknown, origin: string | null = origem, cookie?: string) {
  return new NextRequest(`${origem}/api/conta/ultimo-acesso`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { origin } : {}),
      ...(cookie ? { cookie: `${COOKIE_OBSERVATORIO}=${cookie}` } : {}) },
    body: JSON.stringify({ caminho }),
  });
}
beforeEach(() => { vi.clearAllMocks(); sessao.mockResolvedValue({ id: "teste" } as NonNullable<Awaited<ReturnType<typeof getSessionUser>>>); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("continuidade de uma navegação exibida no cliente", () => {
  it("mantém cookie, escopo, duração e privacidade existentes", async () => {
    const r = await POST(pedido("/observatorio/pix"));
    expect(r.status).toBe(204);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(r.cookies.get(COOKIE_OBSERVATORIO)).toMatchObject({ value: "c:pagamentos", path: "/",
      maxAge: VALIDADE_ULTIMO_ACESSO, httpOnly: true, sameSite: "lax" });
  });
  it("não regrava a mesma coleção", async () => {
    const r = await POST(pedido("/observatorio/pix", origem, "c:pagamentos"));
    expect(r.status).toBe(204);
    expect(r.headers.get("set-cookie")).toBeNull();
  });
  it.each([null, "null", "https://outro.example", "https://scrutiniums.com/caminho", "ftp://scrutiniums.com"])("recusa origem %s antes de consultar sessão", async origin => {
    const r = await POST(pedido("/observatorio", origin));
    expect(r.status).toBe(403);
    expect(sessao).not.toHaveBeenCalled();
    expect(r.headers.get("set-cookie")).toBeNull();
  });
  it.each(["scrutiniums.com", "www.scrutiniums.com", "preview.example.test"])("aceita Origin/Host públicos %s com URL interna do next start", async host => {
    const r = await POST(new NextRequest("http://localhost:3000/api/conta/ultimo-acesso", {
      method: "POST", headers: { origin: `https://${host}`, host }, body: JSON.stringify({ caminho: "/observatorio/pix" }),
    }));
    expect(r.status).toBe(204);
    expect(r.cookies.get(COOKIE_OBSERVATORIO)?.value).toBe("c:pagamentos");
  });
  it.each([false, true])("só confia em x-forwarded-host com proxy declarado: %s", async confiavel => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("TRUST_PROXY", confiavel ? "1" : "");
    const r = await POST(new NextRequest("http://localhost:3000/api/conta/ultimo-acesso", {
      method: "POST", headers: { origin: "https://preview.example.test", host: "localhost:3000", "x-forwarded-host": "preview.example.test" },
      body: JSON.stringify({ caminho: "/observatorio/pix" }),
    }));
    expect(r.status).toBe(confiavel ? 204 : 403);
    if (!confiavel) expect(r.headers.get("set-cookie")).toBeNull();
  });
  it("não grava para quem não tem sessão", async () => {
    sessao.mockResolvedValue(null);
    const r = await POST(pedido("/setor-eletrico"));
    expect(r.status).toBe(401);
    expect(r.headers.get("set-cookie")).toBeNull();
  });
  it.each(["/app/conta", "/inexistente", "https://scrutiniums.com/observatorio", "/observatorio?cpf=privado",
    "/observatorio#nome", 42, null, "/observatorio/" + "a".repeat(513)])("recusa endereço fora do contrato: %s", async caminho => {
    const r = await POST(pedido(caminho));
    expect(r.status).toBe(400);
    expect(r.headers.get("set-cookie")).toBeNull();
  });
  it("recusa JSON malformado", async () => {
    const r = await POST(new NextRequest(`${origem}/api/conta/ultimo-acesso`, {
      method: "POST", headers: { origin: origem }, body: "{",
    }));
    expect(r.status).toBe(400);
  });
});
