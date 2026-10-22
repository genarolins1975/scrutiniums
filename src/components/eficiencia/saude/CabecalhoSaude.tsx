import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { ROTA_ENTRADA } from "@/lib/eficiencia/saude/rotas";
import { NavegacaoSaude } from "./NavegacaoSaude";

/**
 * Cabeçalho do módulo Saúde: a barra comum da plataforma e, abaixo dela, o caminho (observatório, que volta à entrada com os
 * temas, e o módulo) e a navegação das visões.
 */
export function CabecalhoSaude() {
  return (
    <header className="grade-pagina border-b border-linha bg-superficie">
      <CabecalhoPlataforma colecao="eficiencia" destinoConta={ROTA_ENTRADA} />
      <NavegacaoSaude />
    </header>
  );
}
