import type { ReactNode } from "react";
import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import {
  MercadoAusencias,
  MercadoAviso,
  MercadoDefinicoes,
  MercadoIndisponivel,
  MercadoLimitacoes,
  MercadoNavegacao,
  MercadoPendenciasAuditoria,
  MercadoRecorte,
  MercadoResposta,
  MercadoVerificacoes,
  ReferenciaMercado,
} from "@/components/energia/MercadoPainel";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { integra, lerGold } from "@/lib/energia/gold";
import { dataBR, mesAno, num, pct } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import { Nome } from "@/components/i18n/Nome";
import {
  colunasGsf,
  colunasInfoMercado,
  CSV_MERCADO,
  ROTULO_RESULTADO,
  TITULO_PAGINA_MERCADO,
  barrasRiscoHidrologico,
  barrasSubmercadosGsf,
  itensAusentesMercado,
  linhasGsf,
  linhasInfoMercado,
  notaGsfDozeMeses,
  painelMercado,
  provenienciasLegiveis,
  reaisCurto,
  serieGeracaoGarantia,
  serieGsf,
  textoPeriodoMes,
  vereditoGsf,
} from "@/lib/energia/mercado";
import type { MercadoGold } from "@/lib/energia/tipos-mercado";

export const dynamic = "force-static";

export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/mercado/mre-e-gsf", {
    title: tx("Mercado de energia: MRE e GSF", "Energy market: MRE and GSF"),
    description: tx(
      "Como foi o ajuste da garantia física das hidrelétricas do MRE: GSF mês a mês, geração e garantia física em colunas separadas, risco hidrológico alocado às distribuidoras na Conta Bandeira e a conferência com o InfoMercado da CCEE.",
      "How the physical guarantee of the MRE hydropower plants was adjusted: GSF month by month, generation and physical guarantee in separate columns, hydrological risk allocated to distribution utilities in the Conta Bandeira and the check against CCEE's InfoMercado.",
    ),
    alternates: { canonical: "/setor-eletrico/mercado/mre-e-gsf" },
  }, anterior);
}

