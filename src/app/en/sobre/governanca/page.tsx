import GovernancaPage from "../../../sobre/governanca/page";
import { PortuguesApenas } from "@/components/i18n/PortuguesApenas";
import { metadadosPortuguesApenas } from "@/lib/i18n-metadata";

export const dynamic = "force-static";
export const metadata = metadadosPortuguesApenas("/sobre/governanca");

export default function GovernancaInglesPage() {
  return <PortuguesApenas><GovernancaPage /></PortuguesApenas>;
}
