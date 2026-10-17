import type { ReactNode } from "react";
import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { MercadoTabelasSobDemanda } from "@/components/energia/MercadoTabelasSobDemanda";
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
  TextoGold,
} from "@/components/energia/MercadoPainel";
import { Nome } from "@/components/i18n/Nome";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { integra, lerGold } from "@/lib/energia/gold";
import { dataBR, mesAno, num, pct } from "@/lib/energia/formato";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { NOTAS_REVISAO_EN, TIPOS_ENCARGO_EN, rotuloCategoria } from "@/lib/energia/i18n/mercado-preco";
import {
  CSV_MERCADO,
  ROTULO_RESULTADO,
  TITULO_PAGINA_MERCADO,
  URL_DETALHE_MERCADO,
  itensAusentesMercado,
  lacunasLiquidacao,
  notaEssMme,
  painelMercado,
  provenienciasLegiveis,
  reaisCurto,
  serieEer,
  serieEss,
  serieInadimplencia,
  serieLiquidacao,
  textoPeriodoMes,
  vereditoEncargos,
} from "@/lib/energia/mercado";
import type { MercadoGold } from "@/lib/energia/tipos-mercado";

export const dynamic = "force-static";

export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/mercado/encargos", {
    title: tx("Mercado de energia: encargos e liquidação", "Energy market: charges and settlement"),
    description: tx(
      "Quais custos públicos aparecem na liquidação do mercado de curto prazo: encargos de serviços do sistema por tipo, encargo de energia de reserva, liquidação e inadimplência, com os meses sem dado rotulados e a conferência com o MME e o InfoMercado.",
      "Which public costs appear in short-term market settlement: system service charges by type, the reserve energy charge, settlement and default, with months without data labeled and the check against MME and InfoMercado.",
    ),
    alternates: { canonical: "/setor-eletrico/mercado/encargos" },
  }, anterior);
}

