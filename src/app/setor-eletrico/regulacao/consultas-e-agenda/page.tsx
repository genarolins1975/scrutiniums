import type { Metadata } from "next";
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

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Regulação: consultas públicas abertas e Agenda Regulatória da ANEEL",
  description:
    "Consultas e audiências públicas da ANEEL com o período de contribuições lido nas atas da Diretoria, a situação recalculada na data de leitura (nenhuma consulta vencida aparece como aberta), o resultado e o ato, e as atividades da Agenda Regulatória vigente da ANEEL.",
  alternates: { canonical: rotaPainel("p046") },
};

const SERIE_ANO = ["var(--cor-energia)", "var(--serie-referencia)", "var(--cor-energia-dark)"];

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
  const fonte = "ANEEL, Pautas e atas das reuniões públicas da Diretoria";
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

  const oQueMudou = (
    <>
      Esta publicação traz os resultados deliberados até a reunião de {dataBR(C.atas_deliberadas_ate ?? null)} e a pauta de {dataBR(C.atas_ate ?? null)}
      {semResultadoFormal === 0
        ? ", sem decisão de abertura pendente de resultado formal."
        : `, com ${semResultadoFormal} ${semResultadoFormal === 1 ? "decisão de abertura ainda sem resultado formal, contada" : "decisões de abertura ainda sem resultado formal, contadas"} à parte.`}
    </>
  );
  const comoInterpretar = (
    <>
      Cada faixa vai do início ao fim do período de contribuições escrito na ata; a linha tracejada vertical é a data de leitura, e a marca final vazada é o fim calculado do
      início e da duração. A legenda acima do gráfico mostra o traço e a cor de cada situação, que também está escrita na dica e na tabela. As caixas de situação filtram o
      gráfico e a tabela ao mesmo tempo, e o número entre parênteses conta as consultas de cada situação na data de leitura. Escolha uma consulta para ver as fases, o trecho da
      ata de onde o período foi lido e o resultado.
    </>
  );
  const naoConcluir = (
    <>
      A contagem de abertas não mede a atividade regulatória inteira: só entram consultas deliberadas em reunião pública registrada. Encerrada sem resultado não quer dizer
      esquecida: a decisão pode ter saído depois do último arquivo das atas. Não é possível saber o conteúdo das contribuições nem se a ANEEL alterou a proposta depois delas.
      Consulta sem datas na ata (só a duração ou só a sessão da audiência) não tem situação derivável e nunca aparece como aberta. O ano da agenda é previsão da ANEEL.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="regulacao" />
      <MarcaVisita secao="energia:regulacao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <RegulacaoNavegacao atual="p046" />
        <CabecalhoModulo
          siglas={["MMGD", "PLD", "REN", "ANEEL", "DOU"]}
          rotulo="Regulação"
          titulo={perguntaPainel("p046")}
          lead="As consultas e audiências públicas da Agência Nacional de Energia Elétrica (ANEEL) que recebem contribuições ou esperam resultado, e as atividades que a agência prevê decidir."
          recorte={`Referência ${dataRef} · ${C.itens.length} consultas e audiências ${textoJanela(C.janela_dias)}`}
          fonte="ANEEL, atas da Diretoria e Agenda Regulatória"
          referencia={
            <>
              ANEEL, atas da Diretoria (arquivo gerado em {dataBR(C.atas_geradas_em ?? null)}) e {agenda}; data de referência {dataRef}; processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <RegulacaoDatas
              itens={[
                {
                  rotulo: "Atas da Diretoria",
                  texto: `arquivo gerado pela ANEEL em ${dataBR(C.atas_geradas_em ?? null)}, com resultados até a reunião de ${dataBR(C.atas_deliberadas_ate ?? null)} e pauta até ${dataBR(C.atas_ate ?? null)}`,
                  natureza: "OBSERVADO",
                },
                { rotulo: "Situação das consultas", texto: `calculada em ${dataRef} e recalculada no dia da leitura`, natureza: "CALCULADO" },
                {
                  rotulo: "Agenda Regulatória",
                  texto: A.disponivel ? `${A.portaria ?? "portaria da agenda"}, publicada em ${dataBR(A.data_publicacao ?? null)}; os anos são previsão da ANEEL` : "indisponível nesta publicação",
                  natureza: "OBSERVADO",
                },
              ]}
            />
          }
        >
          O período de cada consulta é lido na decisão que a ata da reunião pública da Diretoria registra, e a situação (recebendo contribuições, a abrir, encerrada sem
          resultado, decidida) é recalculada pela mesma regra no dia em que a página é lida. A Agenda Regulatória é o plano de atividades da ANEEL para o biênio, com o ano de
          cada uma como previsão. As outras duas páginas do módulo trazem os limites e as regras de preço e a linha do tempo das mudanças.
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="consultas">
            <PainelEvidencia
              id="p046"
              pergunta="Quais consultas e audiências públicas recebem contribuições?"
              subtitulo="Consultas e audiências públicas com período, situação e resultado; Agenda Regulatória · contagem e datas"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  Uma consulta aberta é a janela em que qualquer pessoa pode influir numa regra antes de ela valer. Saber o prazo, e se a consulta já foi decidida, evita
                  perder a janela ou tratar como pendente o que já virou norma.
                </>
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
                        rotulo="Recebendo contribuições"
                        natureza="CALCULADO"
                        evidencia={g.evidencias.consultas_abertas}
                        formato="num"
                        casas={0}
                        unidade="consultas e audiências"
                        periodo={`em ${dataRef}`}
                        cor="var(--cor-energia)"
                        endereco={`${rotaPainel("p046")}#p046`}
                        nota={`Contagem em ${dataRef}, a data de referência da publicação.`}
                      />
                    ) : (
                      <Numero
                        variante="faixa"
                        rotulo="Recebendo contribuições"
                        natureza="CALCULADO"
                        valor={null}
                        motivoAusencia="As atas da Diretoria não foram integradas nesta publicação, por isso a contagem fica sem valor."
                      />
                    )
                  }
                  ondeContribuir={
                    <p data-onde-contribuir="">
                      <span className="font-medium text-carvao">Onde contribuir.</span> As atas não trazem o endereço de cada consulta. A ANEEL recebe contribuições pelas
                      páginas oficiais de <RegulacaoLinkExterno href={PAGINAS_PARTICIPACAO.consultas}>consultas públicas</RegulacaoLinkExterno> e de{" "}
                      <RegulacaoLinkExterno href={PAGINAS_PARTICIPACAO.audiencias}>audiências públicas</RegulacaoLinkExterno>; procure pelo número da consulta.
                    </p>
                  }
                  legendaFigura={
                    <>
                      O gráfico e a tabela mostram as {C.itens.length} consultas e audiências {textoJanela(C.janela_dias)}
                      {totalHistorico ? `, de um histórico de ${totalHistorico}${anoHistorico ? ` desde ${anoHistorico}` : ""}` : ""}.
                      {csvHistorico && (
                        <>
                          {" "}
                          O histórico completo pode ser baixado em{" "}
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
                        <>
                          {inicioJanela
                            ? `consultas com janela encerrada, resultado ou fase deliberada de ${dataBR(inicioJanela)} a ${dataRef} (${C.janela_dias} dias)`
                            : `consultas com atividade recente até ${dataRef} (a publicação não informa a janela)`}
                          {`; histórico ${totalHistorico ? `de ${totalHistorico} consultas` : "completo (contagem não informada)"} desde ${dataBR(g.proveniencia.consultas.cobertura_historica.inicio)} no arquivo para baixar`}
                        </>
                      }
                      universo="Avisos de consulta e de audiência pública com abertura deliberada em reunião pública da Diretoria da ANEEL"
                      unidade="consulta ou audiência (contagem) e datas no calendário de Brasília"
                    />
                  }
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                />

                <SecaoDoPainel
                  id="agenda-curta"
                  titulo="O que a ANEEL prevê decidir?"
                  lead={
                    <>
                      A <Termo slug="agenda-regulatoria">Agenda Regulatória</Termo> é o plano de atividades em que a ANEEL prevê editar norma no biênio. As que tratam dos limites do
                      PLD (Preço de Liquidação das Diferenças) aparecem também na página de limites e regras de preço.
                    </>
                  }
                >
                  <RespostaCurta id="agenda" atributo="data-resposta-agenda" tamanho="sm" veredito={vereditoAgenda(A, limitesEmRevisao)}>
                    {respostaAgenda(A, limitesEmRevisao)}
                  </RespostaCurta>
                  {avisoRevisao && <RegulacaoAviso tipo="alerta">{avisoRevisao}</RegulacaoAviso>}
                  {A.disponivel ? (
                    agendaPainel.linhas.length > 0 && (
                      <>
                        <GraficoBarras
                          titulo="Atividades da agenda por painel relacionado e ano previsto"
                          dados={agendaPainel.linhas}
                          chaveCategoria="id"
                          chaveRotulo="rotulo"
                          series={agendaPainel.anos.map((a, i) => ({ id: a, rotulo: `Prevista para ${a}`, cor: SERIE_ANO[i % SERIE_ANO.length] }))}
                          unidade="atividades"
                          casas={0}
                          orientacao="horizontal"
                          empilhado
                          rotulosValor
                        />
                        <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                          Uma atividade pode estar ligada a mais de um painel, pelas palavras do texto dela; {agendaPainel.semPainel}{" "}
                          {agendaPainel.semPainel === 1 ? "atividade não se liga" : "atividades não se ligam"} a nenhum painel. A ligação indica onde a leitura pode mudar, não um efeito.
                        </p>
                      </>
                    )
                  ) : (
                    <RegulacaoAviso tipo="alerta">Agenda indisponível nesta publicação: {A.motivo ?? "motivo não informado"}.</RegulacaoAviso>
                  )}
                  <p className="text-sm">
                    <a href="#agenda" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                      Ver as atividades da agenda, uma a uma, em Analisar
                    </a>
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="agenda" nivel="analisar" titulo="Quais são as atividades da agenda e em que ano cada uma está prevista?">
                  {A.disponivel ? (
                    <>
                      <TabelaInterativa
                        titulo={`Atividades da ${agenda}`}
                        colunas={COLUNAS_AGENDA}
                        linhas={linhasAgenda(A.itens, limitesEmRevisao)}
                        chaveLinha="id"
                        colunaRotulo="codigo"
                        fonte={`ANEEL, ${A.versao ?? "Agenda Regulatória"}`}
                        versao={A.data_publicacao ?? C.data_referencia}
                        nomeArquivo="regulacao-agenda"
                        chaveUrl="ag"
                        dicaBusca="Código ou palavra da atividade"
                        nota={
                          <>
                            {A.portaria}, publicada no Diário Oficial da União (DOU) em {dataBR(A.data_publicacao ?? null)}.{" "}
                            {A.url_oficial && <RegulacaoLinkExterno href={A.url_oficial}>Endereço oficial</RegulacaoLinkExterno>}
                            {A.copia_publica && (
                              <>
                                {"; "}
                                <RegulacaoLinkExterno href={A.copia_publica}>cópia pública lida, conferida por sha256</RegulacaoLinkExterno>
                              </>
                            )}
                            .
                          </>
                        }
                      />
                      {A.regra_paineis && <p className="text-sm leading-relaxed text-carvao-muted">Regra dos painéis relacionados: {A.regra_paineis}.</p>}
                      {A.revisao.atualizada_por && !A.revisao.texto_lido && (
                        <RegulacaoAviso>
                          {A.revisao.tentativa
                            ? `Tentativa de ler o texto da atualização em ${carimbo(A.revisao.tentativa.tentado_em)}: ${A.revisao.tentativa.detalhe}.`
                            : "O texto da atualização não foi lido e nenhuma tentativa de leitura está registrada."}{" "}
                          Os anos previstos na tabela são os da versão original.
                        </RegulacaoAviso>
                      )}
                    </>
                  ) : (
                    <RegulacaoAviso tipo="alerta">Agenda indisponível nesta publicação: {A.motivo ?? "motivo não informado"}.</RegulacaoAviso>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel id="historico" nivel="analisar" titulo={`Em que situação estão ${totalHistorico ? `as ${totalHistorico} consultas` : "as consultas"} do histórico em ${dataRef}?`}>
                  <GraficoBarras
                    titulo={`Consultas e audiências ${anoHistorico ? `desde ${anoHistorico}` : "do histórico"}, por situação`}
                    dados={linhasHistoricoSituacao(C)}
                    chaveCategoria="id"
                    chaveRotulo="situacao"
                    series={[{ id: "n", rotulo: "Consultas", cor: "var(--cor-energia)" }]}
                    unidade="consultas"
                    casas={0}
                    orientacao="horizontal"
                    rotulosValor
                  />
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    Como o resultado das decididas e das em pauta foi reconhecido:{" "}
                    {formas.map(([f, n]) => `${num(n, 0)} por ${ROTULO_FORMA_RESULTADO[f] ?? f}`).join("; ")}. A contagem é da data de referência da publicação; a tabela
                    completa, com a fase atual e o resultado de cada uma, está no arquivo para baixar.
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="cobertura" nivel="auditar" titulo="Quantas consultas do ano as atas registram?">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-cobertura="">
                    {textoCoberturaFaixa(C)}
                  </p>
                  <GraficoPontos
                    titulo="Consultas públicas nas atas e total anual publicado pela ANEEL"
                    itens={cobCp}
                    unidade="consultas"
                    casas={0}
                    rotuloValor="Nas atas da Diretoria"
                    rotuloReferencia="Total anual publicado pela ANEEL"
                    unidadeDiferenca="consultas"
                    zeroNoEixo
                  />
                  <GraficoPontos
                    titulo="Audiências públicas nas atas e total anual publicado pela ANEEL"
                    itens={cobAp}
                    unidade="audiências"
                    casas={0}
                    rotuloValor="Nas atas da Diretoria"
                    rotuloReferencia="Total anual publicado pela ANEEL"
                    unidadeDiferenca="audiências"
                    zeroNoEixo
                  />
                  <RegulacaoAviso>
                    Em ano parcial, a contagem anual da ANEEL é anterior ao fim do ano e pode ficar abaixo do que as atas já registram.
                    {anosSoAudiencia.length
                      ? ` Em ${anosSoAudiencia.join(", ")} as atas não registram nenhum aviso como consulta pública e registram as audiências: naquele período os avisos aparecem como audiência.`
                      : ""}
                  </RegulacaoAviso>
                </SecaoDoPainel>

                <SecaoDoPainel id="regra-situacao" nivel="auditar" titulo="Qual regra define a situação e como a contagem é controlada?">
                  {C.regra_situacao && <p className="text-sm leading-relaxed text-carvao-muted">{C.regra_situacao}</p>}
                  <ul className="space-y-1 text-sm text-carvao-muted">
                    {testes.map((t) => (
                      <li key={t.nome}>
                        <span className="text-carvao">{t.nome}</span>: {t.resultado}. {t.detalhe}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    {typeof C.numeros_suspeitos === "number" ? num(C.numeros_suspeitos, 0) : "Um número não informado de"} consultas do histórico têm o número da ata marcado
                    como suspeito (o rótulo usa o número que o próprio processo cita, quando único) e{" "}
                    {typeof C.atos_suspeitos === "number" ? num(C.atos_suspeitos, 0) : "um número não informado de"} resultados têm número de ato fora da faixa do tipo,
                    exibidos sem ato.
                    {C.convencao_contagem_prazo
                      ? ` Das ${C.convencao_contagem_prazo.casos} decisões que escrevem as duas datas e a duração, ${C.convencao_contagem_prazo.inclusiva} contam o dia do início, ${C.convencao_contagem_prazo.exclusiva} não contam e ${C.convencao_contagem_prazo.outra} divergem por mais de um dia; o fim calculado usa a primeira convenção.`
                      : ""}
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
