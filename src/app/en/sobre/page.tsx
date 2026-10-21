import { SobreConteudo } from "@/components/institucional/SobreConteudo";
import { TEXTOS_SOBRE } from "@/i18n/paginas/sobre";
import { metadadosIngleses } from "@/lib/i18n-metadata";

export const dynamic = "force-static";
export const metadata = metadadosIngleses("/sobre", { titulo: TEXTOS_SOBRE.en.titulo, descricao: TEXTOS_SOBRE.en.descricaoMeta });

export default function SobreInglesPage() {
  return <SobreConteudo idioma="en" />;
}
