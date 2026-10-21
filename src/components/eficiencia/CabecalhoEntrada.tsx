import Link from "next/link";
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
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-1 sm:px-6">
        <p className="min-w-0 text-sm text-carvao-muted">
          <span aria-hidden="true" className="mr-2 inline-block h-2 w-2 bg-obee align-middle" />
          <Link href="/eficiencia-estatal" className="inline-flex min-h-[44px] items-center underline-offset-4 hover:underline">
            <span className="sm:hidden">Eficiência Estatal</span>
            <span className="hidden sm:inline">Observatório Brasileiro de Eficiência Estatal</span>
          </Link>
          <span aria-hidden="true" className="mx-2">
            /
          </span>
          <span className="text-obee-tinta">{tema.nome}</span>
        </p>
      </div>
      <NavegacaoTemaObee rota={tema.rota} nome={tema.nome} abas={tema.abas} acoes={tema.acoes} levar={tema.levar} />
    </header>
  );
}
