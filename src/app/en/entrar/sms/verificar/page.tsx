import { PaginaVerificarSms } from "@/components/onboarding/PaginasEntrar";
import { TEXTOS_ENTRAR } from "@/i18n/paginas/entrar";
import { metadadosIngleses } from "@/lib/i18n-metadata";

export const dynamic = "force-dynamic";
export const metadata = metadadosIngleses("/entrar/sms/verificar", {
  titulo: TEXTOS_ENTRAR.en.tituloVerificar,
  descricao: "Enter the access code sent by SMS to sign in to Scrutiniums.",
});

export default async function EntrarSmsVerificarInglesPage() {
  return PaginaVerificarSms({ idioma: "en" });
}
