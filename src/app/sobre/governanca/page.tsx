import type { Metadata, ResolvingMetadata } from "next";
import { GovernancaConteudo } from "@/components/institucional/GovernancaConteudo";
import { TEXTOS_GOVERNANCA } from "@/i18n/paginas/governanca";
import { metadadosPortuguesComAlternativas } from "@/lib/i18n-metadata";

/** Constituição editorial em português; o conteúdo vive em GovernancaConteudo. */
export const dynamic = "force-static";

const metadadosOriginais: Metadata = {
  title: TEXTOS_GOVERNANCA.pt.titulo,
  description: TEXTOS_GOVERNANCA.pt.descricaoMeta,
  alternates: { canonical: "/sobre/governanca" },
};

export async function generateMetadata(_props: { params?: Record<string, string> }, parent: ResolvingMetadata): Promise<Metadata> {
  return metadadosPortuguesComAlternativas("/sobre/governanca", metadadosOriginais, await parent);
}

export default function GovernancaPage() {
  return <GovernancaConteudo idioma="pt" />;
}
