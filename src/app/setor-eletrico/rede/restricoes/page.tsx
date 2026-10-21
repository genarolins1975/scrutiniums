import type { Metadata, ResolvingMetadata } from "next";
import type { ReactNode } from "react";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { RedeAviso, RedeCapitulos, RedeDatas, RedeDicionarios, RedeDocumentos, RedeIndisponivel, RedeNavegacao, RedeRegras, RedeSeguir } from "@/components/energia/RedePagina";
import { RedeRestricoes } from "@/components/energia/RedeRestricoes";
import { ParaLer } from "@/components/energia/Didatica";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, mesAno, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { UNIDADE_ATLS_EN, rotuloDaGold } from "@/lib/energia/i18n/agua-carga-rede";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { colunasBusca, linhasBuscaLimites, medidasRestricoes, mesesEntre, perguntaPainel, provenienciaLegivel, rotaPainel, rotulosRegra, situacaoAtualidade } from "@/lib/energia/rede";
import type { GoldRedeDetalhe } from "@/lib/energia/tipos-rede";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/rede/restricoes", {
    title: tx("Rede: evidência publicada de limitação", "Grid: published evidence of limitation"),
    description: tx(
      "Horas em que fluxos sistêmicos ficaram acima do limite estabelecido (indicador ATLS do ONS), cortes de carga e energia não suprida por ano e por perturbação, e a busca documentada pelos limites operativos de intercâmbio, que não são públicos.",
      "Hours in which system flows were above the established limit (ONS ATLS indicator), load cuts and energy not supplied by year and by disturbance, and the documented search for the operating interchange limits, which are not public.",
    ),
    alternates: { canonical: "/setor-eletrico/rede/restricoes" },
  }, anterior);
}

