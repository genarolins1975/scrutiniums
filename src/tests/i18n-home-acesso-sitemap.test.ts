import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { parDeIdioma } from "@/lib/i18n-rotas";
import { COOKIE_DESTINO, ehRotaPublica, prefetchDoLink } from "@/lib/rotasPublicas";
import { middleware } from "@/middleware";

const ORIGEM = "https://scrutiniums.com";
const PAR = { pt: "/", en: "/en", conteudo: "parcialmente_traduzido" };

describe("home parcialmente traduzida na fronteira de acesso", () => {
  it("declara o par raiz sem transformar a barra dupla em uma rota", () => {
    for (const caminho of ["/", "/en", "/en/", "/?origem=a+b#obs-credito", "/en?origem=a+b#obs-credito"]) {
      expect(parDeIdioma(caminho), caminho).toEqual(PAR);
    }
    for (const caminho of ["//", "/en//", "/en/en", "/en/rota-sintetica-sem-irma"]) {
      expect(parDeIdioma(caminho), caminho).toBeNull();
    }
  });

  it.each(["/", "/en", "/en/"])("serve %s sem sessão e sem redirecionar por preferência", async (caminho) => {
    for (const preferencia of ["pt", "en"]) {
      const request = new NextRequest(ORIGEM + caminho + "?origem=a%2Bb&origem=c", {
        headers: { accept: "text/html", "accept-language": "en-US,en;q=0.9", cookie: `scrutiniums_idioma=${preferencia}` },
      });
      expect(ehRotaPublica(caminho)).toBe(true);
      expect(prefetchDoLink(caminho + "?origem=menu#obs-credito")).toBeUndefined();
      const resposta = await middleware(request);
      expect(resposta.status).toBe(200);
      expect(resposta.headers.get("x-middleware-next")).toBe("1");
      expect(resposta.headers.get("location")).toBeNull();
      expect(resposta.headers.get("x-middleware-rewrite")).toBeNull();
      expect(resposta.cookies.get(COOKIE_DESTINO)).toBeUndefined();
      expect(resposta.cookies.get("scrutiniums_idioma")).toBeUndefined();
    }
  });

  it("mantém a conta e os painéis fechados e não publica imagens ou endpoints ingleses", async () => {
    const caminhos = [
      "/app/observatorios", "/en/app/observatorios", "/app/conta", "/en/app/conta",
      "/observatorio", "/en/observatorio", "/setor-eletrico/pld", "/en/setor-eletrico/pld",
      "/en/opengraph-image", "/en/twitter-image", "/en/api/auth/eu", "/en/home/credito.webp",
      "/en/rota-sintetica-sem-irma",
    ];
    for (const caminho of caminhos) {
      expect(parDeIdioma(caminho), caminho).toBeNull();
      expect(ehRotaPublica(caminho), caminho).toBe(false);
      expect(prefetchDoLink(caminho), caminho).toBe(false);
      const destino = caminho + "?origem=home&recorte=a%2Bb";
      const resposta = await middleware(new NextRequest(ORIGEM + destino, { headers: { accept: "text/html" } }));
      const login = new URL("/entrar", ORIGEM);
      login.searchParams.set("de", destino);
      expect(resposta.status, caminho).toBe(307);
      expect(resposta.headers.get("location"), caminho).toBe(login.href);
      expect(resposta.headers.get("x-middleware-next"), caminho).toBeNull();
      expect(resposta.headers.get("x-middleware-rewrite"), caminho).toBeNull();
    }
    expect(ehRotaPublica("/opengraph-image")).toBe(true);
    expect(ehRotaPublica("/api/auth/eu")).toBe(true);
    expect(ehRotaPublica("/home/credito.webp")).toBe(true);
  });
});

describe("sitemap da home", () => {
  it("preserva a URL PT sem barra, prioridade e frequência, com a irmã e alternativas recíprocas", () => {
    const entradas = sitemap();
    const raiz = entradas.filter((entrada) => new URL(entrada.url).pathname === "/");
    const inglesa = entradas.filter((entrada) => new URL(entrada.url).pathname === "/en");
    expect(raiz).toEqual([{
      url: ORIGEM, priority: 1.0, changeFrequency: "weekly", lastModified: expect.any(Date),
      alternates: { languages: { "pt-BR": ORIGEM, en: ORIGEM + "/en", "x-default": ORIGEM } },
    }]);
    expect(inglesa).toEqual([{ ...raiz[0], url: ORIGEM + "/en" }]);
    expect(entradas.map((entrada) => entrada.url)).not.toContain(ORIGEM + "/");
    expect(entradas.map((entrada) => entrada.url)).not.toContain(ORIGEM + "/en/");
    expect(new Set(entradas.map((entrada) => entrada.url)).size).toBe(entradas.length);
  });
});
