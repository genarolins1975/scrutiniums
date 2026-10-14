import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { middleware } from "@/middleware";
import { COOKIE_DESTINO } from "@/lib/rotasPublicas";
import { signSessionCookie } from "@/lib/sessionCookie";

const ORIGEM = "https://scrutiniums.com";
const TOKEN = "ab".repeat(32);
const fetchInterno = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("COOKIE_SECRET", "segredo-sintetico-do-teste-i18n-middleware");
  fetchInterno.mockReset();
  fetchInterno.mockRejectedValue(new Error("Consulta interna não prevista neste caso"));
  vi.stubGlobal("fetch", fetchInterno);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function requisicao(caminho: string, cookie?: string): NextRequest {
  const headers = new Headers({ accept: "text/html" });
  if (cookie) headers.set("cookie", `scrutiniums_session=${cookie}; preferencia=pt`);
  return new NextRequest(ORIGEM + caminho, { headers });
}

function assinarCookie(validadeMs = 60 * 60 * 1000): Promise<string> {
  return signSessionCookie(TOKEN, new Date(Date.now() + validadeMs));
}

function conferirConsultaAdministrativa(request: NextRequest) {
  expect(fetchInterno).toHaveBeenCalledTimes(1);
  const [url, init] = fetchInterno.mock.calls[0];
  expect(String(url)).toBe(`${ORIGEM}/api/admin/eu`);
  expect(new Headers(init?.headers).get("cookie")).toBe(request.headers.get("cookie"));
}

describe("middleware: primeira irmã inglesa publicada", () => {
  it("serve Sobre nos dois idiomas sem sessão nem consulta administrativa", async () => {
    for (const caminho of ["/sobre", "/en/sobre", "/en/sobre/"]) {
      const resposta = await middleware(requisicao(caminho));
      expect(resposta, caminho).toBeInstanceOf(NextResponse);
      expect(resposta.headers.get("x-middleware-next"), caminho).toBe("1");
      expect(resposta.headers.get("location"), caminho).toBeNull();
      expect(resposta.headers.get("x-middleware-rewrite"), caminho).toBeNull();
    }
    expect(fetchInterno).not.toHaveBeenCalled();
  });

  it("não abre descendentes ausentes, imagens sociais, recursos ou aliases de API em inglês", async () => {
    for (const caminho of [
      "/en", "/en/sobre/erros", "/en/sobre/governanca", "/en/sobrecarga",
      "/en/sobre/opengraph-image", "/en/home/credito.webp", "/en/_next/static/app.js",
      "/en/api/auth/eu", "/en/api/eficiencia-mobilidade/exportar",
      "/en/rota-que-ainda-nao-existe",
    ]) {
      const resposta = await middleware(requisicao(caminho));
      expect(resposta.status, caminho).toBe(307);
      const destino = new URL(resposta.headers.get("location")!);
      expect(destino.pathname, caminho).toBe("/entrar");
      expect(destino.searchParams.get("de"), caminho).toBe(caminho);
      expect(resposta.headers.get("x-middleware-next"), caminho).toBeNull();
      expect(resposta.headers.get("x-middleware-rewrite"), caminho).toBeNull();
    }
    expect(fetchInterno).not.toHaveBeenCalled();
  });

  it("mantém o 401 da API de dados no endereço compartilhado", async () => {
    const resposta = await middleware(requisicao("/api/eficiencia-mobilidade/exportar"));
    expect(resposta.status).toBe(401);
    expect(resposta.headers.get("location")).toBeNull();
    expect(resposta.cookies.get(COOKIE_DESTINO)).toBeUndefined();
    expect(fetchInterno).not.toHaveBeenCalled();
  });

  it.each(["/%65n/sobre", "/%65n/app/admin"])("mantém fechado o prefixo codificado em %s", async (rota) => {
    const caminho = `${rota}?origem=a%2Bb`;
    const semSessao = await middleware(requisicao(caminho));
    expect(semSessao.status).toBe(307);
    const login = new URL(semSessao.headers.get("location")!);
    expect(login.pathname).toBe("/entrar");
    expect(login.searchParams.get("de")).toBe(caminho);
    expect(semSessao.cookies.get(COOKIE_DESTINO)?.value).toBe(caminho);
    expect(semSessao.headers.get("x-middleware-next")).toBeNull();

    const comSessao = await middleware(requisicao(caminho, await assinarCookie()));
    expect(comSessao.headers.get("x-middleware-rewrite")).toBe(`${ORIGEM}/en/nao-encontrado-404`);
    expect(comSessao.headers.get("x-middleware-next")).toBeNull();
    expect(comSessao.headers.get("location")).toBeNull();
    expect(fetchInterno).not.toHaveBeenCalled();
  });
});

