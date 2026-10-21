/** Tabela simples de valores: cabeçalho, primeira coluna como cabeçalho de linha e números alinhados à direita. */

export function TabelaSimples({ legenda, cabecalho, linhas }: { legenda: string; cabecalho: string[]; linhas: (string | number)[][] }) {
  return (
    <div className="tabela-scroll mt-2 min-w-0 max-w-full" tabIndex={0} role="region" aria-label={`${legenda} (tabela; role na horizontal se necessário)`}>
      <table className="w-full min-w-[18rem] border-collapse text-sm">
        <caption className="sr-only">{legenda}</caption>
        <thead>
          <tr>
            {cabecalho.map((c, i) => (
              <th key={c} scope="col" className={`border-b border-carvao-muted px-2 py-1.5 font-semibold text-obee-tinta ${i ? "text-right" : "text-left"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, j) => (
            <tr key={j} className="border-b border-linha">
              {l.map((c, i) =>
                i ? (
                  <td key={i} className="px-2 py-1.5 text-right text-obee-tinta">
                    {c}
                  </td>
                ) : (
                  <th key={i} scope="row" className="px-2 py-1.5 text-left font-normal text-obee-tinta">
                    {c}
                  </th>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

