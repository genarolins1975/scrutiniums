import type { Metadata, ResolvingMetadata } from "next";
import type { ReactNode } from "react";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { AguaClima } from "@/components/energia/AguaClima";
import { AguaPontes } from "@/components/energia/AguaPontes";
import { AguaAviso, AguaDatas, AguaFontes, AguaIndisponivel, AguaNavegacao, AguaParteAusente, AguaRegras, AguaSeguir } from "@/components/energia/AguaPagina";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  baciaPadraoChuva,
  baciasSemChuva,
  colunasCoberturaChuva,
  colunasCoberturaTemperatura,
  colunasValidacao,
  linhasCoberturaChuva,
  linhasCoberturaTemperatura,
  linhasValidacao,
  periodoBase,
  periodoValidacao,
  perguntaPainel,
  rotaPainel,
  situacaoAtualidade,
  textoBaciasSemChuva,
  textoCobertura,
  textoValidacao,
} from "@/lib/energia/agua";
import { carimbo, dataBR } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import type { Natureza } from "@/lib/energia/tipos";
import type { AguaDetalheGold } from "@/lib/energia/tipos-agua";
import { tx } from "@/lib/energia/idioma";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/agua-e-clima/chuva-e-temperatura", {
    title: tx("Água e clima: chuva, temperatura e previsão", "Water and climate: rainfall, temperature and forecast"),
    description: tx(
      "Chuva estimada por satélite em cada bacia do ONS e temperatura de reanálise por subsistema, contra a média climatológica dos mesmos dias, com mapa por bacia, cobertura da grade, conferência com estações e a previsão de uma rodada do ECMWF separada da estimativa.",
      "Satellite-estimated rainfall in each ONS basin and reanalysis temperature by subsystem, against the climatological average of the same days, with a map by basin, grid coverage, a check against stations and the forecast from one ECMWF run kept separate from the estimate.",
    ),
    alternates: { canonical: "/setor-eletrico/agua-e-clima/chuva-e-temperatura" },
  }, anterior);
}

const URL_GEO_BACIAS = "/energia/series/agua_bacias_geo.json";

