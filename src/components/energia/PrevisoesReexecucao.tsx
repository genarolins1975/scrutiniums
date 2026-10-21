import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { PrevisoesLegenda } from "@/components/energia/PrevisoesPagina";
import type { Evidencia } from "@/lib/energia/evidencia";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { rotuloConferencia, textoTolerancia, type LinhaReexecucao } from "@/lib/energia/previsoes";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";

/**
 * Números arquivados do B0 na rodada mais recente, refeitos com o dado como estava no corte: uma linha por submercado e, em cada
 * linha, o valor semanal e o mensal com a prova de cada um ("Comprove este número") e o resultado da reexecução. A reexecução é do
 * próprio observatório: confere a conta, e a legenda diz que não é aprovação metodológica independente. Sem estado nem efeito.
 */
export function PrevisoesReexecucao({
  linhas,
  evidencias,
  endereco,
  tolerancia,
  modelo = "B0",
}: {
  linhas: LinhaReexecucao[];
  evidencias: Record<string, Evidencia>;
  endereco: string;
  tolerancia?: string | null;
  modelo?: string;
}) {
  if (!linhas.length) return null;
  const idioma = idiomaEnergia();
  const submercados = Array.from(new Set(linhas.map((r) => r.sm)));
  // a frequência vem escrita no idioma da página: "semanal"/"weekly" e "mensal"/"monthly"
  const celula = (sm: string, freq: "semanal" | "mensal") =>
    linhas.find((r) => r.sm === sm && (r.frequencia.startsWith(freq) || r.frequencia.startsWith(freq === "semanal" ? "weekly" : "monthly")));
  return (
    <div className="space-y-2" data-reexecucao="">
      <div className="tabela-scroll" tabIndex={0} role="region" aria-label={tx("Previsões arquivadas refeitas (rolável)", "Archived forecasts redone (scrollable)")}>
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <caption className="sr-only">
            {tx(
              `Previsões arquivadas do ${modelo} e resultado da reexecução, por submercado e frequência`,
              `Archived ${modelo} forecasts and rerun result, by submarket and frequency`,
            )}
          </caption>
          <thead>
            <tr className="text-left text-xs text-mineral">
              <th scope="col" className="border-b-2 border-linha px-2 py-2 font-medium first:pl-0">
                {tx("Submercado", "Submarket")}
              </th>
              <th scope="col" className="border-b-2 border-linha px-2 py-2 font-medium">
                {tx("Semanal (W1 a W4)", "Weekly (W1 to W4)")}
              </th>
              <th scope="col" className="border-b-2 border-linha px-2 py-2 font-medium">
                {tx("Mensal (M1 a M3)", "Monthly (M1 to M3)")}
              </th>
            </tr>
          </thead>
          <tbody>
            {submercados.map((sm) => (
              <tr key={sm} className="border-b border-linha align-middle">
                <th scope="row" className="px-2 py-1 text-left font-normal text-carvao first:pl-0">
                  {sm}
                </th>
                {(["semanal", "mensal"] as const).map((freq) => {
                  const r = celula(sm, freq);
                  return (
                    <td key={freq} className="px-2 py-1 tabular-nums" data-reexec={r?.id}>
                      {r ? (
                        <>
                          {/* // i18n: dado (variante do componente) */}
                          {evidencias[r.id] ? <ComproveNumero variante="valor" evidencia={evidencias[r.id]} endereco={endereco} /> : tx("sem prova", "no evidence")}
                          <span className="ml-2 text-carvao">{rotuloConferencia(r.resultado, idioma)}</span>
                          <span data-nivel="analisar" className="block text-xs text-carvao-muted">
                            <TrechoPortugues regiao="previsoes-reexecucao">{r.detalhe.replace(/\b(\d+)\.(\d+)\b/g, "$1,$2")}</TrechoPortugues>
                          </span>
                        </>
                      ) : (
                        <span className="italic text-mineral">{tx("sem dado", "no data")}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PrevisoesLegenda>
        {tx(
          `“Confere” quer dizer que o número refeito com o dado do corte fica dentro da tolerância de ${textoTolerancia(tolerancia)} do arquivado. A reexecução é do próprio observatório: confere a conta, e não é aprovação metodológica independente.`,
          `“Matches” means that the number redone with the data as of the cutoff is within the tolerance of ${textoTolerancia(tolerancia)} of the archived one. The rerun is the observatory's own: it checks the arithmetic and is not an independent methodological approval.`,
        )}
      </PrevisoesLegenda>
    </div>
  );
}
