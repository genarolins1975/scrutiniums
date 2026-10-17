import type { Metadata, ResolvingMetadata } from "next";
import { alternativasDeIdioma, metadadosPortuguesComAlternativas } from "@/lib/i18n-metadata";
import { parDeIdioma } from "@/lib/i18n-rotas";
import { idiomaEnergia } from "./idioma";

/**
 * Head das páginas do Setor Elétrico nos dois idiomas, a partir de um só objeto escrito na página
 * portuguesa com tx(): em português, o head de antes mais os vínculos com a irmã inglesa; em
 * inglês, título e descrição ingleses, canonical próprio, alternates recíprocos e Open Graph
 * en_US sem a imagem social portuguesa.
 */
export async function metadadosEnergia(caminho: string, origem: Metadata, anterior?: ResolvingMetadata): Promise<Metadata> {
  if (idiomaEnergia() === "pt") {
    const pai = anterior ? await anterior : null;
    return metadadosPortuguesComAlternativas(caminho, origem, { openGraph: pai?.openGraph ?? null });
  }
  const par = parDeIdioma(caminho);
  if (!par) throw new Error(`Página sem irmã declarada: ${caminho}`);
  const t = origem.title;
  const absoluto = t && typeof t === "object" && "absolute" in t ? String(t.absolute) : null;
  const titulo = typeof t === "string" ? t : null;
  const descricao = typeof origem.description === "string" ? origem.description : undefined;
  const tituloSocial = absoluto ?? (titulo ? `${titulo} · Setor Elétrico · Scrutiniums` : "Setor Elétrico · Scrutiniums");
  const resto: Metadata = { ...origem };
  delete resto.openGraph;
  delete resto.twitter;
  delete resto.alternates;
  return {
    ...resto,
    alternates: alternativasDeIdioma(caminho, "en"),
    openGraph: {
      title: tituloSocial,
      description: descricao,
      siteName: "Scrutiniums",
      type: "website",
      url: par.en,
      locale: "en_US",
      alternateLocale: "pt_BR",
      images: [],
    },
    twitter: { card: "summary", title: tituloSocial, description: descricao, images: [] },
  };
}

/** Caminho concreto de uma página com parâmetro: "/a/[b]" com { b: "x" } vira "/a/x". */
export function caminhoComParametros(padrao: string, params: Record<string, string | string[] | undefined>): string {
  return padrao.replace(/\[([a-zA-Z0-9_]+)\]/g, (_, nome: string) => {
    const v = params[nome];
    return encodeURIComponent(Array.isArray(v) ? v.join("/") : String(v ?? ""));
  });
}
