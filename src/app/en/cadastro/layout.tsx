import CadastroLayout from "../../cadastro/layout";
import { PortuguesApenas } from "@/components/i18n/PortuguesApenas";

export default function CadastroInglesLayout({ children }: { children: React.ReactNode }) {
  return <PortuguesApenas><CadastroLayout>{children}</CadastroLayout></PortuguesApenas>;
}