export default function MercadoEncargosPage() {
  const idioma = idiomaEnergia();
  const tipo = (t: string) => rotuloCategoria(TIPOS_ENCARGO_EN, t.replace(/_/g, " "), idioma);
  const g = lerGold<MercadoGold>("mercado.json");
  if (!integra(g)) return <MercadoIndisponivel motivo={g?.motivo} />;

  const p = painelMercado(g, "P035");
  const prov = provenienciasLegiveis(g);
  const e = g.encargos;
  const k = e.kpis;
  // últimas três liquidações informadas: o percentual de inadimplência depende do valor não pago e do valor a liquidar, e cada um se move por conta própria
  const liqs = e.liquidacao_mensal.filter((x) => x.situacao === "liquidada" && x.inadimplencia !== null && x.a_liquidar !== null).slice(-3);
  const ultimaLiq = liqs.at(-1);
  const inad = k.inadimplencia_ultimo_mes;
  const contextoInad =
    inad && ultimaLiq && ultimaLiq.mes === inad.mes && liqs.length === 3
      ? tx(
          ` São ${reaisCurto(ultimaLiq.inadimplencia)} sobre ${reaisCurto(ultimaLiq.a_liquidar)} a liquidar. De ${mesAno(liqs[0].mes)} a ${mesAno(ultimaLiq.mes)}, o valor não pago ficou entre ${reaisCurto(Math.min(...liqs.map((x) => x.inadimplencia as number)))} e ${reaisCurto(Math.max(...liqs.map((x) => x.inadimplencia as number)))} e o valor a liquidar passou de ${reaisCurto(liqs[0].a_liquidar)} para ${reaisCurto(ultimaLiq.a_liquidar)}, e é por isso que o percentual sobe.`,
          ` That is ${reaisCurto(ultimaLiq.inadimplencia)} of the ${reaisCurto(ultimaLiq.a_liquidar)} to be settled. From ${mesAno(liqs[0].mes)} to ${mesAno(ultimaLiq.mes)}, the unpaid amount stayed between ${reaisCurto(Math.min(...liqs.map((x) => x.inadimplencia as number)))} and ${reaisCurto(Math.max(...liqs.map((x) => x.inadimplencia as number)))} and the amount to be settled went from ${reaisCurto(liqs[0].a_liquidar)} to ${reaisCurto(ultimaLiq.a_liquidar)}, which is why the percentage rises.`,
        )
      : "";
  const versao = tx(
    `CCEE até ${g.referencias.ccee_ultimo_mes_consumo ? mesAno(g.referencias.ccee_ultimo_mes_consumo) : "sem mês"}, publicado em ${dataBR(g.gerado_em)}`,
    `CCEE to ${g.referencias.ccee_ultimo_mes_consumo ? mesAno(g.referencias.ccee_ultimo_mes_consumo) : "no month"}, published on ${dataBR(g.gerado_em)}`,
  );
  const lacunas = lacunasLiquidacao(g);
  const zeros = e.controles_pagamento.series.pagamento_ess ?? [];
  const resumoMme = e.mme.reconciliacao_ccee_resumo;
  const consol = e.mme.consolidacao_anual.at(-1);
  const ultimaEdicao = e.mme.edicoes.at(-1);
  const ausentes = itensAusentesMercado(g).filter((i) => i.paineis.includes("P035"));
  const notaMme = notaEssMme(g);

  const oQueMudou =
    k.ess_12m && k.eer_12m ? (
      tx(
        <>
          Nos 12 meses até {mesAno(k.ess_12m.periodo.fim)}, o ESS somou {reaisCurto(k.ess_12m.valor_rs)} e o encargo de energia de reserva {reaisCurto(k.eer_12m.valor_rs)}.
          {k.inadimplencia_ultimo_mes?.valor_pct !== null && k.inadimplencia_ultimo_mes?.valor_pct !== undefined && (
            <>
              {" "}
              Na liquidação de {mesAno(k.inadimplencia_ultimo_mes.mes)}, o valor registrado como inadimplência pela CCEE foi de {pct(k.inadimplencia_ultimo_mes.valor_pct, 1)} do valor a liquidar.
              {contextoInad} Os comunicados da CCEE sobre a liquidação não foram consultados, e o valor efetivamente inadimplente pode diferir do valor não pago.
            </>
          )}
        </>,
        <>
          In the 12 months to {mesAno(k.ess_12m.periodo.fim)}, ESS totaled {reaisCurto(k.ess_12m.valor_rs)} and the reserve energy charge {reaisCurto(k.eer_12m.valor_rs)}.
          {k.inadimplencia_ultimo_mes?.valor_pct !== null && k.inadimplencia_ultimo_mes?.valor_pct !== undefined && (
            <>
              {" "}
              In the {mesAno(k.inadimplencia_ultimo_mes.mes)} settlement, the amount recorded as default by CCEE was {pct(k.inadimplencia_ultimo_mes.valor_pct, 1)} of the amount to be settled.
              {contextoInad} CCEE&apos;s notices on the settlement were not consulted, and the amount actually in default can differ from the unpaid amount.
            </>
          )}
        </>,
      )
    ) : (
      <>{tx("Sem soma de 12 meses nesta atualização.", "No 12-month total in this update.")}</>
    );
  const comoInterpretar = tx(
    <>
      Competência é o mês da contabilização; pagamento é a liquidação financeira, que sai depois e passa pelo alívio com recursos do próprio mercado. As barras somam os tipos de ESS do mês; a
      resposta da demanda vem de conjunto próprio da CCEE e fica fora da soma. A restrição de operação reúne três encargos: <Termo slug="constrained-off">constrained-off</Termo>, constrained-on e unit
      commitment. Mês sem barra é ausência, com o motivo escrito: nunca zero.
    </>,
    <>
      The accounting month is the month of the accounting; payment is the financial settlement, which comes later and goes through relief with funds from the market itself. The bars add up the ESS types for the month;
      demand response comes from a separate CCEE dataset and is excluded from the sum. Operating restriction groups three charges: <Termo slug="constrained-off">constrained-off</Termo>, constrained-on and unit
      commitment. A month with no bar is missing data, with the reason stated: never zero.
    </>,
  );
  const naoConcluir = tx(
    <>
      O preço da energia nos contratos: o observatório não publica preço de contrato, e o PLD não é preço de contrato. Que inadimplência alta signifique perda definitiva: o valor não pago numa
      liquidação pode ser pago depois. Que o pagamento publicado como zero em sequência seja zero.
    </>,
    <>
      The price of energy in contracts: the observatory does not publish contract prices, and the PLD is not a contract price. That high default means a definitive loss: the amount unpaid in a
      settlement can be paid later. That a payment published as zero several months in a row is zero.
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="mercado" />
      <MarcaVisita secao="energia:mercado:encargos" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <MercadoNavegacao atual="encargos" />
        <CabecalhoModulo
          siglas={["CCEE", "MME", "EPE", "GSF", "SAMP", "ANEEL", "REN", "MRE", "SIN", "PLD", "ACL", "ACR", "ESS", "EER"]}
          rotulo={tx("Mercado de energia", "Energy market")}
          titulo={TITULO_PAGINA_MERCADO.encargos}
          lead={tx(
            "Operar o sistema com segurança tem custos fora do preço da energia, que viram encargos: os Encargos de Serviços do Sistema (ESS) e o Encargo de Energia de Reserva (EER), apurados no mês de competência e pagos depois, na liquidação do mercado de curto prazo.",
            "Operating the system safely has costs outside the price of energy, which become charges: system service charges (ESS) and the reserve energy charge (EER), calculated in the accounting month and paid later, in short-term market settlement.",
          )}
          recorte={versao}
          fonte={tx("CCEE, Câmara de Comercialização de Energia Elétrica; MME, Ministério de Minas e Energia (boletim de monitoramento)", "CCEE (electric energy trading chamber); MME (Ministry of Mines and Energy) monitoring bulletin")}
          referencia={<ReferenciaMercado g={g} />}
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx("Encargos, inadimplência e o ESS do boletim do MME", "Charges, default and the ESS in the MME bulletin")}
              nota={
                notaMme ? (
                  <span data-nota="ess-mme" className="block">
                    {notaMme}
                  </span>
                ) : undefined
              }
            >
              <Numero
                variante="faixa"
                rotulo={tx("Encargos de serviços do sistema (ESS)", "System service charges (ESS)")}
                natureza="CALCULADO"
                evidencia={k.ess_12m?.evidencia ?? null}
                valor={k.ess_12m ? k.ess_12m.valor_rs / 1e9 : null}
                unidade={tx("R$ bilhões", "R$ billion")}
                casas={2}
                periodo={k.ess_12m ? textoPeriodoMes(k.ess_12m.periodo) : undefined}
                nota={tx(<>por mês de competência, 12 meses</>, <>by accounting month, 12 months</>)}
                motivoAusencia={tx("A CCEE não publicou os 12 meses da janela.", "CCEE did not publish the 12 months of the window.")}
                endereco="https://scrutiniums.com/setor-eletrico/mercado/encargos#encargos"
              />
              <Numero
                variante="faixa"
                rotulo={tx("Encargo de energia de reserva (EER)", "Reserve energy charge (EER)")}
                natureza="CALCULADO"
                evidencia={k.eer_12m?.evidencia ?? null}
                valor={k.eer_12m ? k.eer_12m.valor_rs / 1e9 : null}
                unidade={tx("R$ bilhões", "R$ billion")}
                casas={2}
                periodo={k.eer_12m ? textoPeriodoMes(k.eer_12m.periodo) : undefined}
                nota={tx(<>por mês de competência, 12 meses</>, <>by accounting month, 12 months</>)}
                motivoAusencia={tx("A CCEE não publicou os 12 meses da janela.", "CCEE did not publish the 12 months of the window.")}
                endereco="https://scrutiniums.com/setor-eletrico/mercado/encargos#encargos"
              />
              <Numero
                variante="faixa"
                rotulo={tx("Inadimplência na liquidação", "Default in settlement")}
                natureza="CALCULADO"
                evidencia={k.inadimplencia_ultimo_mes?.evidencia ?? null}
                valor={k.inadimplencia_ultimo_mes?.valor_pct ?? null}
                formato="pct"
                casas={1}
                unidade="%"
                periodo={k.inadimplencia_ultimo_mes ? mesAno(k.inadimplencia_ultimo_mes.mes) : undefined}
                cor="var(--serie-4)"
                nota={tx(<>do valor a liquidar no mês</>, <>of the amount to be settled in the month</>)}
                motivoAusencia={tx("A CCEE não informou a liquidação do mês.", "CCEE did not report the settlement for the month.")}
                endereco="https://scrutiniums.com/setor-eletrico/mercado/encargos#encargos"
              />
              <Numero
                variante="faixa"
                rotulo={tx("ESS no boletim do MME", "ESS in the MME bulletin")}
                natureza="OBSERVADO"
                evidencia={k.ess_mme_ano?.evidencia ?? null}
                valor={k.ess_mme_ano ? k.ess_mme_ano.valor_mil_rs / 1e3 : null}
                unidade={tx("R$ milhões", "R$ million")}
                casas={1}
                periodo={k.ess_mme_ano ? textoPeriodoMes(k.ess_mme_ano.periodo) : undefined}
                nota={k.ess_mme_ano ? tx(<>edição de {mesAno(k.ess_mme_ano.edicao)}, com a resposta da demanda</>, <>{mesAno(k.ess_mme_ano.edicao)} edition, including demand response</>) : undefined}
                motivoAusencia={tx("Sem edição do boletim no ano corrente.", "No bulletin edition in the current year.")}
                endereco="https://scrutiniums.com/setor-eletrico/mercado/encargos#encargos"
              />
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              Operar o sistema com segurança tem custos que não estão no preço da energia: geração fora da ordem de mérito, serviços ancilares, energia de reserva. Eles viram encargos (
              <Termo slug="ess">ESS</Termo> e EER), apurados pela CCEE no mês de competência e pagos depois, na liquidação do mercado de curto prazo. O observatório não publica preço de contrato: só o que a CCEE
              e o MME publicam.
            </>,
            <>
              Operating the system safely has costs that are not in the price of energy: generation outside the merit order, ancillary services, reserve energy. They become charges (
              <Termo slug="ess">ESS</Termo> and EER), calculated by CCEE in the accounting month and paid later, in short-term market settlement. The observatory does not publish contract prices: only what CCEE
              and MME publish.
            </>,
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="encargos">
            <PainelEvidencia
              id="painel-encargos"
              pergunta={tx("Quanto somam os encargos e a inadimplência da liquidação?", "How much do charges and settlement default add up to?")}
              subtitulo={tx(
                `ESS e EER · R$ milhões por mês de competência · liquidação e inadimplência · desde ${mesAno(e.ess_mensal[0]?.mes ?? "2023-07")}`,
                `ESS and EER · R$ million by accounting month · settlement and default · since ${mesAno(e.ess_mensal[0]?.mes ?? "2023-07")}`,
              )}
              natureza="CALCULADO"
              proveniencia={prov.encargos_ccee}
              complementares={[{ rotulo: tx("Encargos no boletim do MME", "Charges in the MME bulletin"), p: prov.encargos_mme }]}
              porQueImporta={
                <>
                  {tx(
                    "Os encargos cobrem custos de serviços do sistema prestados aos usuários do SIN. Para o ESS de restrição de operação de eólicas e fotovoltaicas, o pagamento é proporcional ao consumo; a regra de rateio dos demais encargos e do encargo de energia de reserva não foi lida. Um mês de muita geração fora da ordem de mérito por restrição elétrica aparece aqui antes de chegar à conta de luz.",
                    "The charges cover the costs of system services provided to SIN users. For the ESS for operating restrictions on wind and solar photovoltaic plants, payment is proportional to consumption; the allocation rule for the other charges and for the reserve energy charge was not read. A month with a lot of generation outside the merit order due to electrical constraints shows up here before it reaches the electricity bill.",
                  )}
                  <span data-nivel="analisar" className="block pt-1">
                    {tx(
                      "Fundamentos: Decreto nº 5.163/2004, art. 59 (custos dos serviços do sistema); REN ANEEL nº 1.030/2022, art. 16, § 1º (pagamento proporcional ao consumo).",
                      "Legal basis: Decree No. 5,163/2004, art. 59 (costs of system services); ANEEL normative resolution (REN) No. 1,030/2022, art. 16, § 1 (payment proportional to consumption).",
                    )}
                  </span>
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
            >
              <div className="space-y-6">
                <GraficoBarras
                  titulo={tx("Encargos de serviços do sistema por grupo, mês de competência", "System service charges by group, accounting month")}
                  dados={serieEss(g)}
                  chaveCategoria="mes"
                  chaveRotulo="rotulo"
                  series={[
                    { id: "restricao", rotulo: tx("Restrição de operação", "Operating restriction"), cor: "var(--serie-termica)" },
                    { id: "ancilares", rotulo: tx("Serviços ancilares", "Ancillary services"), cor: "var(--serie-2)" },
                    { id: "outros", rotulo: tx("Segurança energética, deslocamento hidráulico, importação e reserva", "Energy security, hydro displacement, imports and reserve"), cor: "var(--serie-hidraulica)" },
                  ]}
                  unidade={tx("R$ milhões", "R$ million")}
                  casas={1}
                  empilhado
                  altura={300}
                />
                <MercadoRecorte
                  periodo={tx(
                    <>competência de {textoPeriodoMes({ inicio: e.ess_mensal[0]?.mes ?? "", fim: e.ess_mensal.at(-1)?.mes ?? "" })}; liquidação de {textoPeriodoMes({ inicio: e.liquidacao_mensal[0]?.mes ?? "", fim: e.liquidacao_mensal.at(-1)?.mes ?? "" })}</>,
                    <>accounting months {textoPeriodoMes({ inicio: e.ess_mensal[0]?.mes ?? "", fim: e.ess_mensal.at(-1)?.mes ?? "" })}; settlement {textoPeriodoMes({ inicio: e.liquidacao_mensal[0]?.mes ?? "", fim: e.liquidacao_mensal.at(-1)?.mes ?? "" })}</>,
                  )}
                  universo={tx("mercado de curto prazo contabilizado pela CCEE (SIN)", "short-term market accounted by CCEE (SIN)")}
                  unidade={tx("R$ milhões nominais por mês; % do valor a liquidar", "nominal R$ million per month; % of the amount to be settled")}
                />
                <GraficoBarras
                  titulo={tx("Liquidação do mercado de curto prazo: liquidado e inadimplência", "Short-term market settlement: settled and default")}
                  dados={serieLiquidacao(g)}
                  chaveCategoria="mes"
                  chaveRotulo="rotulo"
                  series={[
                    { id: "liquidado", rotulo: tx("Liquidado", "Settled"), cor: "var(--cor-energia)" }, // i18n: dado
                    { id: "inadimplencia", rotulo: tx("Inadimplência", "Default"), cor: "var(--serie-4)" },
                  ]}
                  unidade={tx("R$ milhões", "R$ million")}
                  casas={1}
                  empilhado
                  altura={300}
                />
                {lacunas.length > 0 && (
                  <MercadoAviso>
                    <span data-lacunas="liquidacao">
                      {tx("Meses sem barra na liquidação:", "Months with no settlement bar:")} {lacunas.map((l) => `${mesAno(l.mes)}, ${l.motivo}`).join("; ")}.
                    </span>
                  </MercadoAviso>
                )}
                <TabelaDados
                  titulo={tx("Encargos por mês de competência (R$ milhões)", "Charges by accounting month (R$ million)")}
                  colunas={tx(["Mês", "ESS (nove tipos)", "Restrição de operação", "Serviços ancilares", "Resposta da demanda", "EER"], ["Month", "ESS (nine types)", "Operating restriction", "Ancillary services", "Demand response", "EER"])}
                  linhas={e.ess_mensal.map((x) => {
                    const eer = e.eer_mensal.find((y) => y.mes === x.mes);
                    return [
                      mesAno(x.mes),
                      x.total === null ? null : x.total / 1e6,
                      x.restricao_operacao === null ? null : x.restricao_operacao / 1e6,
                      x.servicos_ancilares === null ? null : x.servicos_ancilares / 1e6,
                      x.resposta_demanda === null ? null : x.resposta_demanda / 1e6,
                      eer?.encargo_energia_reserva === null || eer === undefined ? null : eer.encargo_energia_reserva / 1e6,
                    ];
                  })}
                  casas={[null, 1, 1, 1, 1, 1]}
                  limite={40}
                  csv={CSV_MERCADO.ccee.url}
                />
                <MercadoResposta painel="P035" veredito={vereditoEncargos(g)}>
                  {p?.resposta ?? tx("Sem resposta nesta atualização: os encargos não puderam ser somados com a base publicada.", "No answer in this update: the charges could not be added up with the published database.")}
                </MercadoResposta>
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <SecaoDoPainel
                  id="encargos-reserva"
                  titulo={tx("Quanto custa a energia de reserva?", "How much does reserve energy cost?")}
                  lead={tx("Encargo de energia de reserva (EER) por mês de competência, em R$ milhões.", "Reserve energy charge (EER) by accounting month, in R$ million.")}
                >
                  <GraficoBarras
                    titulo={tx("Encargo de energia de reserva, mês de competência", "Reserve energy charge, accounting month")}
                    dados={serieEer(g)}
                    chaveCategoria="mes"
                    chaveRotulo="rotulo"
                    series={[{ id: "eer", rotulo: tx("Encargo de energia de reserva", "Reserve energy charge"), cor: "var(--serie-eolica)" }]}
                    unidade={tx("R$ milhões", "R$ million")}
                    casas={1}
                    altura={260}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="encargos-inadimplencia"
                  titulo={tx("Quanto da liquidação ficou sem pagamento?", "How much of the settlement went unpaid?")}
                  lead={tx(
                    "Inadimplência é o valor que a CCEE registra como não pago sobre o valor a liquidar do mês; o valor não pago numa liquidação pode ser pago depois.",
                    "Default is the amount CCEE records as unpaid relative to the amount to be settled in the month; the amount unpaid in a settlement can be paid later.",
                  )}
                >
                  <GraficoLinhas
                    titulo={tx("Inadimplência sobre o valor a liquidar, mês a mês", "Default over the amount to be settled, month by month")}
                    dados={serieInadimplencia(g)}
                    chaveX="mes"
                    formatoX="mes"
                    series={[{ id: "inadimplencia", rotulo: tx("Inadimplência", "Default"), cor: "var(--serie-4)", espessura: 2.5 }]}
                    unidade="%"
                    casas={1}
                    zeroNoEixo
                    altura={240}
                  />
                  {zeros.length > 0 && (
                    <MercadoAviso>
                      <span data-zeros="pagamento_ess">
                        {tx(
                          `Pagamento de ESS publicado como zero de ${mesAno(zeros[0].inicio)} a ${mesAno(zeros[0].fim)} (${zeros[0].meses} meses seguidos) com encargo positivo na competência: o zero não é confirmado por publicação independente e aparece como nulo, com a situação escrita.`,
                          `ESS payment published as zero from ${mesAno(zeros[0].inicio)} to ${mesAno(zeros[0].fim)} (${zeros[0].meses} consecutive months) with a positive charge in the accounting month: the zero is not confirmed by an independent publication and appears as null, with the status stated.`,
                        )}
                      </span>
                    </MercadoAviso>
                  )}
                </SecaoDoPainel>

                <MercadoAusencias id="ainda-nao" titulo={tx("O que esta página ainda não mostra?", "What does this page not yet show?")} itens={ausentes} />

                <SecaoDoPainel id="encargos-analise" nivel="analisar" titulo={tx("Liquidação, pagamento e ESS por tipo, mês a mês, e a Conta Bandeira", "Settlement, payment and ESS by type, month by month, and the Conta Bandeira")}>
                  <MercadoTabelasSobDemanda conjunto="encargos-analise" versao={versao} downloads={[{ ...CSV_MERCADO.ccee }]} />
                  <TabelaDados
                    titulo={tx("Componentes do ACR na Conta Bandeira por ano (R$ milhões, soma nacional)", "ACR components in the Conta Bandeira by year (R$ million, national total)")}
                    colunas={tx(
                      ["Ano", "Meses", "ESS e EER", "Ressarcimento CONER", "Resultado no MCP", "CCEAR por disponibilidade", "Receita faturada das bandeiras", "Repasse à Conta Bandeira"],
                      ["Year", "Months", "ESS and EER", "CONER reimbursement", "Result in the MCP (short-term market)", "CCEAR by availability", "Billed tariff flag revenue", "Transfer to the Conta Bandeira"],
                    )}
                    linhas={e.acr_conta_bandeira_anual.map((a) => [
                      a.ano,
                      a.meses,
                      a.ess_eer === null ? null : a.ess_eer / 1e6,
                      a.ressarcimento_coner === null ? null : a.ressarcimento_coner / 1e6,
                      a.resultado_mcp === null ? null : a.resultado_mcp / 1e6,
                      a.ccear_d === null ? null : a.ccear_d / 1e6,
                      a.receita_faturada_bandeiras === null ? null : a.receita_faturada_bandeiras / 1e6,
                      a.repasse_conta_bandeira === null ? null : a.repasse_conta_bandeira / 1e6,
                    ])}
                    casas={[null, 0, 1, 1, 1, 1, 1, 1]}
                    csv={CSV_MERCADO.contaBandeira.url}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="encargos-auditoria" nivel="auditar" titulo={tx("Conferência com o MME e o InfoMercado, pendências e definições", "Check against MME and InfoMercado, pending items and definitions")}>
                  {p && <MercadoVerificacoes painel={p} />}
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      <>
                        ESS por tipo e mês × boletim de monitoramento do MME: {resumoMme.tipos.aprovados} de {resumoMme.tipos.conferidos} conferências dentro da tolerância (
                        <TextoGold regiao="mercado-tolerancia">{resumoMme.tolerancia}</TextoGold>); resposta da demanda: {resumoMme.resposta_demanda.aprovados} de {resumoMme.resposta_demanda.conferidos}.
                      </>,
                      <>
                        ESS by type and month × MME monitoring bulletin: {resumoMme.tipos.aprovados} of {resumoMme.tipos.conferidos} checks within the tolerance (
                        <TextoGold regiao="mercado-tolerancia">{resumoMme.tolerancia}</TextoGold>); demand response: {resumoMme.resposta_demanda.aprovados} of {resumoMme.resposta_demanda.conferidos}.
                      </>,
                    )}
                    {consol &&
                      tx(
                        <>
                          {" "}
                          Consolidação anual de {consol.ano}: o MME publica R$ {num(consol.mme_bilhoes_rs, 1)} bilhão
                          {consol.mme_variacao_pct !== null ? <> e variação de {num(consol.mme_variacao_pct, 0)}% sobre {consol.ano_base}</> : null}; a soma do conjunto aberto dá {reaisCurto(consol.ccee_rs)}
                          {consol.ccee_variacao_pct !== null ? <> e {num(consol.ccee_variacao_pct, 1)}%</> : null}: {ROTULO_RESULTADO[consol.resultado]} ({consol.tolerancia}).
                        </>,
                        <>
                          {" "}
                          Annual consolidation for {consol.ano}: MME publishes R$ {num(consol.mme_bilhoes_rs, 1)} billion
                          {consol.mme_variacao_pct !== null ? <> and a change of {num(consol.mme_variacao_pct, 0)}% over {consol.ano_base}</> : null}; the sum of the open dataset gives {reaisCurto(consol.ccee_rs)}
                          {consol.ccee_variacao_pct !== null ? <> and {num(consol.ccee_variacao_pct, 1)}%</> : null}: {ROTULO_RESULTADO[consol.resultado]} (<TextoGold regiao="mercado-tolerancia">{consol.tolerancia}</TextoGold>).
                        </>,
                      )}
                    {ultimaEdicao &&
                      tx(
                        <>
                          {" "}
                          Última edição mensal integrada: {mesAno(ultimaEdicao.edicao)}
                          {ultimaEdicao.pagina_encargos ? <>, tabela de encargos na página {ultimaEdicao.pagina_encargos}</> : null}.
                        </>,
                        <>
                          {" "}
                          Latest monthly edition integrated: {mesAno(ultimaEdicao.edicao)}
                          {ultimaEdicao.pagina_encargos ? <>, charges table on page {ultimaEdicao.pagina_encargos}</> : null}.
                        </>,
                      )}
                  </p>
                  {resumoMme.fora_da_tolerancia.length > 0 && (
                    <TabelaDados
                      titulo={tx("Conferências com o MME fora da tolerância (mil R$)", "Checks against MME outside the tolerance (R$ thousand)")}
                      colunas={tx(["Tipo", "Mês", "Edição", "MME", "CCEE", "Diferença", "Resultado"], ["Type", "Month", "Edition", "MME", "CCEE", "Difference", "Result"])}
                      linhas={resumoMme.fora_da_tolerancia.map((x) => [tipo(x.tipo), mesAno(x.mes), mesAno(x.edicao), x.mme_mil_rs, x.ccee_mil_rs, x.diferenca_mil_rs, x.resultado ? ROTULO_RESULTADO[x.resultado] : tx("sem conferência", "not checked")])}
                      casas={[null, null, null, 0, 1, 1, null]}
                    />
                  )}
                  {e.mme.revisoes.length > 0 && (
                    <TabelaDados
                      titulo={tx("Valores revistos entre edições do boletim do MME (mil R$)", "Values revised between editions of the MME bulletin (R$ thousand)")}
                      colunas={tx(
                        ["Tipo", "Mês", "Edição anterior", "Valor anterior", "Edição seguinte", "Valor seguinte", "Diferença", "Nota"],
                        ["Type", "Month", "Previous edition", "Previous value", "Next edition", "Next value", "Difference", "Note"],
                      )}
                      linhas={e.mme.revisoes.map((r) => [tipo(r.tipo), mesAno(r.mes), mesAno(r.edicao_anterior), r.valor_anterior_mil_rs, mesAno(r.edicao_posterior), r.valor_posterior_mil_rs, r.diferenca_mil_rs, r.nota ? rotuloCategoria(NOTAS_REVISAO_EN, r.nota, idioma) : null])}
                      casas={[null, null, null, 0, null, 0, 0, null]}
                      csv={CSV_MERCADO.encargosMme.url}
                    />
                  )}
                  <MercadoTabelasSobDemanda conjunto="encargos-auditoria" versao={versao} downloads={[{ ...CSV_MERCADO.ccee }]} />
                  <MercadoPendenciasAuditoria g={{ pendencias: g.pendencias.filter((x) => x.paineis.includes("P035")), bloqueios: g.bloqueios.filter((x) => x.paineis.includes("P035")) }} />
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    {tx<ReactNode>(
                      "O resultado do mercado de curto prazo por submercado, a Conta Bandeira por mês e a lista completa da conferência com o MME estão no",
                      <>
                        The short-term market result by submarket, the <Nome>Conta Bandeira</Nome> by month and the full list of the check against MME are in the
                      </>,
                    )}{" "}
                    <a href={URL_DETALHE_MERCADO} download className="text-energia-dark underline underline-offset-4">
                      {tx("arquivo de detalhe do módulo (JSON)", "module detail file (JSON)")}
                    </a>
                    .
                  </p>
                  <MercadoDefinicoes g={g} chaves={["ess", "eer", "competencia_pagamento_reprocessamento", "pld"]} />
                </SecaoDoPainel>

                {p && <MercadoLimitacoes painel={p} />}
                <SeguirPainel
                  ancora="encargos"
                  proximo={{ href: "/setor-eletrico/mercado", pergunta: TITULO_PAGINA_MERCADO["livre-regulado"] }}
                  downloads={[CSV_MERCADO.ccee, CSV_MERCADO.encargosMme, CSV_MERCADO.contaBandeira].map((d) => ({ ...d }))}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
