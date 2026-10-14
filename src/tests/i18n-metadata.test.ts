import type { Metadata, ResolvingMetadata } from "next";
import { describe, expect, it } from "vitest";
import { metadadosPortuguesComAlternativas } from "@/lib/i18n-metadata";

type Anterior = Pick<Awaited<ResolvingMetadata>, "openGraph">;

function metadadosDoPai(): Anterior {
  return {
    openGraph: {
      type: "article",
      title: { absolute: "Título já resolvido · Scrutiniums", template: "%s · Scrutiniums" },
      description: "Descrição herdada",
      siteName: "Scrutiniums",
      url: null,
      locale: "pt_BR",
      images: [{
        url: "https://scrutiniums.com/imagem.png",
        alt: "Descrição da imagem",
        type: "image/png",
        width: 1200,
        height: 630,
      }],
      publishedTime: "2026-10-14T12:00:00Z",
      authors: ["https://scrutiniums.com/sobre"],
      tags: ["Metodologia"],
    },
  };
}

describe("composição dos metadados portugueses com irmãs declaradas", () => {
  it("preserva o OG herdado, seu tipo e o título absoluto sem aplicar outro template", () => {
    const anterior = metadadosDoPai();
    const origem: Metadata = {
      title: "Título da folha",
      description: "Descrição da folha",
      alternates: {
        canonical: "/sobre",
        types: { "application/rss+xml": "/feed.xml" },
        media: { "only screen and (max-width: 600px)": "/sobre-movel" },
      },
      robots: { index: true, follow: true },
      other: { "atributo-proprio": "Valor preservado" },
    };
    const anteriorAntes = structuredClone(anterior);
    const origemAntes = structuredClone(origem);
    Object.freeze(anterior.openGraph);
    Object.freeze(origem);

    const resultado = metadadosPortuguesComAlternativas("/sobre", origem, anterior);

    expect(resultado).toEqual({
      ...origemAntes,
      alternates: {
        ...origemAntes.alternates,
        languages: { "pt-BR": "/sobre", en: "/en/sobre", "x-default": "/sobre" },
      },
      openGraph: {
        ...anteriorAntes.openGraph,
        title: { absolute: "Título já resolvido · Scrutiniums" },
        url: "/sobre",
        locale: "pt_BR",
        alternateLocale: "en_US",
      },
    });
    expect(resultado).not.toHaveProperty("twitter");
    expect(anterior).toEqual(anteriorAntes);
    expect(origem).toEqual(origemAntes);
  });

  it("OG próprio substitui o herdado inteiro, sem acrescentar imagem, autoria ou siteName", () => {
    const origem: Metadata = {
      title: "Título da página",
      openGraph: {
        title: "Título social próprio",
        description: "Descrição social própria",
        type: "website",
      },
    };
    const resultado = metadadosPortuguesComAlternativas("/sobre", origem, metadadosDoPai());

    expect(resultado.openGraph).toEqual({
      title: "Título social próprio",
      description: "Descrição social própria",
      type: "website",
      url: "/sobre",
      locale: "pt_BR",
      alternateLocale: "en_US",
    });
    expect(resultado).not.toHaveProperty("twitter");
  });

  it("mantém template, imagens vazias e Twitter explícitos da folha", () => {
    const origem: Metadata = {
      openGraph: {
        type: "website",
        title: { default: "Título próprio", template: "%s · Catálogo" },
        images: [],
      },
      twitter: { card: "summary", title: "Cartão próprio", images: [] },
    };
    const resultado = metadadosPortuguesComAlternativas("/sobre", origem, metadadosDoPai());

    expect(resultado.openGraph).toEqual({
      ...origem.openGraph,
      url: "/sobre",
      locale: "pt_BR",
      alternateLocale: "en_US",
    });
    expect(resultado.twitter).toEqual(origem.twitter);
    expect(origem.openGraph).not.toHaveProperty("url");
  });

  it("não inventa título, imagem ou tipo quando o pai também não tem OG", () => {
    const resultado = metadadosPortuguesComAlternativas("/sobre", {}, { openGraph: null });
    expect(resultado.openGraph).toEqual({ url: "/sobre", locale: "pt_BR", alternateLocale: "en_US" });
  });

  it.each([null, undefined])("recusa a remoção explícita de OG com %s", (openGraph) => {
    expect(() => metadadosPortuguesComAlternativas("/sobre", { openGraph }, metadadosDoPai()))
      .toThrow("Open Graph removido explicitamente não é suportado");
  });

  it("recusa anunciar alternativas para uma página sem irmã declarada", () => {
    expect(() => metadadosPortuguesComAlternativas("/rota-sintetica-sem-irma-metadata", {}, metadadosDoPai()))
      .toThrow("Página sem irmã declarada");
  });
});
