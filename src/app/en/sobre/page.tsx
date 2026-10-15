import SobrePage from "../../sobre/page";
import { PortuguesApenas } from "@/components/i18n/PortuguesApenas";
import { metadadosPortuguesApenas } from "@/lib/i18n-metadata";

export const dynamic = "force-static";
export const metadata = metadadosPortuguesApenas("/sobre");

export default function SobreInglesPage() {
  return <PortuguesApenas><SobrePage /></PortuguesApenas>;
}
