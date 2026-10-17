import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { ExpansaoCarteiraUf } from "@/components/energia/ExpansaoCarteira";
import { ExpansaoMapaUsinas } from "@/components/energia/ExpansaoMapas";
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
  tamanhoPublicado,
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
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { ESTAGIO_EN, OUTORGA_SIGA_EN, rotuloDado } from "@/lib/energia/i18n/expansao-transicao-territorio";
import {
  colunasCoortes,
  colunasEncerramentos,
  colunasEstagiosTipo,
  colunasJustificativas,
  colunasObraViabilidade,
  COR_DESFECHO,
  DESFECHOS,
  DOWNLOADS_PAINEL,
  FONTE_ATOS,
  FONTE_LIBERACOES,
  FONTE_RALIE,
  FONTE_SIGA,
  fonteExpansao,
  nomeTipo,
  notaEtapas,
  rotuloDesfecho,
  dadosHistoricoCarteira,
  dataTexto,
  downloadsDe,
  inteiro,
  linhasCarteiraUf,
  linhasCoortes,
  linhasEncerramentos,
  linhasEstagios,
  linhasEstagiosTipo,
  linhasJustificativas,
  linhasObraViabilidade,
  marcosAtipicos,
  mesTexto,
  metricasEtapas,
  mudancaCarteira,
  mwTexto,
  notaEtapa,
  notaRalieSiga,
  numTexto,
  painel,
  pctTexto,
  estagio,
  respostaCarteira,
  semNomeDeCampo,
  vereditoCarteira,
  type MetricaEtapa,
  provenienciasDoLeitor,
} from "@/lib/energia/expansao";
import type { ExpansaoGold } from "@/lib/energia/tipos-expansao";
import { datasLegiveis } from "@/lib/energia/visao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/expansao/carteira", {
    title: tx("Carteira de projetos de geração: outorgado, em construção, em operação e encerrado", "Generation project portfolio: granted, under construction, in operation and terminated"),
    description: tx(
      "Usinas do SIGA por estágio (outorgado sem obra, em construção, em operação), carteira do RALIE por situação da obra e viabilidade, desfecho das usinas acompanhadas desde a primeira fotografia do RALIE e outorgas revogadas ou extintas, por tipo e UF, com mapa e tabelas.",
      "SIGA plants by stage (granted with no construction, under construction, in operation), the RALIE portfolio by construction status and feasibility, the outcome of the plants monitored since the first RALIE snapshot and grants revoked or extinguished, by type and state, with a map and tables.",
    ),
    alternates: { canonical: "/setor-eletrico/expansao/carteira" },
  }, anterior);
}

const URL_PONTOS = "/energia/series/expansao_usinas_pontos.json";

/** Cor de identificação de cada etapa na faixa de métricas (a mesma do gráfico por UF); nunca é cor de texto. */
const COR_ETAPA: Record<string, string> = {
  operacao: "var(--cor-mineral)",
  construcao: "var(--cor-energia)", // i18n: dado
  construcao_nao_iniciada: "var(--serie-comp-3)",
};