export default function ClimaPage() {
  const g = lerGold<AguaDetalheGold>("agua_detalhe.json");
  if (!integra(g)) return <AguaIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const c = g.clima;
  const ev = g.evidencias;
  const prov = g.proveniencia;
  const atualChuva = situacaoAtualidade(
    g.dias_referencia.precipitacao,
    g.gerado_em,
    21,
    tx("o IMERG chega ao NASA POWER com cerca de duas semanas de atraso", "IMERG reaches NASA POWER about two weeks late"),
  );
  const atualTemp = situacaoAtualidade(g.dias_referencia.temperatura, g.gerado_em, 7, tx("a reanálise chega ao NASA POWER com alguns dias de atraso", "the reanalysis reaches NASA POWER a few days late"));
  const downloads = g.downloads.filter((d) => /clima_diario|agua_temperatura|agua_precipitacao|agua_previsao|agua_clima_pontos|agua_bacias_geo/.test(d.url));
  const baciaPadrao = c ? baciaPadraoChuva(g.armazenamento.bacias, c.precipitacao_bacias) : "";
  const notaSemContorno = c ? textoBaciasSemChuva(baciasSemChuva(g.armazenamento.bacias, c.precipitacao_bacias)) : "";
  // o ano em que começa o CSV diário público vem do rótulo do arquivo na gold ("desde AAAA"), não de um número escrito aqui
  const inicioCsvDiario = /desde (\d{4})/.exec(g.downloads.find((d) => /agua_precipitacao_bacias_diario/.test(d.url))?.rotulo ?? "")?.[1] ?? null; // i18n: dado
  const pendPrev = g.pendencias.filter((p) => /previs/i.test(p));
  // base climatológica e período da conferência com estações: lidos da gold, não escritos aqui
  const baseTxt = c ? periodoBase(c.base_climatologica) : null;
  const perVal = c ? periodoValidacao(c.validacao_estacoes) : null;
  const separacao: { rotulo: string; natureza: Natureza; texto: string }[] = c
    ? [
        { rotulo: tx("Observação", "Observation"), natureza: "OBSERVADO", texto: c.separacao.observacao },
        { rotulo: tx("Estimativa", "Estimate"), natureza: "ESTIMADO", texto: c.separacao.estimativa },
        { rotulo: tx("Previsão", "Forecast"), natureza: "PREVISTO", texto: c.separacao.previsao },
        { rotulo: tx("Cenário", "Scenario"), natureza: "CENARIO", texto: c.separacao.cenario },
      ]
    : [];
  const oQueMudou = (
    <>
      {atualChuva.texto} {atualTemp.texto}
    </>
  );
  const comoInterpretar = tx(
    <>
      A anomalia de chuva é a chuva do período dividida pela média dos mesmos dias{baseTxt ? ` em ${baseTxt}` : ""}, menos um; a de temperatura é a diferença em °C. O percentil é a
      posição do valor entre os mesmos dias dos anos da base. No período seco, médias de poucos milímetros produzem percentuais grandes: o mapa usa classes fixas e a tabela traz os
      milímetros. A correlação entre chuva e ENA é associação descritiva.
    </>,
    <>
      The rainfall anomaly is the rainfall for the period divided by the average of the same days{baseTxt ? ` in ${baseTxt}` : ""}, minus one; the temperature anomaly is the
      difference in °C. The percentile is the position of the value among the same days of the baseline years. In the dry season, averages of a few millimeters produce large
      percentages: the map uses fixed classes and the table shows the millimeters. The correlation between rainfall and ENA is a descriptive association.
    </>,
  );
  const naoConcluir = tx(
    <>
      Chuva por satélite e temperatura de reanálise são estimativas, não medições de estação (o INMET não respondeu nas tentativas de coleta), com datas e fontes próprias: não
      equivalem à afluência nem ao armazenamento. As janelas mais recentes são preliminares e a base de comparação é de produto final, então a anomalia pode mudar quando o produto
      final chegar. Chuva acima da média não garante afluência acima da média, e a correlação não identifica causa. A previsão é de um único modelo e de uma rodada, sem avaliação de
      acerto ainda, e nenhum cenário climático de longo prazo é apresentado.
    </>,
    <>
      Satellite rainfall and reanalysis temperature are estimates, not station measurements (INMET did not respond to the collection attempts), with their own dates and sources: they
      are not equivalent to inflow or storage. The most recent windows are preliminary and the comparison baseline is final product, so the anomaly may change when the final product
      arrives. Above-average rainfall does not guarantee above-average inflow, and the correlation does not identify a cause. The forecast comes from a single model and a single run,
      with no accuracy assessment yet, and no long-term climate scenario is presented.
    </>,
  );
  const pendencias = (lista: string[]) =>
    lista.map((p, i) => (
      <span key={p}>
        {i > 0 && "; "}
        <TrechoPortugues regiao="agua-pendencia">{p}</TrechoPortugues>
      </span>
    ));

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:agua-e-clima" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <AguaNavegacao atual="p019" />
        <CabecalhoModulo
          rotulo={tx("Água e clima", "Water and climate")}
          siglas={["SIN", "ENA", "MLT", "EAR", "ONS", "IBGE", "UF"]}
          titulo={perguntaPainel("p019")}
          lead={tx(
            "Compare a chuva e a temperatura estimadas com a média dos mesmos dias em anos anteriores. As previsões dos próximos dias aparecem separadas do histórico; a relação com afluência e demanda é examinada em outros painéis.",
            "Compare the estimated rainfall and temperature with the average of the same days in previous years. Forecasts for the coming days appear separately from the history; the relationship with inflow and demand is examined in other panels.",
          )}
          limite={tx(
            "São estimativas, não medições de estação, e os dias mais recentes são preliminares. A relação com a afluência e a carga é medida em outros painéis.",
            "These are estimates, not station measurements, and the most recent days are preliminary. The relationship with inflow and load is measured in other panels.",
          )}
          recorte={
            c
              ? tx(
                  `Chuva até ${dataBR(g.dias_referencia.precipitacao)} · temperatura até ${dataBR(g.dias_referencia.temperatura)}`,
                  `Rainfall through ${dataBR(g.dias_referencia.precipitacao)} · temperature through ${dataBR(g.dias_referencia.temperatura)}`,
                )
              : undefined
          }
          fonte={tx("NASA POWER (estimativas) e ECMWF (previsão)", "NASA POWER (estimates) and ECMWF (forecast)")}
          referencia={tx(
            <>
              NASA POWER (IMERG e MERRA-2), chuva até {dataBR(g.dias_referencia.precipitacao)} e temperatura até {dataBR(g.dias_referencia.temperatura)}; ECMWF IFS pelo
              Open-Meteo (previsão); contornos de bacia do ONS; processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              NASA POWER (IMERG and MERRA-2), rainfall through {dataBR(g.dias_referencia.precipitacao)} and temperature through {dataBR(g.dias_referencia.temperatura)}; ECMWF IFS
              through Open-Meteo (forecast); ONS basin outlines; processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <AguaDatas
              itens={[
                { rotulo: tx("Chuva por satélite", "Satellite rainfall"), dia: g.dias_referencia.precipitacao, natureza: "ESTIMADO" },
                { rotulo: tx("Temperatura de reanálise", "Reanalysis temperature"), dia: g.dias_referencia.temperatura, natureza: "ESTIMADO" },
              ]}
            />
          }
        >
          {tx(
            <>
              A chuva nas bacias alimenta a afluência dos reservatórios, e a temperatura acompanha a demanda por energia. Esta página mostra a chuva estimada
              por satélite (<Termo slug="imerg">IMERG</Termo>) em cada bacia do ONS e a temperatura estimada por reanálise (<Termo slug="merra-2">MERRA-2</Termo>) em cada
              subsistema, contra a média dos mesmos dias{baseTxt ? ` em ${baseTxt}` : ""}; a diferença para essa média é a anomalia. Estimativa, observação, previsão e cenário ficam
              separados.
            </>,
            <>
              Rainfall in the basins feeds the inflow to the reservoirs, and temperature follows the demand for energy. This page shows satellite-estimated rainfall (
              <Termo slug="imerg">IMERG</Termo>) in each ONS basin and reanalysis-estimated temperature (<Termo slug="merra-2">MERRA-2</Termo>) in each subsystem, against the
              average of the same days{baseTxt ? ` in ${baseTxt}` : ""}; the difference from that average is the anomaly. Estimate, observation, forecast and scenario are kept
              separate.
            </>,
          )}
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="clima">
            <PainelEvidencia
              id="p019"
              pergunta={tx("Onde a chuva estimada ficou acima ou abaixo da média?", "Where was estimated rainfall above or below the average?")}
              subtitulo={tx(
                `Chuva por bacia (mm) e temperatura por subsistema (°C), contra ${baseTxt ?? "a climatologia publicada"}`,
                `Rainfall by basin (mm) and temperature by subsystem (°C), against ${baseTxt ?? "the published climatology"}`,
              )}
              natureza="ESTIMADO"
              porQueImporta={tx(
                <>
                  Chuva nas cabeceiras vira vazão nos rios e afluência aos reservatórios, com atraso que depende da bacia e do solo; a temperatura costuma andar junto com a
                  demanda por energia, associação que o painel de carga mede. Ver as duas por bacia e por subsistema, com a mesma base histórica, situa a
                  água que chega e o clima em que a demanda acontece.
                </>,
                <>
                  Rainfall in the headwaters becomes river flow and inflow to the reservoirs, with a lag that depends on the basin and the soil; temperature tends to move together
                  with the demand for energy, an association that the load panel measures. Seeing both by basin and by subsystem, with the same historical baseline, places the
                  incoming water and the climate in which demand happens.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={prov.precipitacao!}
              complementares={prov.temperatura ? [{ rotulo: tx("Temperatura por subsistema", "Temperature by subsystem"), p: prov.temperatura }] : []}
              extraFonte={
                prov.previsao
                  ? tx(
                      <>
                        Previsão (outra natureza, na própria seção): {prov.previsao.fonte.orgao}, modelo ECMWF IFS 0,25° (referência até {dataBR(prov.previsao.periodo_referencia.fim)}).
                      </>,
                      <>
                        Forecast (a different nature, in its own section): {prov.previsao.fonte.orgao}, ECMWF IFS 0.25° model (reference through{" "}
                        {dataBR(prov.previsao.periodo_referencia.fim)}).
                      </>,
                    )
                  : undefined
              }
            >
              <div className="space-y-6">
                {atualChuva.defasada && <AguaAviso tipo="alerta">{atualChuva.texto}</AguaAviso>}
                {atualTemp.defasada && <AguaAviso tipo="alerta">{atualTemp.texto}</AguaAviso>}
                {c ? (
                  <AguaClima
                    precipitacao={c.precipitacao_bacias}
                    temperatura={c.temperatura}
                    previsao={c.previsao}
                    provPrevisao={prov.previsao}
                    validacao={c.validacao_estacoes}
                    base={c.base_climatologica}
                    baciaPadrao={baciaPadrao}
                    urlGeo={URL_GEO_BACIAS}
                    fonteChuva={tx("NASA POWER (IMERG), média por bacia do ONS calculada pelo observatório", "NASA POWER (IMERG), average by ONS basin calculated by the observatory")}
                    fonteTemperatura={tx(
                      "NASA POWER (MERRA-2 e GEOS-IT), média por subsistema calculada pelo observatório",
                      "NASA POWER (MERRA-2 and GEOS-IT), average by subsystem calculated by the observatory",
                    )}
                    versaoChuva={g.dias_referencia.precipitacao ?? g.gerado_em}
                    versaoTemperatura={g.dias_referencia.temperatura ?? g.gerado_em}
                    corteImergFinal={c.corte_imerg_final}
                    corteMerra2={c.corte_merra2}
                    evidencias={{ chuva30d: ev.precipitacao_maior_bacia_30d, temperaturaSin30d: ev.temperatura_sin_30d }}
                    enderecoMedidas={`${rotaPainel("p019")}#medidas`}
                    notaSemContorno={notaSemContorno}
                    inicioCsvDiario={inicioCsvDiario}
                    motivoSemPrevisao={
                      pendPrev.length
                        ? tx<ReactNode>(
                            `Sem previsão publicada: ${pendPrev.join("; ")}. A previsão nunca é substituída por uma rodada velha nem pela média.`,
                            <>
                              No forecast published: {pendencias(pendPrev)}. The forecast is never replaced by an old run or by the average.
                            </>,
                          )
                        : tx(
                            "Sem previsão publicada nesta execução: nenhuma rodada com menos de 48 horas e com todos os recortes completos. A previsão nunca é substituída por uma rodada velha nem pela média.",
                            "No forecast published in this run: no model run less than 48 hours old with all areas complete. The forecast is never replaced by an old run or by the average.",
                          )
                    }
                    notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                    aposNotas={
                      <SecaoDoPainel id="separacao" titulo={tx("O que é observação, estimativa, previsão e cenário aqui?", "What is observation, estimate, forecast and scenario here?")}>
                        <dl className="grid gap-3 sm:grid-cols-2" data-separacao="p019">
                          {separacao.map((x) => (
                            <div key={x.rotulo} className="border border-linha bg-superficie px-4 py-3">
                              <dt className="flex flex-wrap items-center gap-2">
                                <span className="rotulo text-mineral">{x.rotulo}</span>
                                <SeloNatureza natureza={x.natureza} compacto />
                              </dt>
                              <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">
                                <TrechoPortugues regiao="agua-separacao">{x.texto}</TrechoPortugues>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </SecaoDoPainel>
                    }
                    fecho={
                      <AguaPontes
                        itens={[
                          {
                            slug: "agua-e-clima",
                            rotulo: tx("Afluência", "Inflow"),
                            href: `${rotaPainel("p018")}#p018`,
                            assunto: tx(
                              "A energia das vazões que chegam aos reservatórios, em % da média de longo termo: a água que chega está acima do normal?",
                              "The energy of the flows reaching the reservoirs, in % of the long-term average: is the incoming water above normal?",
                            ),
                          },
                          {
                            slug: "carga",
                            rotulo: tx("Carga, clima e calendário", "Load, climate and calendar"),
                            href: "/setor-eletrico/carga/clima-e-calendario#p027",
                            assunto: tx(
                              "Quanto da variação da carga é compatível com clima e calendário, com a sua própria série de temperatura (NASA POWER nas capitais, ponderadas pela população: outra seleção de células, então os graus não são os desta página).",
                              "How much of the change in load is compatible with climate and calendar, with its own temperature series (NASA POWER in the state capitals, weighted by population: a different selection of cells, so the degrees are not those of this page).",
                            ),
                          },
                          { slug: "pld", assunto: tx("O PLD por submercado: outro painel, com outra fonte de dados.", "The spot price (PLD) by submarket: another panel, with another data source.") },
                          {
                            slug: "conta-de-luz",
                            assunto: tx(
                              "Tarifas e componentes da conta de luz por distribuidora: outro painel, com outra fonte de dados.",
                              "Tariffs and components of the electricity bill by distribution utility: another panel, with another data source.",
                            ),
                          },
                        ]}
                      />
                    }
                  />
                ) : (
                  <>
                    <AguaParteAusente
                      titulo={tx("Chuva e temperatura indisponíveis nesta publicação", "Rainfall and temperature unavailable in this release")}
                      motivo={
                        g.pendencias.some((p) => /clima/i.test(p))
                          ? tx<ReactNode>(g.pendencias.filter((p) => /clima/i.test(p)).join("; "), <>{pendencias(g.pendencias.filter((p) => /clima/i.test(p)))}</>)
                          : tx("O bloco de clima não foi construído nesta execução; nenhum número de reserva é exibido.", "The climate block was not built in this run; no fallback figure is shown.")
                      }
                    />
                    <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />
                  </>
                )}

                {c && (
                  <SecaoDoPainel id="cobertura" nivel="analisar" titulo={tx("Cobertura da grade, agregação espacial e conferência com estações", "Grid coverage, spatial aggregation and check against stations")}>
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-texto="cobertura">
                      {textoCobertura(c)}
                    </p>
                    <TabelaInterativa
                      titulo={tx("Pontos de grade por bacia e polígonos do ONS que compõem cada uma", "Grid points by basin and the ONS polygons that make up each one")}
                      colunas={colunasCoberturaChuva()}
                      linhas={linhasCoberturaChuva(c.cobertura_precipitacao)}
                      chaveLinha="id"
                      colunaRotulo="rotulo"
                      fonte={tx("NASA POWER (IMERG) e contornos das bacias do ONS", "NASA POWER (IMERG) and ONS basin outlines")}
                      versao={g.dias_referencia.precipitacao ?? g.gerado_em}
                      nomeArquivo="agua-cobertura-chuva"
                      nota={tx(
                        "Grade de 1°, adensada para 0,5°, 0,25° e 0,1° enquanto o polígono tiver menos de 5 pontos. A lista de pontos está no manifesto espacial (CSV).",
                        "1° grid, densified to 0.5°, 0.25° and 0.1° while the polygon has fewer than 5 points. The list of points is in the spatial manifest (CSV).",
                      )}
                    />
                    <TabelaInterativa
                      titulo={tx("Células de temperatura por UF e a população que representam", "Temperature cells by state and the population they represent")}
                      colunas={colunasCoberturaTemperatura()}
                      linhas={linhasCoberturaTemperatura(c.cobertura_temperatura)}
                      chaveLinha="id"
                      colunaRotulo="uf"
                      fonte={tx("NASA POWER (MERRA-2); IBGE, sedes municipais e Censo 2022", "NASA POWER (MERRA-2); IBGE, municipal seats and the 2022 Census")}
                      versao={g.dias_referencia.temperatura ?? g.gerado_em}
                      nomeArquivo="agua-cobertura-temperatura"
                      nota={tx(
                        "Células mais populosas até metade da população da UF (no máximo 6). O mapeamento UF para subsistema é o de 2026 e vale para toda a série.",
                        "Most populous cells up to half of the state's population (at most 6). The state-to-subsystem mapping is the 2026 one and applies to the whole series.",
                      )}
                    />
                    <p className="text-sm text-carvao-muted" data-texto="validacao">
                      {textoValidacao(c.validacao_estacoes, c.corte_imerg_final)}
                    </p>
                    <TabelaInterativa
                      titulo={tx(`IMERG contra estações por bacia${perVal ? `, ${perVal}` : ""}`, `IMERG against stations by basin${perVal ? `, ${perVal}` : ""}`)}
                      colunas={colunasValidacao()}
                      linhas={linhasValidacao(c.validacao_estacoes)}
                      chaveLinha="id"
                      colunaRotulo="rotulo"
                      fonte={tx(
                        `ONS, Precipitação Diária Observada${perVal ? ` (${perVal})` : ""}; NASA POWER (IMERG)`,
                        `ONS, observed daily precipitation${perVal ? ` (${perVal})` : ""}; NASA POWER (IMERG)`,
                      )}
                      versao={c.validacao_estacoes.periodo?.fim ?? g.gerado_em}
                      nomeArquivo="agua-validacao-imerg-estacoes"
                    />
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel id="regras-p019" nivel="auditar" titulo={tx("Regras, fontes e arquivos", "Rules, sources and files")}>
                  <AguaRegras regras={g.regras} chaves={["precipitacao", "temperatura", "anomalia", "previsao"]} />
                  <AguaFontes provs={[prov.precipitacao, prov.temperatura, prov.previsao]} />
                  {g.pendencias.length > 0 && (
                    <div>
                      <p className="rotulo text-mineral">{tx("Partes não construídas nesta execução", "Parts not built in this run")}</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                        {g.pendencias.map((p) => (
                          <li key={p}>
                            <TrechoPortugues regiao="agua-pendencia">{p}</TrechoPortugues>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </SecaoDoPainel>

                <AguaSeguir ancora="p019" proximo={{ href: `${rotaPainel("p020")}#p020`, pergunta: perguntaPainel("p020") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
