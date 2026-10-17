import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Termo } from "@/components/evidencia/Termo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { PerdasComposicao } from "@/components/energia/PerdasComposicao";
import { PerdasAuditoria } from "@/components/energia/PerdasAuditoria";
import { PerdasLevaEscolha } from "@/components/energia/PerdasLevaEscolha";
import { PerdasNavegacao, PerdasSeguir, Recorte, ReferenciaPerdas, Resposta, SeparacaoMetricas, perguntaPerdas } from "@/components/energia/PerdasPainel";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { TEXTOS_PERDAS_EN, marcarNomes, traduzOuMarca } from "@/lib/energia/i18n/qualidade-perdas";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { integra, lerGold } from "@/lib/energia/gold";
import { dataBR, mesAno, num, plural } from "@/lib/energia/formato";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";
import {
  ANO_LEIAUTE_SAMP,
  anosSerieNacional,
  fraseCoberturaSeparacao,
  linhaNacional,
  linhasComposicao,
  linhasSeparacaoNacional,
  marcaLeiauteSeparacao,
  motivosComposicao,
  numOu,
  respostaComposicao,
  rotuloDistribuidora,
  serieNacional,
  vereditoComposicao,
} from "@/lib/energia/perdas";

export const dynamic = "force-static";

export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/perdas/composicao", {
    title: tx("Perdas técnicas e não técnicas por distribuidora", "Technical and non-technical losses by distribution utility"),
    description: tx(
      "Composição das perdas de energia de cada distribuidora sobre a mesma energia injetada, a não técnica sobre o mercado de baixa tensão, a cobertura de cada ano e a série de universo fixo, com a fonte da ANEEL.",
      "Composition of the energy losses of each distribution utility over the same injected energy, the non-technical loss over the low-voltage market, the coverage of each year and the fixed-universe series, with ANEEL as the source.",
    ),
    alternates: { canonical: "/setor-eletrico/perdas/composicao" },
  }, anterior);
}

