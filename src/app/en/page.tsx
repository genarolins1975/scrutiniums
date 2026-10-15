import type { Metadata } from "next";
import { en } from "@/i18n/en";
import { alternativasDeIdioma } from "@/lib/i18n-metadata";
import { Home } from "@/components/home/Home";

export function generateMetadata(): Metadata {
  const descricao = `${en["home.hero.titulo_inicio"].texto}${en["home.hero.titulo_destaque"].texto}.`;
  const titulo = `Scrutiniums · ${descricao}`;
  return {
    title: { absolute: titulo },
    description: descricao,
    alternates: alternativasDeIdioma("/", "en"),
    openGraph: {
      title: titulo,
      description: descricao,
      siteName: "Scrutiniums",
      type: "website",
      url: "/en",
      locale: "en_US",
      alternateLocale: "pt_BR",
      images: [],
    },
    twitter: { card: "summary", title: titulo, description: descricao, images: [] },
  };
}

export default async function HomeEnPage() {
  return Home({ idioma: "en" });
}
