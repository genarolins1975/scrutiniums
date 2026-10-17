import type { Metadata, ResolvingMetadata } from "next";
import { PaginaEntrarSms } from "@/components/onboarding/PaginasEntrar";
import { metadadosPortuguesComAlternativas } from "@/lib/i18n-metadata";

const metadadosOriginais: Metadata = { title: "Entrar com código por SMS" };
export const dynamic = "force-dynamic";

export async function generateMetadata(_props: { params?: Record<string, string> }, parent: ResolvingMetadata): Promise<Metadata> {
  return metadadosPortuguesComAlternativas("/entrar/sms", metadadosOriginais, await parent);
}

/** Entrada alternativa por código SMS, também usada por quem esqueceu a senha. */
export default async function EntrarSmsPage() {
  return PaginaEntrarSms({ idioma: "pt" });
}
