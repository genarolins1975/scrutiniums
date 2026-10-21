import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { parDeIdioma } from "@/lib/i18n-rotas";
import { COOKIE_DESTINO, ehRotaPublica, prefetchDoLink } from "@/lib/rotasPublicas";
import { middleware } from "@/middleware";

const ORIGEM = "https://scrutiniums.com";
const PAGINAS = [
  { pt: "/entrar", en: "/en/entrar", prioridade: 0.3, conteudo: "traduzido" },
  { pt: "/cadastro", en: "/en/cadastro", prioridade: 0.6, conteudo: "portugues_marcado" },
  { pt: "/entrar/sms", en: "/en/entrar/sms", prioridade: 0.3, conteudo: "traduzido" },
  { pt: "/entrar/sms/verificar", en: "/en/entrar/sms/verificar", prioridade: 0.3, conteudo: "traduzido" },
] as const;

describe.each(PAGINAS)("entrada pública de autenticação $pt", (par) => {
  it("abre somente a irmã exata, sem preferência automática nem cookie no GET", async () => {
    for (const caminho of [par.pt, par.en, par.pt + "/", par.en + "/"]) {
      expect(parDeIdioma(caminho), caminho).toEqual({ pt: par.pt, en: par.en, conteudo: par.conteudo });
      expect(ehRotaPublica(caminho), caminho).toBe(true);
      expect(prefetchDoLink(caminho + "?de=%2Fen%2Fapp%2Fconta#formulario")).toBeUndefined();
      for (const preferencia of ["pt", "en"]) {
        const request = new NextRequest(ORIGEM + caminho + "?de=%2Fen%2Fapp%2Fconta%3Faba%3Da%252Bb%23perfil", {
          headers: {
            accept: "text/html", "accept-language": "en-US,en;q=0.9",
            cookie: `scrutiniums_idioma=${preferencia}`,
          },
        });
        const resposta = await middleware(request);
        expect(resposta.status, caminho).toBe(200);
        expect(resposta.headers.get("x-middleware-next"), caminho).toBe("1");
        expect(resposta.headers.get("location"), caminho).toBeNull();
        expect(resposta.headers.get("x-middleware-rewrite"), caminho).toBeNull();
        expect(resposta.headers.get("set-cookie"), caminho).toBeNull();
        expect(resposta.headers.get("X-Robots-Tag"), caminho).toBeNull();
      }
    }
  });

  it("publica prioridade e frequência explícitas da entrada PT e a irmã inglesa só quando traduzida", () => {
    const entradas = sitemap();
    const portuguesas = entradas.filter((entrada) => entrada.url === ORIGEM + par.pt);
    const inglesas = entradas.filter((entrada) => entrada.url === ORIGEM + par.en);
    const traduzida = par.conteudo === "traduzido";
    const alternates = traduzida ? { alternates: { languages: { "pt-BR": ORIGEM + par.pt, en: ORIGEM + par.en, "x-default": ORIGEM + par.pt } } } : {};
    const entrada = (url: string) => ({ url, lastModified: expect.any(Date), changeFrequency: "yearly", priority: par.prioridade, ...alternates });
    // as telas SMS ficam fora do sitemap nos dois idiomas
    const sms = par.pt.startsWith("/entrar/sms");
    expect(portuguesas).toEqual(sms ? [] : [entrada(ORIGEM + par.pt)]);
    expect(inglesas).toEqual(sms || !traduzida ? [] : [entrada(ORIGEM + par.en)]);
    for (const caminho of [par.pt, par.en]) expect(entradas.map((entrada) => entrada.url)).not.toContain(ORIGEM + caminho + "/");
  });
});

