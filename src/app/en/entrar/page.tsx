import { PaginaEntrar } from "@/components/onboarding/PaginasEntrar";
import { TEXTOS_ENTRAR } from "@/i18n/paginas/entrar";
import { metadadosIngleses } from "@/lib/i18n-metadata";

export const dynamic = "force-dynamic";
export const metadata = metadadosIngleses("/entrar", {
  titulo: TEXTOS_ENTRAR.en.titulo,
  descricao: "Sign in to Scrutiniums with your email and password to open the observatory dashboards.",
});

export default async function EntrarInglesPage({ searchParams }: { searchParams?: { de?: string } }) {
  return PaginaEntrar({ idioma: "en", searchParams });
}
