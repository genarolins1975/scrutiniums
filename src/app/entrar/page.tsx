import type { Metadata, ResolvingMetadata } from "next";
import { PaginaEntrar } from "@/components/onboarding/PaginasEntrar";
import { metadadosPortuguesComAlternativas } from "@/lib/i18n-metadata";

const metadadosOriginais: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export async function generateMetadata(_props: { params?: Record<string, string> }, parent: ResolvingMetadata): Promise<Metadata> {
  return metadadosPortuguesComAlternativas("/entrar", metadadosOriginais, await parent);
}

/** Login principal: e-mail + senha; o código por SMS fica em /entrar/sms. */
export default async function EntrarPage({ searchParams }: { searchParams?: { de?: string } }) {
  return PaginaEntrar({ idioma: "pt", searchParams });
}