export default function MercadoMreGsfPage() {
  const g = lerGold<MercadoGold>("mercado.json");
  if (!integra(g)) return <MercadoIndisponivel motivo={g?.motivo} />;

  const p = painelMercado(g, "P034");
  const prov = provenienciasLegiveis(g);
  const m = g.mre_gsf;
  const k = m.kpis;
  const versao = tx(
    `CCEE até ${g.referencias.ccee_ultimo_mes_gsf ? mesAno(g.referencias.ccee_ultimo_mes_gsf) : "sem mês"}, publicado em ${dataBR(g.gerado_em)}`,
    `CCEE to ${g.referencias.ccee_ultimo_mes_gsf ? mesAno(g.referencias.ccee_ultimo_mes_gsf) : "no month"}, published on ${dataBR(g.gerado_em)}`,
  );
  const anual = m.anual;
  const vDiv = p?.verificacoes.find((v) => v.nome.startsWith("GSF de 12 meses")); // i18n: dado
  const alt = k.gsf_12m?.alternativas;
  const gfFora = m.identidade_gf.filter((x) => Math.abs(x.diferenca_mwmed) > 1);
  const rh = barrasRiscoHidrologico(g);
  const ausentes = itensAusentesMercado(g).filter((i) => i.paineis.includes("P034"));

  const oQueMudou =
    k.gsf_ultimo_mes && k.gsf_12m ? (
      tx(
        <>
          O GSF foi de {pct(k.gsf_ultimo_mes.valor_pct, 1)} em {mesAno(k.gsf_ultimo_mes.mes)} e de {pct(k.gsf_12m.valor_pct, 1)} nos 12 meses até {mesAno(k.gsf_12m.periodo.fim)}.
          {anual.filter((a) => a.completo).length > 0 && <> Nos anos completos da série: {anual.filter((a) => a.completo).map((a) => `${a.ano}, ${pct(a.gsf_pct, 1)}`).join("; ")}.</>}
        </>,
        <>
          The GSF was {pct(k.gsf_ultimo_mes.valor_pct, 1)} in {mesAno(k.gsf_ultimo_mes.mes)} and {pct(k.gsf_12m.valor_pct, 1)} in the 12 months to {mesAno(k.gsf_12m.periodo.fim)}.
          {anual.filter((a) => a.completo).length > 0 && <> In the complete years of the series: {anual.filter((a) => a.completo).map((a) => `${a.ano}, ${pct(a.gsf_pct, 1)}`).join("; ")}.</>}
        </>,
      )
    ) : (
      <>{tx("Sem GSF publicado nesta atualização.", "No GSF published in this update.")}</>
    );
  const comoInterpretar = tx(
    <>
      GSF do mês = geração das usinas do MRE ÷ garantia física modulada e ajustada pelo fator de disponibilidade, a razão que reproduz o fator publicado pela CCEE no InfoMercado. O de 12 meses divide a
      soma da geração dos 12 meses pela soma da garantia física dos 12 meses (MWh); não é a média dos fatores mensais. Geração e garantia física aparecem em colunas separadas, nunca somadas.
    </>,
    <>
      GSF for the month = generation of the MRE plants ÷ physical guarantee modulated and adjusted by the availability factor, the ratio that reproduces the factor published by CCEE in InfoMercado. The 12-month GSF divides the
      sum of 12-month generation by the sum of the 12-month physical guarantee (MWh); it is not the average of the monthly factors. Generation and physical guarantee appear in separate columns, never added together.
    </>,
  );
  const naoConcluir = tx(
    <>
      A exposição financeira de nenhuma usina ou agente: o GSF é do conjunto do MRE. Que o GSF baixo seja só falta de chuva: o despacho centralizado e a geração de outras fontes também mudam a geração
      hidrelétrica. Que o número de 12 meses do InfoMercado e o daqui medem a mesma coisa: a divergência está publicada abaixo.
    </>,
    <>
      The financial exposure of any individual plant or agent: the GSF is for the MRE as a whole. That a low GSF is only a lack of rain: centralized dispatch and generation from other sources also change hydropower
      generation. That the 12-month figure in InfoMercado and the one here measure the same thing: the divergence is published below.
    </>,
  );

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:mercado:mre-gsf" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <MercadoNavegacao atual="mre-gsf" />
        <CabecalhoModulo
          siglas={["MRE", "GSF", "EPE", "CCEE", "SAMP", "ANEEL", "ACR", "SIN", "MWmed", "ACL", "MME"]}
          rotulo={tx("Mercado de energia", "Energy market")}
          titulo={TITULO_PAGINA_MERCADO["mre-gsf"]}
          lead={tx(
            "As hidrelétricas do Mecanismo de Realocação de Energia (MRE) dividem o risco de gerar menos que a garantia física. O GSF (Generation Scaling Factor, o fator de ajuste do MRE) mede, no conjunto, quanto foi gerado em relação a ela.",
            "The hydropower plants in the Energy Reallocation Mechanism (MRE) share the risk of generating less than their physical guarantee. The generation scaling factor (GSF), the MRE adjustment factor, measures how much was generated relative to it for all of them combined.",
          )}
          recorte={versao}
          fonte={tx<ReactNode>(
            "CCEE, Câmara de Comercialização de Energia Elétrica; ANEEL, Conta Bandeira (risco hidrológico)",
            <>
              CCEE (electric energy trading chamber); ANEEL, <Nome>Conta Bandeira</Nome> (hydrological risk)
            </>,
          )}
          referencia={<ReferenciaMercado g={g} />}
          metricas={
            <FaixaMetricas
              colunas={3}
              rotulo={tx("GSF do mês, GSF de 12 meses e risco hidrológico do ACR", "GSF for the month, 12-month GSF and ACR hydrological risk")}
              nota={
                <>
                  <span className="block">{notaGsfDozeMeses(g)}</span>
                  {k.risco_hidrologico_acr_12m && (
                    <span className="mt-2 block">
                      {tx(
                        <>
                          O risco hidrológico do ACR é o que recai sobre o consumidor cativo (usinas em cotas, usinas que repactuaram o risco com a ANEEL e Itaipu), no valor bruto, antes de descontar a previsão na
                          tarifa e o prêmio de risco; a tabela anual, no modo Analisar, mostra as deduções. A janela termina em {mesAno(prov.risco_hidrologico_acr.periodo_referencia.fim)}, o último mês da
                          Conta Bandeira que a ANEEL publicou.
                        </>,
                        <>
                          ACR hydrological risk is the part that falls on the captive consumer (quota plants, plants that renegotiated the risk with ANEEL, and Itaipu), at the gross value, before deducting the amount forecast in the
                          tariff and the risk premium; the annual table, in Analyze mode, shows the deductions. The window ends in {mesAno(prov.risco_hidrologico_acr.periodo_referencia.fim)}, the latest month of the
                          <Nome>Conta Bandeira</Nome> published by ANEEL.
                        </>,
                      )}
                    </span>
                  )}
                </>
              }
            >
              <Numero
                variante="faixa"
                rotulo={tx("GSF do mês", "GSF for the month")}
                natureza="CALCULADO"
                evidencia={k.gsf_ultimo_mes?.evidencia ?? null}
                formato="pct"
                casas={1}
                unidade="%"
                periodo={k.gsf_ultimo_mes ? mesAno(k.gsf_ultimo_mes.mes) : undefined}
                cor="var(--serie-hidraulica)"
                nota={k.gsf_ultimo_mes ? tx(<>para cada 100 MWh de garantia física ajustada, as hidrelétricas do MRE geraram {num(k.gsf_ultimo_mes.valor_pct, 1)} MWh</>, <>for every 100 MWh of adjusted physical guarantee, the MRE hydropower plants generated {num(k.gsf_ultimo_mes.valor_pct, 1)} MWh</>) : undefined}
                motivoAusencia={tx("A CCEE não publicou o mês.", "CCEE did not publish the month.")}
                endereco="https://scrutiniums.com/setor-eletrico/mercado/mre-e-gsf#mre-gsf"
              />
              <Numero
                variante="faixa"
                rotulo={tx("GSF de 12 meses", "12-month GSF")}
                natureza="CALCULADO"
                evidencia={k.gsf_12m?.evidencia ?? null}
                formato="pct"
                casas={1}
                unidade="%"
                periodo={k.gsf_12m ? textoPeriodoMes(k.gsf_12m.periodo) : undefined}
                cor="var(--serie-hidraulica)"
                motivoAusencia={tx("A CCEE não publicou os 12 meses da janela.", "CCEE did not publish the 12 months of the window.")}
                endereco="https://scrutiniums.com/setor-eletrico/mercado/mre-e-gsf#mre-gsf"
              />
              <Numero
                variante="faixa"
                rotulo={tx("Risco hidrológico do ACR, 12 meses", "ACR hydrological risk, 12 months")}
                natureza="CALCULADO"
                evidencia={k.risco_hidrologico_acr_12m?.evidencia ?? null}
                valor={k.risco_hidrologico_acr_12m ? k.risco_hidrologico_acr_12m.valor_rs / 1e9 : null}
                unidade={tx("R$ bilhões", "R$ billion")}
                casas={2}
                periodo={k.risco_hidrologico_acr_12m ? textoPeriodoMes(k.risco_hidrologico_acr_12m.periodo) : undefined}
                motivoAusencia={tx("A ANEEL não publicou os 12 meses da janela.", "ANEEL did not publish the 12 months of the window.")}
                endereco="https://scrutiniums.com/setor-eletrico/mercado/mre-e-gsf#mre-gsf"
              />
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              As hidrelétricas do <Termo slug="mre">MRE</Termo> dividem entre si o risco de gerar menos que a garantia física, porque quem decide quanto cada uma gera é o despacho centralizado. O{" "}
              <Termo slug="gsf">GSF</Termo> mede, no conjunto, quanto foi gerado em relação à garantia física ajustada; abaixo de 100%, as hidrelétricas do mecanismo geraram, juntas, menos que a{" "}
              <Termo slug="garantia-fisica">garantia física</Termo>, e os documentos do MME registram que isso expôs agentes hidrelétricos a valores elevados de PLD. Mais abaixo, a Conta Bandeira da ANEEL mostra o
              risco hidrológico alocado às distribuidoras.
            </>,
            <>
              The hydropower plants in the <Termo slug="mre">MRE</Termo> share among themselves the risk of generating less than their physical guarantee, because centralized dispatch decides how much each one generates. The{" "}
              <Termo slug="gsf">GSF</Termo> measures, for all of them combined, how much was generated relative to the adjusted physical guarantee; below 100%, the plants in the mechanism together generated less than the{" "}
              <Termo slug="garantia-fisica">physical guarantee</Termo>, and MME documents record that this exposed hydropower agents to high values of the spot price (PLD). Further down, ANEEL&apos;s <Nome>Conta Bandeira</Nome> (tariff flag account) shows the
              hydrological risk allocated to distribution utilities.
            </>,
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="mre-gsf">
            <PainelEvidencia
              id="painel-mre-gsf"
              pergunta={tx("Quanto as hidrelétricas geraram da garantia física?", "How much of their physical guarantee did the hydropower plants generate?")}
              subtitulo={tx(`GSF · % da garantia física ajustada · mensal desde ${mesAno(m.mensal[0]?.mes ?? "2023-05")}`, `GSF · % of the adjusted physical guarantee · monthly since ${mesAno(m.mensal[0]?.mes ?? "2023-05")}`)}
              natureza="CALCULADO"
              proveniencia={prov.gsf}
              complementares={[{ rotulo: tx("Risco hidrológico do ACR (Conta Bandeira)", "ACR hydrological risk (tariff flag account)"), p: prov.risco_hidrologico_acr }]}
              porQueImporta={
                tx(
                  <>
                    Quando o GSF fica abaixo de 100%, as hidrelétricas do MRE geram, juntas, menos que a garantia física, e os documentos do MME registram a exposição a PLD elevado. Os valores da Conta
                    Bandeira, mais abaixo, são o risco hidrológico que a ANEEL publica como alocado às distribuidoras (cotas, repactuadas e Itaipu); o painel não verificou em norma como esse custo chega à
                    tarifa, e por isso não o afirma.
                  </>,
                  <>
                    When the GSF falls below 100%, the MRE hydropower plants together generate less than their physical guarantee, and MME documents record the exposure to a high PLD. The <Nome>Conta Bandeira</Nome> values,
                    further down, are the hydrological risk that ANEEL publishes as allocated to distribution utilities (quotas, renegotiated plants and Itaipu); the panel has not verified in the regulations how this cost reaches the
                    tariff, and therefore does not claim it.
                  </>,
                )
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
            >
              <div className="space-y-6">
                <GraficoLinhas
                  titulo={tx("GSF, fator de ajuste do MRE, mês a mês", "GSF, the MRE adjustment factor, month by month")}
                  dados={serieGsf(g)}
                  chaveX="mes"
                  formatoX="mes"
                  series={[
                    { id: "gsf", rotulo: "GSF", cor: "var(--serie-hidraulica)", espessura: 2.5 },
                    { id: "cem", rotulo: tx("100%: geração igual à garantia física", "100%: generation equal to the physical guarantee"), cor: "var(--serie-referencia)", tracejada: true },
                  ]}
                  unidade="%"
                  casas={1}
                  zeroNoEixo
                  altura={280}
                />
                <MercadoRecorte
                  periodo={<>{textoPeriodoMes({ inicio: m.mensal[0]?.mes ?? "", fim: m.mensal.at(-1)?.mes ?? "" })}, {tx("mês a mês", "month by month")}</>}
                  universo={tx("usinas participantes do MRE contabilizadas pela CCEE (SIN)", "MRE participating plants accounted by CCEE (SIN)")}
                  unidade={tx("% (GSF); MW médios (geração e garantia física)", "% (GSF); MWavg (generation and physical guarantee)")}
                />
                <GraficoLinhas
                  titulo={tx("Geração do MRE e garantia física ajustada, mês a mês", "MRE generation and adjusted physical guarantee, month by month")}
                  dados={serieGeracaoGarantia(g)}
                  chaveX="mes"
                  formatoX="mes"
                  series={[
                    { id: "geracao", rotulo: tx("Geração das usinas do MRE", "Generation of the MRE plants"), cor: "var(--serie-hidraulica)" },
                    { id: "garantia", rotulo: tx("Garantia física ajustada", "Adjusted physical guarantee"), cor: "var(--serie-referencia)", tracejada: true },
                  ]}
                  unidade={tx("MWmed", "MWavg")}
                  casas={0}
                  zeroNoEixo
                  altura={260}
                />
                <TabelaDados
                  titulo={tx("GSF por ano", "GSF by year")}
                  colunas={tx(["Ano", "Meses", "GSF (%)", "Situação"], ["Year", "Months", "GSF (%)", "Status"])}
                  linhas={anual.map((a) => [a.ano, a.meses, a.gsf_pct, a.completo ? tx("ano completo", "complete year") : tx(`parcial, ${textoPeriodoMes({ inicio: a.inicio, fim: a.fim })}`, `partial, ${textoPeriodoMes({ inicio: a.inicio, fim: a.fim })}`)])}
                  casas={[null, 0, 2, null]}
                />
                <MercadoResposta painel="P034" veredito={vereditoGsf(g)}>
                  {p?.resposta ?? tx("Sem resposta nesta atualização: o GSF não pôde ser calculado com a base publicada.", "No answer in this update: the GSF could not be calculated with the published database.")}
                </MercadoResposta>
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                {m.submercados_ultimo_mes.mes && (
                  <SecaoDoPainel
                    id="mre-submercados"
                    titulo={tx("Em que submercados a geração ficou abaixo da garantia?", "In which submarkets was generation below the guarantee?")}
                    lead={tx("Geração do MRE e garantia física sazonalizada de cada submercado no último mês publicado.", "MRE generation and seasonalized physical guarantee of each submarket in the latest month published.")}
                  >
                    <GraficoBarras
                      titulo={tx(`Geração do MRE e garantia física sazonalizada por submercado, ${mesAno(m.submercados_ultimo_mes.mes)}`, `MRE generation and seasonalized physical guarantee by submarket, ${mesAno(m.submercados_ultimo_mes.mes)}`)}
                      dados={barrasSubmercadosGsf(g)}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[
                        { id: "geracao", rotulo: tx("Geração do MRE", "MRE generation"), cor: "var(--serie-hidraulica)" },
                        { id: "garantia", rotulo: tx("Garantia física sazonalizada", "Seasonalized physical guarantee"), cor: "var(--serie-referencia)" },
                      ]}
                      unidade={tx("MWmed", "MWavg")}
                      casas={0}
                      orientacao="horizontal"
                      alturaCategoria={56}
                    />
                    <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                      {tx(
                        "Por submercado, a garantia física sazonalizada não é o denominador do GSF (que usa a garantia modulada e ajustada pela disponibilidade): a comparação mostra onde a geração ficou abaixo ou acima, não o fator de cada submercado.",
                        "By submarket, the seasonalized physical guarantee is not the GSF denominator (which uses the guarantee modulated and adjusted for availability): the comparison shows where generation was below or above, not the factor of each submarket.",
                      )}
                    </p>
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel
                  id="mre-risco"
                  titulo={tx("Quanto do risco hidrológico a ANEEL aloca às distribuidoras?", "How much of the hydrological risk does ANEEL allocate to distribution utilities?")}
                  lead={tx<ReactNode>(
                    "Risco hidrológico do ACR por ano e por origem, na Conta Bandeira da ANEEL, em R$ bilhões. A tabela com as deduções e a de cada mês estão em Analisar.",
                    <>
                      ACR hydrological risk by year and by origin, in ANEEL&apos;s <Nome>Conta Bandeira</Nome>, in R$ billion. The table with the deductions and the monthly one are in Analyze.
                    </>,
                  )}
                >
                  <GraficoBarras
                    titulo={tx("Risco hidrológico do ACR por ano, por origem (Conta Bandeira)", "ACR hydrological risk by year, by origin (tariff flag account)")}
                    dados={rh}
                    chaveCategoria="ano" // i18n: dado
                    chaveRotulo="rotulo"
                    series={[
                      { id: "itaipu", rotulo: "Itaipu", cor: "var(--serie-1)" }, // i18n: dado
                      { id: "repactuadas", rotulo: tx("Repactuadas (Lei 13.203/2015)", "Renegotiated (Law 13,203/2015)"), cor: "var(--serie-2)" },
                      { id: "ccgf", rotulo: tx("Cotas de garantia física", "Physical guarantee quotas"), cor: "var(--serie-3)" },
                    ]}
                    unidade={tx("R$ bilhões", "R$ billion")}
                    casas={2}
                    empilhado
                    altura={280}
                  />
                </SecaoDoPainel>

                <MercadoAusencias id="ainda-nao" titulo={tx("O que esta página ainda não mostra?", "What does this page not yet show?")} itens={ausentes} />

                <SecaoDoPainel id="mre-analise" nivel="analisar" titulo={tx("Deduções do risco hidrológico e o GSF mês a mês em tabela", "Hydrological risk deductions and the GSF month by month in a table")}>
                  <TabelaDados
                    titulo={tx("Risco hidrológico do ACR e o que já estava coberto na tarifa (R$ milhões)", "ACR hydrological risk and what was already covered in the tariff (R$ million)")}
                    colunas={tx(
                      ["Ano", "Meses", "Itaipu", "Repactuadas", "Cotas", "Bruto", "Previsão na tarifa", "Prêmio de risco", "Cotas e repactuadas líquido"],
                      ["Year", "Months", "Itaipu", "Renegotiated", "Quotas", "Gross", "Forecast in the tariff", "Risk premium", "Quotas and renegotiated, net"],
                    )}
                    linhas={m.risco_hidrologico_acr.anual.map((a) => [
                      a.ano,
                      a.meses,
                      a.rh_itaipu === null ? null : a.rh_itaipu / 1e6,
                      a.rh_repactuadas === null ? null : a.rh_repactuadas / 1e6,
                      a.rh_ccgf === null ? null : a.rh_ccgf / 1e6,
                      a.rh_bruto === null ? null : a.rh_bruto / 1e6,
                      a.previsao_rh === null ? null : a.previsao_rh / 1e6,
                      a.premio_risco === null ? null : a.premio_risco / 1e6,
                      a.rh_ccgf_repactuadas_liquido === null ? null : a.rh_ccgf_repactuadas_liquido / 1e6,
                    ])}
                    casas={[null, 0, 1, 1, 1, 1, 1, 1, 1]}
                    csv={CSV_MERCADO.contaBandeira.url}
                  />
                  <p className="text-xs leading-relaxed text-carvao-muted">
                    {tx<ReactNode>(
                      "Previsão e prêmio de risco entram negativos porque a ANEEL os deduz do custo bruto: a previsão é a de risco hidrológico considerada nos processos tarifários das distribuidoras, e o prêmio é o das usinas repactuadas (dicionário da Conta Bandeira da ANEEL). O bruto soma Itaipu, repactuadas e cotas. O ano com menos de 12 meses é parcial.",
                      <>
                        The forecast and the risk premium are negative because ANEEL deducts them from the gross cost: the forecast is the hydrological risk considered in distribution utilities&apos; tariff processes, and the premium is that of the renegotiated plants (ANEEL&apos;s <Nome>Conta Bandeira</Nome> data dictionary). The gross value adds Itaipu, renegotiated plants and quotas. A year with fewer than 12 months is partial.
                      </>,
                    )}
                  </p>
                  <TabelaInterativa
                    titulo={tx("GSF, geração e garantia física por mês", "GSF, generation and physical guarantee by month")}
                    colunas={colunasGsf()}
                    linhas={linhasGsf(g)}
                    chaveLinha="id"
                    colunaRotulo="mes"
                    fonte={tx("CCEE, MRE_MENSAL, GERACAO_SUBMERCADO e GARANTIA_FISICA_SAZO_MRE_SUBMERCADO", "CCEE, MRE_MENSAL, GERACAO_SUBMERCADO and GARANTIA_FISICA_SAZO_MRE_SUBMERCADO")}
                    versao={versao}
                    nomeArquivo="mercado-gsf"
                    chaveUrl="gsf"
                    ordemInicial={{ coluna: "mes", direcao: "desc" }}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="mre-auditoria" nivel="auditar" titulo={tx("Conferência com o InfoMercado, pendências e definições testadas", "Check against InfoMercado, pending items and definitions tested")}>
                  {p && <MercadoVerificacoes painel={p} />}
                  {vDiv && vDiv.resultado !== "aprovado" && (
                    <MercadoAviso>
                      {tx(
                        <>O InfoMercado publica um &quot;ajuste médio do MRE nos últimos doze meses&quot; que nenhuma definição testada reproduz.</>,
                        <>
                          InfoMercado publishes an &quot;average MRE adjustment over the last twelve months&quot; (<Nome>ajuste médio do MRE nos últimos doze meses</Nome>) that no definition tested reproduces.
                        </>,
                      )}
                      {alt &&
                        tx(
                          <>
                            {" "}
                            Para a janela de {k.gsf_12m ? textoPeriodoMes(k.gsf_12m.periodo) : "12 meses"}: razão de energias {pct(k.gsf_12m?.valor_pct, 2)} (a adotada), média simples dos fatores mensais{" "}
                            {pct(alt.media_simples_pct, 2)}, razão sobre a garantia física sazonalizada {pct(alt.razao_gf_sazonalizada_pct, 2)} e acumulado do ano {pct(alt.acumulado_ano_pct, 2)}.
                          </>,
                          <>
                            {" "}
                            For the window {k.gsf_12m ? textoPeriodoMes(k.gsf_12m.periodo) : "12 months"}: energy ratio {pct(k.gsf_12m?.valor_pct, 2)} (the one adopted), simple average of the monthly factors{" "}
                            {pct(alt.media_simples_pct, 2)}, ratio over the seasonalized physical guarantee {pct(alt.razao_gf_sazonalizada_pct, 2)} and year to date {pct(alt.acumulado_ano_pct, 2)}.
                          </>,
                        )}{" "}
                      {tx("A divergência fica publicada como ressalva, sem ajuste para coincidir.", "The divergence is published as a caveat, with no adjustment to make them match.")}
                    </MercadoAviso>
                  )}
                  <TabelaInterativa
                    titulo={tx("GSF calculado × fator publicado no InfoMercado da CCEE", "Calculated GSF × factor published in CCEE's InfoMercado")}
                    colunas={colunasInfoMercado()}
                    linhas={linhasInfoMercado(m.reconciliacao_infomercado)}
                    chaveLinha="id"
                    colunaRotulo="medida"
                    fonte={tx("CCEE, InfoMercado mensal (PDF) e conjuntos abertos", "CCEE, monthly InfoMercado (PDF) and open datasets")}
                    versao={versao}
                    nomeArquivo="mercado-infomercado-gsf"
                    chaveUrl="im"
                  />
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      <>
                        Garantia física por submercado somada × total do MRE: {m.identidade_gf.length - gfFora.length} de {m.identidade_gf.length} meses com diferença de até 1 MW médio
                        {gfFora.length ? ` (fora: ${gfFora.map((x) => `${mesAno(x.mes)}, ${num(x.diferenca_mwmed, 1)}`).join("; ")})` : ""}. Resultado das conferências com o InfoMercado:{" "}
                        {m.reconciliacao_infomercado.filter((c) => c.resultado === "aprovado").length} {ROTULO_RESULTADO.aprovado} e{" "}
                        {m.reconciliacao_infomercado.filter((c) => c.resultado !== "aprovado").length} {ROTULO_RESULTADO.ressalva}. Risco hidrológico do ACR em 12 meses:{" "}
                        {reaisCurto(k.risco_hidrologico_acr_12m?.valor_rs)}.
                      </>,
                      <>
                        Physical guarantee by submarket, added up × MRE total: {m.identidade_gf.length - gfFora.length} of {m.identidade_gf.length} months with a difference of up to 1 MWavg
                        {gfFora.length ? ` (outside: ${gfFora.map((x) => `${mesAno(x.mes)}, ${num(x.diferenca_mwmed, 1)}`).join("; ")})` : ""}. Result of the checks against InfoMercado:{" "}
                        {m.reconciliacao_infomercado.filter((c) => c.resultado === "aprovado").length} {ROTULO_RESULTADO.aprovado} and{" "}
                        {m.reconciliacao_infomercado.filter((c) => c.resultado !== "aprovado").length} {ROTULO_RESULTADO.ressalva}. ACR hydrological risk over 12 months:{" "}
                        {reaisCurto(k.risco_hidrologico_acr_12m?.valor_rs)}.
                      </>,
                    )}
                  </p>
                  <MercadoPendenciasAuditoria g={{ pendencias: g.pendencias.filter((x) => x.paineis.includes("P034")), bloqueios: g.bloqueios.filter((x) => x.paineis.includes("P034")) }} />
                  <p className="text-sm leading-relaxed text-carvao-muted" data-definicoes-operacionais="true">
                    {tx(
                      "As três definições abaixo são operacionais: o observatório as escreveu para ler este painel. Não são a definição regulatória nem foram conferidas em norma (as Leis nº 12.783/2013 e nº 13.203/2015 e as Regras de Comercialização da CCEE não foram lidas). A leitura conferida de MRE e de GSF, com o trecho literal das fontes e o que não foi lido, está nos verbetes do Aprenda.",
                      "The three definitions below are operational: the observatory wrote them to read this panel. They are not the regulatory definition and have not been checked against the regulations (Laws No. 12,783/2013 and No. 13,203/2015 and the CCEE Trading Rules were not read). The checked reading of MRE and GSF, with the literal excerpt of the sources and what was not read, is in the Learn entries.",
                    )}
                  </p>
                  <MercadoDefinicoes g={g} chaves={["mre", "gsf", "risco_hidrologico_acr"]} />
                </SecaoDoPainel>

                {p && <MercadoLimitacoes painel={p} />}
                <SeguirPainel
                  ancora="mre-gsf"
                  proximo={{ href: "/setor-eletrico/mercado/encargos", pergunta: TITULO_PAGINA_MERCADO.encargos }}
                  downloads={[CSV_MERCADO.ccee, CSV_MERCADO.contaBandeira].map((d) => ({ ...d }))}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
