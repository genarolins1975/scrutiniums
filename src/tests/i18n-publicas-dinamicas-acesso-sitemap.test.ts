import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { parDeIdioma } from "@/lib/i18n-rotas";
import { COOKIE_DESTINO, ehRotaPublica, prefetchDoLink } from "@/lib/rotasPublicas";
import { middleware } from "@/middleware";

const ORIGEM = "https://scrutiniums.com";
const PAGINAS = [
  { pt: "/glossario", en: "/en/glossario", prioridade: 0.8, frequencia: "monthly" },
  { pt: "/termos", en: "/en/termos", prioridade: 0.2, frequencia: "yearly" },
  { pt: "/privacidade", en: "/en/privacidade", prioridade: 0.2, frequencia: "yearly" },
] as const;
const FECHADAS = [
  ...PAGINAS.flatMap((par) => [par.pt, par.en].flatMap((caminho) => [
    caminho + "/descendente-sintetico-i18n", caminho + "x",
  ])),
  ...PAGINAS.flatMap((par) => [par.en + "/opengraph-image", par.en + "/twitter-image"]),
  ...["", "/en"].flatMap((prefixo) => [
    "/app/conta", "/app/observatorios", "/observatorio", "/setor-eletrico/pld",
    "/obs/data/gold/meta.json", "/obs/embed.html",
  ].map((caminho) => prefixo + caminho)),
  "/en/api/auth/eu", "/en/api/eficiencia-mobilidade/exportar", "/en/home/credito.webp",
  "/%65n/glossario", "/en/%74ermos", "/en/en/privacidade",
];

describe.each(PAGINAS)("acesso e sitemap da irmã pública $pt", (par) => {
  it("reconhece somente o par exato e permite prefetch dos destinos com query e fragmento", () => {
    const esperado = { pt: par.pt, en: par.en, conteudo: "portugues_marcado" };
    for (const caminho of [par.pt, par.en, par.pt + "/", par.en + "/"]) {
      expect(parDeIdioma(caminho), caminho).toEqual(esperado);
      expect(parDeIdioma(caminho + "?origem=a+b&origem=a%20b#conteudo"), caminho).toEqual(esperado);
      expect(ehRotaPublica(caminho), caminho).toBe(true);
      expect(prefetchDoLink(caminho + "?origem=menu#conteudo"), caminho).toBeUndefined();
    }
    for (const nome of ["opengraph-image", "twitter-image"]) {
      // A política preexistente de imagens PT não publica uma imagem inglesa.
      expect(ehRotaPublica(par.pt + "/" + nome)).toBe(true);
      expect(ehRotaPublica(par.en + "/" + nome)).toBe(false);
    }
  });

  it("permite visitantes nos dois idiomas sem redirecionar nem gravar preferência no GET", async () => {
    for (const caminho of [par.pt, par.en, par.pt + "/", par.en + "/"]) {
      for (const preferencia of ["pt", "en"]) {
        const request = new NextRequest(ORIGEM + caminho + "?origem=a%2Bb&origem=c", {
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
        expect(resposta.cookies.get(COOKIE_DESTINO), caminho).toBeUndefined();
        expect(resposta.cookies.get("scrutiniums_idioma"), caminho).toBeUndefined();
      }
    }
  });

  it("conserva a entrada PT e publica uma irmã com alternates recíprocos", () => {
    const entradas = sitemap();
    const languages = { "pt-BR": ORIGEM + par.pt, en: ORIGEM + par.en, "x-default": ORIGEM + par.pt };
    const portuguesas = entradas.filter((entrada) => entrada.url === ORIGEM + par.pt);
    const inglesas = entradas.filter((entrada) => entrada.url === ORIGEM + par.en);
    expect(portuguesas).toEqual([{
      url: ORIGEM + par.pt,
      lastModified: expect.any(Date),
      changeFrequency: par.frequencia,
      priority: par.prioridade,
      alternates: { languages },
    }]);
    expect(inglesas).toEqual([{ ...portuguesas[0], url: ORIGEM + par.en }]);
    for (const caminho of [par.pt, par.en]) expect(entradas.map((entrada) => entrada.url)).not.toContain(ORIGEM + caminho + "/");
  });
});

describe("publicação exata das três páginas sem ampliar a fronteira pública", () => {
  it("mantém descendentes, painéis, conta e recursos protegidos e conserva o destino do login", async () => {
    for (const caminho of FECHADAS) {
      expect(parDeIdioma(caminho), caminho).toBeNull();
      expect(ehRotaPublica(caminho), caminho).toBe(false);
      expect(prefetchDoLink(caminho + "?origem=menu#conteudo"), caminho).toBe(false);
      const destino = caminho + "?origem=publica&recorte=a%2Bb&recorte=c";
      const resposta = await middleware(new NextRequest(ORIGEM + destino, { headers: { accept: "text/html" } }));
      const login = new URL("/entrar", ORIGEM);
      login.searchParams.set("de", destino);
      expect(resposta.status, caminho).toBe(307);
      expect(resposta.headers.get("location"), caminho).toBe(login.href);
      expect(resposta.headers.get("x-middleware-next"), caminho).toBeNull();
      expect(resposta.headers.get("x-middleware-rewrite"), caminho).toBeNull();
      expect(resposta.headers.get("X-Robots-Tag"), caminho).toBe("noindex");
      expect(resposta.cookies.get(COOKIE_DESTINO)?.value, caminho).toBe(destino);
    }
    expect(ehRotaPublica("/api/auth/eu")).toBe(true);
    expect(ehRotaPublica("/home/credito.webp")).toBe(true);
  });

  it("mantém os vizinhos fechados fora do sitemap e conserva a raiz PT sem barra", () => {
    const urls = sitemap().map((entrada) => entrada.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const caminho of FECHADAS) expect(urls, caminho).not.toContain(ORIGEM + caminho);
    expect(urls.filter((url) => new URL(url).pathname === "/")).toEqual([ORIGEM]);
  });
});
