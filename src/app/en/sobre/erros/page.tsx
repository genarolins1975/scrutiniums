import ErrosPage from "../../../sobre/erros/page";
import { PortuguesApenas } from "@/components/i18n/PortuguesApenas";
import { metadadosPortuguesApenas } from "@/lib/i18n-metadata";

export const dynamic = "force-static";
export const metadata = metadadosPortuguesApenas("/sobre/erros");

export default function ErrosInglesPage() {
  return <PortuguesApenas><ErrosPage /></PortuguesApenas>;
}
