import EntrarPage from "../../entrar/page";
import { PortuguesApenas } from "@/components/i18n/PortuguesApenas";
import { metadadosPortuguesApenas } from "@/lib/i18n-metadata";

export const dynamic = "force-dynamic";
export const metadata = metadadosPortuguesApenas("/entrar");

export default function EntrarInglesPage(props: Parameters<typeof EntrarPage>[0]) {
  return <PortuguesApenas><EntrarPage {...props} /></PortuguesApenas>;
}