export default function PerdasComposicaoPage() {
  const g = lerGold<PerdasGold>("perdas.json");
  const idioma = idiomaEnergia();
  if (!integra(g)) {
    return (
      <>
        <CabecalhoEnergia atual="perdas" />
        <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
          <Indisponivel
            titulo={tx("Perdas indisponíveis", "Losses unavailable")}
            motivo={
              g?.motivo
                ? tx(<>{g.motivo}</>, <TrechoPortugues regiao="perdas-motivo">{g.motivo}</TrechoPortugues>)
                : tx("Os dados processados de perdas não foram gerados nesta publicação.", "The processed loss data were not generated in this release.")
            }
          />
        </main>
      </>
    );
  }

  const ref = g.referencia.ano;
  const ev = g.evidencias;
  const nac = linhaNacional(g, ref);
  const rotulos = Object.fromEntries(g.distribuidoras.map((d) => [d.cnpj, rotuloDistribuidora(d)]));
  const ids = g.distribuidoras.map((d) => d.cnpj);
  const versao = tx(
    `SAMP até ${mesAno(g.referencia.ultima_competencia)}, publicado em ${dataBR(g.gerado_em)}`,
    `SAMP up to ${mesAno(g.referencia.ultima_competencia)}, published on ${dataBR(g.gerado_em)}`,
  );
  const composicao = linhasComposicao(g.distribuidoras);
  const uf = g.universo_fixo;
  const inicioSerie = anosSerieNacional(g.nacional)?.inicio ?? ref;
  const cobertura = fraseCoberturaSeparacao(g.nacional, ref);
  // as barras misturam concessionárias e permissionárias; a linha tracejada é só das concessionárias válidas
  const grupoDe = new Map(g.distribuidoras.map((d) => [d.cnpj, d.grupo]));
  const nBarrasConc = composicao.linhas.filter((l) => grupoDe.get(l.id) === "concessionaria").length;
  const universoBarras = composicao.linhas.length
    ? tx(
        `as distribuidoras com a decomposição fechando (${plural(nBarrasConc, "concessionária", "concessionárias")} e ${plural(composicao.linhas.length - nBarrasConc, "permissionária", "permissionárias")})`,
        `the distribution utilities with the decomposition closing (${plural(nBarrasConc, "concession holder", "concession holders")} and ${plural(composicao.linhas.length - nBarrasConc, "permit holder", "permit holders")})`,
      )
    : null;

  const oQueMudou = tx(
    <>
      Desde {ANO_LEIAUTE_SAMP}, ano do leiaute novo do SAMP, menos distribuidoras publicam a separação: {cobertura ?? `sem linha nacional das concessionárias em ${ref}.`}{" "}
      {uf.anos.length > 1
        ? `Nas mesmas ${uf.n_distribuidoras} concessionárias de ${uf.anos[0]} a ${uf.anos[uf.anos.length - 1]}, a série de universo fixo mostra a tendência sem mudança de composição.`
        : "Sem série de universo fixo com mais de um ano."}
    </>,
    <>
      Since {ANO_LEIAUTE_SAMP}, the year of the new SAMP layout, fewer distribution utilities publish the separation: {cobertura ?? `no national line of the concession holders in ${ref}.`}{" "}
      {uf.anos.length > 1
        ? `In the same ${uf.n_distribuidoras} concession holders from ${uf.anos[0]} to ${uf.anos[uf.anos.length - 1]}, the fixed-universe series shows the trend with no change of composition.`
        : "No fixed-universe series with more than one year."}
    </>,
  );
  const comoInterpretar = tx(
    <>
      Técnica e não técnica sobre a mesma energia injetada somam a taxa total quando a decomposição fecha, e só essas distribuidoras estão nas barras. A não técnica sobre o mercado de
      baixa tensão (a base da regulação) tem outro denominador e nunca é somada à técnica. A técnica do SAMP é a perda técnica informada no balanço de energia: estimativa, não medição.
    </>,
    <>
      Technical and non-technical losses over the same injected energy add up to the total rate when the decomposition closes, and only those distribution utilities are in the bars. The non-technical loss over the
      low-voltage market (the regulatory base) has another denominator and is never added to the technical loss. The SAMP technical loss is the one reported in the energy balance: an estimate, not a measurement.
    </>,
  );
  const naoConcluir = tx(
    <>
      Que perda não técnica seja só furto (inclui erros de medição, leitura e faturamento); que a tendência nacional da separação depois de {ANO_LEIAUTE_SAMP} valha para todas as
      distribuidoras (só o universo fixo é comparável); que toda perda técnica possa ser eliminada.
    </>,
    <>
      That non-technical loss is only theft (it includes metering, reading and billing errors); that the national trend of the separation after {ANO_LEIAUTE_SAMP} holds for all distribution utilities (only the
      fixed universe is comparable); that all technical loss can be eliminated.
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="perdas" />
      <MarcaVisita secao="energia:perdas:composicao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["SAMP", "ANEEL", "IBGE"]}
          rotulo={tx("Perdas de energia", "Energy losses")}
          titulo={perguntaPerdas("composicao")}
          lead={tx(
            <>
              A perda <Termo slug="perdas-tecnicas">técnica</Termo> vem da física das redes; a <Termo slug="perdas-nao-tecnicas">não técnica</Termo> é a diferença entre a total e a técnica.
              As duas são estimativas, publicadas só por parte das distribuidoras.
            </>,
            <>
              The <Termo slug="perdas-tecnicas">technical</Termo> loss comes from the physics of the grids; the <Termo slug="perdas-nao-tecnicas">non-technical</Termo> loss is the difference between the total and
              the technical loss. Both are estimates, published by only some of the distribution utilities.
            </>,
          )}
          recorte={tx(
            <>
              {ref}
              {nac ? ` · ${num(nac.n_distribuidoras, 0)} concessionárias no agregado` : ""} · {num(composicao.linhas.length, 0)} distribuidoras nas barras · % da energia injetada e % do
              mercado de baixa tensão
            </>,
            <>
              {ref}
              {nac ? ` · ${num(nac.n_distribuidoras, 0)} concession holders in the aggregate` : ""} · {num(composicao.linhas.length, 0)} distribution utilities in the bars · % of injected energy and % of
              the low-voltage market
            </>,
          )}
          fonte={tx(
            <>ANEEL, SAMP Balanço</>,
            <>
              ANEEL, <Nome>SAMP Balanço</Nome>
            </>,
          )}
          referencia={<ReferenciaPerdas g={g} />}
          metricas={<SeparacaoMetricas g={g} endereco="https://scrutiniums.com/setor-eletrico/perdas/composicao#composicao" />}
        >
          {tx(
            "Pela definição da ANEEL, a perda total se divide em técnica, inevitável no transporte da energia, e não técnica, a diferença entre a total e a técnica. As duas são estimativas: a técnica do SAMP é a perda técnica informada no balanço de energia, e a não técnica herda essa estimativa.",
            "By ANEEL's definition, the total loss divides into technical loss, unavoidable in transporting energy, and non-technical loss, the difference between the total and the technical loss. Both are estimates: the SAMP technical loss is the one reported in the energy balance, and the non-technical loss inherits that estimate.",
          )}
        </CabecalhoModulo>
        <PerdasNavegacao atual="composicao" />

        <ModoProfundidade>
          <PerdasLevaEscolha />
          <Bloco id="composicao">
            <PainelEvidencia
              id="painel-composicao"
              pergunta={tx("A perda de cada distribuidora dividida em técnica e não técnica", "The loss of each distribution utility divided into technical and non-technical")}
              subtitulo={tx(
                `Técnicas e não técnicas · % da energia injetada e % do mercado de baixa tensão · ${ref}`,
                `Technical and non-technical · % of injected energy and % of the low-voltage market · ${ref}`,
              )}
              natureza="ESTIMADO"
              proveniencia={g.proveniencia.separacao}
              complementares={[{ rotulo: tx("Taxas com denominador explícito", "Rates with an explicit denominator"), p: g.proveniencia.taxas }]}
              porQueImporta={tx(
                <>
                  As duas parcelas se leem de modos diferentes: a técnica está ligada à rede (extensão, tensão, carregamento); a não técnica é a diferença entre a total e a técnica e inclui
                  furto, fraude e erros de medição e de faturamento. A ANEEL regula as duas com referências próprias.
                </>,
                <>
                  The two components are read in different ways: the technical one is linked to the grid (length, voltage, loading); the non-technical one is the difference between the total and the technical
                  loss and includes theft, fraud and metering and billing errors. ANEEL regulates both with their own references.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
            >
              <div className="space-y-6">
                <PerdasComposicao
                  linhas={composicao.linhas}
                  ids={ids}
                  rotulos={rotulos}
                  motivos={motivosComposicao(g.distribuidoras, ref)}
                  anoRef={ref}
                  taxaNacional={nac?.taxa_total_pct ?? null}
                  urlAnual={g.series.anual}
                  versao={versao}
                />
                <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                  {tx(
                    <>
                      Ordem das barras: perda total da distribuidora, da maior para a menor. Fora das barras em {ref}: {composicao.semSeparacao} distribuidoras válidas sem a separação publicada
                      em todos os meses e {composicao.fora} com a decomposição que não fecha.
                      {nac && universoBarras
                        ? ` A linha tracejada é a taxa das ${nac.n_distribuidoras} concessionárias válidas; as ${composicao.linhas.length} barras são ${universoBarras}, outro conjunto.`
                        : ""}
                    </>,
                    <>
                      Order of the bars: total loss of the distribution utility, from largest to smallest. Not in the bars in {ref}: {composicao.semSeparacao} valid distribution utilities without the separation
                      published in every month and {composicao.fora} with a decomposition that does not close.
                      {nac && universoBarras
                        ? ` The dashed line is the rate of the ${nac.n_distribuidoras} valid concession holders; the ${composicao.linhas.length} bars are ${universoBarras}, a different group.`
                        : ""}
                    </>,
                  )}
                </p>
                <Recorte
                  periodo={tx(`${ref} (barras e tabela); ${inicioSerie} a ${ref} (série nacional)`, `${ref} (bars and table); ${inicioSerie} to ${ref} (national series)`)}
                  universo={tx(
                    `concessionárias e permissionárias com o ano completo, sem alerta e com a decomposição fechando (${composicao.linhas.length} distribuidoras nas barras)`,
                    `concession holders and permit holders with the complete year, no alert and the decomposition closing (${composicao.linhas.length} distribution utilities in the bars)`,
                  )}
                  unidade={tx(
                    "% da energia injetada de referência; não técnica também em % do mercado de baixa tensão medido",
                    "% of reference injected energy; non-technical also in % of the measured low-voltage market",
                  )}
                />
                <Resposta
                  id="composicao"
                  veredito={vereditoComposicao(g)}
                  prova={<ComproveNumero evidencia={ev.pnt_bt_nacional} rotulo={tx(`Comprove a não técnica de ${ref}`, `Check the ${ref} non-technical loss`)} />}
                >
                  {marcarNomes(respostaComposicao(g), Object.values(rotulos), idioma)}
                </Resposta>
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />
                <SecaoDoPainel
                  id="separacao-nacional"
                  titulo={tx(`Como a separação mudou desde ${inicioSerie}, e quantas concessionárias a publicam?`, `How has the separation changed since ${inicioSerie}, and how many concession holders publish it?`)}
                >
                  <div className="grid gap-4 lg:grid-cols-2">
                    <GraficoLinhas
                      titulo={tx("Perdas técnicas das concessionárias que publicam a técnica", "Technical losses of the concession holders that publish the technical loss")}
                      dados={serieNacional(g.nacional)}
                      chaveX="ano" // i18n: dado
                      formatoX="texto"
                      series={[{ id: "tecnica", rotulo: tx("Técnicas", "Technical"), cor: "var(--escala-seq-4)" }]}
                      unidade={tx("% da energia injetada", "% of injected energy")}
                      casas={2}
                      zeroNoEixo
                      marcos={marcaLeiauteSeparacao(g.nacional, "tecnica")}
                      altura={240}
                    />
                    <GraficoLinhas
                      titulo={tx("Perdas não técnicas das concessionárias com a separação fechando", "Non-technical losses of the concession holders with the separation closing")}
                      dados={serieNacional(g.nacional)}
                      chaveX="ano" // i18n: dado
                      formatoX="texto"
                      series={[{ id: "pnt_bt", rotulo: tx("Não técnicas", "Non-technical"), cor: "var(--serie-termica)" }]}
                      unidade={tx("% do mercado de baixa tensão", "% of the low-voltage market")}
                      casas={2}
                      zeroNoEixo
                      marcos={marcaLeiauteSeparacao(g.nacional, "pnt_bt")}
                      altura={240}
                    />
                  </div>
                  <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                    {tx(
                      <>
                        Cada ano soma as concessionárias que publicam a parte em questão, e esse conjunto muda de ano a ano: a marca de {ANO_LEIAUTE_SAMP} mostra quantas publicam no leiaute
                        novo. A tendência comparável está na série de universo fixo, abaixo.
                      </>,
                      <>
                        Each year sums the concession holders that publish the component in question, and that group changes from year to year: the {ANO_LEIAUTE_SAMP} mark shows how many publish in the new layout.
                        The comparable trend is in the fixed-universe series, below.
                      </>,
                    )}
                  </p>
                  <TabelaDados
                    titulo={tx("Separação nacional por ano, com o universo de cada medida", "National separation by year, with the universe of each measure")}
                    colunas={tx(
                      [
                        "Ano",
                        "Com técnica",
                        "Cobertura da injetada (%)",
                        "Técnicas (% injetada)",
                        "Técnicas (% injetada publicada)",
                        "Com não técnica",
                        "Cobertura da BT (%)",
                        "Não técnicas (% BT)",
                        "Mesmo universo da não técnica",
                      ],
                      [
                        "Year",
                        "With technical",
                        "Coverage of injected energy (%)",
                        "Technical (% injected)",
                        "Technical (% published injected)",
                        "With non-technical",
                        "Coverage of LV (%)",
                        "Non-technical (% LV)",
                        "Same universe as non-technical",
                      ],
                    )}
                    linhas={linhasSeparacaoNacional(g.nacional)}
                    casas={[0, 0, 1, 2, 2, 0, 1, 2, null]}
                    limite={40}
                    csv="/energia/series/perdas_nacional.csv"
                  />
                  <div className="tabela-scroll" tabIndex={0} role="region" aria-label={tx("Série de universo fixo (tabela rolável)", "Fixed-universe series (scrollable table)")}>
                    <table className="w-full min-w-[32rem] border-collapse text-sm tabular-nums">
                      <caption className="mb-2 text-left text-sm text-carvao">
                        {tx(
                          <>
                            Universo fixo: as mesmas {uf.n_distribuidoras} concessionárias de {uf.anos[0]} a {uf.anos[uf.anos.length - 1]} ({uf.criterio}).
                          </>,
                          <>
                            Fixed universe: the same {uf.n_distribuidoras} concession holders from {uf.anos[0]} to {uf.anos[uf.anos.length - 1]} ({traduzOuMarca(uf.criterio, TEXTOS_PERDAS_EN, idioma, "universo-fixo-criterio")}).
                          </>,
                        )}
                      </caption>
                      <thead>
                        <tr className="text-left text-mineral">
                          {tx(
                            ["Ano", "Perdas totais (% injetada)", "Técnicas (% injetada)", "Não técnicas (% BT)", "Não técnicas (GWh)", "Cobertura da BT das válidas (%)"],
                            ["Year", "Total losses (% injected)", "Technical (% injected)", "Non-technical (% LV)", "Non-technical (GWh)", "LV coverage of the valid ones (%)"],
                          ).map((c) => (
                            <th key={c} scope="col" className="border-b border-linha px-2 py-1.5 font-medium">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {uf.linhas.map((l) => (
                          <tr key={l.ano} className="border-b border-linha">
                            <th scope="row" className="px-2 py-1 text-left font-normal">
                              {l.ano}
                            </th>
                            <td className="px-2 py-1">{numOu(l.taxa_total_pct, 2)}</td>
                            <td className="px-2 py-1">{numOu(l.taxa_tecnica_pct, 2)}</td>
                            <td className="px-2 py-1">{numOu(l.pnt_bt_pct, 2)}</td>
                            <td className="px-2 py-1">{numOu(l.pnt_mwh === null ? null : l.pnt_mwh / 1000, 0)}</td>
                            <td className="px-2 py-1">{numOu(l.cobertura_bt_pct, 1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SecaoDoPainel>
                <PerdasSeguir
                  ancora="composicao"
                  proxima={{ pergunta: perguntaPerdas("regulatorio"), href: "/setor-eletrico/perdas/regulatorio" }}
                  downloads={[
                    { rotulo: tx("Por distribuidora e ano (CSV)", "By distribution utility and year (CSV)"), url: "/energia/series/perdas_distribuidoras.csv" },
                    { rotulo: tx("Balanço mensal para auditoria (CSV)", "Monthly balance for audit (CSV)"), url: "/energia/series/perdas_mensal.csv" },
                  ]}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          <PerdasAuditoria g={g} />
        </ModoProfundidade>
      </main>
    </>
  );
}
