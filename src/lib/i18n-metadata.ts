import type { Metadata } from "next";
import { en } from "@/i18n/en";
import type { Idioma } from "./idioma";
import { parDeIdioma } from "./i18n-rotas";

/** Só anuncia alternates quando as duas fontes da página estão declaradas. */
export function alternativasDeIdioma(caminho: string, idioma: Idioma): Metadata["alternates"] {
  const par = parDeIdioma(caminho);
  if (!par) throw new Error(`Página sem irmã declarada: ${caminho}`);
  return {
    canonical: par[idioma],
    languages: { "pt-BR": par.pt, en: par.en, "x-default": par.pt },
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
