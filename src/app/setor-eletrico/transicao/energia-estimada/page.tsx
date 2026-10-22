import type { Metadata, ResolvingMetadata } from "next";
import type { ReactNode } from "react";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { TransicaoConferencia2023, TransicaoOnsMensal } from "@/components/energia/TransicaoOns";
import {
  TransicaoAnalise,
  TransicaoAuditoria,
  TransicaoAviso,
  TransicaoDatas,
  TransicaoDocumento,
  TransicaoIndisponivel,
  TransicaoNavegacao,
  NotaGold,
  TransicaoRecorte,
  TransicaoSeguir,
  TransicaoTabela,
} from "@/components/energia/TransicaoPagina";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import { RESULTADO_CONTROLE_EN } from "@/lib/energia/i18n/expansao-transicao-territorio";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  FONTE_ONS,
  colunasPares,
  fonteTransicao,
  perguntaA11,
  perguntaOns,
  semDado,
  dadosConferencia,
  comoLerOns,
  dadosRazaoCapacidade,
  data,
  dataIncorporacao,
  inteiro,
  linhasOnsAnual,
  linhasPares,
  mes,
  mudancaOns,
  mudancaOnsMes,
  numTexto,
  pctTexto,
  perguntaPainel,
  respostaOns,
  rotaPainel,
  trechosConferencia,
  ultimoAnoCompletoOns,
  vereditoOns,
} from "@/lib/energia/transicao";
import type { GoldTransicao } from "@/lib/energia/tipos-transicao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/transicao/energia-estimada", {
    title: tx("Energia da MMGD estimada pelo ONS e a entrada no Balanço de Energia", "MMGD energy estimated by the ONS and its entry into the Energy Balance"),
    description: tx(
      "Quanta energia a micro e minigeração distribuída entrega ao SIN segundo a estimativa do ONS (MWmed e participação na carga global, por submercado e mês), a razão rotulada com a capacidade cadastrada e a conferência da incorporação da MMGD ao Balanço de Energia (achado A11).",
      "How much energy distributed micro and mini generation (MMGD) delivers to the SIN according to the ONS estimate (MWavg and share of the gross load, by submarket and month), the labeled ratio with registered capacity and the check of the incorporation of MMGD into the Energy Balance (finding A11).",
    ),
    alternates: { canonical: "/setor-eletrico/transicao/energia-estimada" },
  }, anterior);
}

/**
 * P063, segunda parte: a energia de MMGD estimada pelo ONS (MWmed, só SIN), em
 * painel próprio para nunca ser somada à capacidade cadastrada da ANEEL, e a
 * conferência do achado A11 (o degrau da solar e da carga do Balanço de Energia
 * quando a MMGD passou a compor esses dados). Leitura da gold transicao.json.
 */
