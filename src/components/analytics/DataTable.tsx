"use client";

/**
 * Tabela de dados padrão: thead semântico, caption para leitores de tela,
 * rolagem horizontal via .tabela-scroll e números alinhados à direita
 * (valores já formatados pelos helpers de @/lib/format no chamador).
 */
export type ColunaTabela<T> = {
  chave: string;
  titulo: string;
  numerica?: boolean;
  valor: (linha: T) => string;
};

export function DataTable<T>({
  legenda,
  colunas,
  linhas,
  chaveLinha,
}: {
  legenda: string;
  colunas: ColunaTabela<T>[];
  linhas: T[];
  chaveLinha: (linha: T) => string;
}) {
  return (
    <div className="tabela-scroll border border-linha">
      <table className="w-full text-sm">
        <caption className="sr-only">{legenda}</caption>
        <thead>
          <tr className="border-b border-linha bg-marfim">
            {colunas.map((c) => (
              <th
                key={c.chave}
                scope="col"
                className={`rotulo whitespace-nowrap px-4 py-3 font-normal text-carvao-muted ${
                  c.numerica ? "text-right" : "text-left"
                }`}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={chaveLinha(linha)} className="border-b border-linha last:border-b-0">
              {colunas.map((c) => (
                <td
                  key={c.chave}
                  className={`whitespace-nowrap px-4 py-2.5 text-carvao ${
                    c.numerica ? "text-right tabular-nums" : "text-left"
                  }`}
                >
                  {c.valor(linha)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
