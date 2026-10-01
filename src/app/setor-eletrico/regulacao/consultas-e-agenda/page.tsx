import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { Numero } from "@/components/energia/Numero";
import { RegulacaoConsultas } from "@/components/energia/RegulacaoConsultas";
import {
  RegulacaoAnalise,
  RegulacaoAuditoria,
  RegulacaoAviso,
  RegulacaoIndisponivel,
  RegulacaoLeitura,
  RegulacaoLinkExterno,
  RegulacaoNavegacao,
  RegulacaoRecorte,
  RegulacaoSeguir,
} from "@/components/energia/RegulacaoPagina";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
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
  textoCoberturaFaixa,
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

  return (
    <>
      <CabecalhoEnergia atual="regulacao" />
      <MarcaVisita secao="energia:regulacao" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo
          rotulo="Regulação"
          titulo="Consultas públicas e agenda da ANEEL"
          referencia={
            <>
              ANEEL, atas da Diretoria (arquivo gerado em {dataBR(C.atas_geradas_em ?? null)}) e {agenda}; data de referência {dataBR(C.data_referencia)};
              processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          Que decisões da ANEEL estão abertas a contribuições, quais já fecharam e esperam resultado e o que a agência prevê decidir. O período de cada consulta é lido na
          decisão registrada em ata, e a situação é recalculada no dia em que você lê a página.
        </CabecalhoModulo>
        <RegulacaoNavegacao atual="p046" />
        <ModoProfundidade>
          <Bloco id="consultas">
            <PainelEvidencia
              id="p046"
              pergunta={perguntaPainel("p046")}
              subtitulo="Consultas e audiências públicas com período, situação e resultado; Agenda Regulatória · contagem e datas"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  Uma consulta aberta é a janela em que qualquer pessoa pode influir numa regra antes de ela valer. Saber o prazo, e se a consulta já foi decidida, evita
                  perder a janela ou tratar como pendente o que já virou norma.
                </>
              }
              oQueMudou={
                <>
                  Esta publicação traz os resultados deliberados até a reunião de {dataBR(C.atas_deliberadas_ate ?? null)} e a pauta de {dataBR(C.atas_ate ?? null)}
                  {semResultadoFormal === 0
                    ? ", sem decisão de abertura pendente de resultado formal."
                    : `, com ${semResultadoFormal} ${semResultadoFormal === 1 ? "decisão de abertura ainda sem resultado formal, contada" : "decisões de abertura ainda sem resultado formal, contadas"} à parte.`}
                </>
              }
              comoInterpretar={
                <>
                  Cada faixa vai do início ao fim das contribuições escritos na ata; a linha tracejada vertical é a data de leitura. O traço e a cor de cada situação estão
                  na legenda acima do gráfico, e a situação também está escrita na dica e na tabela. Fim calculado do início e da duração tem a marca final vazada.
                </>
              }
              naoConcluir={
                <>
                  A contagem de abertas não mede a atividade regulatória inteira: só entram consultas deliberadas em reunião pública registrada. Encerrada sem resultado não
                  quer dizer esquecida: a decisão pode ter saído depois do último arquivo das atas. O ano da agenda é previsão da ANEEL.
                </>
              }
              proveniencia={g.proveniencia.consultas}
              complementares={[{ rotulo: agenda, p: g.proveniencia.agenda }]}
            >
              <div className="space-y-6">
                <RegulacaoRecorte
                  periodo={
                    <>
                      {inicioJanela
                        ? `consultas com janela encerrada, resultado ou fase deliberada de ${dataBR(inicioJanela)} a ${dataBR(C.data_referencia)} (${C.janela_dias} dias)`
                        : `consultas com atividade recente até ${dataBR(C.data_referencia)} (a publicação não informa a janela)`}
                      {`; histórico ${totalHistorico ? `de ${totalHistorico} consultas` : "completo (contagem não informada)"} desde ${dataBR(g.proveniencia.consultas.cobertura_historica.inicio)} no CSV`}
                    </>
                  }
                  universo="Avisos de consulta e de audiência pública com abertura deliberada em reunião pública da Diretoria da ANEEL"
                  unidade="consulta ou audiência (contagem) e datas no calendário de Brasília"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  {g.evidencias.consultas_abertas ? (
                    <Numero
                      rotulo={`Consultas e audiências recebendo contribuições em ${dataBR(C.data_referencia)}`}
                      natureza="CALCULADO"
                      evidencia={g.evidencias.consultas_abertas}
                      formato="num"
                      casas={0}
                      tamanho="medio"
                      cor="var(--cor-energia)"
                      endereco={`${rotaPainel("p046")}#p046`}
                      nota="Data de referência da publicação; abaixo, a situação recalculada para hoje."
                    />
                  ) : (
                    <Numero rotulo="Consultas recebendo contribuições" natureza="CALCULADO" valor={null} motivoAusencia="as atas não foram integradas nesta publicação" />
                  )}
                  <div className="border border-linha bg-superficie p-5 text-sm text-carvao-muted">
                    <p className="rotulo text-mineral">Onde contribuir</p>
                    <p className="mt-2 leading-relaxed">
                      As atas não trazem o endereço de cada consulta. A ANEEL recebe contribuições pelas páginas oficiais de{" "}
                      <RegulacaoLinkExterno href={PAGINAS_PARTICIPACAO.consultas}>consultas públicas</RegulacaoLinkExterno> e de{" "}
                      <RegulacaoLinkExterno href={PAGINAS_PARTICIPACAO.audiencias}>audiências públicas</RegulacaoLinkExterno>; procure pelo número da consulta.
                    </p>
                  </div>
                </div>

                <RegulacaoConsultas consultas={C} dataServidor={dataServidor} fonte={fonte} versao={C.data_referencia} inicioHistorico={anoHistorico} />

                <RegulacaoLeitura
                  comoLer={
                    <>
                      As caixas de situação filtram o gráfico e a tabela ao mesmo tempo; o número entre parênteses conta as consultas de cada situação na data de leitura.
                      Escolha uma consulta no gráfico ou na tabela para ver as fases, o trecho da ata de onde o período foi lido e o resultado.
                    </>
                  }
                  naoPermite={
                    <>
                      Não permite saber o conteúdo das contribuições nem o que a ANEEL mudou por causa delas. Consultas sem datas na ata (só a duração ou só a sessão da
                      audiência) não têm situação derivável e nunca aparecem como abertas.
                    </>
                  }
                />

                <RegulacaoAnalise id="agenda" titulo="Agenda Regulatória: o que a ANEEL prevê decidir">
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    A <Termo slug="agenda-regulatoria">Agenda Regulatória</Termo> lista as atividades em que a ANEEL prevê editar norma no biênio.
                  </p>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-resposta-agenda="">
                    {respostaAgenda(A, g.limites_em_revisao)}
                  </p>
                  {A.disponivel ? (
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
                      <p className="text-xs text-carvao-muted">
                        Uma atividade pode estar ligada a mais de um painel, por palavra-chave do texto; {agendaPainel.semPainel}{" "}
                        {agendaPainel.semPainel === 1 ? "atividade não se liga" : "atividades não se ligam"} a nenhum painel. Regra: {A.regra_paineis}.
                      </p>
                      <TabelaInterativa
                        titulo={`Atividades da ${agenda}`}
                        colunas={COLUNAS_AGENDA}
                        linhas={linhasAgenda(A.itens, g.limites_em_revisao)}
                        chaveLinha="id"
                        colunaRotulo="codigo"
                        fonte={`ANEEL, ${A.versao ?? "Agenda Regulatória"}`}
                        versao={A.data_publicacao ?? C.data_referencia}
                        nomeArquivo="regulacao-agenda"
                        chaveUrl="ag"
                        dicaBusca="Código ou palavra da atividade"
                        nota={
                          <>
                            {A.portaria}, publicada no DOU em {dataBR(A.data_publicacao ?? null)}.{" "}
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
                      {A.revisao.atualizada_por && !A.revisao.texto_lido && (
                        <RegulacaoAviso tipo="alerta">
                          A página oficial da agenda diz que ela foi {A.revisao.trecho ?? `atualizada pela ${A.revisao.atualizada_por}`}. O texto dessa revisão não pôde ser lido
                          {A.revisao.tentativa ? ` (tentativa em ${carimbo(A.revisao.tentativa.tentado_em)}: ${A.revisao.tentativa.detalhe})` : ""}; os anos previstos acima são os
                          da versão original e podem ter mudado.
                        </RegulacaoAviso>
                      )}
                    </>
                  ) : (
                    <RegulacaoAviso tipo="alerta">Agenda indisponível nesta publicação: {A.motivo ?? "motivo não informado"}.</RegulacaoAviso>
                  )}
                </RegulacaoAnalise>

                <RegulacaoAnalise id="historico" titulo={`Situação ${totalHistorico ? `das ${totalHistorico} consultas` : "das consultas"} do histórico em ${dataBR(C.data_referencia)}`}>
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
                    completa, com a fase atual e o resultado de cada uma, está no CSV do painel.
                  </p>
                </RegulacaoAnalise>

                <RegulacaoAuditoria id="cobertura" titulo="Cobertura: quantas consultas do ano as atas registram">
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
                </RegulacaoAuditoria>

                <RegulacaoAuditoria id="regra-situacao" titulo="Regra da situação e controles da contagem">
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
                </RegulacaoAuditoria>

                <RegulacaoSeguir ancora="p046" proximo={{ href: proximo.rota, pergunta: proximo.pergunta }} downloads={downloadsDoPainel(g, "p046")} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
