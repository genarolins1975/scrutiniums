import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";

/**
 * Cabeçalho da entrada e dos temas da Eficiência Estatal: a barra comum da plataforma (marca, seletor com a coleção
 * corrente, abas dos seis observatórios e conta). Cada tema mantém, abaixo, a sua própria navegação. Alinhada à grade das
 * páginas do observatório (max-w-page).
 */
export function CabecalhoEntrada() {
  return (
    <header className="grade-pagina">
      <CabecalhoPlataforma colecao="eficiencia" destinoConta="/eficiencia-estatal" />
    </header>
  );
}
