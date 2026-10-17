import type { Metadata, ResolvingMetadata } from "next";
import { SobreConteudo } from "@/components/institucional/SobreConteudo";
import { TEXTOS_SOBRE } from "@/i18n/paginas/sobre";
import { metadadosPortuguesComAlternativas } from "@/lib/i18n-metadata";

/** Sobre a plataforma, em português; o conteúdo vive em SobreConteudo, comum aos dois idiomas. */
export const dynamic = "force-static";

const metadadosOriginais: Metadata = {
  title: TEXTOS_SOBRE.pt.titulo,
  description: TEXTOS_SOBRE.pt.descricaoMeta,
  alternates: { canonical: "/sobre" },
};

export async function generateMetadata(_props: { params?: Record<string, string> }, parent: ResolvingMetadata): Promise<Metadata> {
  return metadadosPortuguesComAlternativas("/sobre", metadadosOriginais, await parent);
}

export default function SobrePage() {
  return <SobreConteudo idioma="pt" />;
}