export default function RedeRestricoesPage() {
  const g = lerGold<GoldRedeDetalhe>("rede_detalhe.json");
  if (!integra(g)) return <RedeIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const idioma = idiomaEnergia();
  const ROTULO_REGRA = rotulosRegra(idioma);
  const r = g.restricoes;
  const a6 = g.achados.A06;
  const ev = g.evidencias;
  const atual = situacaoAtualidade(g.referencia.dia, g.gerado_em);
  const versao = g.referencia.dia;
  const downloads = g.downloads.filter((d) => /atls|interrupcoes/.test(d.url));
  const evAtls = Object.fromEntries(Object.entries(ev).filter(([k]) => k.startsWith("atls_12m.")));
  // o ATLS é mensal: defasagem medida em meses entre o último mês publicado e o mês do processamento
  const mesProc = g.gerado_em.slice(0, 7);
  const defasagemAtls = r.atls.ultimo_mes ? mesesEntre(r.atls.ultimo_mes, mesProc) : null;
  // regras de contagem citadas do documento (trechos conferidos no arquivo), nunca reescritas à mão
  const trechosSubmodulo = r.documentos.ons_submodulo_9_1.trechos.filter((t) => t.confere && t.id !== "atls_definicao").map((t) => t.texto);
  const citacoes = trechosSubmodulo.map((t) => `“${t}”`).join("; ");
  // glossário: as duas regras de contagem pelos trechos conferidos do mesmo documento
  const trechoDe = (id: string) => r.documentos.ons_submodulo_9_1.trechos.find((t) => t.id === id && t.confere)?.texto ?? null;
  const trecho10 = trechoDe("atls_10min");
  const trechoBanda = trechoDe("atls_banda_morta");
  // a faixa lê o mesmo arquivo do ATLS do gráfico de barras, da tabela e da exportação
  const m = medidasRestricoes(r);
  const fichaMaisHoras = m.maisHoras ? (ev[`atls_12m.${m.maisHoras.fluxo}`] ?? null) : null;
  const u12 = r.interrupcoes.ultimos_12_meses;
  const periodo12 = tx(`${dataBR(u12.inicio)} a ${dataBR(u12.fim)}`, `${dataBR(u12.inicio)} to ${dataBR(u12.fim)}`);
  const oQueMudou = (
    <>
      {atual.texto}{" "}
      {defasagemAtls !== null
        ? tx(
            `O ATLS é mensal: o último mês publicado (${mesAno(r.atls.ultimo_mes!)}) está ${defasagemAtls === 1 ? "um mês" : `${defasagemAtls} meses`} antes do mês do processamento.`,
            `The ATLS is monthly: the last month published (${mesAno(r.atls.ultimo_mes!)}) is ${defasagemAtls === 1 ? "one month" : `${defasagemAtls} months`} before the processing month.`,
          )
        : tx("O arquivo do ATLS não trouxe mês publicado.", "The ATLS file did not include a published month.")}
    </>
  );
  const comoInterpretar = tx(
    <>
      O ONS publica o ATLS como fração do tempo dentro da faixa e as horas fora dela; o painel soma as horas dos 12 meses publicados mais recentes. Pelo Submódulo 9.1 dos
      Procedimentos de Rede: {citacoes}. As siglas dos fluxos são do ONS; a definição aparece só quando conferida em documento público.
    </>,
    <>
      ONS publishes the ATLS as the fraction of time within the band and the hours outside it; the panel adds up the hours of the 12 most recent published months. Under{" "}
      <Nome>Submódulo 9.1 dos Procedimentos de Rede</Nome>: <TrechoPortugues regiao="trechos do Submódulo 9.1">{citacoes}</TrechoPortugues>. The flow codes are ONS
      codes; the definition appears only when checked in a public document.
    </>,
  );
  const naoConcluir = tx(
    <>
      Quanto de cada fronteira estava ocupado: nenhum percentual de utilização é calculado, e capacidade nominal de linha não substitui limite de transferência entre regiões. O
      ATLS não diz o valor do limite nem a folga; um corte de carga não prova limite de intercâmbio.
    </>,
    <>
      How much of each boundary was in use: no utilization percentage is calculated, and nominal line capacity does not replace a transfer limit between regions. The ATLS
      does not state the value of the limit or the margin; a load cut does not prove an interchange limit.
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="rede" />
      <MarcaVisita secao="energia:rede" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["SIN", "ONS", "CCEE", "ATLS"]}
          rotulo={tx("Rede · Restrições publicadas", "Grid · Published restrictions")}
          titulo={perguntaPainel("p030")}
          lead={tx<ReactNode>(
            "Horas em que fluxos acompanhados pelo ONS ficaram acima do limite estabelecido (indicador ATLS, Atendimento aos Limites Sistêmicos) e cortes de carga.",
            <>
              Hours in which flows tracked by ONS were above the established limit (ATLS indicator, <Nome>Atendimento aos Limites Sistêmicos</Nome>, compliance with system limits)
              and load cuts.
            </>,
          )}
          recorte={tx(
            `${m.fluxosAcima ? `ATLS de ${m.fluxosAcima.periodo}` : "ATLS"} · cortes de carga de ${dataBR(u12.inicio)} a ${dataBR(u12.fim)} · horas e MWh`,
            `${m.fluxosAcima ? `ATLS from ${m.fluxosAcima.periodo}` : "ATLS"} · load cuts from ${dataBR(u12.inicio)} to ${dataBR(u12.fim)} · hours and MWh`,
          )}
          fonte={tx("ONS, ATLS e Interrupção de Carga", "ONS, ATLS and Load Interruption")}
          referencia={tx(
            <>
              ONS, indicador ATLS até {r.atls.ultimo_mes ? mesAno(r.atls.ultimo_mes) : "sem dado"} e interrupções de carga até {dataBR(r.interrupcoes.fim)}; processado em{" "}
              {carimbo(g.gerado_em)}.
            </>,
            <>
              ONS, ATLS indicator through {r.atls.ultimo_mes ? mesAno(r.atls.ultimo_mes) : "no data"} and load interruptions through {dataBR(r.interrupcoes.fim)}; processed on{" "}
              {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <RedeDatas
              itens={[
                {
                  rotulo: tx("Indicador ATLS (mensal)", "ATLS indicator (monthly)"),
                  texto: r.atls.ultimo_mes ? tx(`até ${mesAno(r.atls.ultimo_mes)}`, `through ${mesAno(r.atls.ultimo_mes)}`) : null,
                  natureza: g.proveniencia.atls.natureza,
                },
                {
                  rotulo: tx("Cortes de carga", "Load cuts"),
                  texto: tx(`até ${dataBR(r.interrupcoes.fim)}`, `through ${dataBR(r.interrupcoes.fim)}`),
                  natureza: g.proveniencia.interrupcoes.natureza,
                },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={3}
              rotulo={tx("Fluxos acima do limite em 12 meses e energia não suprida em cortes de carga", "Flows above the limit in 12 months and energy not supplied in load cuts")}
              nota={tx(
                "Horas acima do limite e cortes de carga são as evidências públicas de limitação; nenhum percentual de utilização é calculado: os limites operativos de cada fronteira não são públicos.",
                "Hours above the limit and load cuts are the public evidence of limitation; no utilization percentage is calculated: the operating limits of each boundary are not public.",
              )}
            >
              {m.fluxosAcima && (
                <Numero
                  variante="faixa"
                  rotulo={tx("Fluxos acompanhados que passaram algum tempo acima do limite em 12 meses", "Tracked flows that spent some time above the limit in 12 months")}
                  natureza="CALCULADO"
                  valor={m.fluxosAcima.valor}
                  formato="num"
                  casas={0}
                  unidade={tx(`de ${m.fluxosAcima.de} fluxos`, `of ${m.fluxosAcima.de} flows`)}
                  periodo={m.fluxosAcima.periodo}
                  cor="var(--cor-energia)"
                  nota={tx("Fluxos publicados no último mês do arquivo do ATLS.", "Flows published in the last month of the ATLS file.")}
                />
              )}
              {m.maisHoras && (
                <Numero
                  variante="faixa"
                  rotulo={tx(`Mais horas acima do limite em 12 meses: ${m.maisHoras.nome}`, `Most hours above the limit in 12 months: ${m.maisHoras.nome}`)}
                  natureza="CALCULADO"
                  valor={fichaMaisHoras ? undefined : m.maisHoras.horas}
                  evidencia={fichaMaisHoras}
                  casas={1}
                  unidade="h"
                  periodo={m.maisHoras.periodo}
                  cor="var(--cor-energia)"
                  nota={tx(`Sigla do ONS: ${m.maisHoras.fluxo}.`, `ONS code: ${m.maisHoras.fluxo}.`)}
                  endereco={`${rotaPainel("p030")}#p030`}
                />
              )}
              <Numero
                variante="faixa"
                rotulo={tx("Energia não suprida em cortes de carga, 12 meses", "Energy not supplied in load cuts, 12 months")}
                natureza="CALCULADO"
                evidencia={ev.ens_12m ?? null}
                casas={1}
                periodo={periodo12}
                cor="var(--serie-5)"
                nota={tx(
                  `${num(u12.registros, 0)} registros de corte em ${num(u12.perturbacoes, 0)} perturbações (uma perturbação pode ter mais de um registro).`,
                  `${num(u12.registros, 0)} cut records in ${num(u12.perturbacoes, 0)} disturbances (one disturbance can have more than one record).`,
                )}
                endereco={`${rotaPainel("p030")}#p030`}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              Os limites operativos de intercâmbio e as suas vigências não são públicos em formato que permita compará-los com o fluxo de cada hora; por isso este painel não diz
              se uma fronteira estava no limite. Ele mostra a evidência de limitação que o ONS publica: o tempo em que fluxos acompanhados pelo indicador{" "}
              <Termo slug="atls">ATLS</Termo> (Atendimento aos Limites Sistêmicos) ficaram acima do limite estabelecido, e os cortes de carga, que são registros de interrupção do
              atendimento, com a energia não suprida, isto é, a que deixou de ser entregue.
            </>,
            <>
              The operating interchange limits and their validity periods are not public in a format that allows comparing them with the flow of each hour; that is why this panel
              does not say whether a boundary was at its limit. It shows the evidence of limitation that ONS publishes: the time in which flows tracked by the{" "}
              <Termo slug="atls">ATLS</Termo> indicator (<Nome>Atendimento aos Limites Sistêmicos</Nome>) were above the established limit, and the load cuts, which are records of
              supply interruption, with the energy not supplied, that is, the energy that was not delivered.
            </>,
          )}
        </CabecalhoModulo>
        <RedeNavegacao atual="p030" />
        <ParaLer
          id="para-ler-restricoes"
          itens={[
            {
              termo: tx("Fluxo acompanhado e limite", "Monitored flow and limit"),
              definicao: tx(
                "O ONS escolhe alguns fluxos importantes para a segurança da rede (por exemplo, quanto a região Sul recebe) e define, em estudos, a faixa em que cada um pode operar com segurança. As siglas dos fluxos (RSUL, FBTA e outras) são do ONS.",
                "ONS picks some flows that matter for grid security (for example, how much the South region receives) and sets, in studies, the range in which each can operate safely. The flow codes (RSUL, FBTA and others) are ONS codes.",
              ),
            },
            {
              termo: <Termo slug="atls">ATLS</Termo>,
              definicao: tx(
                <>
                  Atendimento aos Limites Sistêmicos: a parte do tempo em que cada fluxo ficou dentro da faixa. A página mostra o outro lado, as horas fora dela, somadas em 12 meses.
                  {trecho10 ? <> Pelo Submódulo 9.1 do ONS: &ldquo;{trecho10}&rdquo;</> : null}
                </>,
                <>
                  Compliance with System Limits (ATLS): the share of time each flow stayed within its range. The page shows the other side, the hours outside it, added up over 12
                  months.
                  {trecho10 ? (
                    <>
                      {" "}
                      Under ONS <Nome>Submódulo 9.1</Nome>: &ldquo;<TrechoPortugues regiao="trecho do Submódulo 9.1">{trecho10}</TrechoPortugues>&rdquo;
                    </>
                  ) : null}
                </>,
              ),
            },
            ...(trechoBanda
              ? [
                  {
                    termo: tx("Banda morta", "Dead band"),
                    definicao: tx(
                      <>Uma folga acima do limite que o ONS não conta como violação: &ldquo;{trechoBanda}&rdquo;.</>,
                      <>
                        A margin above the limit that ONS does not count as a violation: &ldquo;<TrechoPortugues regiao="trecho do Submódulo 9.1">{trechoBanda}</TrechoPortugues>&rdquo;.
                      </>,
                    ),
                  },
                ]
              : []),
            {
              termo: tx("Corte de carga e perturbação", "Load cut and disturbance"),
              definicao: tx(
                "Perturbação é um defeito ou desligamento na rede. Às vezes ela obriga a cortar o fornecimento de uma parte dos consumidores: é o corte de carga. Uma perturbação pode ter mais de um registro de corte.",
                "A disturbance is a fault or outage on the grid. Sometimes it forces supply to part of the consumers to be cut: that is a load cut. One disturbance can have more than one cut record.",
              ),
            },
            {
              termo: tx("Energia não suprida", "Energy not supplied"),
              definicao: tx(
                "A energia que os consumidores deixaram de receber durante os cortes, em MWh.",
                "The energy consumers did not receive during the cuts, in MWh.",
              ),
              exemplo: tx(
                `De ${dataBR(u12.inicio)} a ${dataBR(u12.fim)}: ${num(u12.ens_mwh, 1)} MWh em ${num(u12.registros, 0)} registros de corte de ${num(u12.perturbacoes, 0)} perturbações.`,
                `From ${dataBR(u12.inicio)} to ${dataBR(u12.fim)}: ${num(u12.ens_mwh, 1)} MWh in ${num(u12.registros, 0)} cut records from ${num(u12.perturbacoes, 0)} disturbances.`,
              ),
            },
            {
              termo: tx("Limite de intercâmbio", "Interchange limit"),
              definicao: tx(
                "Quanto pode passar entre duas regiões, valor que muda com a rede ligada. Não é público em dados abertos, e a capacidade de uma linha não o substitui; por isso nenhum percentual de uso da rede é calculado.",
                "How much can pass between two regions, a value that changes with the grid in service. It is not public as open data, and a line's capacity does not replace it; that is why no grid usage percentage is calculated.",
              ),
            },
          ]}
        />
        <ModoProfundidade>
          <Bloco id="restricoes">
            <PainelEvidencia
              id="p030"
              pergunta={tx("Horas acima do limite e cortes de carga publicados", "Hours above the limit and published load cuts")}
              subtitulo={tx(
                "Horas acima do limite sistêmico (ATLS, Atendimento aos Limites Sistêmicos) e cortes de carga · horas e MWh",
                "Hours above the system limit (ATLS, compliance with system limits) and load cuts · hours and MWh",
              )}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>
                  O <Termo slug="atls">ATLS</Termo> mede, mês a mês, quanto tempo cada fluxo acompanhado pelo ONS passou fora da faixa de segurança recomendada; o corte de carga
                  mede energia que deixou de chegar ao consumidor. São as evidências públicas de limitação que existem sem os limites de cada fronteira.
                </>,
                <>
                  The <Termo slug="atls">ATLS</Termo> measures, month by month, how much time each flow tracked by ONS spent outside the recommended safety band; the load cut
                  measures energy that did not reach the consumer. They are the public evidence of limitation that exists without the limits of each boundary.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={provenienciaLegivel(g.proveniencia.atls)}
              complementares={[{ rotulo: tx("Interrupções de carga e energia não suprida", "Load interruptions and energy not supplied"), p: provenienciaLegivel(g.proveniencia.interrupcoes) }]}
            >
              <div className="space-y-6">
                {atual.defasada && <RedeAviso tipo="alerta">{atual.texto}</RedeAviso>}
                <RedeRestricoes
                  restricoes={{ atls: r.atls, interrupcoes: r.interrupcoes }}
                  evidencias={evAtls}
                  titulosDocumentos={Object.fromEntries(Object.entries(r.documentos).map(([k, d]) => [k, d.titulo]))}
                  criterioCorte={g.achados.dicionarios.ons_rede_interrupcao_carga?.trechos.find((t) => t.id === "criterio" && t.confere)?.texto ?? null}
                  fonteAtls={tx("ONS, Indicadores de confiabilidade da rede básica: ATLS", "ONS, Basic grid reliability indicators: ATLS")}
                  fonteInterrupcoes={tx("ONS, Interrupção de Carga", "ONS, Load Interruption")}
                  versao={versao}
                  limites={
                    <div className="space-y-2 border border-dashed border-linha p-4">
                      <p className="rotulo text-mineral">{tx("Limites operativos de intercâmbio: sem fonte aberta", "Operating interchange limits: no open source")}</p>
                      <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
                        <TrechoPortugues regiao="conclusão da busca pelos limites">{r.limites.conclusao}</TrechoPortugues>
                      </p>
                    </div>
                  }
                  limitesDetalhe={
                    <div data-nivel="analisar" className="space-y-3 border-l-2 border-linha pl-4">
                      <p className="text-sm text-carvao-muted">
                        {tx("Estado da verificação dos limites operativos", "Status of the operating limits check")}:{" "}
                        <TrechoPortugues regiao="estado do achado A06">{a6.status}</TrechoPortugues>.
                      </p>
                      <TabelaInterativa
                        titulo={tx("Onde os limites foram procurados e o que se encontrou", "Where the limits were searched for and what was found")}
                        colunas={colunasBusca(idioma)}
                        linhas={linhasBuscaLimites(r.limites.busca)}
                        chaveLinha="id"
                        colunaRotulo="onde"
                        fonte={tx("Busca do observatório em fontes públicas do ONS e da CCEE", "Observatory search in public ONS and CCEE sources")}
                        versao={versao}
                        nomeArquivo="rede-busca-limites"
                        chaveUrl="bl"
                      />
                    </div>
                  }
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  aposPrincipal={<RedeCapitulos atual="p030" />}
                />

                <SecaoDoPainel id="documentos" nivel="auditar" titulo={tx("Documentos públicos do ONS: trechos conferidos", "Public ONS documents: checked excerpts")}>
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        Direitos reservados ao ONS: só trechos citados, cada um conferido literalmente no arquivo baixado. O limite citado no relatório técnico depende da
                        configuração da rede e não é série com vigência; por isso não é comparado com o fluxo de nenhuma hora.
                      </>,
                      <>
                        Rights reserved to ONS: only quoted excerpts, each checked word for word in the downloaded file. The limit cited in the technical report depends on the grid
                        configuration and is not a series with validity periods; that is why it is not compared with the flow of any hour.
                      </>,
                    )}
                  </p>
                  <RedeDocumentos documentos={[r.documentos.ons_submodulo_9_1, r.documentos.ons_pel_2019_2020, r.documentos.ons_rt_dpl_0131_2023]} />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="dicionarios-restricoes"
                  nivel="auditar"
                  titulo={tx("Dicionários de dados: ATLS, interrupções e intercâmbio", "Data dictionaries: ATLS, interruptions and interchange")}
                >
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        Unidade do ATLS lida no arquivo: {r.atls.unidade_publicada} (maior valor lido {num(r.atls.maior_valor_lido, 3)}, menor {num(r.atls.menor_valor_lido, 3)}). O
                        painel usa as horas acima do limite, que não dependem dessa leitura.
                      </>,
                      <>
                        ATLS unit read in the file: {rotuloDaGold(UNIDADE_ATLS_EN, r.atls.unidade_publicada, "en")} (largest value read {num(r.atls.maior_valor_lido, 3)}, smallest{" "}
                        {num(r.atls.menor_valor_lido, 3)}). The panel uses the hours above the limit, which do not depend on this reading.
                      </>,
                    )}
                  </p>
                  <RedeDicionarios
                    dicionarios={[g.achados.dicionarios.ons_rede_atls, g.achados.dicionarios.ons_rede_interrupcao_carga, g.achados.dicionarios.ons_rede_intercambio_nacional].filter(Boolean)}
                  />
                  {a6.trecho_dicionario && (
                    <p className="text-sm text-carvao-muted">
                      {tx(
                        <>
                          O dicionário do conjunto de intercâmbio remete a relação das linhas de transmissão de fronteira ao &ldquo;{a6.trecho_dicionario.texto}&rdquo; (
                          {a6.trecho_dicionario.confere ? "trecho conferido" : "trecho não conferido"}), no Portal SINtegre do ONS, de acesso autenticado; nenhum conjunto aberto traz os
                          limites com vigência.
                        </>,
                        <>
                          The interchange dataset dictionary refers the list of boundary transmission lines to &ldquo;
                          <TrechoPortugues regiao="trecho do dicionário de intercâmbio">{a6.trecho_dicionario.texto}</TrechoPortugues>&rdquo; (
                          {a6.trecho_dicionario.confere ? "excerpt checked" : "excerpt not checked"}), on the ONS <Nome>Portal SINtegre</Nome>, with authenticated access; no open
                          dataset has the limits with validity periods.
                        </>,
                      )}
                    </p>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel id="metodologia-a06" nivel="auditar" titulo={tx("Nota de revisão sobre a página de metodologia", "Revision note on the methodology page")}>
                  <p className="text-sm text-carvao-muted">
                    <TrechoPortugues regiao="correção da metodologia (achado A06)">{a6.correcao_metodologia}</TrechoPortugues>
                  </p>
                  <RedeRegras regras={[{ rotulo: ROTULO_REGRA.limites, texto: g.regras.limites }]} />
                </SecaoDoPainel>

                <RedeSeguir ancora="p030" proximo={{ href: `${rotaPainel("p031")}#p031`, pergunta: perguntaPainel("p031") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
