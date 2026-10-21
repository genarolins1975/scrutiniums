import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { Numero } from "@/components/energia/Numero";
import { RegulacaoConsultas } from "@/components/energia/RegulacaoConsultas";
import { RegulacaoAviso, RegulacaoDatas, RegulacaoIndisponivel, RegulacaoLinkExterno, RegulacaoNavegacao, RegulacaoRecorte } from "@/components/energia/RegulacaoPagina";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { somarDias } from "@/lib/energia/calendario";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_AGENDA,
  PAGINAS_PARTICIPACAO,
  ROTULO_FORMA_RESULTADO,
  anoInicioHistorico,
  avisoRevisaoAgenda,
  contagemAgendaPorPainel,
  downloadsDoPainel,
  linhasAgenda,
  linhasHistoricoSituacao,
  nomeAgenda,
  paresCobertura,
  perguntaPainel,
  proximoPainel,
  respostaAgenda,
  rotaPainel,
  rotuloDownload,
  textoCoberturaFaixa,
  textoJanela,
  vereditoAgenda,
} from "@/lib/energia/regulacao";
import { hojeBrasilia, type FormaResultado, type GoldRegulacao } from "@/lib/energia/tipos-regulacao";
import { tx } from "@/lib/energia/idioma";
import { comNomes, versaoDaAgenda } from "@/lib/energia/i18n/regulacao-dados-metodo";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/regulacao/consultas-e-agenda", {
    title: tx("Regulação: consultas públicas abertas e Agenda Regulatória da ANEEL", "Regulation: open public consultations and the ANEEL regulatory agenda"),
    description: tx(
      "Consultas e audiências públicas da ANEEL com o período de contribuições lido nas atas da Diretoria, a situação recalculada na data de leitura (nenhuma consulta vencida aparece como aberta), o resultado e o ato, e as atividades da Agenda Regulatória vigente da ANEEL.",
      "ANEEL public consultations and hearings with the contribution period read in the Board minutes, the status recomputed on the reading date (no expired consultation shows as open), the result and the act, and the activities of ANEEL's current regulatory agenda.",
    ),
    alternates: { canonical: rotaPainel("p046") },
  }, anterior);
}

const SERIE_ANO = ["var(--cor-energia)", "var(--serie-referencia)", "var(--cor-energia-dark)"]; // i18n: dado

