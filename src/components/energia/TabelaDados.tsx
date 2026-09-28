/**
 * Tabela equivalente de um gráfico (acessibilidade e auditoria): recolhida por
 * padrão, com as últimas linhas e o link para a série completa.
 */
function formata(v: number, casas: number | null | undefined): string {
  return typeof casas === "number"
    ? v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).replace(/^-/, "\u2212")
    : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }).replace(/^-/, "\u2212");
}

export function TabelaDados({
  titulo,
  colunas,
  linhas,
  csv,
  limite = 30,
  casas,
}: {
  titulo: string;
  colunas: string[];
  linhas: (string | number | null)[][];
  csv?: string;
  limite?: number;
  /** Casas decimais fixas por coluna numérica (null = até 2 casas); padroniza com o texto da página. */
  casas?: (number | null)[];
}) {
  const ult = linhas.slice(-limite);
  return (
    <details className="mt-4 border-t border-linha pt-3">
      <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
        Resumo em tabela ({ult.length === linhas.length ? `${linhas.length} linhas` : `últimas ${ult.length} de ${linhas.length} linhas`})
      </summary>
      <div className="tabela-scroll mt-2" tabIndex={0} role="region" aria-label={`${titulo} (tabela rolável)`}>
        <table className="w-full min-w-[28rem] border-collapse text-xs tabular-nums">
          <caption className="sr-only">{titulo}</caption>
          <thead>
            <tr>
              {colunas.map((c) => (
                <th key={c} scope="col" className="border-b border-linha px-2 py-1.5 text-left font-medium text-mineral">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ult.map((l, i) => (
              <tr key={i} className="odd:bg-papel">
                {l.map((v, j) => (
                  <td key={j} className="px-2 py-1 text-carvao">
                    {v === null || v === undefined ? <span className="text-mineral">sem dado</span> : typeof v === "number" ? formata(v, casas?.[j]) : v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {csv && (
        <a href={csv} download className="rotulo mt-3 inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
          Baixar série completa (CSV)
        </a>
      )}
    </details>
  );
}
