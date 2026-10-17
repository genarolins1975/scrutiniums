import { PaginaEntrarSms } from "@/components/onboarding/PaginasEntrar";
import { TEXTOS_ENTRAR } from "@/i18n/paginas/entrar";
import { metadadosIngleses } from "@/lib/i18n-metadata";

export const dynamic = "force-dynamic";
export const metadata = metadadosIngleses("/entrar/sms", {
  titulo: TEXTOS_ENTRAR.en.tituloSms,
  descricao: "Sign in to Scrutiniums with a code sent by SMS to the phone number on your account.",
});

export default async function EntrarSmsInglesPage() {
  return PaginaEntrarSms({ idioma: "en" });
}
