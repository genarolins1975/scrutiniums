import EntrarSmsPage from "../../../entrar/sms/page";
import { PortuguesApenas } from "@/components/i18n/PortuguesApenas";
import { metadadosPortuguesApenas } from "@/lib/i18n-metadata";

export const dynamic = "force-dynamic";
export const metadata = metadadosPortuguesApenas("/entrar/sms");

export default function EntrarSmsInglesPage() {
  return <PortuguesApenas><EntrarSmsPage /></PortuguesApenas>;
}
