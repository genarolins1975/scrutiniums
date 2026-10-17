import type { Metadata, ResolvingMetadata } from "next";
import { PaginaVerificarSms } from "@/components/onboarding/PaginasEntrar";
import { metadadosPortuguesComAlternativas } from "@/lib/i18n-metadata";

const metadadosOriginais: Metadata = { title: "Código de acesso" };
export const dynamic = "force-dynamic";

export async function generateMetadata(_props: { params?: Record<string, string> }, parent: ResolvingMetadata): Promise<Metadata> {
  return metadadosPortuguesComAlternativas("/entrar/sms/verificar", metadadosOriginais, await parent);
}

/** Segunda tela do login por SMS: código de 6 dígitos enviado por SMS. */
export default async function EntrarSmsVerificarPage() {
  return PaginaVerificarSms({ idioma: "pt" });
}
