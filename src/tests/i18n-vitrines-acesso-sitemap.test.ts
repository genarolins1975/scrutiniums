import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { parDeIdioma } from "@/lib/i18n-rotas";
import { COOKIE_DESTINO, ehRotaPublica, prefetchDoLink } from "@/lib/rotasPublicas";
import { middleware } from "@/middleware";

const ORIGEM = "https://scrutiniums.com";
const VITRINES = [
  { pt: "/imprensa", en: "/en/imprensa", frequencia: "weekly" },
  { pt: "/observatorio-do-credito", en: "/en/observatorio-do-credito", frequencia: "daily" },
] as const;
const FECHADAS = [
  ["/observatorio", "/entrar"], ["/observatorio/pix", "/entrar"],
  ["/obs/index.html", "/entrar"], ["/obs/embed.html", "/entrar"],
  ["/obs/data/gold/meta.json", "/entrar"], ["/obs/app.min.js", "/entrar"], ["/obs/styles.css", "/entrar"],
  ["/imprensa/descendente-sintetico-i18n", "/entrar"],
  ["/observatorio-do-credito/descendente-sintetico-i18n", "/entrar"],
  ["/imprensax", "/entrar"], ["/observatorio-do-creditox", "/entrar"],
  ["/en/observatorio", "/en/entrar"], ["/en/observatorio/pix", "/en/entrar"],
  ["/en/obs/index.html", "/entrar"], ["/en/obs/embed.html", "/entrar"],
  ["/en/obs/data/gold/meta.json", "/entrar"], ["/en/obs/app.min.js", "/entrar"], ["/en/obs/styles.css", "/entrar"],
  ["/en/imprensa/descendente-sintetico-i18n", "/en/entrar"],
  ["/en/observatorio-do-credito/descendente-sintetico-i18n", "/en/entrar"],
  ["/en/imprensax", "/en/entrar"], ["/en/observatorio-do-creditox", "/en/entrar"],
  ["/en/imprensa/opengraph-image", "/entrar"], ["/en/imprensa/twitter-image", "/entrar"],
  ["/en/observatorio-do-credito/opengraph-image", "/entrar"], ["/en/observatorio-do-credito/twitter-image", "/entrar"],
] as const;

function requisicao(caminho: string): NextRequest {
  return new NextRequest(ORIGEM + caminho, { headers: { accept: "text/html" } });
}

describe.each(VITRINES)("fronteira pública da vitrine $pt", (par) => {
  it("declara somente o par exato e permite as duas páginas sem sessão", async () => {
    const esperado = { pt: par.pt, en: par.en, conteudo: "portugues_marcado" };
    for (const caminho of [par.pt, par.en, par.pt + "/", par.en + "/"]) {
      expect(parDeIdioma(caminho), caminho).toEqual(esperado);
      expect(ehRotaPublica(caminho), caminho).toBe(true);
      expect(prefetchDoLink(caminho + "?origem=menu#conteudo"), caminho).toBeUndefined();
      const resposta = await middleware(requisicao(caminho + "?origem=menu"));
      expect(resposta.status, caminho).toBe(200);
      expect(resposta.headers.get("x-middleware-next"), caminho).toBe("1");
      expect(resposta.headers.get("location"), caminho).toBeNull();
      expect(resposta.headers.get("x-middleware-rewrite"), caminho).toBeNull();
      expect(resposta.cookies.get(COOKIE_DESTINO), caminho).toBeUndefined();
    }
  });

  it("não interpreta a publicação como prefixo público nem como uma SPA traduzida", () => {
    for (const caminho of [par.pt + "/descendente-sintetico-i18n", par.en + "/descendente-sintetico-i18n"]) {
      expect(parDeIdioma(caminho), caminho).toBeNull();
      expect(ehRotaPublica(caminho), caminho).toBe(false);
    }
    // A política PT preexistente das imagens sociais é distinta da publicação EN.
    expect(ehRotaPublica(par.pt + "/opengraph-image")).toBe(true);
    expect(ehRotaPublica(par.en + "/opengraph-image")).toBe(false);
  });

  it("conserva o sitemap português sem anunciar tradução inexistente", () => {
    const entradas = sitemap();
    const portuguesas = entradas.filter((entrada) => entrada.url === ORIGEM + par.pt);
    const inglesas = entradas.filter((entrada) => entrada.url === ORIGEM + par.en);
    expect(portuguesas).toEqual([{
      url: ORIGEM + par.pt,
      lastModified: expect.any(Date),
      changeFrequency: par.frequencia,
      priority: 0.9,
    }]);
    expect(inglesas).toEqual([]);
  });
});

describe("vizinhos das vitrines continuam atrás da conta", () => {
  it("mantém painéis, arquivos, embeds e descendentes fechados nos dois idiomas", async () => {
    for (const [caminho, entrada] of FECHADAS) {
      expect(parDeIdioma(caminho), caminho).toBeNull();
      expect(ehRotaPublica(caminho), caminho).toBe(false);
      expect(prefetchDoLink(caminho + "?origem=vitrine#recorte"), caminho).toBe(false);
      const destino = caminho + "?origem=vitrine&recorte=a%2Bb";
      const resposta = await middleware(requisicao(destino));
      const login = new URL(entrada, ORIGEM);
      login.searchParams.set("de", destino);
      expect(resposta.status, caminho).toBe(307);
      expect(resposta.headers.get("location"), caminho).toBe(login.href);
      expect(resposta.headers.get("x-middleware-next"), caminho).toBeNull();
      expect(resposta.headers.get("x-middleware-rewrite"), caminho).toBeNull();
      expect(resposta.headers.get("X-Robots-Tag"), caminho).toBe("noindex");
      expect(resposta.cookies.get(COOKIE_DESTINO)?.value, caminho).toBe(destino);
    }
  });

  it("não anuncia os vizinhos fechados nem duplica URLs no sitemap", () => {
    const urls = sitemap().map((entrada) => entrada.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const [caminho] of FECHADAS) expect(urls, caminho).not.toContain(ORIGEM + caminho);
  });
});
