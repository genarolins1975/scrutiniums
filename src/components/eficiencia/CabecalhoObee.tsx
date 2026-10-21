import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoPainel } from "./NavegacaoPainel";

/**
 * Cabeçalho do OBEE: a barra comum da plataforma (marca, seletor com a coleção corrente, abas dos seis observatórios e
 * conta) e, abaixo dela, a navegação do painel. Nada de metodologia ou de etapa de construção antes do dado.
 */
export function CabecalhoObee() {
  return (
    <header className="grade-pagina border-b border-linha bg-superficie">
      <CabecalhoPlataforma colecao="eficiencia" destinoConta="/eficiencia-estatal" />
      <NavegacaoPainel />
    </header>
  );
}