export default function CarteiraPage() {
  const g = lerGold<ExpansaoGold>("expansao.json");
  if (!integra(g)) return <ExpansaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const e = g.estagios;
  const r = e.ralie;
  const enc = e.encerramentos;
  const p = provenienciasDoLeitor(g);
  const ev = g.evidencias;
  const pp = painel("p040");
  const hist = dadosHistoricoCarteira(e.historico_mensal);
  const atip = e.unidades_atipicas;
  const rec = g.capacidade_instalada.reconciliacao;
  const etapas = metricasEtapas(g);
  const dataSiga = dataTexto(e.data_referencia);
  const evidenciaDe = (m: MetricaEtapa) => (m.id === "operacao" ? ev.capacidade_total : m.id === "construcao_nao_iniciada" ? ev.outorgado_sem_obra : undefined);
  const oQueMudou = mudancaCarteira(g);
  // i18n: dado ("ausente do SIGA" é o valor da gold)
  const ausenteDoSiga = (situacao: string) => situacao === "ausente do SIGA";
  const semDesfecho = e.sem_desfecho_no_siga
    .map((s) =>
      tx(
        `${inteiro(s.usinas)} ${ausenteDoSiga(s.situacao_siga) ? "estão fora do arquivo aberto do SIGA" : `estão na fase ${s.situacao_siga} do SIGA`} (${mwTexto(s.mw_outorgado)} outorgados)`,
        `${inteiro(s.usinas)} ${ausenteDoSiga(s.situacao_siga) ? "are outside the SIGA open file" : `are in the SIGA phase ${rotuloDado(s.situacao_siga, ESTAGIO_EN, "en")}`} (${mwTexto(s.mw_outorgado)} granted)`,
      ),
    )
    .join("; ");
  const paresTipo = enc.tipo_do_ato_diferente_do_cadastro.pares
    .map((x) =>
      tx(
        `${x.tipo_no_ato} no ato e ${x.tipo_no_cadastro} no SIGA (${x.outorga_no_siga ?? "outorga sem dado"}), ${inteiro(x.atos)}`,
        `${x.tipo_no_ato} in the act and ${x.tipo_no_cadastro} in the SIGA (${x.outorga_no_siga ? rotuloDado(x.outorga_no_siga, OUTORGA_SIGA_EN, "en") : "grant: no data"}), ${inteiro(x.atos)}`,
      ),
    )
    .join("; ");
  const comoInterpretar = tx(
    <>
      Estágio é a fase da usina no SIGA na data do arquivo; as três fases são disjuntas. A carteira do RALIE é o acompanhamento da fiscalização das usinas em implantação, com a situação da
      obra e a viabilidade atribuídas pela ANEEL. O desfecho de cada coorte pondera as usinas pela potência das unidades em implantação na primeira fotografia, limitada à outorga.{" "}
      {g.regras.outorga}
    </>,
    <>
      Stage is the plant&apos;s phase in the SIGA on the file date; the three phases are disjoint. The RALIE portfolio is the inspection&apos;s monitoring of the plants under
      implementation, with the construction status and feasibility assigned by ANEEL. The outcome of each cohort weights the plants by the capacity of the units under implementation in the
      first snapshot, capped at the grant. <TrechoPortugues regiao="expansao-regra-outorga">{g.regras.outorga}</TrechoPortugues>
    </>,
  );
  const naoConcluir = tx(
    <>
      Quanto da carteira vai entrar, nem quando: o desfecho das coortes passadas descreve o que aconteceu com elas, não é probabilidade para a carteira atual. Também não permite somar a
      carteira ao parque em operação como capacidade futura, nem converter MW em energia.
    </>,
    <>
      How much of the portfolio will come online, or when: the outcome of past cohorts describes what happened to them, it is not a probability for the current portfolio. Nor does it allow
      adding the portfolio to the fleet in operation as future capacity, or converting MW into energy.
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="expansao" />
      <MarcaVisita secao="energia:expansao-carteira" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <ExpansaoNavegacao atual="p040" />
        <CabecalhoModulo
          siglas={["RALIE", "SIGA", "CEG", "ANEEL", "IBGE"]}
          rotulo={tx("Expansão", "Expansion")}
          titulo={pp.pergunta}
          lead={tx(
            "Acompanhe as usinas desde a autorização até a operação, em megawatts (MW) de potência. O cadastro de geração (SIGA) mostra as etapas; a fiscalização da ANEEL (RALIE) permite acompanhar as obras e seu desfecho.",
            "Follow the plants from authorization to operation, in megawatts (MW) of capacity. The generation register (SIGA) shows the stages; ANEEL's inspection (RALIE) makes it possible to follow the construction works and their outcome.",
          )}
          recorte={tx(`SIGA de ${dataSiga} · RALIE de ${dataTexto(r.data_ralie)} · MW`, `SIGA of ${dataSiga} · RALIE of ${dataTexto(r.data_ralie)} · MW`)}
          fonte={tx("ANEEL, SIGA, RALIE e atos de outorga", "ANEEL, SIGA, RALIE and grant acts")}
          referencia={tx(
            <>
              SIGA da ANEEL de {dataTexto(g.referencias.siga)}; RALIE na fotografia de {dataTexto(g.referencias.ralie)}, com histórico desde {dataTexto(g.referencias.ralie_historico_desde)}; atos de outorga até{" "}
              {dataTexto(g.referencias.atos)}; liberações comerciais até {dataTexto(g.referencias.liberacoes_ultima_data)}. Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              ANEEL&apos;s SIGA of {dataTexto(g.referencias.siga)}; RALIE in the snapshot of {dataTexto(g.referencias.ralie)}, with history since {dataTexto(g.referencias.ralie_historico_desde)}; grant acts
              through {dataTexto(g.referencias.atos)}; commercial releases through {dataTexto(g.referencias.liberacoes_ultima_data)}. Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <ExpansaoDatas
              itens={[
                { rotulo: "SIGA", texto: tx(`até ${dataSiga}`, `through ${dataSiga}`), natureza: "OBSERVADO" },
                {
                  rotulo: "RALIE",
                  texto: tx(
                    `fotografia de ${dataTexto(g.referencias.ralie)}, histórico desde ${dataTexto(g.referencias.ralie_historico_desde)}`,
                    `snapshot of ${dataTexto(g.referencias.ralie)}, history since ${dataTexto(g.referencias.ralie_historico_desde)}`,
                  ),
                  natureza: "OBSERVADO",
                },
                { rotulo: tx("Atos de outorga", "Grant acts"), texto: tx(`até ${dataTexto(g.referencias.atos)}`, `through ${dataTexto(g.referencias.atos)}`), natureza: "OBSERVADO" },
                {
                  rotulo: tx("Liberações comerciais", "Commercial releases"),
                  texto: tx(`até ${dataTexto(g.referencias.liberacoes_ultima_data)}`, `through ${dataTexto(g.referencias.liberacoes_ultima_data)}`),
                  natureza: "OBSERVADO",
                },
              ]}
            />
          }
          metricas={
            <FaixaMetricas colunas={5} rotulo={tx("Indicadores da carteira", "Portfolio indicators")} nota={notaEtapas()}>
              {etapas.map((m) => (
                <Numero
                  key={m.id}
                  variante="faixa"
                  rotulo={m.rotulo}
                  natureza="CALCULADO"
                  valor={m.mw}
                  evidencia={evidenciaDe(m) ?? null}
                  formato="num"
                  casas={1}
                  unidade="MW"
                  periodo={tx(`SIGA de ${dataSiga}`, `SIGA of ${dataSiga}`)}
                  cor={COR_ETAPA[m.id]}
                  nota={notaEtapa(m)}
                  motivoAusencia={tx("Sem a soma do SIGA nesta publicação.", "No SIGA total in this release.")}
                  endereco="/setor-eletrico/expansao/carteira#p040"
                />
              ))}
              <Numero
                variante="faixa"
                rotulo={tx("Unidades em implantação no RALIE", "Units under implementation in the RALIE")}
                natureza="CALCULADO"
                evidencia={ev.ralie_em_implantacao ?? null}
                casas={1}
                unidade="MW"
                periodo={tx(`RALIE de ${dataTexto(r.data_ralie)}`, `RALIE of ${dataTexto(r.data_ralie)}`)}
                cor="var(--serie-referencia)"
                nota={tx("Unidades geradoras, não usinas.", "Generating units, not plants.")}
                motivoAusencia={tx("Sem a fotografia do RALIE nesta publicação.", "No RALIE snapshot in this release.")}
                endereco="/setor-eletrico/expansao/carteira#p040"
              />
              <Numero
                variante="faixa"
                rotulo={tx(`Em operação, da carteira de ${dataTexto(g.referencias.ralie_historico_desde)}`, `In operation, of the portfolio of ${dataTexto(g.referencias.ralie_historico_desde)}`)}
                natureza="CALCULADO"
                evidencia={ev.coorte_inicial_operacao ?? null}
                formato="pct"
                casas={1}
                unidade={tx("da potência", "of capacity")}
                periodo={tx(`até ${dataTexto(g.referencias.ralie)}`, `through ${dataTexto(g.referencias.ralie)}`)}
                cor="var(--serie-comp-4)"
                nota={tx("Coorte da primeira fotografia do RALIE.", "Cohort of the first RALIE snapshot.")}
                motivoAusencia={tx("Sem o desfecho das coortes nesta publicação.", "No cohort outcome in this release.")}
                endereco="/setor-eletrico/expansao/carteira#p040"
              />
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              O que está outorgado, o que está em obra, o que já opera e o que teve a outorga revogada ou extinta. Outorga não é obra, e obra não é entrada certa; o desfecho das usinas
              acompanhadas pelo RALIE desde {dataTexto(g.referencias.ralie_historico_desde)} aparece ao lado da carteira.
            </>,
            <>
              What is granted, what is under construction, what already operates and what had its grant revoked or extinguished. A grant is not construction, and construction is not a
              guaranteed entry; the outcome of the plants monitored by the RALIE since {dataTexto(g.referencias.ralie_historico_desde)} appears next to the portfolio.
            </>,
          )}
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="carteira">
            <PainelEvidencia
              id="p040"
              pergunta={tx("Etapas: quanto está outorgado, em obra e em operação", "Stages: how much is granted, under construction and in operation")}
              subtitulo={tx(
                "Usinas e potência por estágio do SIGA, carteira do RALIE e desfecho das usinas acompanhadas · MW",
                "Plants and capacity by SIGA stage, RALIE portfolio and outcome of the monitored plants · MW",
              )}
              porQueImporta={tx(
                <>
                  A carteira mostra o que pode vir a operar e onde. Lida como capacidade certa, ela superestima a expansão: parte das outorgas é revogada antes da obra, e potência
                  instalada em MW não é energia entregue nem garantia física.
                </>,
                <>
                  The portfolio shows what may come to operate and where. Read as certain capacity, it overstates the expansion: some grants are revoked before construction, and installed
                  capacity in MW is not delivered energy or physical guarantee.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={p.estagios}
              complementares={[
                { rotulo: tx("Carteira do RALIE", "RALIE portfolio"), p: p.ralie },
                { rotulo: tx("Desfecho das coortes", "Cohort outcomes"), p: p.coortes },
                { rotulo: tx("Outorgas encerradas", "Terminated grants"), p: p.encerramentos },
                { rotulo: tx("Capacidade em operação", "Capacity in operation"), p: p.capacidade },
              ]}
            >
              <div className="space-y-6">
                {estagio(g, "operacao") && (
                  <ExpansaoNota>
                    {tx(
                      <>
                        Em operação aparecem dois valores, de medidas diferentes: o cartão mostra a potência fiscalizada ({mwTexto(estagio(g, "operacao")?.mw_fiscalizado)}) e o gráfico, a outorgada ({mwTexto(estagio(g, "operacao")?.mw_outorgado)}),
                        a mesma das outras duas fases.
                      </>,
                      <>
                        In operation there are two values, of different measures: the card shows inspected capacity ({mwTexto(estagio(g, "operacao")?.mw_fiscalizado)}) and the chart, granted capacity (
                        {mwTexto(estagio(g, "operacao")?.mw_outorgado)}), the same as the other two phases.
                      </>,
                    )}
                  </ExpansaoNota>
                )}
                <GraficoBarras
                  titulo={tx(`Usinas do SIGA por estágio, ${dataSiga} (MW outorgado)`, `SIGA plants by stage, ${dataSiga} (granted MW)`)}
                  dados={linhasEstagios(g)}
                  chaveCategoria="id"
                  chaveRotulo="rotulo"
                  series={[{ id: "mw_outorgado", rotulo: tx("Potência outorgada", "Granted capacity"), cor: "var(--cor-energia)" }]} // i18n: dado
                  unidade="MW"
                  casas={1}
                  orientacao="horizontal"
                  rotulosValor
                />
                {/* a faixa de cima já traz os números das etapas; a resposta vem depois da figura para que ela comece na primeira tela */}
                <RespostaCurta id="p040" depois veredito={vereditoCarteira(g) || respostaCarteira(g)}>
                  {respostaCarteira(g)}
                </RespostaCurta>
                <ExpansaoNota>{notaRalieSiga(g)}</ExpansaoNota>
                <ExpansaoNota>
                  {tx(
                    <>
                      A mesma medida nas três fases (potência outorgada) para que as etapas se comparem; a potência fiscalizada, que só existe para o que opera, está na tabela do gráfico. A
                      fase não é um funil com entrada garantida: desde {enc.desde}, {inteiro(enc.total.atos)} atos revogaram ou extinguiram outorgas de {inteiro(enc.total.usinas)} usinas (
                      {mwTexto(enc.total.mw_usinas)}).
                    </>,
                    <>
                      The same measure in the three phases (granted capacity) so that the stages can be compared; inspected capacity, which only exists for what operates, is in the chart&apos;s
                      table. The phase is not a funnel with guaranteed entry: since {enc.desde}, {inteiro(enc.total.atos)} acts revoked or extinguished the grants of {inteiro(enc.total.usinas)}{" "}
                      plants ({mwTexto(enc.total.mw_usinas)}).
                    </>,
                  )}
                </ExpansaoNota>
                <ExpansaoRecorte
                  periodo={tx(
                    <>
                      SIGA de {dataSiga}; RALIE de {dataTexto(r.data_ralie)}; desfechos de {dataTexto(g.referencias.ralie_historico_desde)} a {dataTexto(g.referencias.ralie)}
                    </>,
                    <>
                      SIGA of {dataSiga}; RALIE of {dataTexto(r.data_ralie)}; outcomes from {dataTexto(g.referencias.ralie_historico_desde)} to {dataTexto(g.referencias.ralie)}
                    </>,
                  )}
                  universo={tx(
                    <>
                      Usinas do SIGA nas fases Operação, Construção e Construção não iniciada; {inteiro(r.usinas)} usinas e {inteiro(r.ugs)} unidades geradoras no RALIE
                    </>,
                    <>
                      SIGA plants in the Operation, Construction and Construction not started phases; {inteiro(r.usinas)} plants and {inteiro(r.ugs)} generating units in the RALIE
                    </>,
                  )}
                  unidade={tx(
                    "MW de potência (outorgada para a carteira, fiscalizada para a operação); não é energia",
                    "MW of capacity (granted for the portfolio, inspected for operation); it is not energy",
                  )}
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <SecaoDoPainel id="coortes" titulo={tx("O que aconteceu com a potência que estava em implantação?", "What happened to the capacity that was under implementation?")}>
                  <GraficoBarras
                    titulo={tx(
                      `Desfecho das usinas acompanhadas pelo RALIE, por coorte, até ${dataTexto(g.referencias.ralie)} (% da potência em implantação na primeira fotografia)`,
                      `Outcome of the plants monitored by the RALIE, by cohort, through ${dataTexto(g.referencias.ralie)} (% of capacity under implementation in the first snapshot)`,
                    )}
                    dados={linhasCoortes(g)}
                    chaveCategoria="id"
                    chaveRotulo="rotulo"
                    series={DESFECHOS.map((d) => ({ id: `pct_${d}`, rotulo: rotuloDesfecho(d), cor: COR_DESFECHO[d] }))}
                    unidade="%"
                    casas={1}
                    orientacao="horizontal"
                    empilhado
                    rotulosValor
                  />
                  <ExpansaoNota>
                    {tx(
                      <>
                        Coorte é o grupo de usinas que entrou no acompanhamento do RALIE no mesmo ano; a primeira é o estoque da primeira fotografia. Coortes recentes tiveram menos tempo para chegar à operação e têm parcela maior em implantação: compare coortes de idade parecida. Percentuais
                        arredondados a uma casa; a soma de cada barra pode diferir de 100 por arredondamento. Das usinas que saíram sem desfecho,{" "}
                        {semDesfecho}.
                      </>,
                      <>
                        A cohort is the group of plants that entered RALIE monitoring in the same year; the first is the stock of the first snapshot. Recent cohorts have had less time to reach
                        operation and have a larger share under implementation: compare cohorts of similar age. Percentages rounded to one decimal place; the sum of each bar may differ from 100 due to
                        rounding. Of the plants that left with no outcome,{" "}
                        {semDesfecho}.
                      </>,
                    )}
                  </ExpansaoNota>
                  <TabelaInterativa
                    titulo={tx("Desfecho por coorte, com as potências que formam cada parcela", "Outcome by cohort, with the capacities that make up each share")}
                    colunas={colunasCoortes()}
                    linhas={linhasCoortes(g)}
                    chaveLinha="id"
                    colunaRotulo="rotulo"
                    fonte={`${fonteExpansao(FONTE_RALIE)}; ${fonteExpansao(FONTE_LIBERACOES)}; ${fonteExpansao(FONTE_ATOS)}`}
                    versao={g.referencias.ralie}
                    nomeArquivo="expansao-desfecho-coortes"
                    chaveUrl="car.coo"
                    nota={<TrechoPortugues regiao="expansao-coortes-regra">{semNomeDeCampo(e.coortes_peso.regra)}</TrechoPortugues>}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="onde-esta" titulo={tx("Onde está a carteira?", "Where is the portfolio?")}>
                  <ExpansaoCarteiraUf
                    linhas={linhasCarteiraUf(g)}
                    data={dataSiga}
                    dataRalie={dataTexto(r.data_ralie)}
                    fonte={`${fonteExpansao(FONTE_SIGA)}; ${fonteExpansao(FONTE_RALIE)}`}
                    multiestaduais={tx(
                      `${inteiro(g.capacidade_instalada.multiestaduais.usinas)} usinas multiestaduais em operação, ${mwTexto(g.capacidade_instalada.multiestaduais.mw_fiscalizado)}`,
                      `${inteiro(g.capacidade_instalada.multiestaduais.usinas)} multi-state plants in operation, ${mwTexto(g.capacidade_instalada.multiestaduais.mw_fiscalizado)}`,
                    )}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="fontes" titulo={tx("De que fontes é a carteira?", "Which sources make up the portfolio?")}>
                  <GraficoBarras
                    titulo={tx(`Carteira do SIGA por tipo de geração, ${dataSiga} (MW outorgado)`, `SIGA portfolio by generation type, ${dataSiga} (granted MW)`)}
                    dados={linhasEstagiosTipo(g)}
                    chaveCategoria="id"
                    chaveRotulo="nome"
                    series={[
                      { id: "nao_iniciada_mw", rotulo: tx("Outorgado, construção não iniciada", "Granted, construction not started"), cor: "var(--serie-comp-3)" },
                      { id: "construcao_mw", rotulo: tx("Em construção", "Under construction"), cor: "var(--cor-energia)" }, // i18n: dado
                    ]}
                    unidade="MW"
                    casas={1}
                    orientacao="horizontal"
                    rotulosValor
                  />
                  <ExpansaoNota>
                    {tx(
                      "As duas etapas aparecem lado a lado, cada uma na sua barra e sem total: são usinas diferentes na mesma medida (MW outorgado). A operação por tipo, também em potência outorgada, está na tabela do modo Analisar; a potência fiscalizada por tipo está no CSV de capacidade em operação.",
                      "The two stages appear side by side, each in its own bar and without a total: they are different plants in the same measure (granted MW). Operation by type, also in granted capacity, is in the Analyze mode table; inspected capacity by type is in the CSV of capacity in operation.",
                    )}
                  </ExpansaoNota>
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="historico"
                  titulo={tx(`Como a carteira mudou desde ${mesTexto(g.referencias.ralie_historico_desde)}?`, `How has the portfolio changed since ${mesTexto(g.referencias.ralie_historico_desde)}?`)}
                >
                  <GraficoLinhas
                    titulo={tx(
                      `Carteira do RALIE na última fotografia de cada mês, ${mesTexto(hist[0]?.ralie)} a ${mesTexto(hist.at(-1)?.ralie)} (MW)`,
                      `RALIE portfolio in the last snapshot of each month, ${mesTexto(hist[0]?.ralie)} to ${mesTexto(hist.at(-1)?.ralie)} (MW)`,
                    )}
                    dados={hist}
                    chaveX="ralie"
                    formatoX="data"
                    series={[
                      { id: "mw_outorgado", rotulo: tx("Potência outorgada das usinas", "Granted capacity of the plants"), sigla: tx("Outorgada", "Granted"), cor: "var(--cor-mineral)", tracejada: true },
                      { id: "mw_ugs", rotulo: tx("Unidades em implantação", "Units under implementation"), sigla: tx("Unidades", "Units"), cor: "var(--cor-energia)" }, // i18n: dado
                      {
                        id: "mw_ugs_sem_previsao",
                        rotulo: tx("Unidades sem previsão da fiscalização", "Units without an inspection forecast"),
                        sigla: tx("Sem previsão", "No forecast"),
                        cor: "var(--serie-comp-3)",
                      },
                    ]}
                    marcos={marcosAtipicos(e.historico_mensal)}
                    unidade="MW"
                    casas={1}
                    zeroNoEixo
                    zoom
                    legendaInterativa
                  />
                  <GraficoLinhas
                    titulo={tx(
                      `Carteira do RALIE por situação da obra, ${mesTexto(hist[0]?.ralie)} a ${mesTexto(hist.at(-1)?.ralie)} (MW outorgado)`,
                      `RALIE portfolio by construction status, ${mesTexto(hist[0]?.ralie)} to ${mesTexto(hist.at(-1)?.ralie)} (granted MW)`,
                    )}
                    dados={hist}
                    chaveX="ralie"
                    formatoX="data"
                    series={[
                      { id: "obra_nao_iniciada", rotulo: tx("Obra não iniciada", "Construction not started"), sigla: tx("Não iniciada", "Not started"), cor: "var(--serie-comp-3)" },
                      { id: "obra_em_andamento", rotulo: tx("Obra em andamento", "Construction in progress"), sigla: tx("Em andamento", "In progress"), cor: "var(--cor-energia)" }, // i18n: dado
                      { id: "obra_paralisada", rotulo: tx("Obra paralisada", "Construction halted"), sigla: tx("Paralisada", "Halted"), cor: "var(--escala-div-neg-1)", tracejada: true },
                    ]}
                    unidade="MW"
                    casas={1}
                    zeroNoEixo
                    zoom
                    legendaInterativa
                  />
                  <ExpansaoNota>
                    {atip.pares > 0
                      ? tx(
                          `Nas fotografias marcadas, unidades de usinas com potência fora de escala no arquivo histórico (soma de ${numTexto(atip.fator, 0)} vezes a outorga ou mais) foram excluídas dos campos por unidade; a potência outorgada das usinas fica. `,
                          `In the marked snapshots, units of plants with out-of-scale capacity in the historical file (sum of ${numTexto(atip.fator, 0)} times the grant or more) were excluded from the per-unit fields; the plants' granted capacity stays. `,
                        )
                      : ""}
                    {tx("Fotografias com intervalo irregular: a série usa a última de cada mês.", "Snapshots at irregular intervals: the series uses the last one of each month.")}
                  </ExpansaoNota>
                </SecaoDoPainel>

                <SecaoDoPainel id="encerramentos" titulo={tx("Quanta potência teve a outorga revogada ou extinta, ano a ano?", "How much capacity had its grant revoked or extinguished, year by year?")}>
                  <GraficoBarras
                    titulo={tx(
                      `Potência das usinas com outorga revogada ou extinta, por ano de publicação do ato, ${enc.desde} a ${dataTexto(g.referencias.atos)} (MW)`,
                      `Capacity of the plants whose grant was revoked or extinguished, by year of publication of the act, ${enc.desde} to ${dataTexto(g.referencias.atos)} (MW)`,
                    )}
                    dados={linhasEncerramentos(enc.por_ano)}
                    chaveCategoria="id"
                    chaveRotulo="ano" // i18n: dado
                    series={[{ id: "mw_usinas", rotulo: tx("Potência das usinas (uma vez por usina)", "Capacity of the plants (once per plant)"), cor: "var(--escala-div-neg-1)" }]}
                    unidade="MW"
                    casas={1}
                  />
                  <TabelaInterativa
                    titulo={tx("Atos de encerramento por ano", "Termination acts by year")}
                    colunas={colunasEncerramentos()}
                    linhas={linhasEncerramentos(enc.por_ano)}
                    chaveLinha="id"
                    colunaRotulo="ano" // i18n: dado
                    fonte={fonteExpansao(FONTE_ATOS)}
                    versao={g.referencias.atos ?? g.referencias.siga}
                    nomeArquivo="expansao-encerramentos-ano"
                    chaveUrl="car.enc"
                    nota={tx(
                      <>{`Ano parcial marcado. Atos sem data de publicação na fonte (${inteiro(enc.sem_data_publicacao.atos)}, ${mwTexto(enc.sem_data_publicacao.mw_usinas)}) ficam fora da série anual e entram no total. Outorga encerrada não é usina retirada: ${enc.usinas_em_operacao_no_siga.nota}`}</>,
                      <>
                        Partial year marked. Acts without a publication date in the source ({inteiro(enc.sem_data_publicacao.atos)}, {mwTexto(enc.sem_data_publicacao.mw_usinas)}) are left out of the
                        annual series and enter the total. A terminated grant is not a retired plant:{" "}
                        <TrechoPortugues regiao="expansao-encerramento-nota">{enc.usinas_em_operacao_no_siga.nota}</TrechoPortugues>
                      </>,
                    )}
                  />
                  <p data-nivel="analisar" className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    <TrechoPortugues regiao="expansao-regra-tipo">{enc.regra_tipo}</TrechoPortugues>
                  </p>
                </SecaoDoPainel>

                <ExpansaoAnalise titulo={tx("Carteira do RALIE: situação da obra e viabilidade", "RALIE portfolio: construction status and feasibility")} id="ralie">
                  <GraficoBarras
                    titulo={tx(
                      `Unidades em implantação por situação da obra e viabilidade, fotografia de ${dataTexto(r.data_ralie)} (MW)`,
                      `Units under implementation by construction status and feasibility, snapshot of ${dataTexto(r.data_ralie)} (MW)`,
                    )}
                    dados={linhasObraViabilidade(g)}
                    chaveCategoria="id"
                    chaveRotulo="obra"
                    series={[
                      { id: "alta", rotulo: tx("Viabilidade alta", "High feasibility"), cor: "var(--escala-seq-5)" },
                      { id: "media", rotulo: tx("Viabilidade média", "Medium feasibility"), cor: "var(--escala-seq-3)" },
                      { id: "baixa", rotulo: tx("Viabilidade baixa", "Low feasibility"), cor: "var(--escala-seq-1)" },
                    ]}
                    unidade="MW"
                    casas={1}
                    orientacao="horizontal"
                    empilhado
                    rotulosValor
                  />
                  <ExpansaoNota>
                    {tx(
                      <>
                        Viabilidade é a classificação da fiscalização da ANEEL. {inteiro(r.leilao.usinas_com_compromisso)} usinas ({mwTexto(r.leilao.mw_outorgado_com_compromisso)} outorgados) têm
                        compromisso de venda em leilão; {inteiro(r.leilao.usinas_sem_compromisso)} não têm. Fase no SIGA das usinas do RALIE:{" "}
                        {r.fase_no_siga.map((f) => `${f.fase} ${inteiro(f.usinas)}`).join("; ")}.
                      </>,
                      <>
                        Feasibility is the classification by ANEEL&apos;s inspection. {inteiro(r.leilao.usinas_com_compromisso)} plants ({mwTexto(r.leilao.mw_outorgado_com_compromisso)} granted) have
                        an auction sale commitment; {inteiro(r.leilao.usinas_sem_compromisso)} do not. SIGA phase of the RALIE plants:{" "}
                        {r.fase_no_siga.map((f) => `${rotuloDado(f.fase, ESTAGIO_EN, "en")} ${inteiro(f.usinas)}`).join("; ")}.
                      </>,
                    )}
                  </ExpansaoNota>
                  <GraficoBarras
                    titulo={tx(
                      `Por que a previsão está como está: justificativa da fiscalização, fotografia de ${dataTexto(r.data_ralie)} (MW das unidades)`,
                      `Why the forecast is what it is: the inspection's reason, snapshot of ${dataTexto(r.data_ralie)} (MW of the units)`,
                    )}
                    dados={linhasJustificativas(g)}
                    chaveCategoria="id"
                    chaveRotulo="justificativa"
                    series={[{ id: "mw", rotulo: tx("Unidades em implantação", "Units under implementation"), cor: "var(--cor-energia)" }]} // i18n: dado
                    unidade="MW"
                    casas={1}
                    orientacao="horizontal"
                    rotulosValor
                  />
                  <TabelaInterativa
                    titulo={tx(`Situação da obra e viabilidade, ${dataTexto(r.data_ralie)}`, `Construction status and feasibility, ${dataTexto(r.data_ralie)}`)}
                    colunas={colunasObraViabilidade()}
                    linhas={linhasObraViabilidade(g)}
                    chaveLinha="id"
                    colunaRotulo="obra"
                    fonte={fonteExpansao(FONTE_RALIE)}
                    versao={r.data_ralie}
                    nomeArquivo="expansao-ralie-obra-viabilidade"
                    chaveUrl="car.obr"
                    nota={tx(
                      "Combinação de obra e viabilidade sem usina é zero observado: o cruzamento cobre todas as usinas do RALIE.",
                      "A combination of construction and feasibility with no plant is an observed zero: the cross-tabulation covers every RALIE plant.",
                    )}
                  />
                  <TabelaInterativa
                    titulo={tx(`Justificativas da previsão, ${dataTexto(r.data_ralie)}`, `Reasons for the forecast, ${dataTexto(r.data_ralie)}`)}
                    colunas={colunasJustificativas()}
                    linhas={linhasJustificativas(g)}
                    chaveLinha="id"
                    colunaRotulo="justificativa"
                    fonte={fonteExpansao(FONTE_RALIE)}
                    versao={r.data_ralie}
                    nomeArquivo="expansao-ralie-justificativas"
                    chaveUrl="car.jus"
                  />
                </ExpansaoAnalise>

                <ExpansaoAnalise titulo={tx("Carteira e operação por tipo de geração", "Portfolio and operation by generation type")} id="por-tipo">
                  <TabelaInterativa
                    titulo={tx(`Carteira e operação por tipo de geração (SIGA de ${dataSiga})`, `Portfolio and operation by generation type (SIGA of ${dataSiga})`)}
                    colunas={colunasEstagiosTipo()}
                    linhas={linhasEstagiosTipo(g)}
                    chaveLinha="id"
                    colunaRotulo="nome"
                    fonte={fonteExpansao(FONTE_SIGA)}
                    versao={g.referencias.siga}
                    nomeArquivo="expansao-estagios-tipo"
                    chaveUrl="car.tip"
                    ordemInicial={{ coluna: "construcao_mw", direcao: "desc" }}
                    nota={tx(
                      "As três etapas na mesma medida (MW outorgado), cada uma em colunas próprias e sem total. A potência fiscalizada da operação por tipo está no CSV de capacidade em operação.",
                      "The three stages in the same measure (granted MW), each in its own columns and without a total. Inspected capacity of operation by type is in the CSV of capacity in operation.",
                    )}
                  />
                </ExpansaoAnalise>

                <ExpansaoAnalise titulo={tx("Mapa das usinas", "Map of the plants")} id="mapa-usinas">
                  <ExpansaoMapaUsinas url={URL_PONTOS} tamanho={tamanhoPublicado(URL_PONTOS)} dataSiga={dataSiga} fonte={fonteExpansao(FONTE_SIGA)} />
                </ExpansaoAnalise>

                <ExpansaoAuditoria titulo={tx("Regras, conferências e ressalvas", "Rules, checks and caveats")} id="auditoria-carteira">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    <li>
                      <TrechoPortugues regiao="expansao-regra-estagio">{datasLegiveis(g.regras.estagio, "pt")}</TrechoPortugues>
                    </li>
                    <li>
                      <TrechoPortugues regiao="expansao-regra-encerramentos">{datasLegiveis(g.regras.encerramentos, "pt")}</TrechoPortugues>
                    </li>
                    <li>
                      <TrechoPortugues regiao="expansao-regra-potencia">{datasLegiveis(g.regras.potencia, "pt")}</TrechoPortugues>
                    </li>
                  </ul>
                  <ExpansaoTabelaSimples
                    titulo={tx(
                      `Reconciliação do SIGA com o agregado oficial "empreendimentos em operação" (${mesTexto(rec.referencia_tipo)}), por tipo`,
                      `Reconciliation of the SIGA with the official aggregate "projects in operation" (${mesTexto(rec.referencia_tipo)}), by type`,
                    )}
                    cabecalho={tx(
                      ["Tipo", "SIGA (MW)", "Agregado (MW)", "Liberado no intervalo (MW)", "Resíduo (MW)", "Resíduo (%)"],
                      ["Type", "SIGA (MW)", "Aggregate (MW)", "Released in the interval (MW)", "Residual (MW)", "Residual (%)"],
                    )}
                    linhas={rec.por_tipo.map((t) => [t.tipo, numTexto(t.siga_mw, 1), numTexto(t.agregado_mw, 1), numTexto(t.liberado_no_intervalo_mw, 1), numTexto(t.residuo_mw, 1), pctTexto(t.residuo_pct, 2)])}
                  />
                  <ExpansaoNota>
                    {tx(
                      <>
                        Liberações descontadas de {dataTexto(rec.janela_tipo?.liberacoes_descontadas.inicio)} a {dataTexto(rec.janela_tipo?.liberacoes_descontadas.fim)}
                        {rec.janela_tipo?.sem_liberacoes_publicadas
                          ? `; de ${dataTexto(rec.janela_tipo.sem_liberacoes_publicadas.inicio)} a ${dataTexto(rec.janela_tipo.sem_liberacoes_publicadas.fim)} não há liberação publicada, e o que entrou fica no resíduo`
                          : ""}
                        . Tolerância: {rec.justificativa_tolerancia} Fora da tolerância: tipos {rec.fora_da_tolerancia.tipos.length ? rec.fora_da_tolerancia.tipos.join(", ") : "nenhum"}; UF{" "}
                        {rec.fora_da_tolerancia.ufs.length ? rec.fora_da_tolerancia.ufs.join(", ") : "nenhuma"}.
                      </>,
                      <>
                        Releases deducted from {dataTexto(rec.janela_tipo?.liberacoes_descontadas.inicio)} to {dataTexto(rec.janela_tipo?.liberacoes_descontadas.fim)}
                        {rec.janela_tipo?.sem_liberacoes_publicadas
                          ? `; from ${dataTexto(rec.janela_tipo.sem_liberacoes_publicadas.inicio)} to ${dataTexto(rec.janela_tipo.sem_liberacoes_publicadas.fim)} there is no published release, and what came online stays in the residual`
                          : ""}
                        . Tolerance: <TrechoPortugues regiao="expansao-tolerancia">{rec.justificativa_tolerancia}</TrechoPortugues> Outside the tolerance: types{" "}
                        {rec.fora_da_tolerancia.tipos.length ? rec.fora_da_tolerancia.tipos.join(", ") : "none"}; states {rec.fora_da_tolerancia.ufs.length ? rec.fora_da_tolerancia.ufs.join(", ") : "none"}.
                      </>,
                    )}
                  </ExpansaoNota>
                  <ExpansaoNota>
                    {tx(
                      <>
                        RALIE atual contra o Parquet histórico da mesma fotografia ({dataTexto(g.conferencias.ralie_csv_x_parquet.fotografia)}): {inteiro(g.conferencias.ralie_csv_x_parquet.ugs_iguais)} de{" "}
                        {inteiro(g.conferencias.ralie_csv_x_parquet.ugs_csv)} unidades iguais, {mwTexto(g.conferencias.ralie_csv_x_parquet.mw_csv, 3)} contra {mwTexto(g.conferencias.ralie_csv_x_parquet.mw_parquet, 3)};
                        resultado: {g.conferencias.ralie_csv_x_parquet.resultado}.
                      </>,
                      <>
                        Current RALIE against the historical Parquet file of the same snapshot ({dataTexto(g.conferencias.ralie_csv_x_parquet.fotografia)}):{" "}
                        {inteiro(g.conferencias.ralie_csv_x_parquet.ugs_iguais)} of {inteiro(g.conferencias.ralie_csv_x_parquet.ugs_csv)} units equal, {mwTexto(g.conferencias.ralie_csv_x_parquet.mw_csv, 3)}{" "}
                        against {mwTexto(g.conferencias.ralie_csv_x_parquet.mw_parquet, 3)}; result:{" "}
                        <TrechoPortugues regiao="expansao-conferencia-ralie">{g.conferencias.ralie_csv_x_parquet.resultado}</TrechoPortugues>.
                      </>,
                    )}
                  </ExpansaoNota>
                  <ExpansaoTabelaSimples
                    titulo={tx(
                      `Unidades fora de escala no Parquet histórico (soma das unidades ${numTexto(atip.fator, 0)} vezes a outorga ou mais), conferidas nas fotografias vizinhas`,
                      `Out-of-scale units in the historical Parquet file (sum of the units ${numTexto(atip.fator, 0)} times the grant or more), checked against the neighboring snapshots`,
                    )}
                    cabecalho={tx(
                      ["Usina", "Fotografia", "Unidades", "Soma das unidades (MW)", "Outorga (MW)", "Fotografia seguinte"],
                      ["Plant", "Snapshot", "Units", "Sum of the units (MW)", "Grant (MW)", "Next snapshot"],
                    )}
                    linhas={atip.casos.map((c) => [
                      <>
                        <Nome>{c.nome ?? c.nucleo}</Nome> ({c.tipo ? nomeTipo(c.tipo) : tx("tipo sem dado", "type: no data")})
                      </>,
                      `${dataTexto(c.ralie)}${c.fotografia_mensal ? tx(" (mensal)", " (monthly)") : ""}`,
                      inteiro(c.ugs),
                      numTexto(c.mw_ugs, 1),
                      numTexto(c.mw_outorgado, 1),
                      c.seguinte
                        ? tx(`${dataTexto(c.seguinte.ralie)}: ${inteiro(c.seguinte.ugs)} unidades, ${mwTexto(c.seguinte.mw_ugs, 2)}`, `${dataTexto(c.seguinte.ralie)}: ${inteiro(c.seguinte.ugs)} units, ${mwTexto(c.seguinte.mw_ugs, 2)}`)
                        : tx("sem fotografia seguinte", "no next snapshot"),
                    ])}
                  />
                  <ExpansaoNota>
                    <TrechoPortugues regiao="expansao-atipicas-regra">{atip.regra}</TrechoPortugues>
                  </ExpansaoNota>
                  <ExpansaoTabelaSimples
                    titulo={tx("Atos de encerramento com potência corrigida (kW no campo de MW) ou fora da soma", "Termination acts with corrected capacity (kW in the MW field) or left out of the sum")}
                    cabecalho={tx(
                      ["Usina", "Publicação", "Tipo no ato", "Tipo no SIGA", "MW no ato", "MW usado", "Motivo"],
                      ["Plant", "Publication", "Type in the act", "Type in the SIGA", "MW in the act", "MW used", "Reason"],
                    )}
                    linhas={[...enc.potencia_conferida.corrigidas_kw, ...enc.potencia_conferida.fora_da_soma].map((a) => [
                      <Nome key="n">{a.nome ?? a.chave}</Nome>,
                      dataTexto(a.publicacao),
                      a.tipo ?? tx("sem dado", "no data"),
                      a.tipo_no_cadastro ?? tx("fora do SIGA", "outside the SIGA"),
                      numTexto(a.mw_no_ato, 3),
                      a.mw_usado === null ? tx("fora da soma", "left out of the sum") : numTexto(a.mw_usado, 3),
                      a.motivo ? <TrechoPortugues regiao="expansao-motivo-ato">{a.motivo}</TrechoPortugues> : "",
                    ])}
                  />
                  <ExpansaoNota>
                    {tx(
                      <>
                        {enc.potencia_conferida.regra}. Repetições: {inteiro(enc.repeticoes.usinas_com_mais_de_um_ato)} usinas com mais de um ato; somar por ato repetiria{" "}
                        {mwTexto(enc.repeticoes.mw_que_a_soma_por_ato_repetiria)}. {enc.sem_chave_de_usina.nota} ({inteiro(enc.sem_chave_de_usina.atos)} atos, {mwTexto(enc.sem_chave_de_usina.mw_usado)}).
                        Tipo do ato diferente do tipo atual no SIGA em {inteiro(enc.tipo_do_ato_diferente_do_cadastro.atos)} atos:{" "}
                        {paresTipo}.
                      </>,
                      <>
                        <TrechoPortugues regiao="expansao-potencia-conferida">{enc.potencia_conferida.regra}</TrechoPortugues>. Repetitions: {inteiro(enc.repeticoes.usinas_com_mais_de_um_ato)}{" "}
                        plants with more than one act; adding by act would repeat {mwTexto(enc.repeticoes.mw_que_a_soma_por_ato_repetiria)}.{" "}
                        <TrechoPortugues regiao="expansao-sem-chave">{enc.sem_chave_de_usina.nota}</TrechoPortugues> ({inteiro(enc.sem_chave_de_usina.atos)} acts,{" "}
                        {mwTexto(enc.sem_chave_de_usina.mw_usado)}). Type in the act different from the current type in the SIGA in {inteiro(enc.tipo_do_ato_diferente_do_cadastro.atos)} acts:{" "}
                        {paresTipo}.
                      </>,
                    )}
                  </ExpansaoNota>
                  <ExpansaoNota>
                    {tx(
                      <>
                        Peso das coortes: {inteiro(e.coortes_peso.usinas_com_peso_limitado_pela_outorga)} usinas tiveram o peso limitado pela outorga; {inteiro(e.coortes_peso.usinas_que_ja_operavam)} eram
                        ampliações de usinas que já operavam, {inteiro(e.coortes_peso.usinas_que_ja_operavam_em_operacao_no_siga_sem_liberacao)} delas em operação no SIGA sem a liberação das unidades da
                        ampliação. Pares (fotografia, usina) com a soma das unidades entre {numTexto(atip.mantidos_entre_atencao_e_fator.fator_minimo, 1)} e {numTexto(atip.fator, 0)} vezes a
                        outorga ficam como estão ({inteiro(atip.mantidos_entre_atencao_e_fator.pares)} pares de {inteiro(atip.mantidos_entre_atencao_e_fator.usinas)} usinas), por não terem a assinatura de
                        erro de ordem de grandeza.
                      </>,
                      <>
                        Cohort weights: {inteiro(e.coortes_peso.usinas_com_peso_limitado_pela_outorga)} plants had their weight capped by the grant; {inteiro(e.coortes_peso.usinas_que_ja_operavam)} were
                        expansions of plants that already operated, {inteiro(e.coortes_peso.usinas_que_ja_operavam_em_operacao_no_siga_sem_liberacao)} of them in operation in the SIGA without the release
                        of the expansion units. Pairs (snapshot, plant) with the sum of the units between {numTexto(atip.mantidos_entre_atencao_e_fator.fator_minimo, 1)} and {numTexto(atip.fator, 0)} times
                        the grant stay as they are ({inteiro(atip.mantidos_entre_atencao_e_fator.pares)} pairs of {inteiro(atip.mantidos_entre_atencao_e_fator.usinas)} plants), because they do not have the
                        signature of an order-of-magnitude error.
                      </>,
                    )}
                  </ExpansaoNota>
                  <p className="rotulo text-mineral">{tx("Ressalvas da validação desta publicação", "Validation caveats of this release")}</p>
                  <ExpansaoLimitacoes itens={g.ressalvas} />
                  <p className="rotulo text-mineral">{tx("Limitações declaradas na proveniência", "Limitations declared in the provenance")}</p>
                  <ExpansaoLimitacoes itens={[...p.estagios.limitacoes, ...p.ralie.limitacoes, ...p.coortes.limitacoes]} />
                </ExpansaoAuditoria>

                <ExpansaoSeguir id="p040" downloads={downloadsDe(g, DOWNLOADS_PAINEL.p040)} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
