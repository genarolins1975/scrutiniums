import { fmtNumber } from "@/lib/format";
import type { BuscasDoPeriodo, TermoBuscado } from "@/lib/uso/painel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { EmptyState } from "@/components/ui/States";
import { diaBr } from "./UsoPaginas";

/** Quantos termos cada quadro mostra. */
const LINHAS = 30;

/**
 * Seção do painel de administração com a medição agregada da busca da plataforma (uso_busca_dia,
 * docs/observatorios/MEDICAO_DE_USO.md): os termos mais buscados nos últimos 30 dias e os que a busca de hoje não acha. Sem
 * conta, a coluna só mede com USO_ANONIMO_ATIVO=1; desligada, aparece como "não medido", nunca como zero.
 */
export function UsoBusca({ busca }: { busca: BuscasDoPeriodo }) {
  const semResultado = busca.termos.filter((t) => t.resultados === 0);
  return (
    <section aria-label="Busca da plataforma" className="border border-linha bg-papel p-8" data-secao="uso-busca">
      <SectionHeading label="Busca" title="Busca da plataforma, últimos 30 dias" />
      <p className="text-sm text-carvao">
        {diaBr(busca.inicio)} a {diaBr(busca.fim)}, fuso de Brasília. Cada busca feita (resultado aberto pelo campo ou página de
        resultados) soma 1 ao termo do dia, sem associar a busca a ninguém. Só é gravado o termo cujas palavras existem no
        vocabulário do índice; os demais (um nome, um endereço, um email, algarismos) somam num contador sem o texto
        {busca.foraDoIndice > 0 ? `, ${fmtNumber(busca.foraDoIndice)} no período` : ""}. {busca.anonimoAtivo ? "Buscas sem conta: contagem ligada (USO_ANONIMO_ATIVO=1)." : "Buscas sem conta: não medidas (USO_ANONIMO_ATIVO desligado)."}
      </p>
      {busca.primeiroRegistro !== null && busca.primeiroRegistro > busca.inicio && (
        <p className="mt-2 text-sm text-mineral">
          A medição da busca começou em {diaBr(busca.primeiroRegistro)}; os dias anteriores não têm registro, o que não equivale a zero buscas.
        </p>
      )}
      {busca.termos.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="Nenhuma busca registrada nos últimos 30 dias" description="Assim que alguém fizer uma busca, o termo aparece aqui." />
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <Quadro titulo="Termos mais buscados, últimos 30 dias" termos={busca.termos.slice(0, LINHAS)} anonimo={busca.anonimoAtivo} dado="termos" />
          <div>
            <Quadro titulo="Buscas sem resultado" termos={semResultado.slice(0, LINHAS)} anonimo={busca.anonimoAtivo} dado="sem-resultado" />
            <p className="mt-3 text-xs text-mineral">
              Termos com palavras do índice cuja combinação o índice de hoje não acha: destino que falta ou sinônimo a acrescentar
              em src/lib/busca/sinonimos.json.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function Quadro({ titulo, termos, anonimo, dado }: { titulo: string; termos: TermoBuscado[]; anonimo: boolean; dado: string }) {
  return (
    <div>
      <h3 className="font-serif text-xl text-carvao">{titulo}</h3>
      {termos.length === 0 ? (
        <p className="mt-3 text-sm text-mineral">Nenhum no período.</p>
      ) : (
        <div className="tabela-scroll mt-4 overflow-x-auto">
          <table className="w-full min-w-[22rem] border-collapse text-sm" data-uso={dado}>
            <thead>
              <tr className="border-b border-linha">
                <th scope="col" className="rotulo px-3 py-3 text-left text-mineral">Termo</th>
                <th scope="col" className="rotulo px-3 py-3 text-right text-mineral">Com conta</th>
                <th scope="col" className="rotulo px-3 py-3 text-right text-mineral">Sem conta</th>
              </tr>
            </thead>
            <tbody>
              {termos.map((t) => (
                <tr key={t.termo} className="border-b border-linha">
                  <td className="px-3 py-3 text-carvao">{t.termo}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-carvao">{fmtNumber(t.comConta)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-carvao">
                    {anonimo || t.semConta > 0 ? fmtNumber(t.semConta) : <span className="text-mineral">não medido</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
