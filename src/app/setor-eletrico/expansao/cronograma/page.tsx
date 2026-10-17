import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { ExpansaoPrevisoes, ExpansaoRevisoes } from "@/components/energia/ExpansaoCronograma";
import {
  ExpansaoAnalise,
  ExpansaoAuditoria,
  ExpansaoDatas,
  ExpansaoIndisponivel,
  ExpansaoLimitacoes,
  ExpansaoNavegacao,
  ExpansaoNota,
  ExpansaoRecorte,
  ExpansaoSeguir,
  ExpansaoTabelaSimples,
} from "@/components/energia/ExpansaoPagina";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { tx } from "@/lib/energia/idioma";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import {
  colunasAtrasadas,
  colunasDatasFrequentes,
  colunasDesvioPrazo,
  fonteExpansao,
  rotuloSituacaoCronograma,
  DOWNLOADS_PAINEL,
  FONTE_LIBERACOES,
  FONTE_RALIE,
  cronogramaAtrasadoDaFiscalizacao,
  dataTexto,
  diasTexto,
  downloadsDe,
  inteiro,
  linhasAtrasadas,
  linhasConfiabilidade,
  linhasConfiabilidadeTipo,
  linhasDatasFrequentes,
  linhasDeslizamento,
  linhasDesvioPrazo,
  linhasPrevisoesAno,
  linhasProximos24,
  linhasSemPrevisao,
  mudancaCronograma,
  mwTexto,
  notaDatasCronograma,
  painel,
  pctTexto,
  previsaoPrimeiroAno,
  previsoesPorAnoSeparadas,
  respostaCronograma,
  textoAnoDasDatasEmBloco,
  textoContagemFotografias,
  ultimaConfiabilidade,
  vereditoCronograma,
  provenienciasDoLeitor,
} from "@/lib/energia/expansao";
import type { ExpansaoGold } from "@/lib/energia/tipos-expansao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/expansao/cronograma", {
    title: tx("Cronograma da expansão: previsões com data-base, revisões e o que atrasou", "Expansion schedule: forecasts with a base date, revisions and what is delayed"),
    description: tx(
      "Previsões de operação comercial da fiscalização da ANEEL (RALIE) com a data da fotografia, separadas das datas convencionais em bloco, confiabilidade das previsões contra a liberação comercial real desde a primeira fotografia publicada, revisões em 12 meses e desvio em relação ao prazo outorgado vigente.",
      "Commercial operation forecasts by ANEEL's inspection (RALIE) with the snapshot date, separated from the conventional dates assigned in bulk, reliability of the forecasts against actual commercial release since the first published snapshot, 12-month revisions and deviation from the current granted deadline.",
    ),
    alternates: { canonical: "/setor-eletrico/expansao/cronograma" },
  }, anterior);
}