export default function EnergiaEstimadaPage() {
  const g = lerGold<GoldTransicao>("transicao.json");
  if (!integra(g)) return <TransicaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const m = g.mmgd;
  const o = g.ons_mmgd;
  const downloads = (urls: string[]) => g.downloads.filter((d) => urls.includes(d.url));
  // primeiro dia depois da incorporação declarada pelo ONS, como a conferência publicada o traz (nunca escrito à mão)
  const dataA11 = o ? dataIncorporacao(o.conferencia_quebra_2023) : null;
  // dias de cada média da solar na tabela de resumo (a gold publica as médias; os dias saem da janela publicada)
  const trechos = o ? trechosConferencia(o.conferencia_quebra_2023) : { antes: null, depois: null };
  const sd = semDado();
  const semDias = tx("dias sem dado", "days without data");
  const rotuloTrecho = (t: { inicio: string; fim: string; dias: number } | null) =>
    t ? tx(`de ${data(t.inicio)} a ${data(t.fim)}, ${t.dias} dias`, `from ${data(t.inicio)} to ${data(t.fim)}, ${t.dias} days`) : semDias;
  const notaGold = (texto: string, regiao: string, tabela?: Readonly<Record<string, string>>): ReactNode => <NotaGold texto={texto} regiao={regiao} tabela={tabela} />;
  const ultimoMes = o?.ultimo_mes_completo ?? null;
  const anoCompleto = o ? ultimoAnoCompletoOns(o.anual) : null;
  const primeiroAnoCompleto = o?.anual.find((a) => a.completo) ?? null;
  const oQueMudou = o ? (
    <>
      {mudancaOnsMes(o) || mudancaOns(o, m.corte_provisorio)}
      {mudancaOnsMes(o) && (
        <span data-nivel="analisar" className="mt-2 block">
          {mudancaOns(o, m.corte_provisorio)}
        </span>
      )}
    </>
  ) : null;
  const comoInterpretar = o
    ? tx(
        <>
          {comoLerOns(o)} <Termo slug="carga-global">Carga global</Termo> é a carga verificada pelo ONS.
          <span data-nivel="analisar" className="mt-2 block">
            Como o observatório calcula: energia de cada meia hora = valor publicado × 0,5 h; MWmed do período = energia ÷ horas cobertas, nunca média de médias. SIN = soma dos quatro submercados nos dias em que os
            quatro têm as 24 horas. Participação = 100 × energia de MMGD ÷ energia da carga global, mesmos intervalos.
          </span>
        </>,
        <>
          {comoLerOns(o)} <Termo slug="carga-global">Gross load</Termo> is the load verified by the ONS.
          <span data-nivel="analisar" className="mt-2 block">
            How the observatory calculates: energy of each half hour = published value × 0.5 h; MWavg of the period = energy ÷ hours covered, never an average of averages. SIN = sum of the four
            submarkets on the days when all four have the 24 hours. Share = 100 × MMGD energy ÷ gross load energy, same intervals.
          </span>
        </>,
      )
    : null;
  const naoConcluir = tx(
    <>
      Que esse seja o valor medido: o ONS chama o dado de estimado e os documentos consultados não descrevem o método. Nada sobre sistemas isolados (fora do SIN) nem
      sobre município ou UF. A razão com a capacidade cadastrada não é fator de capacidade: compara perímetros diferentes (SIN e Brasil).
    </>,
    <>
      That this is the measured value: the ONS calls the data estimated and the documents consulted do not describe the method. Nothing about isolated systems (outside the SIN) nor
      about municipality or state. The ratio with registered capacity is not a capacity factor: it compares different perimeters (SIN and Brazil).
    </>,
  );

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:transicao-energia-estimada" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <TransicaoNavegacao atual="ons" />
        <CabecalhoModulo
          siglas={["MMGD", "SIN", "MWmed", "ANEEL", "ONS", "CCEE"]}
          rotulo={tx("Transição e ambiente", "Transition and environment")}
          titulo={tx("Energia da geração distribuída no SIN", "Energy from distributed generation in the SIN")}
          lead={tx(
            "A produção estimada pelo ONS e sua participação na carga global. MWmed expressa potência média no período; MW de capacidade instalada é outra medida e não se soma a ela. Não é medição.",
            "The output estimated by the ONS and its share of the gross load. MWavg expresses average power over the period; MW of installed capacity is a different measure and is not added to it. It is not a measurement.",
          )}
          recorte={tx(
            `${data(o?.inicio_serie)} a ${data(o?.fim_serie)} · SIN · MWmed e % da carga global`,
            `${data(o?.inicio_serie)} to ${data(o?.fim_serie)} · SIN · MWavg and % of the gross load`,
          )}
          fonte={tx("ONS, carga de energia verificada (parcela de MMGD)", "ONS, verified energy load (MMGD share)")}
          referencia={tx(
            <>
              Carga verificada do ONS de {data(o?.inicio_serie)} a {data(o?.fim_serie)}; capacidade cadastrada na ANEEL de {data(m.data_cadastro)}, só na razão rotulada. Processado em{" "}
              {carimbo(g.gerado_em)}.
            </>,
            <>
              ONS verified load from {data(o?.inicio_serie)} to {data(o?.fim_serie)}; capacity registered with ANEEL as of {data(m.data_cadastro)}, only in the labeled ratio. Processed on{" "}
              {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <TransicaoDatas
              itens={[
                {
                  rotulo: tx("MMGD estimada (ONS)", "Estimated MMGD (ONS)"),
                  texto: o ? tx(`${data(o.inicio_serie)} a ${data(o.fim_serie)}`, `${data(o.inicio_serie)} to ${data(o.fim_serie)}`) : tx("sem dado nesta publicação", "no data in this release"),
                  natureza: "ESTIMADO",
                },
                { rotulo: tx("Último mês completo", "Last full month"), texto: mes(ultimoMes?.m), natureza: "ESTIMADO" },
                {
                  rotulo: tx("Capacidade cadastrada (ANEEL)", "Registered capacity (ANEEL)"),
                  texto: tx(`até ${data(m.data_cadastro)}, só na razão rotulada`, `through ${data(m.data_cadastro)}, only in the labeled ratio`),
                  natureza: "OBSERVADO",
                },
              ]}
            />
          }
          metricas={
            o ? (
              <FaixaMetricas
                colunas={4}
                rotulo={tx("Indicadores da energia estimada", "Estimated energy indicators")}
                nota={tx(
                  <>
                    <Unidade u="MWmed" /> é a energia do período dividida pelas horas cobertas; TWh é energia; participação é o percentual da carga global.
                  </>,
                  <>
                    <Unidade u="MWmed" /> (MWavg) is the energy of the period divided by the hours covered; TWh is energy; share is the percentage of the gross load.
                  </>,
                )}
              >
                <Numero
                  variante="faixa"
                  rotulo={tx("MMGD estimada no SIN", "Estimated MMGD in the SIN")}
                  natureza="ESTIMADO"
                  evidencia={o.evidencia}
                  casas={1}
                  unidade={tx("MWmed", "MWavg")}
                  periodo={ultimoMes ? tx(`${mes(ultimoMes.m)}, mês completo`, `${mes(ultimoMes.m)}, full month`) : undefined}
                  cor="var(--serie-solar)"
                  nota={tx("Estimativa do ONS, não medição.", "ONS estimate, not a measurement.")}
                  motivoAusencia={tx("Nenhum mês com os quatro submercados completos nesta publicação.", "No month with the four submarkets complete in this release.")}
                  endereco={`${rotaPainel("ons")}#ons`}
                />
                <Numero
                  variante="faixa"
                  rotulo={tx("Participação na carga global do SIN", "Share of the SIN gross load")}
                  natureza="ESTIMADO"
                  valor={ultimoMes?.participacao_carga_global_sin_pct ?? null}
                  formato="pct"
                  casas={2}
                  unidade={tx("da carga global", "of the gross load")}
                  periodo={ultimoMes ? tx(`${mes(ultimoMes.m)}, mês completo`, `${mes(ultimoMes.m)}, full month`) : undefined}
                  cor="var(--cor-carvao)"
                  nota={tx("A carga global é a carga que o ONS verifica.", "The gross load is the load the ONS verifies.")}
                  motivoAusencia={tx("Nenhum mês com os quatro submercados completos nesta publicação.", "No month with the four submarkets complete in this release.")}
                />
                <Numero
                  variante="faixa"
                  rotulo={tx(`MMGD estimada em ${anoCompleto?.ano ?? "sem dado"}`, `Estimated MMGD in ${anoCompleto?.ano ?? sd}`)}
                  natureza="ESTIMADO"
                  valor={anoCompleto?.mmgd_sin_mwmed ?? null}
                  casas={0}
                  unidade={tx("MWmed", "MWavg")}
                  periodo={tx("último ano completo", "last full year")}
                  cor="var(--serie-solar)"
                  nota={
                    anoCompleto
                      ? tx(
                          `${numTexto(anoCompleto.mmgd_sin_twh, 2)} TWh, ${pctTexto(anoCompleto.participacao_carga_global_pct, 2)} da carga global.`,
                          `${numTexto(anoCompleto.mmgd_sin_twh, 2)} TWh, ${pctTexto(anoCompleto.participacao_carga_global_pct, 2)} of the gross load.`,
                        )
                      : undefined
                  }
                  motivoAusencia={tx("Nenhum ano completo nesta publicação.", "No full year in this release.")}
                />
                <Numero
                  variante="faixa"
                  rotulo={tx(`MMGD estimada em ${primeiroAnoCompleto?.ano ?? "sem dado"}`, `Estimated MMGD in ${primeiroAnoCompleto?.ano ?? sd}`)}
                  natureza="ESTIMADO"
                  valor={primeiroAnoCompleto?.mmgd_sin_mwmed ?? null}
                  casas={0}
                  unidade={tx("MWmed", "MWavg")}
                  periodo={tx("primeiro ano completo da série", "first full year of the series")}
                  cor="var(--serie-referencia)"
                  nota={
                    primeiroAnoCompleto
                      ? tx(
                          `${numTexto(primeiroAnoCompleto.mmgd_sin_twh, 2)} TWh, ${pctTexto(primeiroAnoCompleto.participacao_carga_global_pct, 2)} da carga global.`,
                          `${numTexto(primeiroAnoCompleto.mmgd_sin_twh, 2)} TWh, ${pctTexto(primeiroAnoCompleto.participacao_carga_global_pct, 2)} of the gross load.`,
                        )
                      : undefined
                  }
                  motivoAusencia={tx("Nenhum ano completo nesta publicação.", "No full year in this release.")}
                />
              </FaixaMetricas>
            ) : undefined
          }
        >
          {tx(
            "O cadastro da ANEEL mede capacidade; esta página mostra a energia que o ONS estima para a MMGD no SIN, em MWmed. No modo Analisar, confere o que mudou nos dados do ONS quando essa estimativa entrou na geração e na carga do Balanço de Energia.",
            "The ANEEL register measures capacity; this page shows the energy the ONS estimates for MMGD in the SIN, in MWavg. In Analyze mode, it checks what changed in the ONS data when this estimate entered the generation and load of the Energy Balance.",
          )}
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="energia-estimada">
            {o ? (
              <PainelEvidencia
                id="ons"
                pergunta={perguntaOns()}
                subtitulo={tx(
                  "MMGD estimada pelo ONS na carga verificada · MWmed, TWh e % da carga global, só SIN",
                  "MMGD estimated by the ONS in the verified load · MWavg, TWh and % of the gross load, SIN only",
                )}
                natureza="ESTIMADO"
                porQueImporta={tx(
                  <>
                    O cadastro diz quanta capacidade existe; esta estimativa diz quanta energia ela entrega ao SIN. É a parcela da carga que o ONS atribui à MMGD, separada da
                    parcela supervisionada e da medida para faturamento, e que entrou nos dados de geração e carga do Balanço de Energia.
                  </>,
                  <>
                    The register says how much capacity exists; this estimate says how much energy it delivers to the SIN. It is the share of the load that the ONS attributes to MMGD, separate
                    from the supervised share and from the share metered for billing, and it entered the generation and load data of the Energy Balance.
                  </>,
                )}
                oQueMudou={oQueMudou}
                comoInterpretar={comoInterpretar}
                naoConcluir={naoConcluir}
                naoConcluirNoCorpo
                proveniencia={o.proveniencia.estimativa}
                complementares={[{ rotulo: tx("Razão com a capacidade cadastrada", "Ratio with registered capacity"), p: o.proveniencia.razao }]}
              >
                <div className="space-y-6">
                  <TransicaoOnsMensal mensal={o.mensal} fonte={fonteTransicao(FONTE_ONS)} versao={o.fim_serie} />
                  {/* a faixa de cima já traz os números; a resposta vem depois do gráfico para que ele comece na primeira tela */}
                  <RespostaCurta id="ons" depois veredito={vereditoOns(o) || respostaOns(o)}>
                    {respostaOns(o)}
                  </RespostaCurta>
                  <TransicaoRecorte
                    periodo={tx(
                      <>
                        {data(o.inicio_serie)} a {data(o.fim_serie)}; último mês completo {mes(o.ultimo_mes_completo?.m)}
                      </>,
                      <>
                        {data(o.inicio_serie)} to {data(o.fim_serie)}; last full month {mes(o.ultimo_mes_completo?.m)}
                      </>,
                    )}
                    universo={tx(
                      "SIN: os quatro submercados da carga verificada (sistemas isolados ficam fora)",
                      "SIN: the four submarkets of the verified load (isolated systems are left out)",
                    )}
                    unidade={tx("MWmed (energia do período ÷ horas), TWh e % da carga global", "MWavg (energy of the period ÷ hours), TWh and % of the gross load")}
                  />
                  <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />
                  <TransicaoAviso rotulo={tx("Estimativa da fonte", "Source estimate")}>
                    {tx(
                      <>
                        {g.regras.cadastro_x_estimativa} O ONS publica a MMGD como parcela estimada da carga, separada da parcela supervisionada e da medida para faturamento.
                      </>,
                      <>
                        {notaGold(g.regras.cadastro_x_estimativa, "transicao-regra")} The ONS publishes MMGD as an estimated share of the load, separate from the supervised share and from the share
                        metered for billing.
                      </>,
                    )}
                  </TransicaoAviso>
                  {dataA11 && (
                    <TransicaoAviso rotulo={tx("Quebra na série do Balanço de Energia", "Break in the Energy Balance series")}>
                      {tx(
                        <>
                          A partir de {data(dataA11)}, o ONS passou a incluir a MMGD estimada nos dados de geração e de carga do Balanço de Energia: comparações de geração solar e de carga que
                          atravessam essa data misturam critérios diferentes. A conferência está no modo Analisar.
                        </>,
                        <>
                          From {data(dataA11)}, the ONS began to include the estimated MMGD in the generation and load data of the Energy Balance: comparisons of solar generation and load that
                          cross this date mix different criteria. The check is in Analyze mode.
                        </>,
                      )}
                    </TransicaoAviso>
                  )}

                  <SecaoDoPainel id="por-ano" titulo={tx("Quanto a MMGD estimada entregou, ano a ano?", "How much did the estimated MMGD deliver, year by year?")}>
                    <GraficoBarras
                      titulo={tx("MMGD estimada no SIN por ano (anos incompletos marcados)", "Estimated MMGD in the SIN by year (incomplete years marked)")}
                      dados={linhasOnsAnual(o.anual)}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[{ id: "mmgd_sin_mwmed", rotulo: tx("MMGD estimada no SIN", "Estimated MMGD in the SIN"), cor: "var(--serie-solar)" }]}
                      unidade={tx("MWmed", "MWavg")}
                      casas={0}
                      altura={260}
                    />
                    <TransicaoTabela
                      titulo={tx("MMGD estimada no SIN por ano", "Estimated MMGD in the SIN by year")}
                      colunas={tx(["Ano", "MWmed", "TWh", "% da carga global", "Dias completos", "Situação"], ["Year", "MWavg", "TWh", "% of the gross load", "Full days", "Status"])}
                      numericas={[1, 2, 3, 4]}
                      linhas={linhasOnsAnual(o.anual).map((a) => [String(a.ano), numTexto(a.mmgd_sin_mwmed, 0), numTexto(a.mmgd_sin_twh, 2), pctTexto(a.participacao_carga_global_pct, 2), inteiro(a.dias_completos), a.situacao])}
                    />
                  </SecaoDoPainel>

                  <TransicaoAnalise titulo={tx("Energia estimada sobre capacidade cadastrada (razão rotulada)", "Estimated energy over registered capacity (labeled ratio)")}>
                    {dadosRazaoCapacidade(o.mensal).length > 0 ? (
                      <GraficoLinhas
                        titulo={tx(
                          "Razão entre a MMGD estimada no SIN e a capacidade cadastrada no Brasil, por mês",
                          "Ratio between the estimated MMGD in the SIN and the registered capacity in Brazil, by month",
                        )}
                        dados={dadosRazaoCapacidade(o.mensal)}
                        chaveX="m"
                        formatoX="mes"
                        series={[
                          {
                            id: "razao",
                            rotulo: tx("Estimativa ÷ capacidade (não é fator de capacidade)", "Estimate ÷ capacity (not a capacity factor)"),
                            sigla: tx("Razão", "Ratio"),
                            cor: "var(--cor-carvao)",
                          },
                        ]}
                        unidade="%"
                        casas={1}
                        zeroNoEixo
                        altura={240}
                      />
                    ) : (
                      <p className="text-sm text-carvao-muted">{tx("Nenhum mês com a razão publicada nesta versão.", "No month with the ratio published in this version.")}</p>
                    )}
                    <p className="max-w-prose2 text-sm text-carvao-muted">
                      {tx(
                        "Só em mês completo do ONS e não provisório no cadastro. Herda as limitações das duas fontes e o descasamento de perímetro; serve para ver ordem de grandeza, não para medir o desempenho dos sistemas.",
                        "Only in a full ONS month that is not provisional in the register. It inherits the limitations of both sources and the perimeter mismatch; it serves to see the order of magnitude, not to measure the performance of the systems.",
                      )}
                    </p>
                  </TransicaoAnalise>

                  <TransicaoAuditoria titulo={tx("Validações e documentos da fonte", "Validations and source documents")}>
                    <TransicaoTabela
                      titulo={tx("Domínio da participação e dos dias", "Domain of the share and of the days")}
                      colunas={tx(["Regra", "Verificado", "Resultado"], ["Rule", "Checked", "Result"])}
                      linhas={[
                        [
                          tx<ReactNode>(o.validacoes.participacao_dominio.regra, notaGold(o.validacoes.participacao_dominio.regra, "transicao-validacao")),
                          tx(
                            `${inteiro(o.validacoes.participacao_dominio.meses_verificados)} meses e ${inteiro(o.validacoes.participacao_dominio.anos_verificados)} anos; ${inteiro(o.validacoes.participacao_dominio.violacoes)} violações`,
                            `${inteiro(o.validacoes.participacao_dominio.meses_verificados)} months and ${inteiro(o.validacoes.participacao_dominio.anos_verificados)} years; ${inteiro(o.validacoes.participacao_dominio.violacoes)} violations`,
                          ),
                          tx<ReactNode>(o.validacoes.participacao_dominio.resultado, notaGold(o.validacoes.participacao_dominio.resultado, "transicao-validacao", RESULTADO_CONTROLE_EN)),
                        ],
                        [
                          tx<ReactNode>(o.validacoes.dias_fora_do_dominio.regra, notaGold(o.validacoes.dias_fora_do_dominio.regra, "transicao-validacao")),
                          tx(`${inteiro(o.validacoes.dias_fora_do_dominio.dias)} dias`, `${inteiro(o.validacoes.dias_fora_do_dominio.dias)} days`),
                          tx<ReactNode>(
                            `${o.validacoes.dias_fora_do_dominio.resultado}; ${o.validacoes.dias_fora_do_dominio.tratamento}`,
                            <>
                              {notaGold(o.validacoes.dias_fora_do_dominio.resultado, "transicao-validacao", RESULTADO_CONTROLE_EN)};{" "}
                              {notaGold(o.validacoes.dias_fora_do_dominio.tratamento, "transicao-validacao")}
                            </>,
                          ),
                        ],
                      ]}
                    />
                    {o.documentos.map((d) => (
                      <TransicaoDocumento key={d.url} doc={d} />
                    ))}
                  </TransicaoAuditoria>

                  <TransicaoSeguir
                    ancora="ons"
                    href={`${rotaPainel("ons")}#a11`}
                    pergunta={perguntaA11()}
                    downloads={downloads(["/energia/series/transicao_ons_mmgd_mensal.csv", "/energia/series/transicao_ons_mmgd_diario.csv"])}
                  />
                </div>
              </PainelEvidencia>
            ) : (
              <Indisponivel
                titulo={tx("Estimativa de MMGD do ONS ausente nesta publicação", "ONS MMGD estimate missing in this release")}
                motivo={tx(
                  `O bloco do ONS não foi montado nesta execução (${g.pendencias.join(" ") || "sem motivo registrado"}). O cadastro da ANEEL, na página da MMGD no território, não depende dele; nenhum valor de energia é estimado no lugar.`,
                  `The ONS block was not assembled in this run (${g.pendencias.join(" ") || "no reason recorded"}). The ANEEL register, on the page of MMGD across the territory, does not depend on it; no energy value is estimated in its place.`,
                )}
              />
            )}
          </Bloco>

          {o && (
            <Bloco id="achado-a11">
              <PainelEvidencia
                id="a11"
                nivel="analisar"
                pergunta={perguntaA11()}
                subtitulo={tx("Balanço de Energia do SIN e MMGD estimada, MWmed por dia", "SIN Energy Balance and estimated MMGD, MWavg by day")}
                natureza="CALCULADO"
                porQueImporta={tx(
                  <>
                    A solar do SIN dá um salto em {data(dataA11)} nos dados do ONS. Se o salto for lido como crescimento da geração, qualquer comparação que atravesse essa data
                    superestima a expansão solar. A conferência separa o que a fonte declara do que aparece no dado.
                  </>,
                  <>
                    SIN solar jumps on {data(dataA11)} in the ONS data. If the jump is read as growth in generation, any comparison that crosses this date overstates the solar expansion. The
                    check separates what the source declares from what appears in the data.
                  </>,
                )}
                oQueMudou={tx(
                  <>
                    Degrau da solar de {numTexto(o.conferencia_quebra_2023.degrau_solar_mwmed, 0)} MWmed de um dia para o outro; MMGD estimada de{" "}
                    {numTexto(o.conferencia_quebra_2023.mmgd_ons_no_dia_mwmed, 0)} MWmed no dia, {numTexto(o.conferencia_quebra_2023.diferenca_degrau_solar_e_mmgd_mwmed, 0)} MWmed acima do
                    degrau, diferença que a fonte não explica.
                  </>,
                  <>
                    Solar step of {numTexto(o.conferencia_quebra_2023.degrau_solar_mwmed, 0)} MWavg from one day to the next; estimated MMGD of{" "}
                    {numTexto(o.conferencia_quebra_2023.mmgd_ons_no_dia_mwmed, 0)} MWavg on the day, {numTexto(o.conferencia_quebra_2023.diferenca_degrau_solar_e_mmgd_mwmed, 0)} MWavg above
                    the step, a difference the source does not explain.
                  </>,
                )}
                comoInterpretar={tx(
                  <>
                    {o.conferencia_quebra_2023.regra_pares}. A carga &ldquo;mostra degrau&rdquo; quando a mediana das diferenças dela chega à metade da mediana da MMGD estimada nos mesmos
                    dias.
                  </>,
                  <>
                    {notaGold(o.conferencia_quebra_2023.regra_pares, "transicao-conferencia")}. The load &ldquo;shows a step&rdquo; when the median of its differences reaches half the median of
                    the estimated MMGD on the same days.
                  </>,
                )}
                naoConcluir={tx(
                  <>
                    A causa da diferença entre o degrau e a estimativa, nem o motivo de a carga não mostrar degrau do mesmo tamanho: a fonte não publica explicação. Comparações que
                    atravessam {data(dataA11)} na solar e na carga do balanço misturam critérios diferentes.
                  </>,
                  <>
                    The cause of the difference between the step and the estimate, nor why the load does not show a step of the same size: the source publishes no explanation. Comparisons
                    that cross {data(dataA11)} in the balance solar and load mix different criteria.
                  </>,
                )}
                proveniencia={o.proveniencia.estimativa}
              >
                <div className="space-y-6">
                  <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="a11">
                    {tx<ReactNode>(o.conferencia_quebra_2023.leitura, notaGold(o.conferencia_quebra_2023.leitura, "transicao-conferencia"))}
                  </p>
                  <TransicaoRecorte
                    periodo={tx(
                      <>
                        {data(o.conferencia_quebra_2023.janela.inicio)} a {data(o.conferencia_quebra_2023.janela.fim)}
                      </>,
                      <>
                        {data(o.conferencia_quebra_2023.janela.inicio)} to {data(o.conferencia_quebra_2023.janela.fim)}
                      </>,
                    )}
                    universo={tx("SIN (Balanço de Energia nos Subsistemas e carga verificada)", "SIN (Energy Balance in the Subsystems and verified load)")}
                    unidade={tx("MWmed, média de cada dia", "MWavg, average of each day")}
                  />
                  <TransicaoDocumento doc={o.conferencia_quebra_2023.documento} />
                  <TransicaoConferencia2023
                    dias={dadosConferencia(o.conferencia_quebra_2023)}
                    marco={dataA11 ? { x: dataA11, rotulo: tx("MMGD incorporada ao balanço (ONS)", "MMGD incorporated into the balance (ONS)") } : null}
                    captura={o.proveniencia.estimativa.capturado_em ? carimbo(o.proveniencia.estimativa.capturado_em) : sd}
                  />
                  <TransicaoTabela
                    titulo={tx("Resumo da conferência", "Summary of the check")}
                    colunas={tx(["Medida", "MWmed"], ["Measure", "MWavg"])}
                    numericas={[1]}
                    linhas={[
                      [tx("Degrau da solar de um dia para o outro", "Solar step from one day to the next"), numTexto(o.conferencia_quebra_2023.degrau_solar_mwmed, 0)],
                      [tx(`MMGD estimada em ${data(dataA11)}`, `Estimated MMGD on ${data(dataA11)}`), numTexto(o.conferencia_quebra_2023.mmgd_ons_no_dia_mwmed, 0)],
                      [
                        tx(`Média da solar antes da incorporação (${rotuloTrecho(trechos.antes)})`, `Solar average before the incorporation (${rotuloTrecho(trechos.antes)})`),
                        numTexto(o.conferencia_quebra_2023.solar_media_7d_antes, 0),
                      ],
                      [
                        tx(`Média da solar a partir da incorporação (${rotuloTrecho(trechos.depois)})`, `Solar average from the incorporation on (${rotuloTrecho(trechos.depois)})`),
                        numTexto(o.conferencia_quebra_2023.solar_media_depois, 0),
                      ],
                      [
                        tx(
                          `Mediana das diferenças na solar (${o.conferencia_quebra_2023.pares_na_mediana} pares)`,
                          `Median of the differences in solar (${o.conferencia_quebra_2023.pares_na_mediana} pairs)`,
                        ),
                        numTexto(o.conferencia_quebra_2023.mediana_diferenca_solar_mwmed, 0),
                      ],
                      [
                        tx(
                          `Mediana das diferenças na carga (${o.conferencia_quebra_2023.pares_na_mediana} pares)`,
                          `Median of the differences in load (${o.conferencia_quebra_2023.pares_na_mediana} pairs)`,
                        ),
                        numTexto(o.conferencia_quebra_2023.mediana_diferenca_carga_mwmed, 0),
                      ],
                      [tx("Mediana da MMGD estimada nos mesmos dias", "Median of the estimated MMGD on the same days"), numTexto(o.conferencia_quebra_2023.mediana_mmgd_ons_mwmed, 0)],
                    ]}
                  />
                  <TabelaInterativa
                    titulo={tx("Cada dia contra o mesmo dia da semana 14 dias antes", "Each day against the same weekday 14 days earlier")}
                    colunas={colunasPares()}
                    linhas={linhasPares(o.conferencia_quebra_2023)}
                    chaveLinha="id"
                    colunaRotulo="d"
                    fonte={tx(
                      "ONS, Balanço de Energia nos Subsistemas e Carga de Energia Verificada",
                      "ONS, Energy Balance in the Subsystems and Verified Energy Load",
                    )}
                    versao={o.conferencia_quebra_2023.janela.fim}
                    nomeArquivo="transicao-conferencia-quebra-2023"
                    chaveUrl="ons.pares"
                    ordemInicial={{ coluna: "d", direcao: "asc" }}
                    nota={tx(
                      "Médias de 24 horas de cada dia. Pares com feriado nacional ficam fora da mediana.",
                      "24-hour averages of each day. Pairs with a national holiday stay out of the median.",
                    )}
                  />
                  <TransicaoSeguir
                    ancora="a11"
                    href={`${rotaPainel("p064")}#p064`}
                    pergunta={perguntaPainel("p064")}
                    downloads={downloads(["/energia/series/transicao_ons_mmgd_diario.csv"])}
                  />
                </div>
              </PainelEvidencia>
            </Bloco>
          )}
        </ModoProfundidade>
      </main>
    </>
  );
}
