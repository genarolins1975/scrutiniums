import GlossarioPage from "../../glossario/page";
import { PortuguesApenas } from "@/components/i18n/PortuguesApenas";
import { metadadosPortuguesApenas } from "@/lib/i18n-metadata";

export const metadata = metadadosPortuguesApenas("/glossario");

export default function GlossarioInglesPage() {
  return <PortuguesApenas><GlossarioPage /></PortuguesApenas>;
}
