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
  ...["", "/en"].flatMap((prefixo) => [
    "/observatorio", "/observatorio/pix", "/obs/index.html", "/obs/embed.html",
    "/obs/data/gold/meta.json", "/obs/app.min.js", "/obs/styles.css",
    "/imprensa/descendente-sintetico-i18n", "/observatorio-do-credito/descendente-sintetico-i18n",
    "/imprensax", "/observatorio-do-creditox",
  ].map((caminho) => prefixo + caminho)),
  "/en/imprensa/opengraph-image", "/en/imprensa/twitter-image",
  "/en/observatorio-do-credito/opengraph-image", "/en/observatorio-do-credito/twitter-image",
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

  it("conserva prioridade e frequência do sitemap com alternates recíprocos", () => {
    const entradas = sitemap();
    const languages = { "pt-BR": ORIGEM + par.pt, en: ORIGEM + par.en, "x-default": ORIGEM + par.pt };
    const portuguesas = entradas.filter((entrada) => entrada.url === ORIGEM + par.pt);
    const inglesas = entradas.filter((entrada) => entrada.url === ORIGEM + par.en);
    expect(portuguesas).toEqual([{
      url: ORIGEM + par.pt,
      lastModified: expect.any(Date),
      changeFrequency: par.frequencia,
      priority: 0.9,
      alternates: { languages },
    }]);
    expect(inglesas).toEqual([{ ...portuguesas[0], url: ORIGEM + par.en }]);
  });
});

describe("vizinhos das vitrines continuam atrás da conta", () => {
  it("mantém painéis, arquivos, embeds e descendentes fechados nos dois idiomas", async () => {
    for (const caminho of FECHADAS) {
      expect(parDeIdioma(caminho), caminho).toBeNull();
      expect(ehRotaPublica(caminho), caminho).toBe(false);
      expect(prefetchDoLink(caminho + "?origem=vitrine#recorte"), caminho).toBe(false);
      const destino = caminho + "?origem=vitrine&recorte=a%2Bb";
      const resposta = await middleware(requisicao(destino));
      const login = new URL("/entrar", ORIGEM);
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
    for (const caminho of FECHADAS) expect(urls, caminho).not.toContain(ORIGEM + caminho);
  });
});
