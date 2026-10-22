import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GeracaoMatriz } from "@/components/energia/GeracaoMatriz";
import { GeracaoSerieRecente } from "@/components/energia/GeracaoSerieRecente";
import {
  GeracaoAviso,
  GeracaoCapitulos,
  GeracaoDatas,
  GeracaoDocumentos,
  GeracaoFrases,
  GeracaoIndisponivel,
  GeracaoNavegacao,
  GeracaoRegras,
  GeracaoSeguir,
} from "@/components/energia/GeracaoPagina";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { Numero } from "@/components/energia/Numero";
import { RedirecionaAncoraAntiga } from "@/components/energia/RedirecionaAncoraAntiga";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { GeracaoTabelaSobDemanda } from "@/components/energia/GeracaoTabelasSobDemanda";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, mesAno, num, plural } from "@/lib/energia/formato";
import { URL_GOLD_GERACAO_DETALHE } from "@/lib/energia/geracao-tabelas";
import {
  COR_CATEGORIA,
  COR_NATUREZA,
  NATUREZAS,
  curtoCategoria,
  curtoNatureza,
  datasDoModulo,
  downloadsDoPainel,
  emPortugues,
  fontePrincipalDaJanela,
  fontesDoGrupoTipo3,
  lacunaDasComparaveis,
  linhasDozeMeses,
  linhasMmgdApi,
  linhasNaturezaMensal,
  marcosMensais,
  mesesComPresencaParcial,
  minusculaPalavras,
  mwmed,
  nomesCategorias,
  perguntaPainel,
  rotaPainel,
  rotuloJanela,
  rotuloRegraGeracao,
  situacaoAtualidade,
  textoA11,
  textoDozeMeses,
} from "@/lib/energia/geracao";
import { integra, lerGold } from "@/lib/energia/gold";
import { rotuloFicha } from "@/lib/energia/i18n/aprenda";
import { valorExibidoNoIdioma } from "@/lib/energia/i18n/geracao";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import type { GoldGeracaoDetalhe } from "@/lib/energia/tipos-geracao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/geracao", {
    title: tx("Geração: de onde vem a eletricidade", "Generation: where electricity comes from"),
    description: tx(
      "Matriz efetiva do SIN e dos subsistemas pela Geração por Usina do ONS: hidráulica, eólica, solar centralizada, MMGD estimada, nuclear, gás, carvão, óleo, biomassa e demais térmicas, em energia e participação, com e sem a MMGD, a quebra de 29/04/2023 conferida na fonte, ressalvas de universo e a reconciliação com o Balanço de Energia.",
      `Effective generation mix of the SIN and its subsystems from the ONS generation by plant dataset: hydropower, wind, centralized solar, estimated MMGD, nuclear, gas, coal, oil, biomass and other thermal, in energy and share, with and without the MMGD, the ${dataBR("2023-04-29")} break checked at the source, coverage caveats and the reconciliation with the ONS energy balance.`,
    ),
    alternates: { canonical: "/setor-eletrico/geracao" },
  }, anterior);
}

