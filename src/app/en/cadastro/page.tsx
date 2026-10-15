import CadastroPage from "../../cadastro/page";
import { metadadosPortuguesApenas } from "@/lib/i18n-metadata";

export const dynamic = "force-dynamic";
export const metadata = metadadosPortuguesApenas("/cadastro");

export default function CadastroInglesPage() {
  return <CadastroPage />;
}
