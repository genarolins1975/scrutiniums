import ImprensaPage from "../../imprensa/page";
import { PortuguesApenas } from "@/components/i18n/PortuguesApenas";
import { metadadosPortuguesApenas } from "@/lib/i18n-metadata";

export const dynamic = "force-static";
export const metadata = metadadosPortuguesApenas("/imprensa");

export default function ImprensaInglesPage() {
  return <PortuguesApenas><ImprensaPage /></PortuguesApenas>;
}
