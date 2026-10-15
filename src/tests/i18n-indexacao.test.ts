import { describe, expect, it } from "vitest";
import { alternativasDeIdioma, metadadosPortuguesApenas } from "@/lib/i18n-metadata";
import { PARES_DE_IDIOMA, traducaoPublicada } from "@/lib/i18n-rotas";
import sitemap from "@/app/sitemap";

describe("publicação condicionada à tradução", () => {
  it("não anuncia nem indexa cópias em português sob /en", () => {
    const entradas = sitemap();
    for (const par of PARES_DE_IDIOMA.filter((p) => p.conteudo === "portugues_marcado")) {
      expect(traducaoPublicada(par.en)).toBe(false);
      expect(metadadosPortuguesApenas(par.pt).robots).toEqual({ index: false, follow: true });
      for (const idioma of ["pt", "en"] as const) {
        expect(alternativasDeIdioma(par.pt, idioma)).toEqual({ canonical: par[idioma] });
      }
      expect(entradas.some((e) => new URL(e.url).pathname === par.en)).toBe(false);
      expect(entradas.find((e) => new URL(e.url).pathname === par.pt)?.alternates?.languages).toBeUndefined();
    }
  });

  it("não inclui etapas de SMS no sitemap em nenhum idioma", () => {
    expect(sitemap().some((e) => /^\/(?:en\/)?entrar\/sms(?:\/|$)/.test(new URL(e.url).pathname))).toBe(false);
  });
});