describe("publicar as entradas não publica o restante da autenticação inglesa", () => {
  it.each([
    "/entrar/verificar", "/cadastro/telefone",
    "/cadastro/perfil", "/cadastro/verificar-email", "/cadastro/acesso",
  ])("mantém %s pública em PT e sua irmã ausente fechada em EN", async (pt) => {
    expect(parDeIdioma(pt)).toBeNull();
    expect(ehRotaPublica(pt)).toBe(true);
    const en = "/en" + pt;
    expect(ehRotaPublica(en)).toBe(false);
    expect(prefetchDoLink(en + "?origem=cadastro#etapa")).toBe(false);
    const respostaPt = await middleware(new NextRequest(ORIGEM + pt));
    expect(respostaPt.headers.get("x-middleware-next")).toBe("1");
    expect(respostaPt.headers.get("location")).toBeNull();
    const respostaEn = await middleware(new NextRequest(ORIGEM + en));
    const login = new URL(respostaEn.headers.get("location")!);
    expect(respostaEn.status).toBe(307);
    expect(login.pathname).toBe("/en/entrar");
    expect(login.searchParams.get("de")).toBe(en);
    expect(respostaEn.headers.get("x-middleware-next")).toBeNull();
    expect(respostaEn.headers.get("x-middleware-rewrite")).toBeNull();
    expect(respostaEn.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(sitemap().map((entrada) => entrada.url)).not.toContain(ORIGEM + en);
  });

  it.each([
    ["/en/entrar/descendente-sintetico-i18n", "/en/entrar"],
    ["/en/cadastro/descendente-sintetico-i18n", "/en/entrar"],
    ["/en/entrarx", "/en/entrar"], ["/en/cadastrox", "/en/entrar"],
    ["/en/%65ntrar", "/en/entrar"], ["/en/%63adastro", "/en/entrar"],
    ["/%65n/entrar", "/entrar"], ["/%65n/cadastro", "/entrar"],
    ["/en/en/entrar", "/entrar"], ["/en/en/cadastro", "/entrar"],
    ["/en/entrar/opengraph-image", "/entrar"], ["/en/cadastro/twitter-image", "/entrar"],
    ["/en/api/auth/login", "/entrar"], ["/en/api/onboarding/email/start", "/entrar"],
    ["/en/entrar/sms/descendente-sintetico-i18n", "/en/entrar"],
    ["/en/entrar/sms/verificar/descendente-sintetico-i18n", "/en/entrar"],
    ["/en/entrar/smsx", "/en/entrar"], ["/en/entrar/sms/verificarx", "/en/entrar"],
    ["/en/entrar/%73ms", "/en/entrar"], ["/en/entrar/sms/%76erificar", "/en/entrar"],
    ["/%65n/entrar/sms", "/entrar"], ["/en/en/entrar/sms", "/entrar"],
    ["/en/entrar/sms/opengraph-image", "/entrar"], ["/en/entrar/sms/verificar/twitter-image", "/entrar"],
    ["/en/api/auth/entrar/start", "/entrar"], ["/en/api/auth/entrar/check", "/entrar"],
  ])("%s conserva a guarda e usa %s como entrada", async (caminho, entrada) => {
    expect(parDeIdioma(caminho)).toBeNull();
    expect(ehRotaPublica(caminho)).toBe(false);
    const destino = caminho + "?origem=a+b&origem=a%20b&de=%2Fapp%2Fconta&recorte=%2f";
    const resposta = await middleware(new NextRequest(ORIGEM + destino, { headers: { accept: "text/html" } }));
    const login = new URL(resposta.headers.get("location")!);
    expect(resposta.status).toBe(307);
    expect(login.origin).toBe(ORIGEM);
    expect(login.pathname).toBe(entrada);
    expect([...login.searchParams.keys()]).toEqual(["de"]);
    expect(login.searchParams.get("de")).toBe(destino);
    expect(resposta.cookies.get(COOKIE_DESTINO)).toMatchObject({
      value: destino, httpOnly: true, sameSite: "lax", path: "/", maxAge: 3600,
    });
    expect(resposta.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(resposta.headers.get("x-middleware-next")).toBeNull();
    expect(resposta.headers.get("x-middleware-rewrite")).toBeNull();
    expect(sitemap().map((item) => item.url)).not.toContain(ORIGEM + caminho);
  });
});

it("exclui as telas SMS públicas do sitemap e preserva seu bloqueio de rastreamento nos dois idiomas", () => {
  expect(robots()).toEqual({
    rules: [{
      userAgent: "*", allow: "/",
      disallow: ["/app", "/api/", "/entrar/sms", "/en/entrar/sms", "/cadastro/telefone", "/cadastro/perfil", "/cadastro/acesso"],
    }],
    sitemap: ORIGEM + "/sitemap.xml",
  });
  const entradas = sitemap().map((entrada) => entrada.url);
  for (const caminho of ["/entrar/sms", "/en/entrar/sms", "/entrar/sms/verificar", "/en/entrar/sms/verificar"]) {
    expect(entradas.filter((url) => url === ORIGEM + caminho)).toHaveLength(0);
    expect(entradas.filter((url) => url.startsWith(ORIGEM + caminho + "?"))).toHaveLength(0);
  }
});
