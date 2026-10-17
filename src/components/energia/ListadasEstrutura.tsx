import { MOTIVO_TOPO } from "@/lib/energia/listadas";
import type { CompanhiaListada } from "@/lib/energia/tipos-listadas";

function p(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "sem dado";
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

/**
 * Estrutura societária em três camadas, cada uma com a sua fonte:
 *  1. acima, a cadeia de controladores únicos declarada à ANEEL (Composição Societária), do topo até a companhia, com a participação
 *     de cada controlador no degrau de baixo;
 *  2. ao lado, os acionistas diretos que a companhia declara no Formulário de Referência da CVM, com a fatia das ações ordinárias
 *     (voto) e do total; pessoas físicas somadas e sem nome;
 *  3. abaixo, quantas empresas estão sob o controle da companhia.
 * As duas fontes podem divergir na data e no critério; a figura mostra as duas lado a lado, sem reconciliar.
 */
export function ListadasEstrutura({ c, nome }: { c: CompanhiaListada; nome: string }) {
  const ct = c.controle;
  const fre = ct.fre;
  const cadeia = [...ct.cadeia_acima].reverse();
  const acionistas = fre?.acionistas ?? [];
  const max = Math.max(1, ...acionistas.map((a) => Math.max(a.pct_on ?? 0, a.pct_total ?? 0)), fre?.pessoas_fisicas?.pct_on ?? 0);
  return (
    <div className="grid gap-8 lg:grid-cols-2" data-estrutura="">
      <figure className="space-y-3">
        <figcaption className="rotulo text-mineral">Cadeia de controle declarada à ANEEL</figcaption>
        <ol className="space-y-0" aria-label="Do topo da cadeia até a companhia">
          {cadeia.map((x, i) => (
            <li key={x.cnpj} className="relative pl-6">
              <span aria-hidden="true" className="absolute left-2 top-0 h-full border-l border-linha" />
              <span aria-hidden="true" className="absolute left-[5px] top-3 h-2 w-2 rounded-full bg-carvao-muted" />
              <p className="pt-1 text-sm text-carvao">{x.nome ?? x.cnpj}</p>
              <p className="pb-2 text-xs text-mineral">
                {i === 0 ? `topo: ${MOTIVO_TOPO[ct.motivo_parada] ?? ct.motivo_parada}${ct.acima_sem_cnpj ? ` (${ct.acima_sem_cnpj})` : ""}` : ""}
                {x.pct !== null ? `${i === 0 ? " · " : ""}controla o degrau de baixo com ${p(x.pct)}` : ""}
              </p>
            </li>
          ))}
          <li className="relative pl-6">
            <span aria-hidden="true" className="absolute left-[3px] top-2.5 h-3 w-3 rounded-full bg-energia" />
            <p className="pt-1 text-sm font-medium text-carvao">{nome}</p>
            <p className="text-xs text-mineral">
              {cadeia.length === 0 ? `sem controlador único acima: ${MOTIVO_TOPO[ct.motivo_parada] ?? ct.motivo_parada}` : "companhia listada"}
            </p>
          </li>
          <li className="relative mt-2 pl-6">
            <span aria-hidden="true" className="absolute left-2 top-0 h-3 border-l border-dashed border-linha" />
            <p className="pt-3 text-sm text-carvao-muted">
              {ct.empresas_sob_controle - 1} {ct.empresas_sob_controle - 1 === 1 ? "empresa" : "empresas"} sob o controle da companhia, em uma ou mais camadas
            </p>
          </li>
        </ol>
      </figure>

      <figure className="space-y-3">
        <figcaption className="rotulo text-mineral">
          Acionistas diretos no Formulário de Referência {fre ? `${fre.ano_formulario}, versão ${fre.versao}` : ""}
        </figcaption>
        {fre ? (
          <>
            <ul className="space-y-2.5">
              {acionistas.map((a) => (
                <li key={`${a.nome}-${a.cnpj ?? ""}`} className="text-sm">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className={a.tipo === "coletivo" ? "text-carvao-muted" : "text-carvao"}>
                      {a.rotulo_coletivo === "outros" ? "Demais acionistas" : a.rotulo_coletivo === "tesouraria" ? "Ações em tesouraria" : a.nome}
                      {a.controlador && <span className="ml-2 rounded-sm border border-energia px-1 text-xs text-energia-dark">controlador</span>}
                      {a.acordo && <span className="ml-1 rounded-sm border border-linha px-1 text-xs text-carvao-muted">acordo de acionistas</span>}
                    </span>
                    <span className="tabular-nums text-xs text-carvao-muted">
                      {p(a.pct_on)} das ON · {p(a.pct_total)} do total
                    </span>
                  </p>
                  <span className="mt-1 block h-1.5 bg-energia-fundo" aria-hidden="true">
                    <span className="block h-1.5 bg-energia" style={{ width: `${(100 * (a.pct_on ?? 0)) / max}%` }} />
                  </span>
                </li>
              ))}
              {fre.pessoas_fisicas && (
                <li className="text-sm">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-carvao">
                      {fre.pessoas_fisicas.quantidade} {fre.pessoas_fisicas.quantidade === 1 ? "pessoa física" : "pessoas físicas"} (somadas, sem nome)
                      {fre.pessoas_fisicas.controladores > 0 && (
                        <span className="ml-2 rounded-sm border border-energia px-1 text-xs text-energia-dark">{fre.pessoas_fisicas.controladores} no grupo de controle</span>
                      )}
                    </span>
                    <span className="tabular-nums text-xs text-carvao-muted">
                      {p(fre.pessoas_fisicas.pct_on)} das ON · {p(fre.pessoas_fisicas.pct_total)} do total
                    </span>
                  </p>
                  <span className="mt-1 block h-1.5 bg-energia-fundo" aria-hidden="true">
                    <span className="block h-1.5 bg-energia" style={{ width: `${(100 * fre.pessoas_fisicas.pct_on) / max}%` }} />
                  </span>
                </li>
              )}
            </ul>
            <p className="text-xs leading-relaxed text-carvao-muted">
              Barra: fatia das ações ordinárias (as que votam). O formulário lista quem tem 5% ou mais de uma classe, os controladores e quem participa de acordo de acionistas.
            </p>
          </>
        ) : (
          <p className="text-sm text-carvao-muted">Sem Formulário de Referência lido para a companhia.</p>
        )}
      </figure>
    </div>
  );
}