export default function GeracaoPage() {
  const g = lerGold<GoldGeracaoDetalhe>("geracao_detalhe.json");
  if (!integra(g)) return <GeracaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const idioma = idiomaEnergia();
  const FONTE = tx("ONS, Geração por Usina em Base Horária", "ONS, hourly generation by plant dataset");
  /** Título da abertura: a pergunta do módulo na galeria, a mesma do registro dos painéis (o texto do menu fica em navegacao.ts). */
  const TITULO = perguntaPainel("p021");
  const ROTULO_JANELA = rotuloJanela();
  const CURTO_NATUREZA = curtoNatureza();
  const CURTO = curtoCategoria();
  const UNIDADE = mwmed();
  const m = g.matriz;
  const ev = g.evidencias;
  const nomes = nomesCategorias(g.categorias);
  const atual = situacaoAtualidade(g.dia_referencia, g.gerado_em);
  const versao = g.dia_referencia;
  const sin30 = m.janelas.SIN["30d"];
  const sin12 = m.janelas.SIN["12m"];
  const principal = fontePrincipalDaJanela(sin30, "com"); // i18n: dado
  // janela e período de cada medida da faixa: a mesma janela de 30 dias do SIN que o gráfico mostra ao abrir
  const periodo30 = sin30
    ? tx(`${ROTULO_JANELA["30d"]}, de ${dataBR(sin30.inicio)} a ${dataBR(sin30.fim)}`, `${ROTULO_JANELA["30d"]}, from ${dataBR(sin30.inicio)} to ${dataBR(sin30.fim)}`)
    : undefined;
  const doze = m.comparacao_12m ? linhasDozeMeses(m.comparacao_12m, sin12) : [];
  const dozeGrafico = doze.filter((l) => !m.comparacao_12m?.variacao_suprimida[l.id]);
  const natureza = linhasNaturezaMensal(m.natureza_mensal_sin);
  const presencaMmgd = mesesComPresencaParcial(m.mensal_sin, "solar_mmgd");
  const lacunas = m.comparacao_12m ? lacunaDasComparaveis(m.comparacao_12m, m.universo) : [];
  const a11 = g.a11;
  const mmgdApi = linhasMmgdApi(a11);
  const marcos = marcosMensais(g.quebras, m.mensal_sin.meses);
  const rec = m.reconciliacao_balanco;
  const lac = m.universo.lacuna_ultimo_mes;
  const seq = m.universo.sequencias_zero_identificadores;
  const dataQuebra = dataBR("2023-04-29");
  const rotulosRegra = rotuloRegraGeracao();
  const presencaTexto = presencaMmgd
    .map((x) =>
      tx(`${mesAno(x.mes)} tem estimativa em ${num(x.dias, 0)} de ${num(x.diasDoMes, 0)} dias`, `${mesAno(x.mes)} has an estimate on ${num(x.dias, 0)} of ${num(x.diasDoMes, 0)} days`),
    )
    .join("; ");
  const lacunasTexto = lacunas.map((x) => `${minusculaPalavras(x.rotulo)} ${num(x.gwh, 1)} GWh`).join("; ");
  const oQueMudou = (
    <>
      {atual.texto} {m.comparacao_12m ? textoDozeMeses(m.comparacao_12m) : tx("Sem duas janelas de 365 dias comparáveis nesta publicação.", "No two comparable 365-day windows in this release.")}
    </>
  );
  const comoInterpretar = tx(
    <>
      A geração média, em MWmed, é a energia do período dividida pelas horas dos dias completos. Participação é a energia da categoria dividida pela energia de todas as categorias no mesmo período e
      região. No perímetro com MMGD o total soma as mesmas fontes do Balanço de Energia do ONS e fica próximo dele, com diferenças por fonte e por dia que a reconciliação do modo Auditar mostra; no
      perímetro sem MMGD, a estimativa sai do numerador e do denominador. Categoria com ressalva de universo teve menos usinas publicadas com dado no período; a ressalva aparece junto da participação.
    </>,
    <>
      Average generation, in MWavg, is the energy of the period divided by the hours of the complete days. Share is the energy of the category divided by the energy of all categories in the same period and
      region. In the scope with MMGD, the total adds up the same sources as the ONS energy balance and is close to it, with differences by source and by day that the reconciliation in Audit mode shows; in the
      scope without MMGD, the estimate is removed from the numerator and the denominator. A category with a coverage caveat had fewer plants published with data in the period; the caveat appears next to the share.
    </>,
  );
  const naoConcluir = tx(
    <>
      Participação não é capacidade instalada (ver o painel de capacidade). A MMGD e os grupos Tipo III são estimativa e previsão do ONS, não medição. A participação da biomassa cobre só as usinas
      despachadas com combustível declarado e não representa a biomassa do país; parte dela (licor negro de celulose) está em outras térmicas, como o ONS rotula. Uma participação maior não indica,
      sozinha, preço menor ou maior.
    </>,
    <>
      Share is not installed capacity (see the capacity panel). The MMGD and the Type III groups are ONS estimates and forecasts, not measurements. The biomass share covers only the dispatched plants
      with a declared fuel and does not represent the country&apos;s biomass; part of it (pulp black liquor) is in other thermal, as the ONS labels it. A larger share does not indicate,
      on its own, a lower or higher price.
    </>,
  );
  const ficha = (chave: "matriz_30d_eolica" | "matriz_30d_gas", nome: string) => {
    const e = ev[chave];
    if (!e) return null;
    const valor = valorExibidoNoIdioma(e.valor_exibido, idioma);
    return (
      <li key={chave} className="inline-flex flex-wrap items-center gap-x-2">
        <span>
          {nome} {valor}
        </span>
        <ComproveNumero
          sobDemanda={{ url: URL_GOLD_GERACAO_DETALHE, caminho: `evidencias.${chave}`, indicador: rotuloFicha(e.indicador, idioma) ?? e.indicador, valorExibido: valor }}
          endereco={`${rotaPainel("p021")}#composicao`}
        />
      </li>
    );
  };

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:geracao" />
      {/* o contexto térmico de 7 dias foi para o painel de despacho térmico; links antigos seguem para lá */}
      <RedirecionaAncoraAntiga ancoras={["termica", "termica-ctx"]} destino={rotaPainel("p022")} />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["ONS", "MWmed", "SIN", "MMGD", "CEG", "CVU", "SIGA", "ANEEL"]}
          titulo={TITULO}
          lead={tx(
            "A participação de cada fonte na energia gerada no Sistema Interligado Nacional (SIN), com a micro e minigeração distribuída (MMGD) estimada pelo ONS identificada à parte. Mostra de onde veio a energia que atendeu a carga e quanto dela é medição, previsão ou estimativa.",
            "The share of each source in the energy generated in the National Interconnected System (SIN), with distributed micro and mini generation (MMGD) estimated by the ONS identified separately. It shows where the energy that met the load came from, and how much of it is measurement, forecast or estimate.",
          )}
          recorte={
            sin30
              ? tx(
                  `${dataBR(sin30.inicio)} a ${dataBR(sin30.fim)} (${ROTULO_JANELA["30d"]}) · SIN · MWmed e % da geração com a MMGD estimada`,
                  `${dataBR(sin30.inicio)} to ${dataBR(sin30.fim)} (${ROTULO_JANELA["30d"]}) · SIN · MWavg and % of generation with the estimated MMGD`,
                )
              : undefined
          }
          fonte={FONTE}
          referencia={tx(
            <>
              {FONTE}, até {dataBR(g.dia_referencia)}; processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              {FONTE}, up to {dataBR(g.dia_referencia)}; processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={<GeracaoDatas itens={datasDoModulo(g)} />}
          metricas={
            <FaixaMetricas
              colunas={3}
              rotulo={tx("Indicadores da geração no SIN, em 30 dias", "SIN generation indicators, over 30 days")}
              nota={tx(
                "Perímetro: SIN, energia gerada com a MMGD estimada pelo ONS, que é estimativa com previsão meteorológica, não medição. As três medidas são sempre as dos 30 dias do SIN e não mudam com Região, Janela e Perímetro, escolhidos mais abaixo.",
                "Scope: SIN, energy generated including the MMGD estimated by the ONS, which is an estimate based on weather forecasts, not a measurement. The three measures are always those of the SIN's 30 days and do not change with Region, Window and Scope, chosen further below.",
              )}
            >
              <Numero
                variante="faixa"
                rotulo={tx("Geração média do SIN, com a MMGD estimada", "Average SIN generation, with the estimated MMGD")}
                natureza="CALCULADO"
                evidencia={ev.matriz_30d_total}
                casas={0}
                unidade={UNIDADE}
                periodo={periodo30}
                cor="var(--cor-energia)"
                endereco={`${rotaPainel("p021")}#p021`}
              />
              {principal && (
                <Numero
                  variante="faixa"
                  rotulo={tx(`Participação da ${principal.frase}, a maior fonte`, `Share of ${principal.frase}, the largest source`)}
                  natureza="CALCULADO"
                  valor={principal.participacao}
                  formato="pct"
                  casas={1}
                  unidade={tx("da geração com a MMGD", "of generation with the MMGD")}
                  periodo={periodo30}
                  cor={COR_CATEGORIA[principal.id]}
                />
              )}
              <Numero
                variante="faixa"
                rotulo={tx("Participação da MMGD solar, estimativa do ONS", "Share of solar MMGD, ONS estimate")}
                natureza="ESTIMADO"
                evidencia={ev.matriz_30d_solar_mmgd}
                formato="pct"
                casas={1}
                unidade={tx("da geração", "of generation")}
                periodo={periodo30}
                cor={COR_CATEGORIA.solar_mmgd}
                endereco={`${rotaPainel("p021")}#p021`}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              A <Termo slug="geracao-centralizada">geração verificada</Termo> de cada usina, conjunto e grupo de pequenas usinas que o ONS publica hora a hora, somada por fonte e combustível, em{" "}
              <Unidade u="MWmed" /> e em participação. Desde 29/04/2023 a mesma base inclui a estimativa do ONS para a{" "}
              <Termo slug="geracao-distribuida">micro e minigeração distribuída</Termo>, conferida na documentação da fonte; a matriz sai em dois perímetros, com e sem ela. As outras páginas
              respondem por que as térmicas foram acionadas, quanto da eólica e da solar foi restringido e quanto está instalado.
            </>,
            <>
              The <Termo slug="geracao-centralizada">verified generation</Termo> of each plant, plant cluster and group of small plants that the ONS publishes hour by hour, added up by source and fuel, in{" "}
              <Unidade u="MWmed" /> and as a share. Since {dataQuebra} the same dataset includes the ONS estimate for{" "}
              <Termo slug="geracao-distribuida">distributed micro and mini generation</Termo>, checked against the source documentation; the mix comes in two scopes, with and without it. The other pages
              answer why thermal plants were dispatched, how much wind and solar was restricted, and how much is installed.
            </>,
          )}
        </CabecalhoModulo>
        <GeracaoNavegacao atual="p021" />
        <ModoProfundidade>
          <Bloco id="matriz">
            <PainelEvidencia
              id="p021"
              pergunta={tx("Participação de cada fonte na geração", "Share of each source in generation")}
              subtitulo={tx(
                "Geração por categoria e participação, SIN e subsistemas, com e sem a MMGD estimada · MWmed e %",
                "Generation by category and share, SIN and subsystems, with and without the estimated MMGD · MWavg and %",
              )}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>
                  A matriz efetiva mostra de onde veio a energia que atendeu a carga: quanto foi água, vento, sol, combustível nuclear, gás, carvão, óleo e biomassa, separados
                  por combustível onde a fonte permite, e quanto é estimativa do próprio ONS.
                </>,
                <>
                  The effective mix shows where the energy that met the load came from: how much was water, wind, sun, nuclear fuel, gas, coal, oil and biomass, separated
                  by fuel where the source allows, and how much is an estimate by the ONS itself.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.matriz!}
              complementares={g.proveniencia.a11 ? [{ rotulo: tx("Quebra de 29/04/2023", `Break of ${dataQuebra}`), p: g.proveniencia.a11 }] : []}
            >
              <div className="space-y-6">
                {atual.defasada && <GeracaoAviso tipo="alerta">{atual.texto}</GeracaoAviso>}
                <GeracaoMatriz
                  janelas={m.janelas}
                  mensal={m.mensal_sin}
                  nomes={nomes}
                  marcos={marcos}
                  fonte={FONTE}
                  versao={versao}
                  fontesTipo3={fontesDoGrupoTipo3(m.rotulos, g.categorias)}
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  aposPrincipal={<GeracaoCapitulos />}
                  fichas={
                    <div className="text-xs leading-relaxed text-carvao-muted" data-fichas="p021">
                      <p>
                        {tx(
                          "Ficha de prova dos valores do SIN em 30 dias, com a MMGD estimada, que não aparecem na faixa de métricas:",
                          "Proof sheet for the SIN 30-day values, with the estimated MMGD, that do not appear in the metrics strip:",
                        )}
                      </p>
                      <ul className="flex flex-wrap gap-x-6 gap-y-0">
                        {ficha("matriz_30d_eolica", CURTO.eolica)}
                        {ficha("matriz_30d_gas", CURTO.gas)}
                      </ul>
                    </div>
                  }
                  naturezaIntro={tx(
                    <>
                      A geração publicada soma três naturezas: medição das usinas com relacionamento com o ONS, previsão do ONS para grupos de pequenas usinas Tipo III e estimativa do ONS para a MMGD
                      {a11.primeiro_dia_mmgd ? ` (desde ${dataBR(a11.primeiro_dia_mmgd)})` : ""}. Mês sem a natureza fica vazio.
                    </>,
                    <>
                      Published generation adds up three natures: measurement of the plants with a relationship with the ONS, the ONS forecast for groups of small Type III plants, and the ONS estimate for the MMGD
                      {a11.primeiro_dia_mmgd ? ` (since ${dataBR(a11.primeiro_dia_mmgd)})` : ""}. A month without the nature is left empty.
                    </>,
                  )}
                  naturezaMensal={
                    <>
                      <GraficoLinhas
                        titulo={tx("Parcela da geração do SIN por natureza do dado", "Share of SIN generation by data nature")}
                        dados={natureza}
                        chaveX="m"
                        formatoX="mes"
                        series={NATUREZAS.map((n) => ({ id: n, rotulo: CURTO_NATUREZA[n], cor: COR_NATUREZA[n] }))}
                        unidade="%"
                        casas={1}
                        zeroNoEixo
                        marcos={marcos}
                      />
                      {presencaMmgd.length > 0 && (
                        <GeracaoAviso>
                          {tx(
                            <>
                              Presença parcial da MMGD: {presencaTexto}. Nesses meses a parcela da MMGD é a energia dos dias com estimativa sobre a energia
                              do mês inteiro, e fica abaixo da de um mês completo.
                            </>,
                            <>
                              Partial presence of the MMGD: {presencaTexto}. In those months the MMGD share is the energy of the days with an estimate over the energy
                              of the whole month, and it is below that of a complete month.
                            </>,
                          )}
                        </GeracaoAviso>
                      )}
                      <div data-nivel="analisar">
                        <GeracaoTabelaSobDemanda tabela="natureza" versao={versao} />
                      </div>
                    </>
                  }
                  comparacaoAnual={
                    m.comparacao_12m && (
                      <SecaoDoPainel
                        id="doze-meses"
                        titulo={tx(
                          `O que mudou em 365 dias: ${dataBR(m.comparacao_12m.atual.inicio)} a ${dataBR(m.comparacao_12m.atual.fim)} contra o ano anterior`,
                          `What changed in 365 days: ${dataBR(m.comparacao_12m.atual.inicio)} to ${dataBR(m.comparacao_12m.atual.fim)} against the previous year`,
                        )}
                        lead={tx(
                          <>
                            Geração média de cada categoria nos 365 dias mais recentes e nos 365 anteriores, no SIN. Fica fora do gráfico a categoria cuja cobertura na fonte mudou dentro das janelas: a variação dela, na tabela, aparece como suprimida.
                            {lacunas.length > 0 && (
                              <>
                                {" "}
                                As categorias que seguem comparáveis também têm usinas sem dado em {mesAno(lacunas[0].mes)}; a geração delas em {mesAno(lacunas[0].mesAnoAnterior)} dá a ordem de grandeza da lacuna:{" "}
                                {lacunasTexto}. A tabela traz uma coluna com esse valor.
                              </>
                            )}
                          </>,
                          <>
                            Average generation of each category in the most recent 365 days and in the previous 365, in the SIN. A category whose coverage in the source changed within the windows is left out of the chart: its variation, in the table, appears as suppressed.
                            {lacunas.length > 0 && (
                              <>
                                {" "}
                                The categories that remain comparable also have plants without data in {mesAno(lacunas[0].mes)}; their generation in {mesAno(lacunas[0].mesAnoAnterior)} gives the order of magnitude of the gap:{" "}
                                {lacunasTexto}. The table has a column with this value.
                              </>
                            )}
                          </>,
                        )}
                      >
                        <GraficoPontos
                          titulo={tx("Geração média por categoria nos 365 dias mais recentes e nos 365 anteriores, SIN", "Average generation by category in the most recent 365 days and the previous 365, SIN")}
                          itens={dozeGrafico.map((l) => ({ id: l.id, rotulo: l.rotulo, valor: l.atual, referencia: l.anterior }))}
                          unidade={UNIDADE}
                          casas={0}
                          rotuloValor={tx("365 dias mais recentes", "Most recent 365 days")}
                          rotuloReferencia={tx("365 dias anteriores", "Previous 365 days")}
                          zeroNoEixo
                          ordemInicial={{ por: "valor", direcao: "desc" }} // i18n: dado
                          chaveUrl="dzg"
                        />
                        <div data-nivel="analisar">
                          <GeracaoTabelaSobDemanda tabela="doze" versao={versao} />
                        </div>
                      </SecaoDoPainel>
                    )
                  }
                />

                <SecaoDoPainel
                  nivel="analisar"
                  id="recentes"
                  titulo={tx(
                    `Os últimos ${plural(m.diario_sin_recente.dias.length, "dia", "dias")} e as últimas ${plural(m.horario_sin_recente.horas.length, "hora", "horas")}, SIN`,
                    `The last ${plural(m.diario_sin_recente.dias.length, "day", "days")} and the last ${plural(m.horario_sin_recente.horas.length, "hour", "hours")}, SIN`,
                  )}
                >
                  <GeracaoSerieRecente tipo="diaria" />
                  <GeracaoTabelaSobDemanda tabela="diaria" versao={versao} />
                  <GeracaoSerieRecente tipo="horaria" />
                  <GeracaoTabelaSobDemanda tabela="horaria" versao={versao} />
                </SecaoDoPainel>

                <SecaoDoPainel nivel="analisar" id="anos" titulo={tx("Participação por ano, sem a MMGD, e a MMGD estimada à parte", "Share by year, without the MMGD, and the estimated MMGD shown separately")}>
                  <GeracaoTabelaSobDemanda tabela="anual" versao={versao} />
                </SecaoDoPainel>

                <SecaoDoPainel nivel="analisar" id="a11" titulo={tx("A quebra de 29/04/2023: MMGD estimada dentro da solar", `The ${dataQuebra} break: estimated MMGD inside solar`)}>
                  <p className="text-sm leading-relaxed text-carvao">
                    <TrechoPortugues regiao="geracao-a11-conclusao">{emPortugues(a11.conclusao ?? "")}</TrechoPortugues>
                  </p>
                  <p className="text-sm text-carvao-muted">{emPortugues(textoA11(a11))}</p>
                  <GeracaoDocumentos documentos={a11.evidencias_documentais} />
                  <p className="rotulo text-mineral">{tx("Tratamento aplicado", "Treatment applied")}</p>
                  <GeracaoFrases itens={a11.tratamento} daFonte />
                  <GeracaoTabelaSobDemanda tabela="a11" versao={versao} />
                  <GraficoLinhas
                    titulo={tx(
                      "MMGD estimada pelo ONS: na Geração por Usina e na carga verificada (API), por mês",
                      "MMGD estimated by the ONS: in the generation by plant dataset and in verified load (API), by month",
                    )}
                    dados={mmgdApi}
                    chaveX="m"
                    formatoX="mes"
                    series={[
                      { id: "usina_mwmed", rotulo: tx("Geração por Usina", "Generation by plant"), cor: COR_CATEGORIA.solar_mmgd, espessura: 2.5 },
                      { id: "api_mwmed", rotulo: tx("Carga verificada (API)", "Verified load (API)"), cor: "var(--serie-referencia)", tracejada: true },
                    ]}
                    unidade={UNIDADE}
                    casas={0}
                    zeroNoEixo
                  />
                  <GeracaoTabelaSobDemanda tabela="mmgd-api" versao={versao} />
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" id="reconciliacao" titulo={tx("Reconciliação com o Balanço de Energia nos Subsistemas", "Reconciliation with the ONS subsystem energy balance")}>
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        Soma das usinas por fonte do Balanço (térmica com a nuclear), subsistema e dia, contra o Balanço publicado pelo ONS, com tolerância de{" "}
                        {num(rec.tolerancia_mwh_por_subsistema_dia, 0)} MWh por subsistema e dia. Nada é corrigido: o painel mostra os dois. {emPortugues(rec.roraima.regra)} Último dia com a
                        térmica de Roraima fora do Balanço: {dataBR(rec.roraima.ultimo_dia_excluida)} ({num(rec.roraima.dias_balanco_exclui, 0)} dias).
                      </>,
                      <>
                        Sum of the plants by Energy Balance source (thermal including nuclear), subsystem and day, against the Balance published by the ONS, with a tolerance of{" "}
                        {num(rec.tolerancia_mwh_por_subsistema_dia, 0)} MWh per subsystem and day. Nothing is corrected: the panel shows both.{" "}
                        <TrechoPortugues regiao="geracao-roraima-regra">{emPortugues(rec.roraima.regra)}</TrechoPortugues> Last day with Roraima thermal outside the Balance:{" "}
                        {dataBR(rec.roraima.ultimo_dia_excluida)} ({plural(rec.roraima.dias_balanco_exclui, "day", "days")}).
                      </>,
                    )}
                  </p>
                  <GeracaoTabelaSobDemanda tabela="rec-fonte" versao={versao} />
                  <GeracaoTabelaSobDemanda tabela="rec-mensal" versao={versao} />
                  <GeracaoTabelaSobDemanda tabela="divergencias" versao={versao} />
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" id="universo" titulo={tx("Universo da fonte: usinas com dado, saltos e mudanças de rótulo", "Source universe: plants with data, jumps and label changes")}>
                  <p className="text-sm text-carvao-muted">
                    <TrechoPortugues regiao="geracao-universo-regra">{emPortugues(m.universo.regra)}</TrechoPortugues>
                  </p>
                  <p className="text-sm text-carvao-muted">
                    <TrechoPortugues regiao="geracao-universo-ressalvas">{emPortugues(m.universo.regra_ressalvas)}</TrechoPortugues>
                  </p>
                  {lac && <GeracaoTabelaSobDemanda tabela="lacuna" versao={versao} />}
                  <GeracaoTabelaSobDemanda tabela="quebras" versao={versao} />
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        {emPortugues(m.universo.regra_sequencias_zero)} {num(seq.n, 0)} identificadores com zero exato por 6 meses ou mais depois de produção positiva (
                        {num(seq.continuam_no_ultimo_mes, 0)} até o último mês). Nada é excluído: térmica sem despacho e usina parada também produzem zero.
                      </>,
                      <>
                        <TrechoPortugues regiao="geracao-universo-zeros">{emPortugues(m.universo.regra_sequencias_zero)}</TrechoPortugues> {num(seq.n, 0)} identifiers with exact zero for 6 months or more after positive output (
                        {num(seq.continuam_no_ultimo_mes, 0)} up to the latest month). Nothing is excluded: a thermal plant without dispatch and a stopped plant also produce zero.
                      </>,
                    )}
                  </p>
                  <GeracaoTabelaSobDemanda tabela="rotulos" versao={versao} />
                  {m.outros_por_ceg && <GeracaoTabelaSobDemanda tabela="outros-ceg" versao={versao} />}
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" id="controles" titulo={tx("Controles, regras, limitações e fontes", "Checks, rules, limitations and sources")}>
                  <GeracaoTabelaSobDemanda tabela="controles" versao={versao} />
                  <GeracaoRegras regras={Object.entries(g.regras).map(([k, t]) => ({ rotulo: rotulosRegra[k] ?? k, texto: t }))} />
                  <p className="rotulo text-mineral">{tx("Limitações da matriz", "Limitations of the mix")}</p>
                  <GeracaoFrases itens={g.proveniencia.matriz?.limitacoes ?? []} daFonte />
                  <GeracaoTabelaSobDemanda tabela="fontes" versao={versao} />
                </SecaoDoPainel>

                <GeracaoSeguir ancora="p021" proximo={{ href: `${rotaPainel("p022")}#p022`, pergunta: perguntaPainel("p022") }} downloads={downloadsDoPainel(g.downloads, "p021")} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
