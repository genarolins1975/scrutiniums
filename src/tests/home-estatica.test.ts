import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { signSessionCookie } from "@/lib/sessionCookie";
const req = (caminho: string, cookie?: string) => new NextRequest(`https://scrutiniums.com${caminho}`, { headers: cookie ? { cookie: `scrutiniums_session=${cookie}` } : {} });
afterEach(() => vi.unstubAllGlobals());
describe("home estática e validação privada", () => {
  it.each(["/", "/en"])("%s não consulta o banco sem assinatura válida e só redireciona conta completa", async rota => {
    process.env.COOKIE_SECRET = "teste-local-iniciativa-3-nao-producao";
    const consultar = vi.fn().mockResolvedValue(Response.json({ logado: true, completo: true }));
    vi.stubGlobal("fetch", consultar);
    for (const cookie of [undefined, "forjado", await signSessionCookie("cd".repeat(32), new Date(0))]) {
      const resposta = await middleware(req(rota, cookie));
      expect(resposta.headers.get("x-middleware-next")).toBe("1");
      expect(resposta.headers.get("set-cookie")).toBeNull();
    }
    expect(consultar).not.toHaveBeenCalled();
    const valido = await signSessionCookie("ab".repeat(32), new Date(Date.now() + 60000));
    const resposta = await middleware(req(rota, valido));
    expect(resposta.status).toBe(307);
    expect(resposta.headers.get("location")).toBe("https://scrutiniums.com/app/observatorios");
    expect(resposta.headers.get("cache-control")).toBe("private, no-store");
    expect(consultar).toHaveBeenCalledTimes(1);
    consultar.mockResolvedValueOnce(Response.json({ logado: false, completo: false }));
    expect((await middleware(req(rota, valido))).headers.get("x-middleware-next")).toBe("1");
    consultar.mockRejectedValueOnce(new Error("banco indisponível"));
    expect((await middleware(req(rota, valido))).status).toBe(503);
  });
});
