import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoTemaObee, type AbaTema } from "./NavegacaoTemaObee";

/** Um tema da Eficiência Estatal no cabeçalho: nome, rota, visões e ações de conferência. */
export type TemaCabecalho = { nome: string; rota: string; abas: readonly AbaTema[]; acoes?: readonly AbaTema[]; levar?: readonly string[] };

/**
 * Cabeçalho da entrada e dos temas da Eficiência Estatal: a barra comum da plataforma (marca, seletor com a coleção
 * corrente, abas dos seis observatórios e conta). Com `tema`, abaixo dela vêm o caminho (observatório, que volta à
 * entrada, e o tema) e as abas do tema, no molde da Saúde nas capitais: um só subcabeçalho no observatório
 * (diagnóstico de layout de 20/10/2026, item 10). Alinhado à grade das páginas do observatório (max-w-page).
 */
export function CabecalhoEntrada({ tema }: { tema?: TemaCabecalho } = {}) {
  if (!tema)
    return (
      <header className="grade-pagina">
        <CabecalhoPlataforma colecao="eficiencia" destinoConta="/eficiencia-estatal" />
      </header>
    );
  return (
    <header className="grade-pagina border-b border-linha bg-superficie">
      <CabecalhoPlataforma colecao="eficiencia" destinoConta={tema.rota} />
      <NavegacaoTemaObee rota={tema.rota} nome={tema.nome} abas={tema.abas} acoes={tema.acoes} levar={tema.levar} />
    </header>
  );
}