export default function ConsultasEAgendaPage() {
  const g = lerGold<GoldRegulacao>("regulacao.json");
  if (!integra(g)) return <RegulacaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const C = g.consultas;
  const A = g.agenda;
  // data do build, nunca anterior à da gold; o navegador ainda troca pela data de hoje
  const hoje = hojeBrasilia();
  const dataServidor = hoje > C.data_referencia ? hoje : C.data_referencia;
  const dataRef = dataBR(C.data_referencia);
  const proximo = proximoPainel("p046");
  const fonte = tx("ANEEL, Pautas e atas das reuniões públicas da Diretoria", "ANEEL, agendas and minutes of the public Board meetings");
  const agendaPainel = contagemAgendaPorPainel(A.itens);
  const formas = Object.entries(C.contagem_por_forma_resultado ?? {}) as [FormaResultado, number][];
  const cobCp = paresCobertura(C, "consultas");
  const cobAp = paresCobertura(C, "audiencias");
  // sem a janela na gold, o período diz que ela não foi informada: nenhum número de reserva
  const inicioJanela = typeof C.janela_dias === "number" ? somarDias(C.data_referencia, -C.janela_dias) : null;
  const agenda = nomeAgenda(A);
  const anoHistorico = anoInicioHistorico(g);
  const totalHistorico = typeof C.total_historico === "number" ? num(C.total_historico, 0) : null;
  const semResultadoFormal = (C.decisoes_sem_resultado_formal ?? []).length;
  const testes = g.evidencias.consultas_abertas?.testes ?? [];
  const anosSoAudiencia = C.cobertura.filter((x) => !x.parcial && x.nas_atas === 0 && x.total_anual_aneel > 0 && x.audiencias_nas_atas > 0).map((x) => x.ano);
  const csvHistorico = downloadsDoPainel(g, "p046").find((d) => /consultas/.test(d.url));
  const avisoRevisao = avisoRevisaoAgenda(A);
  const limitesEmRevisao = g.limites_em_revisao;

  const oQueMudou = tx(
    <>
      Esta publicação traz os resultados deliberados até a reunião de {dataBR(C.atas_deliberadas_ate ?? null)} e a pauta de {dataBR(C.atas_ate ?? null)}
      {semResultadoFormal === 0
        ? ", sem decisão de abertura pendente de resultado formal."
        : `, com ${semResultadoFormal} ${semResultadoFormal === 1 ? "decisão de abertura ainda sem resultado formal, contada" : "decisões de abertura ainda sem resultado formal, contadas"} à parte.`}
    </>,
    <>
      This publication carries the results decided up to the meeting of {dataBR(C.atas_deliberadas_ate ?? null)} and the agenda of {dataBR(C.atas_ate ?? null)}
      {semResultadoFormal === 0
        ? ", with no opening decision awaiting a formal result."
        : `, with ${semResultadoFormal} ${semResultadoFormal === 1 ? "opening decision still without a formal result, counted" : "opening decisions still without a formal result, counted"} separately.`}
    </>,
  );
  const comoInterpretar = tx(
    <>
      Cada faixa vai do início ao fim do período de contribuições escrito na ata; a linha tracejada vertical é a data de leitura, e a marca final vazada é o fim calculado do
      início e da duração. A legenda acima do gráfico mostra o traço e a cor de cada situação, que também está escrita na dica e na tabela. As caixas de situação filtram o
      gráfico e a tabela ao mesmo tempo, e o número entre parênteses conta as consultas de cada situação na data de leitura. Escolha uma consulta para ver as fases, o trecho da
      ata de onde o período foi lido e o resultado.
    </>,
    <>
      Each band runs from the start to the end of the contribution period written in the minutes; the dashed vertical line is the reading date, and the hollow end mark is the
      end computed from the start and the duration. The legend above the chart shows the line and color of each status, which is also written in the tooltip and the table. The
      status boxes filter the chart and the table at the same time, and the number in brackets counts the consultations in each status on the reading date. Choose a
      consultation to see its phases, the passage of the minutes the period was read from and the result.
    </>,
  );
  const naoConcluir = tx(
    <>
      A contagem de abertas não mede a atividade regulatória inteira: só entram consultas deliberadas em reunião pública registrada. Encerrada sem resultado não quer dizer
      esquecida: a decisão pode ter saído depois do último arquivo das atas. Não é possível saber o conteúdo das contribuições nem se a ANEEL alterou a proposta depois delas.
      Consulta sem datas na ata (só a duração ou só a sessão da audiência) não tem situação derivável e nunca aparece como aberta. O ano da agenda é previsão da ANEEL.
    </>,
    <>
      The count of open consultations does not measure all regulatory activity: only consultations decided in a recorded public meeting are included. Closed without a result
      does not mean forgotten: the decision may have come after the latest minutes file. It is not possible to know the content of the contributions or whether ANEEL changed the
      proposal after them. A consultation without dates in the minutes (only the duration or only the hearing session) has no derivable status and never shows as open. The
      agenda year is an ANEEL forecast.
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="regulacao" />
      <MarcaVisita secao="energia:regulacao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <RegulacaoNavegacao atual="p046" />
        <CabecalhoModulo
          siglas={["MMGD", "PLD", "REN", "ANEEL", "DOU"]}
          rotulo={tx("Regulação", "Regulation")}
          titulo={perguntaPainel("p046")}
          lead={tx(
            "As consultas e audiências públicas da Agência Nacional de Energia Elétrica (ANEEL) que recebem contribuições ou esperam resultado, e as atividades que a agência prevê decidir.",
            "The public consultations and hearings of the Brazilian Electricity Regulatory Agency (ANEEL) that are receiving contributions or awaiting a result, and the activities the agency plans to decide.",
          )}
          recorte={tx(
            `Referência ${dataRef} · ${C.itens.length} consultas e audiências ${textoJanela(C.janela_dias)}`,
            `Reference ${dataRef} · ${C.itens.length} consultations and hearings ${textoJanela(C.janela_dias)}`,
          )}
          fonte={tx("ANEEL, atas da Diretoria e Agenda Regulatória", "ANEEL, Board minutes and regulatory agenda")}
          referencia={tx(
            <>
              ANEEL, atas da Diretoria (arquivo gerado em {dataBR(C.atas_geradas_em ?? null)}) e {agenda}; data de referência {dataRef}; processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              ANEEL, Board minutes (file generated on {dataBR(C.atas_geradas_em ?? null)}) and {agenda}; reference date {dataRef}; processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <RegulacaoDatas
              itens={[
                {
                  rotulo: tx("Atas da Diretoria", "Board minutes"),
                  texto: tx(
                    `arquivo gerado pela ANEEL em ${dataBR(C.atas_geradas_em ?? null)}, com resultados até a reunião de ${dataBR(C.atas_deliberadas_ate ?? null)} e pauta até ${dataBR(C.atas_ate ?? null)}`,
                    `file generated by ANEEL on ${dataBR(C.atas_geradas_em ?? null)}, with results up to the meeting of ${dataBR(C.atas_deliberadas_ate ?? null)} and agenda up to ${dataBR(C.atas_ate ?? null)}`,
                  ),
                  natureza: "OBSERVADO",
                },
                {
                  rotulo: tx("Situação das consultas", "Status of the consultations"),
                  texto: tx(`calculada em ${dataRef} e recalculada no dia da leitura`, `computed on ${dataRef} and recomputed on the reading day`),
                  natureza: "CALCULADO",
                },
                {
                  rotulo: tx("Agenda Regulatória", "Regulatory agenda"),
                  texto: A.disponivel
                    ? comNomes(
                        tx(
                          `${A.portaria ?? "portaria da agenda"}, publicada em ${dataBR(A.data_publicacao ?? null)}; os anos são previsão da ANEEL`,
                          `${A.portaria ?? "agenda ordinance"}, published on ${dataBR(A.data_publicacao ?? null)}; the years are an ANEEL forecast`,
                        ),
                      )
                    : tx("indisponível nesta publicação", "unavailable in this publication"),
                  natureza: "OBSERVADO",
                },
              ]}
            />
          }
        >
          {tx(
            <>
              O período de cada consulta é lido na decisão que a ata da reunião pública da Diretoria registra, e a situação (recebendo contribuições, a abrir, encerrada sem
              resultado, decidida) é recalculada pela mesma regra no dia em que a página é lida. A Agenda Regulatória é o plano de atividades da ANEEL para o biênio, com o ano de
              cada uma como previsão. As outras duas páginas do módulo trazem os limites e as regras de preço e a linha do tempo das mudanças.
            </>,
            <>
              The period of each consultation is read from the decision recorded in the minutes of the public Board meeting, and the status (receiving contributions, about to open,
              closed without a result, decided) is recomputed by the same rule on the day the page is read. The regulatory agenda is ANEEL&apos;s plan of activities for the two-year
              period, with the year of each as a forecast. The other two pages of the module cover the price limits and rules and the timeline of changes.
            </>,
          )}
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="consultas">
            <PainelEvidencia
              id="p046"
              pergunta={tx("Quais consultas e audiências públicas recebem contribuições?", "Which public consultations and hearings are receiving contributions?")}
              subtitulo={tx(
                "Consultas e audiências públicas com período, situação e resultado; Agenda Regulatória · contagem e datas",
                "Public consultations and hearings with period, status and result; regulatory agenda · count and dates",
              )}
              natureza="CALCULADO"
              porQueImporta={
                tx(
                  <>
                    Uma consulta aberta é a janela em que qualquer pessoa pode influir numa regra antes de ela valer. Saber o prazo, e se a consulta já foi decidida, evita
                    perder a janela ou tratar como pendente o que já virou norma.
                  </>,
                  <>
                    An open consultation is the window in which anyone can influence a rule before it applies. Knowing the deadline, and whether the consultation has already been
                    decided, avoids missing the window or treating as pending what has already become a rule.
                  </>,
                )
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.consultas}
              complementares={[{ rotulo: agenda, p: g.proveniencia.agenda }]}
            >
              <div className="space-y-6">
                <RegulacaoConsultas
                  consultas={C}
                  dataServidor={dataServidor}
                  fonte={fonte}
                  versao={C.data_referencia}
                  cartao={
                    g.evidencias.consultas_abertas ? (
                      <Numero
                        variante="faixa"
                        rotulo={tx("Recebendo contribuições", "Receiving contributions")}
                        natureza="CALCULADO"
                        evidencia={g.evidencias.consultas_abertas}
                        formato="num"
                        casas={0}
                        unidade={tx("consultas e audiências", "consultations and hearings")}
                        periodo={tx(`em ${dataRef}`, `on ${dataRef}`)}
                        cor="var(--cor-energia)"
                        endereco={`${rotaPainel("p046")}#p046`}
                        nota={tx(`Contagem em ${dataRef}, a data de referência da publicação.`, `Count on ${dataRef}, the reference date of the publication.`)}
                      />
                    ) : (
                      <Numero
                        variante="faixa"
                        rotulo={tx("Recebendo contribuições", "Receiving contributions")}
                        natureza="CALCULADO"
                        valor={null}
                        motivoAusencia={tx(
                          "As atas da Diretoria não foram integradas nesta publicação, por isso a contagem fica sem valor.",
                          "The Board minutes were not integrated in this publication, so the count has no value.",
                        )}
                      />
                    )
                  }
                  ondeContribuir={
                    <p data-onde-contribuir="">
                      {tx(
                        <>
                          <span className="font-medium text-carvao">Onde contribuir.</span> As atas não trazem o endereço de cada consulta. A ANEEL recebe contribuições pelas
                          páginas oficiais de <RegulacaoLinkExterno href={PAGINAS_PARTICIPACAO.consultas}>consultas públicas</RegulacaoLinkExterno> e de{" "}
                          <RegulacaoLinkExterno href={PAGINAS_PARTICIPACAO.audiencias}>audiências públicas</RegulacaoLinkExterno>; procure pelo número da consulta.
                        </>,
                        <>
                          <span className="font-medium text-carvao">Where to contribute.</span> The minutes do not carry the address of each consultation. ANEEL receives
                          contributions through the official pages for <RegulacaoLinkExterno href={PAGINAS_PARTICIPACAO.consultas}>public consultations</RegulacaoLinkExterno> and{" "}
                          <RegulacaoLinkExterno href={PAGINAS_PARTICIPACAO.audiencias}>public hearings</RegulacaoLinkExterno> (in Portuguese); search for the consultation number.
                        </>,
                      )}
                    </p>
                  }
                  legendaFigura={
                    <>
                      {tx(
                        `O gráfico e a tabela mostram as ${C.itens.length} consultas e audiências ${textoJanela(C.janela_dias)}${totalHistorico ? `, de um histórico de ${totalHistorico}${anoHistorico ? ` desde ${anoHistorico}` : ""}` : ""}.`,
                        `The chart and the table show the ${C.itens.length} consultations and hearings ${textoJanela(C.janela_dias)}${totalHistorico ? `, out of a history of ${totalHistorico}${anoHistorico ? ` since ${anoHistorico}` : ""}` : ""}.`,
                      )}
                      {csvHistorico && (
                        <>
                          {" "}
                          {tx("O histórico completo pode ser baixado em", "The full history can be downloaded as")}{" "}
                          <a href={csvHistorico.url} download className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                            {rotuloDownload(csvHistorico.rotulo)}
                          </a>
                          .
                        </>
                      )}
                    </>
                  }
                  recorte={
                    <RegulacaoRecorte
                      periodo={
                        tx(
                          <>
                            {inicioJanela
                              ? `consultas com janela encerrada, resultado ou fase deliberada de ${dataBR(inicioJanela)} a ${dataRef} (${C.janela_dias} dias)`
                              : `consultas com atividade recente até ${dataRef} (a publicação não informa a janela)`}
                            {`; histórico ${totalHistorico ? `de ${totalHistorico} consultas` : "completo (contagem não informada)"} desde ${dataBR(g.proveniencia.consultas.cobertura_historica.inicio)} no arquivo para baixar`}
                          </>,
                          <>
                            {inicioJanela
                              ? `consultations with a window closed, a result or a phase decided from ${dataBR(inicioJanela)} to ${dataRef} (${C.janela_dias} days)`
                              : `consultations with recent activity up to ${dataRef} (the publication does not report the window)`}
                            {`; ${totalHistorico ? `history of ${totalHistorico} consultations` : "full history (count not reported)"} since ${dataBR(g.proveniencia.consultas.cobertura_historica.inicio)} in the download file`}
                          </>,
                        )
                      }
                      universo={tx(
                        "Avisos de consulta e de audiência pública com abertura deliberada em reunião pública da Diretoria da ANEEL",
                        "Public consultation and hearing notices with an opening decided in a public ANEEL Board meeting",
                      )}
                      unidade={tx("consulta ou audiência (contagem) e datas no calendário de Brasília", "consultation or hearing (count) and dates in the Brasília calendar")}
                    />
                  }
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                />

                <SecaoDoPainel
                  id="agenda-curta"
                  titulo="O que a ANEEL prevê decidir?" // i18n: dado (o título português fica literal, conferido no código pelo teste r8; o inglês vem no spread abaixo)
                  {...tx({}, { titulo: "What does ANEEL plan to decide?" })}
                  lead={tx(
                    <>
                      A <Termo slug="agenda-regulatoria">Agenda Regulatória</Termo> é o plano de atividades em que a ANEEL prevê editar norma no biênio. As que tratam dos limites do
                      PLD (Preço de Liquidação das Diferenças) aparecem também na página de limites e regras de preço.
                    </>,
                    <>
                      The <Termo slug="agenda-regulatoria">regulatory agenda</Termo> is the plan of activities in which ANEEL expects to issue rules over the two-year period. Those dealing
                      with the limits of the PLD (spot price) also appear on the price limits and rules page.
                    </>,
                  )}
                >
                  <RespostaCurta id="agenda" atributo="data-resposta-agenda" tamanho="sm" veredito={vereditoAgenda(A, limitesEmRevisao)}>
                    {comNomes(respostaAgenda(A, limitesEmRevisao))}
                  </RespostaCurta>
                  {avisoRevisao && <RegulacaoAviso tipo="alerta">{comNomes(avisoRevisao)}</RegulacaoAviso>}
                  {A.disponivel ? (
                    agendaPainel.linhas.length > 0 && (
                      <>
                        <GraficoBarras
                          titulo={tx("Atividades da agenda por painel relacionado e ano previsto", "Agenda activities by related panel and planned year")}
                          dados={agendaPainel.linhas}
                          chaveCategoria="id"
                          chaveRotulo="rotulo"
                          series={agendaPainel.anos.map((a, i) => ({ id: a, rotulo: tx(`Prevista para ${a}`, `Planned for ${a}`), cor: SERIE_ANO[i % SERIE_ANO.length] }))}
                          unidade={tx("atividades", "activities")}
                          casas={0}
                          orientacao="horizontal"
                          empilhado
                          rotulosValor
                        />
                        <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                          {tx(
                            `Uma atividade pode estar ligada a mais de um painel, pelas palavras do texto dela; ${agendaPainel.semPainel} ${agendaPainel.semPainel === 1 ? "atividade não se liga" : "atividades não se ligam"} a nenhum painel. A ligação indica onde a leitura pode mudar, não um efeito.`,
                            `An activity can be linked to more than one panel, through the words of its text; ${agendaPainel.semPainel} ${agendaPainel.semPainel === 1 ? "activity is" : "activities are"} not linked to any panel. The link shows where the reading may change, not an effect.`,
                          )}
                        </p>
                      </>
                    )
                  ) : (
                    <RegulacaoAviso tipo="alerta">
                      {tx("Agenda indisponível nesta publicação:", "Agenda unavailable in this publication:")}{" "}
                      {A.motivo ? <TrechoPortugues regiao="regulacao-agenda-motivo">{A.motivo}</TrechoPortugues> : tx("motivo não informado", "reason not reported")}.
                    </RegulacaoAviso>
                  )}
                  <p className="text-sm">
                    <a href="#agenda" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                      {tx("Ver as atividades da agenda, uma a uma, em Analisar", "See the agenda activities, one by one, under Analyze")}
                    </a>
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="agenda" nivel="analisar" titulo={tx("Quais são as atividades da agenda e em que ano cada uma está prevista?", "What are the agenda activities, and in which year is each planned?")}>
                  {A.disponivel ? (
                    <>
                      <TabelaInterativa
                        titulo={tx(`Atividades da ${agenda}`, `Activities of the ${agenda}`)}
                        colunas={COLUNAS_AGENDA}
                        linhas={linhasAgenda(A.itens, limitesEmRevisao ?? [])}
                        chaveLinha="id"
                        colunaRotulo="codigo"
                        fonte={`ANEEL, ${A.versao ? versaoDaAgenda(A.versao) : tx("Agenda Regulatória", "regulatory agenda")}`}
                        versao={A.data_publicacao ?? C.data_referencia}
                        nomeArquivo="regulacao-agenda"
                        chaveUrl="ag"
                        dicaBusca={tx("Código ou palavra da atividade", "Code or word of the activity")}
                        nota={
                          <>
                            <Nome>{A.portaria}</Nome>
                            {tx(
                              `, publicada no Diário Oficial da União (DOU) em ${dataBR(A.data_publicacao ?? null)}.`,
                              `, published in the Official Gazette of the Union (DOU) on ${dataBR(A.data_publicacao ?? null)}.`,
                            )}{" "}
                            {A.url_oficial && <RegulacaoLinkExterno href={A.url_oficial}>{tx("Endereço oficial", "Official address")}</RegulacaoLinkExterno>}
                            {A.copia_publica && (
                              <>
                                {"; "}
                                <RegulacaoLinkExterno href={A.copia_publica}>{tx("cópia pública lida, conferida por sha256", "public copy read, checked by sha256")}</RegulacaoLinkExterno>
                              </>
                            )}
                            .
                          </>
                        }
                      />
                      {A.regra_paineis && (
                        <p className="text-sm leading-relaxed text-carvao-muted">
                          {tx("Regra dos painéis relacionados:", "Rule for the related panels:")} <TrechoPortugues regiao="regulacao-agenda-regra">{A.regra_paineis}</TrechoPortugues>.
                        </p>
                      )}
                      {A.revisao.atualizada_por && !A.revisao.texto_lido && (
                        <RegulacaoAviso>
                          {A.revisao.tentativa ? (
                            <>
                              {tx(`Tentativa de ler o texto da atualização em ${carimbo(A.revisao.tentativa.tentado_em)}:`, `Attempt to read the text of the update on ${carimbo(A.revisao.tentativa.tentado_em)}:`)}{" "}
                              <TrechoPortugues regiao="regulacao-agenda-tentativa">{A.revisao.tentativa.detalhe}</TrechoPortugues>.
                            </>
                          ) : (
                            tx("O texto da atualização não foi lido e nenhuma tentativa de leitura está registrada.", "The text of the update was not read and no reading attempt is recorded.")
                          )}{" "}
                          {tx("Os anos previstos na tabela são os da versão original.", "The planned years in the table are those of the original version.")}
                        </RegulacaoAviso>
                      )}
                    </>
                  ) : (
                    <RegulacaoAviso tipo="alerta">
                      {tx("Agenda indisponível nesta publicação:", "Agenda unavailable in this publication:")}{" "}
                      {A.motivo ? <TrechoPortugues regiao="regulacao-agenda-motivo">{A.motivo}</TrechoPortugues> : tx("motivo não informado", "reason not reported")}.
                    </RegulacaoAviso>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="historico"
                  nivel="analisar"
                  titulo={tx(
                    `Em que situação estão ${totalHistorico ? `as ${totalHistorico} consultas` : "as consultas"} do histórico em ${dataRef}?`,
                    `What is the status of ${totalHistorico ? `the ${totalHistorico} consultations` : "the consultations"} in the history on ${dataRef}?`,
                  )}
                >
                  <GraficoBarras
                    titulo={tx(
                      `Consultas e audiências ${anoHistorico ? `desde ${anoHistorico}` : "do histórico"}, por situação`,
                      `Consultations and hearings ${anoHistorico ? `since ${anoHistorico}` : "in the history"}, by status`,
                    )}
                    dados={linhasHistoricoSituacao(C)}
                    chaveCategoria="id"
                    chaveRotulo="situacao"
                    // i18n: dado
                    series={[{ id: "n", rotulo: tx("Consultas", "Consultations"), cor: "var(--cor-energia)" }]}
                    unidade={tx("consultas", "consultations")}
                    casas={0}
                    orientacao="horizontal"
                    rotulosValor
                  />
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      `Como o resultado das decididas e das em pauta foi reconhecido: ${formas.map(([f, n]) => `${num(n, 0)} por ${ROTULO_FORMA_RESULTADO[f] ?? f}`).join("; ")}. A contagem é da data de referência da publicação; a tabela completa, com a fase atual e o resultado de cada uma, está no arquivo para baixar.`,
                      `How the result of the decided ones and of those on the agenda was recognized: ${formas.map(([f, n]) => `${num(n, 0)} by ${ROTULO_FORMA_RESULTADO[f] ?? f}`).join("; ")}. The count is from the reference date of the publication; the full table, with the current phase and the result of each one, is in the download file.`,
                    )}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="cobertura" nivel="auditar" titulo={tx("Quantas consultas do ano as atas registram?", "How many of the year's consultations do the minutes record?")}>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-cobertura="">
                    {textoCoberturaFaixa(C)}
                  </p>
                  <GraficoPontos
                    titulo={tx("Consultas públicas nas atas e total anual publicado pela ANEEL", "Public consultations in the minutes and annual total published by ANEEL")}
                    itens={cobCp}
                    unidade={tx("consultas", "consultations")}
                    casas={0}
                    rotuloValor={tx("Nas atas da Diretoria", "In the Board minutes")}
                    rotuloReferencia={tx("Total anual publicado pela ANEEL", "Annual total published by ANEEL")}
                    unidadeDiferenca={tx("consultas", "consultations")}
                    zeroNoEixo
                  />
                  <GraficoPontos
                    titulo={tx("Audiências públicas nas atas e total anual publicado pela ANEEL", "Public hearings in the minutes and annual total published by ANEEL")}
                    itens={cobAp}
                    unidade={tx("audiências", "hearings")}
                    casas={0}
                    rotuloValor={tx("Nas atas da Diretoria", "In the Board minutes")}
                    rotuloReferencia={tx("Total anual publicado pela ANEEL", "Annual total published by ANEEL")}
                    unidadeDiferenca={tx("audiências", "hearings")}
                    zeroNoEixo
                  />
                  <RegulacaoAviso>
                    {tx(
                      "Em ano parcial, a contagem anual da ANEEL é anterior ao fim do ano e pode ficar abaixo do que as atas já registram.",
                      "In a partial year, ANEEL's annual count predates the end of the year and may fall below what the minutes already record.",
                    )}
                    {anosSoAudiencia.length
                      ? tx(
                          ` Em ${anosSoAudiencia.join(", ")} as atas não registram nenhum aviso como consulta pública e registram as audiências: naquele período os avisos aparecem como audiência.`,
                          ` In ${anosSoAudiencia.join(", ")} the minutes record no notice as a public consultation and do record the hearings: in that period the notices appear as hearings.`,
                        )
                      : ""}
                  </RegulacaoAviso>
                </SecaoDoPainel>

                <SecaoDoPainel id="regra-situacao" nivel="auditar" titulo={tx("Qual regra define a situação e como a contagem é controlada?", "Which rule defines the status, and how is the count controlled?")}>
                  {C.regra_situacao && (
                    <p className="text-sm leading-relaxed text-carvao-muted">
                      <TrechoPortugues regiao="regulacao-regra-situacao">{C.regra_situacao}</TrechoPortugues>
                    </p>
                  )}
                  <ul className="space-y-1 text-sm text-carvao-muted">
                    {testes.map((t) => (
                      <li key={t.nome}>
                        <span className="text-carvao">
                          <TrechoPortugues regiao="regulacao-teste-nome">{t.nome}</TrechoPortugues>
                        </span>
                        : {t.resultado}. <TrechoPortugues regiao="regulacao-teste-detalhe">{t.detalhe}</TrechoPortugues>
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      <>
                        {typeof C.numeros_suspeitos === "number" ? num(C.numeros_suspeitos, 0) : "Um número não informado de"} consultas do histórico têm o número da ata marcado
                        como suspeito (o rótulo usa o número que o próprio processo cita, quando único) e{" "}
                        {typeof C.atos_suspeitos === "number" ? num(C.atos_suspeitos, 0) : "um número não informado de"} resultados têm número de ato fora da faixa do tipo,
                        exibidos sem ato.
                        {C.convencao_contagem_prazo
                          ? ` Das ${C.convencao_contagem_prazo.casos} decisões que escrevem as duas datas e a duração, ${C.convencao_contagem_prazo.inclusiva} contam o dia do início, ${C.convencao_contagem_prazo.exclusiva} não contam e ${C.convencao_contagem_prazo.outra} divergem por mais de um dia; o fim calculado usa a primeira convenção.`
                          : ""}
                      </>,
                      <>
                        {typeof C.numeros_suspeitos === "number" ? num(C.numeros_suspeitos, 0) : "An unreported number of"} consultations in the history have the minutes number
                        flagged as suspect (the label uses the number cited by the proceeding itself, when unique) and{" "}
                        {typeof C.atos_suspeitos === "number" ? num(C.atos_suspeitos, 0) : "an unreported number of"} results have an act number outside the range for the type,
                        shown without an act.
                        {C.convencao_contagem_prazo
                          ? ` Of the ${C.convencao_contagem_prazo.casos} decisions that write both dates and the duration, ${C.convencao_contagem_prazo.inclusiva} count the start day, ${C.convencao_contagem_prazo.exclusiva} do not and ${C.convencao_contagem_prazo.outra} differ by more than one day; the computed end uses the first convention.`
                          : ""}
                      </>,
                    )}
                  </p>
                </SecaoDoPainel>

                <SeguirPainel
                  ancora="p046"
                  proximo={{ href: `${proximo.rota}#${proximo.id}`, pergunta: proximo.pergunta }}
                  downloads={downloadsDoPainel(g, "p046").map((d) => ({ ...d, rotulo: rotuloDownload(d.rotulo) }))}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
