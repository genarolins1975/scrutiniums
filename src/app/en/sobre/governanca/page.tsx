import { GovernancaConteudo } from "@/components/institucional/GovernancaConteudo";
import { TEXTOS_GOVERNANCA } from "@/i18n/paginas/governanca";
import { metadadosIngleses } from "@/lib/i18n-metadata";

export const dynamic = "force-static";
export const metadata = metadadosIngleses("/sobre/governanca", { titulo: TEXTOS_GOVERNANCA.en.titulo, descricao: TEXTOS_GOVERNANCA.en.descricaoMeta });

export default function GovernancaInglesPage() {
  return <GovernancaConteudo idioma="en" />;
}
