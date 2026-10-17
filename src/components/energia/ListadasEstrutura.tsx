import { Nome } from "@/components/i18n/Nome";
import { pct } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import { MOTIVO_TOPO } from "@/lib/energia/listadas";
import type { CompanhiaListada } from "@/lib/energia/tipos-listadas";

function p(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return tx("sem dado", "no data");
  return pct(v, casas);
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
        <figcaption className="rotulo text-mineral">{tx("Cadeia de controle declarada à ANEEL", "Control chain declared to ANEEL")}</figcaption>
        <ol className="space-y-0" aria-label={tx("Do topo da cadeia até a companhia", "From the top of the chain to the company")}>
          {cadeia.map((x, i) => (
            <li key={x.cnpj} className="relative pl-6">
              <span aria-hidden="true" className="absolute left-2 top-0 h-full border-l border-linha" />
              <span aria-hidden="true" className="absolute left-[5px] top-3 h-2 w-2 rounded-full bg-carvao-muted" />
              <p className="pt-1 text-sm text-carvao">{x.nome != null ? <Nome>{x.nome}</Nome> : x.cnpj}</p>
              <p className="pb-2 text-xs text-mineral">
                {i === 0
                  ? tx<React.ReactNode>(
                      `topo: ${MOTIVO_TOPO[ct.motivo_parada] ?? ct.motivo_parada}${ct.acima_sem_cnpj ? ` (${ct.acima_sem_cnpj})` : ""}`,
                      <>
                        top: {MOTIVO_TOPO[ct.motivo_parada] ?? ct.motivo_parada}
                        {ct.acima_sem_cnpj ? (
                          <>
                            {" "}
                            (<Nome>{ct.acima_sem_cnpj}</Nome>)
                          </>
                        ) : (
                          ""
                        )}
                      </>,
                    )
                  : ""}
                {x.pct !== null ? tx(`${i === 0 ? " · " : ""}controla o degrau de baixo com ${p(x.pct)}`, `${i === 0 ? " · " : ""}controls the step below with ${p(x.pct)}`) : ""}
              </p>
            </li>
          ))}
          <li className="relative pl-6">
            <span aria-hidden="true" className="absolute left-[3px] top-2.5 h-3 w-3 rounded-full bg-energia" />
            <p className="pt-1 text-sm font-medium text-carvao">
              <Nome>{nome}</Nome>
            </p>
            <p className="text-xs text-mineral">
              {cadeia.length === 0
                ? tx(`sem controlador único acima: ${MOTIVO_TOPO[ct.motivo_parada] ?? ct.motivo_parada}`, `no single controlling shareholder above: ${MOTIVO_TOPO[ct.motivo_parada] ?? ct.motivo_parada}`)
                : tx("companhia listada", "listed company")}
            </p>
          </li>
          <li className="relative mt-2 pl-6">
            <span aria-hidden="true" className="absolute left-2 top-0 h-3 border-l border-dashed border-linha" />
            <p className="pt-3 text-sm text-carvao-muted">
              {tx(
                `${ct.empresas_sob_controle - 1} ${ct.empresas_sob_controle - 1 === 1 ? "empresa" : "empresas"} sob o controle da companhia, em uma ou mais camadas`,
                `${ct.empresas_sob_controle - 1} ${ct.empresas_sob_controle - 1 === 1 ? "company" : "companies"} under the company's control, in one or more layers`,
              )}
            </p>
          </li>
        </ol>
      </figure>

      <figure className="space-y-3">
        <figcaption className="rotulo text-mineral">
          {tx(
            `Acionistas diretos no Formulário de Referência ${fre ? `${fre.ano_formulario}, versão ${fre.versao}` : ""}`,
            `Direct shareholders in the Reference Form (FRE) ${fre ? `${fre.ano_formulario}, version ${fre.versao}` : ""}`,
          )}
        </figcaption>
        {fre ? (
          <>
            <ul className="space-y-2.5">
              {acionistas.map((a) => (
                <li key={`${a.nome}-${a.cnpj ?? ""}`} className="text-sm">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className={a.tipo === "coletivo" ? "text-carvao-muted" : "text-carvao"}>
                      {a.rotulo_coletivo === "outros" ? tx("Demais acionistas", "Other shareholders") : a.rotulo_coletivo === "tesouraria" ? tx("Ações em tesouraria", "Treasury shares") : <Nome>{a.nome}</Nome>}
                      {a.controlador && <span className="ml-2 rounded-sm border border-energia px-1 text-xs text-energia-dark">{tx("controlador", "controlling")}</span>}
                      {a.acordo && <span className="ml-1 rounded-sm border border-linha px-1 text-xs text-carvao-muted">{tx("acordo de acionistas", "shareholders' agreement")}</span>}
                    </span>
                    <span className="tabular-nums text-xs text-carvao-muted">
                      {tx(`${p(a.pct_on)} das ON · ${p(a.pct_total)} do total`, `${p(a.pct_on)} of common shares · ${p(a.pct_total)} of the total`)}
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
                      {tx(
                        `${fre.pessoas_fisicas.quantidade} ${fre.pessoas_fisicas.quantidade === 1 ? "pessoa física" : "pessoas físicas"} (somadas, sem nome)`,
                        `${fre.pessoas_fisicas.quantidade} ${fre.pessoas_fisicas.quantidade === 1 ? "individual" : "individuals"} (combined, unnamed)`,
                      )}
                      {fre.pessoas_fisicas.controladores > 0 && (
                        <span className="ml-2 rounded-sm border border-energia px-1 text-xs text-energia-dark">
                          {tx(`${fre.pessoas_fisicas.controladores} no grupo de controle`, `${fre.pessoas_fisicas.controladores} in the controlling group`)}
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums text-xs text-carvao-muted">
                      {tx(
                        `${p(fre.pessoas_fisicas.pct_on)} das ON · ${p(fre.pessoas_fisicas.pct_total)} do total`,
                        `${p(fre.pessoas_fisicas.pct_on)} of common shares · ${p(fre.pessoas_fisicas.pct_total)} of the total`,
                      )}
                    </span>
                  </p>
                  <span className="mt-1 block h-1.5 bg-energia-fundo" aria-hidden="true">
                    <span className="block h-1.5 bg-energia" style={{ width: `${(100 * fre.pessoas_fisicas.pct_on) / max}%` }} />
                  </span>
                </li>
              )}
            </ul>
            <p className="text-xs leading-relaxed text-carvao-muted">
              {tx(
                "Barra: fatia das ações ordinárias (as que votam). O formulário lista quem tem 5% ou mais de uma classe, os controladores e quem participa de acordo de acionistas.",
                "Bar: share of common shares (the voting ones). The form lists those holding 5% or more of a class, the controlling shareholders and those party to a shareholders' agreement.",
              )}
            </p>
          </>
        ) : (
          <p className="text-sm text-carvao-muted">{tx("Sem Formulário de Referência lido para a companhia.", "No Reference Form (FRE) read for the company.")}</p>
        )}
      </figure>
    </div>
  );
}