export default function CronogramaPage() {
  const g = lerGold<ExpansaoGold>("expansao.json");
  if (!integra(g)) return <ExpansaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const c = g.cronograma;
  const pa = c.previsoes_atuais;
  const p = provenienciasDoLeitor(g);
  const ev = g.evidencias;
  const pp = painel("p041");
  const conf = linhasConfiabilidade(g);
  const ult = ultimaConfiabilidade(g);
  const at = pa.atraso_previsto;
  const blocoFoto = c.datas_em_bloco_por_fotografia;
  const ultimoBloco = blocoFoto.at(-1);
  const dataRalie = dataTexto(c.data_ralie);
  const dataLib = dataTexto(c.data_liberacoes);
  const primeiro = previsaoPrimeiroAno(g);
  const sep = previsoesPorAnoSeparadas(g);
  const atrasada = cronogramaAtrasadoDaFiscalizacao(g);
  const avisoBloco = textoAnoDasDatasEmBloco(g);
  const oQueMudou = (
    <>
      {mudancaCronograma(g)} {notaDatasCronograma(g)}
    </>
  );
  const comoInterpretar = tx(
    <>
      Previsão de operação comercial é a previsão da fiscalização da ANEEL por unidade geradora, sempre com a data da fotografia do RALIE em que foi registrada. Confiabilidade: de cada fotografia mensal (a última do mês), a
      potência com previsão para os 12 meses seguintes e quanto dela foi liberada para operação comercial até o fim desses 12 meses, depois disso ou não foi liberada até a data do arquivo de liberações; só entram janelas
      encerradas há pelo menos 15 dias. {g.regras.data_em_bloco}
      <span data-nivel="analisar" className="mt-2 block">
        Regras como a base publicada as escreve: {g.regras.previsao} {g.regras.confiabilidade}
      </span>
    </>,
    <>
      A commercial operation forecast is ANEEL&apos;s inspection forecast per generating unit, always with the date of the RALIE snapshot in which it was recorded. Reliability: from each monthly
      snapshot (the last of the month), the capacity forecast for the following 12 months and how much of it was released for commercial operation by the end of those 12 months, after that or was
      not released by the date of the releases file; only windows closed at least 15 days ago are included.{" "}
      <TrechoPortugues regiao="expansao-regra-bloco">{g.regras.data_em_bloco}</TrechoPortugues>
      <span data-nivel="analisar" className="mt-2 block">
        Rules as the published dataset writes them:{" "}
        <TrechoPortugues regiao="expansao-regras-previsao">
          {g.regras.previsao} {g.regras.confiabilidade}
        </TrechoPortugues>
      </span>
    </>,
  );
  const naoConcluir = tx(
    <>
      A data provável de entrada de uma usina: a previsão é da fiscalização, e boa parte da carteira tem data convencional atribuída em bloco. A confiabilidade passada não é
      probabilidade para as previsões atuais. O desvio em relação ao prazo outorgado não é atraso: em autorizações recentes esse prazo é um limite anos à frente.
    </>,
    <>
      The likely entry date of a plant: the forecast is the inspection&apos;s, and a large part of the portfolio has a conventional date assigned in bulk. Past reliability is not a probability for
      the current forecasts. The deviation from the granted deadline is not a delay: in recent authorizations that deadline is a limit years ahead.
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="expansao" />
      <MarcaVisita secao="energia:expansao-cronograma" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <ExpansaoNavegacao atual="p041" />
        <CabecalhoModulo
          siglas={["RALIE", "ANEEL"]}
          rotulo={tx("Expansão", "Expansion")}
          titulo={pp.pergunta}
          lead={tx(
            "Compare a entrada em operação prevista pela fiscalização com a data em que cada usina foi liberada para operar. Datas convencionais atribuídas em bloco ficam separadas: elas não têm a mesma precisão de um cronograma individual.",
            "Compare the entry into operation forecast by the inspection with the date each plant was released to operate. Conventional dates assigned in bulk are kept separate: they do not have the precision of an individual schedule.",
          )}
          recorte={tx(
            `RALIE de ${dataRalie} · liberações até ${dataTexto(g.referencias.liberacoes_ultima_data)} · MW e % da potência`,
            `RALIE of ${dataRalie} · releases through ${dataTexto(g.referencias.liberacoes_ultima_data)} · MW and % of capacity`,
          )}
          fonte={tx("ANEEL, RALIE e liberações para operação comercial", "ANEEL, RALIE and releases for commercial operation")}
          referencia={tx(
            <>
              RALIE da ANEEL: fotografia atual de {dataRalie} e histórico de {inteiro(c.historico_fonte.fotografias)} fotografias desde {dataTexto(c.historico_fonte.primeira_fotografia)}; liberações para
              operação comercial até {dataTexto(g.referencias.liberacoes_ultima_data)} (arquivo de {dataLib}). Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              ANEEL&apos;s RALIE: current snapshot of {dataRalie} and history of {inteiro(c.historico_fonte.fotografias)} snapshots since {dataTexto(c.historico_fonte.primeira_fotografia)}; releases for
              commercial operation through {dataTexto(g.referencias.liberacoes_ultima_data)} (file of {dataLib}). Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <ExpansaoDatas
              itens={[
                { rotulo: tx("Previsões", "Forecasts"), texto: tx(`fotografia de ${dataRalie}`, `snapshot of ${dataRalie}`), natureza: "PREVISTO" },
                {
                  rotulo: tx("Histórico do RALIE", "RALIE history"),
                  texto: tx(
                    `${dataTexto(c.historico_fonte.primeira_fotografia)} a ${dataTexto(c.historico_fonte.ultima_fotografia)}`,
                    `${dataTexto(c.historico_fonte.primeira_fotografia)} to ${dataTexto(c.historico_fonte.ultima_fotografia)}`,
                  ),
                  natureza: "OBSERVADO",
                },
                {
                  rotulo: tx("Liberações comerciais", "Commercial releases"),
                  texto: tx(`até ${dataTexto(g.referencias.liberacoes_ultima_data)}`, `through ${dataTexto(g.referencias.liberacoes_ultima_data)}`),
                  natureza: "OBSERVADO",
                },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx("Indicadores do cronograma", "Schedule indicators")}
              nota={tx("O cronograma da fiscalização e as datas convencionais em bloco são medidas separadas.", "The inspection schedule and the conventional dates assigned in bulk are separate measures.")}
            >
              {primeiro && (
                <Numero
                  variante="faixa"
                  rotulo={
                    primeiro.restante
                      ? tx(`Prevista para o restante de ${primeiro.ano}`, `Forecast for the rest of ${primeiro.ano}`)
                      : tx(`Prevista para ${primeiro.ano}`, `Forecast for ${primeiro.ano}`)
                  }
                  natureza="PREVISTO"
                  valor={primeiro.mw}
                  casas={1}
                  unidade="MW"
                  periodo={tx(`fotografia do RALIE de ${dataRalie}`, `RALIE snapshot of ${dataRalie}`)}
                  cor="var(--cor-energia)" // i18n: dado
                  nota={tx("Previsão da fiscalização por unidade geradora.", "Inspection forecast per generating unit.")}
                />
              )}
              <Numero
                variante="faixa"
                rotulo={tx("Em datas convencionais em bloco", "On conventional dates assigned in bulk")}
                natureza="PREVISTO"
                valor={sep.mwEmBloco}
                casas={1}
                unidade="MW"
                periodo={tx(`fotografia do RALIE de ${dataRalie}`, `RALIE snapshot of ${dataRalie}`)}
                cor="var(--serie-comp-3)"
                nota={tx(
                  `${inteiro(sep.datas.length)} ${sep.datas.length === 1 ? "data atribuída" : "datas atribuídas"} em lote, não cronograma de obra.`,
                  `${inteiro(sep.datas.length)} ${sep.datas.length === 1 ? "date assigned" : "dates assigned"} in bulk, not a construction schedule.`,
                )}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Prevista e liberada em 12 meses", "Forecast and released within 12 months")}
                natureza="CALCULADO"
                evidencia={ev.confiabilidade_ultima ?? null}
                formato="pct"
                casas={1}
                unidade={tx("da potência prevista", "of forecast capacity")}
                periodo={ult ? tx(`previsões de ${dataTexto(ult.ralie)}`, `forecasts of ${dataTexto(ult.ralie)}`) : undefined}
                cor="var(--serie-referencia)"
                nota={tx("Coorte passada, não probabilidade.", "Past cohort, not probability.")}
                motivoAusencia={tx("Sem janela de 12 meses encerrada nesta publicação.", "No closed 12-month window in this release.")}
                endereco="/setor-eletrico/expansao/cronograma#p041"
              />
              {atrasada && (
                <Numero
                  variante="faixa"
                  rotulo={tx("Cronograma atrasado (fiscalização)", "Behind schedule (inspection)")}
                  natureza="CALCULADO"
                  valor={atrasada.mw_outorgado}
                  casas={1}
                  unidade={tx("MW outorgados", "granted MW")}
                  periodo={tx(`fotografia do RALIE de ${dataRalie}`, `RALIE snapshot of ${dataRalie}`)}
                  cor="var(--escala-div-neg-1)"
                  nota={tx(`${inteiro(atrasada.usinas)} ${atrasada.usinas === 1 ? "usina" : "usinas"}.`, `${inteiro(atrasada.usinas)} ${atrasada.usinas === 1 ? "plant" : "plants"}.`)}
                />
              )}
            </FaixaMetricas>
          }
        >
          {tx(
            "Quando a fiscalização da ANEEL prevê que cada usina entre em operação, e o que aconteceu com as previsões feitas antes. Toda previsão aparece com a data em que foi feita; atraso só é medido contra uma previsão datada.",
            "When ANEEL's inspection expects each plant to enter operation, and what happened to the forecasts made earlier. Every forecast appears with the date it was made; delay is only measured against a dated forecast.",
          )}
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="cronograma">
            <PainelEvidencia
              id="p041"
              pergunta={tx("Cronograma da fiscalização: o que está previsto", "Inspection schedule: what is forecast")}
              subtitulo={tx(
                "Previsões de operação comercial por fotografia do RALIE e liberação comercial real · MW e % da potência",
                "Commercial operation forecasts by RALIE snapshot and actual commercial release · MW and % of capacity",
              )}
              porQueImporta={tx(
                <>
                  Quem planeja a rede, o mercado ou a conta precisa saber o que deve entrar e quando, e quanto as previsões costumam errar. Uma previsão sem a data em que foi feita não
                  permite saber se ela foi cumprida.
                </>,
                <>
                  Whoever plans the grid, the market or the bill needs to know what should come online and when, and how much the forecasts usually miss. A forecast without the date it was
                  made does not show whether it was met.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={p.previsoes}
              complementares={[
                { rotulo: tx("Confiabilidade das previsões", "Reliability of the forecasts"), p: p.confiabilidade },
                { rotulo: tx("Desvio em relação ao prazo vigente", "Deviation from the current deadline"), p: p.desvio_prazo_vigente },
                { rotulo: tx("Carteira do RALIE", "RALIE portfolio"), p: p.ralie },
              ]}
            >
              <div className="space-y-6">
                <ExpansaoPrevisoes
                  porAno={linhasPrevisoesAno(g)}
                  porAnoSemBloco={sep.cronograma}
                  anosEmBloco={sep.anosEmBloco.map((a) => a.ano)}
                  proximos={linhasProximos24(g)}
                  dataRalie={dataRalie}
                  fonte={fonteExpansao(FONTE_RALIE)}
                  avisoBloco={avisoBloco ? <ExpansaoNota>{avisoBloco}</ExpansaoNota> : undefined}
                />
                {/* a faixa de cima já traz os números; a resposta vem depois dos gráficos para que a figura comece na primeira tela */}
                <RespostaCurta id="p041" depois veredito={vereditoCronograma(g) || respostaCronograma(g)}>
                  {respostaCronograma(g)}
                </RespostaCurta>
                <ExpansaoRecorte
                  periodo={tx(
                    <>
                      Previsões da fotografia de {dataRalie}; confiabilidade de {dataTexto(conf[0]?.ralie as string | undefined)} a {dataTexto(ult?.ralie)}, com liberações até{" "}
                      {dataTexto(g.referencias.liberacoes_ultima_data)}
                    </>,
                    <>
                      Forecasts of the snapshot of {dataRalie}; reliability from {dataTexto(conf[0]?.ralie as string | undefined)} to {dataTexto(ult?.ralie)}, with releases through{" "}
                      {dataTexto(g.referencias.liberacoes_ultima_data)}
                    </>,
                  )}
                  universo={tx(
                    <>
                      Unidades geradoras em implantação acompanhadas pelo RALIE ({inteiro(g.estagios.ralie.ugs)} na fotografia atual); {inteiro(c.historico_fonte.fotografias_mensais)} fotografias mensais
                    </>,
                    <>
                      Generating units under implementation monitored by the RALIE ({inteiro(g.estagios.ralie.ugs)} in the current snapshot); {inteiro(c.historico_fonte.fotografias_mensais)} monthly
                      snapshots
                    </>,
                  )}
                  unidade={tx("MW das unidades geradoras e % da potência; datas com a data-base da previsão", "MW of the generating units and % of capacity; dates with the forecast's base date")}
                />
                <div className="space-y-2 border-l-2 border-linha pl-4 text-sm leading-relaxed text-carvao-muted">
                  <p className="rotulo text-mineral">{tx("Data-base preservada", "Base date preserved")}</p>
                  <p>
                    {tx(
                      <>
                        Cada previsão deste painel sai com a data da fotografia do RALIE em que foi registrada, de {dataTexto(c.historico_fonte.primeira_fotografia)} a {dataTexto(c.historico_fonte.ultima_fotografia)}. Previsões
                        anteriores a {dataTexto(c.historico_fonte.primeira_fotografia)} não são reconstruídas com o estoque atual.
                      </>,
                      <>
                        Each forecast in this panel comes with the date of the RALIE snapshot in which it was recorded, from {dataTexto(c.historico_fonte.primeira_fotografia)} to{" "}
                        {dataTexto(c.historico_fonte.ultima_fotografia)}. Forecasts before {dataTexto(c.historico_fonte.primeira_fotografia)} are not rebuilt with the current stock.
                      </>,
                    )}
                  </p>
                  <p data-contagem="fotografias">{textoContagemFotografias(g)}</p>
                  <p data-nivel="analisar">
                    {tx(
                      <>
                        O observatório também guarda a previsão de cada unidade a cada captura do RALIE atual, desde {dataTexto(c.historico_proprio.primeira_captura)} ({inteiro(c.historico_proprio.capturas)}{" "}
                        {c.historico_proprio.capturas === 1 ? "captura" : "capturas"}; {inteiro(c.historico_proprio.ugs_com_previsao_revisada)} previsões revisadas até aqui).
                      </>,
                      <>
                        The observatory also keeps the forecast of each unit at each capture of the current RALIE, since {dataTexto(c.historico_proprio.primeira_captura)} (
                        {inteiro(c.historico_proprio.capturas)} {c.historico_proprio.capturas === 1 ? "capture" : "captures"}; {inteiro(c.historico_proprio.ugs_com_previsao_revisada)} forecasts revised so far).
                      </>,
                    )}
                  </p>
                </div>
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <SecaoDoPainel id="datas-em-bloco" titulo={tx("Quanto da carteira tem só uma data convencional?", "How much of the portfolio has only a conventional date?")}>
                  <ExpansaoNota>
                    {tx(
                      <>
                        {pa.datas_em_bloco.regra} Na fotografia atual: {pa.datas_em_bloco.datas.map((d) => dataTexto(d)).join(", ")}, com {inteiro(pa.datas_em_bloco.ugs)} unidades e {mwTexto(pa.datas_em_bloco.mw)}.
                      </>,
                      <>
                        <TrechoPortugues regiao="expansao-bloco-regra">{pa.datas_em_bloco.regra}</TrechoPortugues> In the current snapshot: {pa.datas_em_bloco.datas.map((d) => dataTexto(d)).join(", ")}, with{" "}
                        {inteiro(pa.datas_em_bloco.ugs)} units and {mwTexto(pa.datas_em_bloco.mw)}.
                      </>,
                    )}
                  </ExpansaoNota>
                  <GraficoLinhas
                    titulo={tx("Potência com previsão em data em bloco, por fotografia mensal (MW)", "Capacity forecast on a bulk-assigned date, by monthly snapshot (MW)")}
                    dados={blocoFoto.map((b) => ({ ralie: b.ralie, mw: b.mw, ugs: b.ugs }))}
                    chaveX="ralie"
                    formatoX="data"
                    series={[{ id: "mw", rotulo: tx("Potência em datas em bloco", "Capacity on bulk-assigned dates"), sigla: tx("Em bloco", "In bulk"), cor: "var(--serie-comp-3)" }]}
                    unidade="MW"
                    casas={1}
                    zeroNoEixo
                    zoom
                  />
                  {ultimoBloco?.maior && (
                    <ExpansaoNota>
                      {tx(
                        <>
                          Na fotografia de {dataTexto(ultimoBloco.ralie)}, a maior data em bloco é {dataTexto(ultimoBloco.maior.data)}, atribuída a {inteiro(ultimoBloco.maior.usinas)} usinas,{" "}
                          {diasTexto(ultimoBloco.maior.dias_depois_da_fotografia)} depois da fotografia. {g.regras.deslizamento}
                        </>,
                        <>
                          In the snapshot of {dataTexto(ultimoBloco.ralie)}, the largest bulk-assigned date is {dataTexto(ultimoBloco.maior.data)}, assigned to {inteiro(ultimoBloco.maior.usinas)} plants,{" "}
                          {diasTexto(ultimoBloco.maior.dias_depois_da_fotografia)} after the snapshot. <TrechoPortugues regiao="expansao-regra-deslizamento">{g.regras.deslizamento}</TrechoPortugues>
                        </>,
                      )}
                    </ExpansaoNota>
                  )}
                  <ExpansaoNota>
                    {tx(
                      <>
                        Na fotografia de {dataRalie}, {pctTexto(at.pct_mw_apos_outorgado)} da potência com previsão ({mwTexto(at.mw_com_previsao)}) está prevista para depois da data outorgada, com mediana
                        ponderada de {diasTexto(at.mediana_dias_ponderada)}. Sem as unidades em data em bloco, a parcela é {pctTexto(at.sem_datas_em_bloco.pct_mw_apos_outorgado)} de{" "}
                        {mwTexto(at.sem_datas_em_bloco.mw_com_previsao)}, com mediana de {diasTexto(at.sem_datas_em_bloco.mediana_dias_ponderada)}. A diferença entre as duas leituras é o efeito da data
                        convencional: isso descreve a classificação da fiscalização, não o cronograma das obras.
                      </>,
                      <>
                        In the snapshot of {dataRalie}, {pctTexto(at.pct_mw_apos_outorgado)} of the capacity with a forecast ({mwTexto(at.mw_com_previsao)}) is forecast for after the granted date, with a
                        weighted median of {diasTexto(at.mediana_dias_ponderada)}. Without the units on bulk-assigned dates, the share is {pctTexto(at.sem_datas_em_bloco.pct_mw_apos_outorgado)} of{" "}
                        {mwTexto(at.sem_datas_em_bloco.mw_com_previsao)}, with a median of {diasTexto(at.sem_datas_em_bloco.mediana_dias_ponderada)}. The difference between the two readings is the
                        effect of the conventional date: it describes the inspection&apos;s classification, not the construction schedule.
                      </>,
                    )}
                  </ExpansaoNota>
                  <TabelaInterativa
                    titulo={tx(`Datas de previsão mais frequentes, fotografia de ${dataRalie}`, `Most frequent forecast dates, snapshot of ${dataRalie}`)}
                    colunas={colunasDatasFrequentes()}
                    linhas={linhasDatasFrequentes(g)}
                    chaveLinha="id"
                    colunaRotulo="data"
                    fonte={fonteExpansao(FONTE_RALIE)}
                    versao={dataRalie}
                    nomeArquivo="expansao-datas-previsao-frequentes"
                    chaveUrl="cro.dat"
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="o-que-atrasou" titulo={tx("O que atrasou: previsões datadas contra a liberação comercial real", "What is delayed: dated forecasts against actual commercial release")}>
                  <ExpansaoRevisoes
                    confiabilidade={conf}
                    deslizamentoCom={linhasDeslizamento(g, "com")} // i18n: dado
                    deslizamentoSem={linhasDeslizamento(g, "sem")} // i18n: dado
                    dataLiberacoes={dataLib}
                    fonte={`${fonteExpansao(FONTE_RALIE)}; ${fonteExpansao(FONTE_LIBERACOES)}`}
                  />
                  <ExpansaoNota>
                    {tx(
                      <>
                        As janelas mais recentes tiveram menos tempo para a liberação &quot;depois do prazo&quot;. Unidade renumerada entre a fotografia e a liberação aparece como não liberada.{" "}
                        {inteiro(c.historico_fonte.ugs_atipicas_excluidas_das_fotografias_mensais)} unidades de usinas com potência fora de escala no arquivo histórico ficam fora destas contas.
                      </>,
                      <>
                        The most recent windows have had less time for a &quot;late&quot; release. A unit renumbered between the snapshot and the release appears as not released.{" "}
                        {inteiro(c.historico_fonte.ugs_atipicas_excluidas_das_fotografias_mensais)} units of plants with out-of-scale capacity in the historical file are left out of these counts.
                      </>,
                    )}
                  </ExpansaoNota>
                  {ult && (
                    <GraficoBarras
                      titulo={tx(
                        `Liberado no prazo por tipo, previsões da fotografia de ${dataTexto(ult.ralie)} para 12 meses (% da potência prevista)`,
                        `Released on time by type, forecasts of the snapshot of ${dataTexto(ult.ralie)} for 12 months (% of forecast capacity)`,
                      )}
                      dados={linhasConfiabilidadeTipo(g)}
                      chaveCategoria="id"
                      chaveRotulo="tipo"
                      series={[{ id: "pct_no_prazo", rotulo: tx("Liberado no prazo", "Released on time"), cor: "var(--cor-energia)" }]} // i18n: dado
                      unidade="%"
                      casas={1}
                      orientacao="horizontal"
                      rotulosValor
                    />
                  )}
                  <ExpansaoNota>
                    {tx(
                      "Tipos com pouca potência prevista (algumas unidades) dão percentuais extremos: a potência prevista de cada tipo está na tabela do gráfico.",
                      "Types with little forecast capacity (a few units) give extreme percentages: the forecast capacity of each type is in the chart's table.",
                    )}
                  </ExpansaoNota>
                  <ExpansaoTabelaSimples
                    titulo={tx(`Situação do cronograma atribuída pela fiscalização, fotografia de ${dataRalie}`, `Schedule status assigned by the inspection, snapshot of ${dataRalie}`)}
                    cabecalho={tx(["Situação", "Usinas", "Potência outorgada (MW)"], ["Status", "Plants", "Granted capacity (MW)"])}
                    linhas={c.por_situacao_cronograma.map((s) => [rotuloSituacaoCronograma(s.situacao), inteiro(s.usinas), mwTexto(s.mw_outorgado)])}
                  />
                  <TabelaInterativa
                    titulo={tx(`Maiores usinas com cronograma atrasado, fotografia de ${dataRalie}`, `Largest plants behind schedule, snapshot of ${dataRalie}`)}
                    colunas={colunasAtrasadas()}
                    linhas={linhasAtrasadas(g)}
                    chaveLinha="id"
                    colunaRotulo="nome"
                    fonte={fonteExpansao(FONTE_RALIE)}
                    versao={dataRalie}
                    nomeArquivo="expansao-usinas-atrasadas"
                    chaveUrl="cro.atr"
                    ordemInicial={{ coluna: "mw_outorgado", direcao: "desc" }}
                    dicaBusca={tx("Nome da usina, tipo ou UF", "Plant name, type or state")}
                    nota={tx(
                      `Previsão e data outorgada da última unidade da usina; a diferença tem data-base (a fotografia de ${dataRalie}). Previsão em data em bloco é a data convencional da fiscalização, não cronograma de obra; sem previsão, a diferença fica sem dado.`,
                      `Forecast and granted date of the plant's last unit; the difference has a base date (the snapshot of ${dataRalie}). A forecast on a bulk-assigned date is the inspection's conventional date, not a construction schedule; without a forecast, the difference has no data.`,
                    )}
                  />
                </SecaoDoPainel>

                <ExpansaoAnalise titulo={tx("Unidades sem previsão da fiscalização", "Units without an inspection forecast")} id="previsto-x-outorgado">
                  <GraficoBarras
                    titulo={tx(`Unidades sem previsão da fiscalização, por justificativa, fotografia de ${dataRalie} (MW)`, `Units without an inspection forecast, by reason, snapshot of ${dataRalie} (MW)`)}
                    dados={linhasSemPrevisao(g)}
                    chaveCategoria="id"
                    chaveRotulo="justificativa"
                    series={[{ id: "mw", rotulo: tx("Unidades sem previsão", "Units without a forecast"), cor: "var(--serie-comp-3)" }]}
                    unidade="MW"
                    casas={1}
                    orientacao="horizontal"
                    rotulosValor
                  />
                </ExpansaoAnalise>

                <ExpansaoAnalise titulo={tx("Liberação comercial contra o prazo outorgado vigente (desvio, não atraso)", "Commercial release against the current granted deadline (deviation, not delay)")} id="desvio-prazo">
                  <ExpansaoNota>
                    <TrechoPortugues regiao="expansao-desvio-definicao">{c.desvio_prazo_vigente.definicao}</TrechoPortugues>
                  </ExpansaoNota>
                  <GraficoBarras
                    titulo={tx(
                      `Potência liberada depois e antes do prazo outorgado vigente, por ano da liberação (% da potência com data outorgada)`,
                      `Capacity released after and before the current granted deadline, by year of release (% of capacity with a granted date)`,
                    )}
                    dados={linhasDesvioPrazo(g)}
                    chaveCategoria="id"
                    chaveRotulo="ano" // i18n: dado
                    series={[
                      { id: "pct_depois", rotulo: tx("Depois do prazo vigente", "After the current deadline"), cor: "var(--escala-div-neg-1)" },
                      { id: "pct_antes", rotulo: tx("Antes do prazo vigente", "Before the current deadline"), cor: "var(--cor-energia)" }, // i18n: dado
                    ]}
                    unidade="%"
                    casas={1}
                  />
                  <TabelaInterativa
                    titulo={tx("Desvio da liberação comercial em relação ao prazo outorgado vigente, por ano", "Deviation of the commercial release from the current granted deadline, by year")}
                    colunas={colunasDesvioPrazo()}
                    linhas={linhasDesvioPrazo(g)}
                    chaveLinha="id"
                    colunaRotulo="ano" // i18n: dado
                    fonte={fonteExpansao(FONTE_LIBERACOES)}
                    versao={dataLib}
                    nomeArquivo="expansao-desvio-prazo-vigente"
                    chaveUrl="cro.dsv"
                    nota={tx(
                      "O denominador dos percentuais é a potência com data outorgada; as linhas sem data outorgada ficam à parte. Ano parcial marcado. Mediana negativa é liberação antes do prazo.",
                      "The denominator of the percentages is the capacity with a granted date; the rows without a granted date are kept separate. Partial year marked. A negative median is a release before the deadline.",
                    )}
                  />
                </ExpansaoAnalise>

                <ExpansaoAuditoria titulo={tx("Regras, cobertura e limitações", "Rules, coverage and limitations")} id="auditoria-cronograma">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    <li>
                      <TrechoPortugues regiao="expansao-regra-previsao">{g.regras.previsao}</TrechoPortugues>
                    </li>
                    <li>
                      <TrechoPortugues regiao="expansao-regra-confiabilidade">{g.regras.confiabilidade}</TrechoPortugues>
                    </li>
                    <li>
                      <TrechoPortugues regiao="expansao-regra-deslizamento">{g.regras.deslizamento}</TrechoPortugues>
                    </li>
                    <li>
                      <TrechoPortugues regiao="expansao-regra-bloco">{g.regras.data_em_bloco}</TrechoPortugues>
                    </li>
                    <li>
                      <TrechoPortugues regiao="expansao-regra-desvio">{g.regras.desvio_prazo_vigente}</TrechoPortugues>
                    </li>
                  </ul>
                  <ExpansaoNota>
                    {tx(
                      <>
                        Histórico da fonte: {inteiro(c.historico_fonte.fotografias)} fotografias ({inteiro(c.historico_fonte.fotografias_mensais)} mensais) de {dataTexto(c.historico_fonte.primeira_fotografia)} a{" "}
                        {dataTexto(c.historico_fonte.ultima_fotografia)}. Liberações detalhadas contra o resumo anual oficial desde {g.conferencias.liberacoes_detalhado_x_resumo.desde}:{" "}
                        {inteiro(g.conferencias.liberacoes_detalhado_x_resumo.iguais)} de {inteiro(g.conferencias.liberacoes_detalhado_x_resumo.grupos_ano_tipo)} grupos (ano e tipo) iguais, tolerância de{" "}
                        {g.conferencias.liberacoes_detalhado_x_resumo.tolerancia_kw.toLocaleString("pt-BR")} kW; resultado: {g.conferencias.liberacoes_detalhado_x_resumo.resultado}.
                      </>,
                      <>
                        Source history: {inteiro(c.historico_fonte.fotografias)} snapshots ({inteiro(c.historico_fonte.fotografias_mensais)} monthly) from {dataTexto(c.historico_fonte.primeira_fotografia)} to{" "}
                        {dataTexto(c.historico_fonte.ultima_fotografia)}. Detailed releases against the official annual summary since {g.conferencias.liberacoes_detalhado_x_resumo.desde}:{" "}
                        {inteiro(g.conferencias.liberacoes_detalhado_x_resumo.iguais)} of {inteiro(g.conferencias.liberacoes_detalhado_x_resumo.grupos_ano_tipo)} groups (year and type) equal, tolerance of{" "}
                        {g.conferencias.liberacoes_detalhado_x_resumo.tolerancia_kw.toLocaleString("en-US")} kW; result:{" "}
                        <TrechoPortugues regiao="expansao-conferencia-liberacoes">{g.conferencias.liberacoes_detalhado_x_resumo.resultado}</TrechoPortugues>.
                      </>,
                    )}
                  </ExpansaoNota>
                  <p className="rotulo text-mineral">{tx("Limitações declaradas na proveniência", "Limitations declared in the provenance")}</p>
                  <ExpansaoLimitacoes itens={[...p.previsoes.limitacoes, ...p.confiabilidade.limitacoes, ...p.desvio_prazo_vigente.limitacoes]} />
                </ExpansaoAuditoria>

                <ExpansaoSeguir id="p041" downloads={downloadsDe(g, DOWNLOADS_PAINEL.p041)} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
