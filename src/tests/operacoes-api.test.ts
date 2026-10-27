import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/tarefas/route";
import { getSessionUser } from "@/lib/session";
import { salvarTarefa } from "@/lib/operacoes/tarefas";
vi.mock("@/lib/session", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/operacoes/tarefas", async (original) => ({ ...await original<typeof import("@/lib/operacoes/tarefas")>(), salvarTarefa: vi.fn() }));
vi.mock("@/lib/operacoes/estado", () => ({ lerEstadoOperacoes: vi.fn(async () => ({ estado: null })) }));
const sessao = vi.mocked(getSessionUser);
const gravar = vi.mocked(salvarTarefa);
const entrada = { titulo: "Conferir fonte", estado: "aberta", nota: "", responsavel: "", prazo: "", versao: 0 };
const pedido = (corpo: unknown = entrada, origin: string | null = "https://scrutiniums.com") => new Request("https://scrutiniums.com/api/admin/tarefas", { method: "POST", headers: { host: "scrutiniums.com", ...(origin ? { origin } : {}) }, body: JSON.stringify(corpo) });
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("ADMIN_EMAILS", "adm@example.invalid");
  sessao.mockResolvedValue({ id: "adm", email: "adm@example.invalid" } as NonNullable<Awaited<ReturnType<typeof getSessionUser>>>);
  gravar.mockResolvedValue({ tipo: "invalida" });
});
afterEach(() => vi.unstubAllEnvs());
describe("API administrativa de tarefas", () => {
  it.each([null, { id: "leitor", email: "leitor@example.invalid" }])("recusa sessão sem privilégio", async (user) => {
    sessao.mockResolvedValue(user as Awaited<ReturnType<typeof getSessionUser>>);
    expect((await POST(pedido())).status).toBe(403);
    expect(gravar).not.toHaveBeenCalled();
  });
  it.each([null, "null", "https://outro.test", "https://scrutiniums.com/caminho"])("recusa CSRF de %s", async (origin) => {
    expect((await POST(pedido(entrada, origin))).status).toBe(403);
    expect(gravar).not.toHaveBeenCalled();
  });
  it("limita corpo, rejeita estado inválido e mantém resposta sem cache", async () => {
    expect((await POST(pedido({ ...entrada, nota: "x".repeat(17000) }))).status).toBe(413);
    expect((await POST(pedido({ ...entrada, estado: "publicado" }))).status).toBe(400);
    gravar.mockResolvedValue({ tipo: "conflito" });
    const r = await POST(pedido());
    expect(r.status).toBe(409);
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
});
