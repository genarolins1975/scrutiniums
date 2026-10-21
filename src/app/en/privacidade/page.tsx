import PrivacidadePage from "../../privacidade/page";
import { PortuguesApenas } from "@/components/i18n/PortuguesApenas";
import { metadadosPortuguesApenas } from "@/lib/i18n-metadata";

export const metadata = metadadosPortuguesApenas("/privacidade");

export default function PrivacidadeInglesPage() {
  return <PortuguesApenas><PrivacidadePage /></PortuguesApenas>;
}