describe("middleware: autenticação e administração em inglês", () => {
  it.each(["ausente", "adulterado", "vencido"] as const)(
    "cookie %s leva ao login existente e conserva idioma, query e cookie de destino",
    async (estado) => {
      let cookie: string | undefined;
      if (estado === "vencido") cookie = await assinarCookie(-60 * 1000);
      if (estado === "adulterado") {
        const valido = await assinarCookie();
        cookie = valido.slice(0, -1) + (valido.endsWith("0") ? "1" : "0");
      }
      const caminho = "/en/app/admin?aba=sessoes&filtro=a%2Bb&aba=recentes";
      const resposta = await middleware(requisicao(caminho, cookie));
      expect(resposta.status).toBe(307);
      const destino = new URL(resposta.headers.get("location")!);
      expect(destino.origin).toBe(ORIGEM);
      expect(destino.pathname).toBe("/entrar");
      expect([...destino.searchParams.keys()]).toEqual(["de"]);
      expect(destino.searchParams.get("de")).toBe(caminho);
      expect(resposta.cookies.get(COOKIE_DESTINO)).toMatchObject({
        value: caminho, httpOnly: true, sameSite: "lax", path: "/",
      });
      expect(resposta.headers.get("X-Robots-Tag")).toBe("noindex");
      expect(resposta.headers.get("x-middleware-next")).toBeNull();
      expect(fetchInterno).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["/app/admin", "/nao-encontrado-404"],
    ["/en/app/admin", "/en/nao-encontrado-404"],
    ["/en/app/admin/sessoes", "/en/nao-encontrado-404"],
    ["/en/%61pp/admin", "/en/nao-encontrado-404"],
    ["/en/app/%61dmin/sessoes", "/en/nao-encontrado-404"],
  ])("sessão assinada sem permissão administrativa em %s recebe rewrite", async (caminho, alvo) => {
    fetchInterno.mockResolvedValue(new Response(null, { status: 403 }));
    const request = requisicao(`${caminho}?aba=sessoes`, await assinarCookie());
    const resposta = await middleware(request);
    conferirConsultaAdministrativa(request);
    // O middleware escolhe o destino; o status 404 final depende da renderização do Next.
    expect(resposta.headers.get("x-middleware-rewrite")).toBe(ORIGEM + alvo);
    expect(resposta.headers.get("x-middleware-next")).toBeNull();
    expect(resposta.headers.get("location")).toBeNull();
  });

  it("falha fechada quando a consulta administrativa inglesa lança erro", async () => {
    fetchInterno.mockRejectedValue(new Error("API administrativa indisponível"));
    const request = requisicao("/en/app/admin", await assinarCookie());
    const resposta = await middleware(request);
    conferirConsultaAdministrativa(request);
    expect(resposta.headers.get("x-middleware-rewrite")).toBe(`${ORIGEM}/en/nao-encontrado-404`);
    expect(resposta.headers.get("x-middleware-next")).toBeNull();
  });

  it.each(["/app/admin", "/en/app/admin"])("permite %s somente após a confirmação administrativa", async (caminho) => {
    fetchInterno.mockResolvedValue(Response.json({ ok: true }));
    const request = requisicao(caminho, await assinarCookie());
    const resposta = await middleware(request);
    conferirConsultaAdministrativa(request);
    expect(resposta.headers.get("x-middleware-next")).toBe("1");
    expect(resposta.headers.get("x-middleware-rewrite")).toBeNull();
    expect(resposta.headers.get("location")).toBeNull();
  });
});
