import { ErrosConteudo } from "@/components/institucional/ErrosConteudo";
import { TEXTOS_ERROS } from "@/i18n/paginas/erros";
import { metadadosIngleses } from "@/lib/i18n-metadata";

export const dynamic = "force-static";
export const metadata = metadadosIngleses("/sobre/erros", { titulo: TEXTOS_ERROS.en.titulo, descricao: TEXTOS_ERROS.en.descricaoMeta });

export default function ErrosInglesPage() {
  return <ErrosConteudo idioma="en" />;
}
