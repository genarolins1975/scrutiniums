import type { Metadata, ResolvingMetadata } from "next";
import { ErrosConteudo } from "@/components/institucional/ErrosConteudo";
import { TEXTOS_ERROS } from "@/i18n/paginas/erros";
import { metadadosPortuguesComAlternativas } from "@/lib/i18n-metadata";

/** Registro público de erros, em português; o conteúdo vive em ErrosConteudo. */
export const dynamic = "force-static";

const metadadosOriginais: Metadata = {
  title: TEXTOS_ERROS.pt.titulo,
  description: TEXTOS_ERROS.pt.descricaoMeta,
  alternates: { canonical: "/sobre/erros" },
};

export async function generateMetadata(_props: { params?: Record<string, string> }, parent: ResolvingMetadata): Promise<Metadata> {
  return metadadosPortuguesComAlternativas("/sobre/erros", metadadosOriginais, await parent);
}

export default function ErrosPage() {
  return <ErrosConteudo idioma="pt" />;
}
