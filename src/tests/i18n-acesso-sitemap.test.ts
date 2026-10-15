import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { PARES_DE_IDIOMA, parDeIdioma, traducaoPublicada } from "@/lib/i18n-rotas";
import { ehApiDeDados, ehRotaPublica, prefetchDoLink } from "@/lib/rotasPublicas";

describe("acesso das irmãs declaradas", () => {
  it("aplica a política PT a cada par e abre Sobre nos dois idiomas", () => {
    for (const caminho of ["/sobre", "/sobre/", "/en/sobre", "/en/sobre/"]) {
      expect(ehRotaPublica(caminho), caminho).toBe(true);
    }
    for (const par of PARES_DE_IDIOMA) {
      expect(ehRotaPublica(par.en), par.en).toBe(ehRotaPublica(par.pt));
    }
    expect(prefetchDoLink("/en/sobre?origem=menu#contato")).toBeUndefined();
  });

  it("não abre descendentes ainda não publicados nem imagens e arquivos por recursão", () => {
    const aindaSemIrma = ["/sobre/erros", "/sobre/governanca", "/entrar"]
      .filter((caminho) => !parDeIdioma(caminho));
    for (const caminho of aindaSemIrma) {
      expect(ehRotaPublica(caminho), caminho).toBe(true);
      expect(ehRotaPublica("/en" + caminho), caminho).toBe(false);
    }
    for (const caminho of [
      "/en/sobre/rota-inexistente-i18n", "/en/sobre/opengraph-image",
      "/en/sobre/twitter-image", "/en/home/credito.webp", "/en/_next/static/app.js",
      "/en/api/auth/eu", "/en/api/eficiencia-mobilidade/exportar",
      "/en/obs/data/gold/meta.json", "/en/app/admin", "/en/app/admin/contas",
      "/en/en/sobre", "/enx/sobre", "/%65n/sobre", "/en/%73obre",
      "/en/sobre?origem=menu", "/en/sobre#contato",
    ]) expect(ehRotaPublica(caminho), caminho).toBe(false);
    expect(prefetchDoLink("/en/sobre/rota-inexistente-i18n?origem=menu")).toBe(false);
    expect(ehRotaPublica("/sobre/opengraph-image")).toBe(true);
    expect(ehRotaPublica("/api/auth/eu")).toBe(true);
    expect(ehApiDeDados("/api/eficiencia-mobilidade/exportar")).toBe(true);
    expect(ehApiDeDados("/en/api/eficiencia-mobilidade/exportar")).toBe(false);
  });
});

describe("sitemap dos pares publicados", () => {
  const base = "https://scrutiniums.com";
  const entradas = sitemap();

  it("publica somente irmãs declaradas e públicas, sem duplicar URLs", () => {
    const inglesas = entradas.filter((e) => new URL(e.url).pathname === "/en" || new URL(e.url).pathname.startsWith("/en/"));
    const esperadas = PARES_DE_IDIOMA.filter((par) => ehRotaPublica(par.pt) && traducaoPublicada(par.pt) && !par.pt.startsWith("/entrar/sms")).map((par) => base + par.en);
    expect(inglesas.map((e) => e.url).sort()).toEqual(esperadas.sort());
    expect(inglesas.map((e) => e.url)).not.toContain(base + "/en/sobre");
    expect(new Set(entradas.map((e) => e.url)).size).toBe(entradas.length);
    for (const entrada of entradas) expect(ehRotaPublica(new URL(entrada.url).pathname), entrada.url).toBe(true);
  });

  it("preserva os dados da entrada PT e produz alternates recíprocos absolutos", () => {
    for (const par of PARES_DE_IDIOMA.filter((p) => ehRotaPublica(p.pt) && traducaoPublicada(p.pt) && !p.pt.startsWith("/entrar/sms"))) {
      const pt = entradas.find((e) => new URL(e.url).pathname === par.pt);
      const en = entradas.find((e) => new URL(e.url).pathname === par.en);
      expect(pt, par.pt).toBeDefined();
      expect(en, par.en).toEqual({ ...pt, url: base + par.en });
      expect(pt?.alternates?.languages).toEqual({
        "pt-BR": base + par.pt, en: base + par.en, "x-default": base + par.pt,
      });
    }
    for (const entrada of entradas) {
      if (!traducaoPublicada(new URL(entrada.url).pathname)) expect(entrada.alternates?.languages?.en).toBeUndefined();
    }
  });
});
