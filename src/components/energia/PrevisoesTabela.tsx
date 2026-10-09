import type { ReactNode } from "react";

/**
 * Tabela curta que se reorganiza em lista no celular: a partir de 768 px é uma tabela comum (cabeçalho, uma linha por item, a
 * primeira coluna como cabeçalho de linha); abaixo disso, cada item vira um bloco com o título e os pares rótulo e valor, para
 * nenhuma coluna ficar cortada nem exigir rolagem para o lado. Serve às tabelas de poucas linhas e texto longo nas células (a matriz
 * de modelos, as entradas e fórmulas, as rodadas registradas). As duas formas levam o mesmo conteúdo, e a que não cabe na largura
 * fica fora da árvore de acessibilidade (display: none), sem leitura duplicada.
 *
 * Sem estado nem efeito: renderiza no servidor e pode ser usada em componentes cliente.
 */
export type ColunaAdaptativa<T> = {
  id: string;
  rotulo: string;
  celula: (linha: T) => ReactNode;
  /** Classe extra da coluna na tabela (largura, alinhamento). */
  classe?: string;
};

export function TabelaAdaptativa<T extends { id: string }>({
  legenda,
  colunas,
  linhas,
  nome = "tabela-adaptativa",
}: {
  /** Descrição da tabela para leitor de tela (a mesma frase vale para as duas formas). */
  legenda: string;
  /** A primeira coluna nomeia a linha. */
  colunas: ColunaAdaptativa<T>[];
  linhas: T[];
  nome?: string;
}) {
  const [titulo, ...demais] = colunas;
  return (
    <div data-tabela-adaptativa={nome} className="min-w-0">
      <table className="hidden w-full border-collapse text-sm md:table">
        <caption className="sr-only">{legenda}</caption>
        <thead>
          <tr className="text-left text-xs text-mineral">
            {colunas.map((c) => (
              <th key={c.id} scope="col" className={`border-b-2 border-linha px-2 py-2 align-bottom font-medium first:pl-0 ${c.classe ?? ""}`}>
                {c.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id} data-linha={l.id} className="border-b border-linha align-top">
              <th scope="row" className={`px-2 py-3 text-left align-top font-normal text-carvao first:pl-0 ${titulo.classe ?? ""}`}>
                {titulo.celula(l)}
              </th>
              {demais.map((c) => (
                <td key={c.id} className={`px-2 py-3 align-top leading-snug text-carvao ${c.classe ?? ""}`}>
                  {c.celula(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="md:hidden" aria-label={legenda}>
        {linhas.map((l) => (
          <li key={l.id} data-linha={l.id} className="border-b border-linha py-3 first:border-t">
            <div className="text-base text-carvao">{titulo.celula(l)}</div>
            <dl className="mt-2 grid gap-y-2 text-sm">
              {demais.map((c) => (
                <div key={c.id} className="min-[360px]:grid min-[360px]:grid-cols-[7.5rem_minmax(0,1fr)] min-[360px]:gap-x-3">
                  <dt className="rotulo text-mineral min-[360px]:pt-0.5">{c.rotulo}</dt>
                  <dd className="mt-0.5 min-w-0 leading-snug text-carvao min-[360px]:mt-0">{c.celula(l)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
