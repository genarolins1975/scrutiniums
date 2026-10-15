import TermosPage from "../../termos/page";
import { PortuguesApenas } from "@/components/i18n/PortuguesApenas";
import { metadadosPortuguesApenas } from "@/lib/i18n-metadata";

export const metadata = metadadosPortuguesApenas("/termos");

export default function TermosInglesPage() {
  return <PortuguesApenas><TermosPage /></PortuguesApenas>;
}
