import type { Metadata, ResolvingMetadata } from "next";
import { en } from "@/i18n/en";
import type { Idioma } from "./idioma";
import { parDeIdioma, traducaoPublicada } from "./i18n-rotas";

/** Só anuncia alternates quando há tradução publicada. */
export function alternativasDeIdioma(caminho: string, idioma: Idioma): Metadata["alternates"] {
  const par = parDeIdioma(caminho);
  if (!par) throw new Error(`Página sem irmã declarada: ${caminho}`);
  return {
    canonical: par[idioma],
    ...(traducaoPublicada(caminho) ? { languages: { "pt-BR": par.pt, en: par.en, "x-default": par.pt } } : {}),
  };
}

/** Preserva o head PT e acrescenta somente o vínculo com a irmã declarada. */
export function metadadosPortuguesComAlternativas(
  caminho: string,
  origem: Metadata,
  anterior: Pick<Awaited<ResolvingMetadata>, "openGraph">,
): Metadata {
  const par = parDeIdioma(caminho);
  if (!par) throw new Error(`Página sem irmã declarada: ${caminho}`);
  // No Next, o campo presente com undefined também remove o OG herdado.
  if (origem.openGraph === null || ("openGraph" in origem && origem.openGraph === undefined)) {
    throw new Error("Open Graph removido explicitamente não é suportado pelos metadados bilíngues");
  }

  // Como no Next, um OG próprio substitui o herdado inteiro, inclusive imagens.
  let openGraph = origem.openGraph;
  if (openGraph === undefined && anterior.openGraph) {
    openGraph = {
      ...anterior.openGraph,
      title: { absolute: anterior.openGraph.title.absolute },
      url: anterior.openGraph.url ?? undefined,
    };
  }

  return {
    ...origem,
    alternates: { ...origem.alternates, ...alternativasDeIdioma(caminho, "pt") },
    openGraph: {
      ...openGraph,
      url: par.pt,
      locale: "pt_BR",
      alternateLocale: "en_US",
    },
  };
}

/** Metadados da infraestrutura enquanto o conteúdo continua explicitamente em PT. */
export function metadadosPortuguesApenas(caminho: string): Metadata {
  const aviso = en["traducao.portugues_apenas"].texto;
  const titulo = `Scrutiniums · ${aviso}`;
  const alternates = alternativasDeIdioma(caminho, "en");
  return {
    title: { absolute: titulo },
    description: aviso,
    alternates,
    robots: { index: false, follow: true },
    openGraph: {
      title: titulo,
      description: aviso,
      siteName: "Scrutiniums",
      type: "website",
      url: parDeIdioma(caminho)!.en,
      locale: "en_US",
      alternateLocale: "pt_BR",
      images: [],
    },
    twitter: { card: "summary", title: titulo, description: aviso, images: [] },
  };
}
