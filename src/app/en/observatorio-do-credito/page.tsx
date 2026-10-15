import ObservatorioPublicoPage from "../../observatorio-do-credito/page";
import { PortuguesApenas } from "@/components/i18n/PortuguesApenas";
import { metadadosPortuguesApenas } from "@/lib/i18n-metadata";

export const dynamic = "force-static";
export const metadata = metadadosPortuguesApenas("/observatorio-do-credito");

export default function ObservatorioPublicoInglesPage() {
  return <PortuguesApenas><ObservatorioPublicoPage /></PortuguesApenas>;
}
