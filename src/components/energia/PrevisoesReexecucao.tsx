import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { PrevisoesLegenda } from "@/components/energia/PrevisoesPagina";
import type { Evidencia } from "@/lib/energia/evidencia";
import { ROTULO_CONFERENCIA, textoTolerancia, type LinhaReexecucao } from "@/lib/energia/previsoes";

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
  const submercados = Array.from(new Set(linhas.map((r) => r.sm)));
  const celula = (sm: string, freq: "semanal" | "mensal") => linhas.find((r) => r.sm === sm && r.frequencia.startsWith(freq));
  return (
    <div className="space-y-2" data-reexecucao="">
      <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Previsões arquivadas refeitas (rolável)">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <caption className="sr-only">Previsões arquivadas do {modelo} e resultado da reexecução, por submercado e frequência</caption>
          <thead>
            <tr className="text-left text-xs text-mineral">
              <th scope="col" className="border-b-2 border-linha px-2 py-2 font-medium first:pl-0">
                Submercado
              </th>
              <th scope="col" className="border-b-2 border-linha px-2 py-2 font-medium">
                Semanal (W1 a W4)
              </th>
              <th scope="col" className="border-b-2 border-linha px-2 py-2 font-medium">
                Mensal (M1 a M3)
              </th>
            </tr>
          </thead>
          <tbody>
            {submercados.map((sm) => (
              <tr key={sm} className="border-b border-linha align-top">
                <th scope="row" className="px-2 py-2 text-left font-normal text-carvao first:pl-0">
                  {sm}
                </th>
                {(["semanal", "mensal"] as const).map((freq) => {
                  const r = celula(sm, freq);
                  return (
                    <td key={freq} className="px-2 py-2 tabular-nums" data-reexec={r?.id}>
                      {r ? (
                        <>
                          {evidencias[r.id] ? <ComproveNumero variante="valor" evidencia={evidencias[r.id]} endereco={endereco} /> : "sem prova"}
                          <span className="ml-2 text-carvao">{ROTULO_CONFERENCIA[r.resultado] ?? r.resultado}</span>
                          <span data-nivel="analisar" className="block text-xs text-carvao-muted">
                            {r.detalhe.replace(/\b(\d+)\.(\d+)\b/g, "$1,$2")}
                          </span>
                        </>
                      ) : (
                        <span className="italic text-mineral">sem dado</span>
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
        “Confere” quer dizer que o número refeito com o dado do corte fica dentro da tolerância de {textoTolerancia(tolerancia)} do arquivado. A reexecução é do próprio
        observatório: confere a conta, e não é aprovação metodológica independente.
      </PrevisoesLegenda>
    </div>
  );
}
