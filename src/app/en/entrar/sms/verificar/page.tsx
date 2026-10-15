import EntrarSmsVerificarPage from "../../../../entrar/sms/verificar/page";
import { PortuguesApenas } from "@/components/i18n/PortuguesApenas";
import { metadadosPortuguesApenas } from "@/lib/i18n-metadata";

export const dynamic = "force-dynamic";
export const metadata = metadadosPortuguesApenas("/entrar/sms/verificar");

export default function EntrarSmsVerificarInglesPage() {
  return <PortuguesApenas><EntrarSmsVerificarPage /></PortuguesApenas>;
}
