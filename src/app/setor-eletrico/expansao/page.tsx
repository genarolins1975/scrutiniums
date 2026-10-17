import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import {
  ExpansaoCapitulos,
  ExpansaoDatas,
  ExpansaoIndisponivel,
  ExpansaoNavegacao,
  ExpansaoNota,
  ExpansaoRecorte,
} from "@/components/energia/ExpansaoPagina";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, datasLegiveis } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { DOWNLOAD_EXPANSAO_TRANSICAO_EN, downloadsNoIdioma, mesPorExtensoEn } from "@/lib/energia/i18n/expansao-transicao-territorio";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import {
  notaEtapas,
  perguntaCapacidade,
  perguntaExpansao,
  ROTA_EXPANSAO,
  capacidadeNoCenario,
  dataTexto,
  inteiro,
  linhasRalieTipoNoGrafico,
  metricasEtapas,
  mesTexto,
  mudancaCarteira,
  notaEtapa,
  notaRetratosSigaRalie,
  painel,
  respostaCarteira,
  respostaCenarios,
  respostaCronograma,
  respostaSintese,
  respostaTransmissao,
  ressalvaLegivel,
  rotaPainel,
  ultimaConfiabilidade,
  vereditoCarteira,
  vereditoCenarios,
  vereditoCronograma,
  vereditoSintese,
  vereditoTransmissao,
  type MetricaEtapa,
  provenienciasDoLeitor,
} from "@/lib/energia/expansao";
import type { ExpansaoGold } from "@/lib/energia/tipos-expansao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/expansao", {
    title: tx("Expansão da oferta e da rede: carteira, cronograma, transmissão e cenários", "Supply and grid expansion: portfolio, schedule, transmission and scenarios"),
    description: tx(
      "O que está sendo construído: usinas em operação (potência fiscalizada), em construção e com obra não iniciada (potência outorgada) no SIGA e no RALIE da ANEEL, cronograma com data-base e o que atrasou, obras e leilões de transmissão ao lado da geração, e o PDE 2035 como cenário, com um painel completo para cada pergunta.",
      "What is being built: plants in operation (inspected capacity), under construction and with construction not started (granted capacity) in ANEEL's SIGA and RALIE, the schedule with a base date and what is delayed, transmission works and auctions next to generation, and the PDE 2035 as a scenario, with a full panel for each question.",
    ),
    alternates: { canonical: "/setor-eletrico/expansao" },
  }, anterior);
}

/** Cor de identificação de cada etapa na faixa de métricas (a mesma dos gráficos da carteira); nunca é cor de texto. */
const COR_ETAPA: Record<string, string> = {
  operacao: "var(--cor-mineral)",
  construcao: "var(--cor-energia)", // i18n: dado
  construcao_nao_iniciada: "var(--serie-comp-3)",
};

/** As três camadas do módulo e as unidades que nunca se somam: definições que acompanham a abertura, depois da informação. */
function camadas() {
  return [
    [
      tx("Realizado", "Actual"),
      tx(
        "O que já opera e o que entrou: usinas em operação no SIGA, liberações para operação comercial e obras de transmissão energizadas no SIGET.",
        "What already operates and what came online: plants in operation in the SIGA, releases for commercial operation and transmission works energized in the SIGET.",
      ),
    ],
    [
      tx("Carteira", "Portfolio"),
      tx(
        "O que está outorgado ou em obra, com a previsão da fiscalização datada pela fotografia do RALIE, e as obras de transmissão em andamento.",
        "What is granted or under construction, with the inspection's forecast dated by the RALIE snapshot, and the transmission works in progress.",
      ),
    ],
    [
      tx("Cenário", "Scenario"),
      tx(
        "O Plano Decenal de Expansão: o que o planejamento oficial supõe para os próximos dez anos, com data-base e hipóteses da edição. Não é previsão.",
        "The Ten-Year Expansion Plan (PDE): what official planning assumes for the next ten years, with the base date and assumptions of the edition. It is not a forecast.",
      ),
    ],
  ] as const;
}
function unidades() {
  return [
    ["MW", tx("Potência de geração. Não é energia (MWh) nem garantia física.", "Generation capacity. It is not energy (MWh) or physical guarantee.")],
    [tx("km de circuito", "circuit km"), tx("Extensão das linhas no SIGET: linha de circuito duplo conta cada circuito.", "Length of the lines in the SIGET: a double-circuit line counts each circuit.")],
    [tx("km de traçado", "route km"), tx("Comprimento da geometria das linhas no mapa da EPE.", "Length of the geometry of the lines on the EPE map.")],
    ["MVA", tx("Capacidade de transformação das subestações, sem o transformador reserva.", "Transformation capacity of the substations, without the spare transformer.")],
    [
      tx("R$ nominais", "Nominal R$"),
      tx("Investimento previsto e receita anual dos leilões, na moeda da data de cada leilão.", "Planned investment and annual revenue of the auctions, in the currency of the date of each auction."),
    ],
  ] as const;
}

/**
 * Abertura da Expansão: o que está sendo construído, com operação, obras e obra não iniciada em etapas separadas (potência
 * fiscalizada de um lado, outorgada do outro, sem total), a carteira por fonte no retrato do RALIE com a data própria, e as quatro
 * perguntas das páginas, cada uma com a resposta curta derivada da gold, o limite da leitura e o caminho para o painel completo
 * (mapa, séries, tabelas, downloads, modos Analisar e Auditar). A página não repete os gráficos dos painéis.
 */
export default function ExpansaoPage() {
  const g = lerGold<ExpansaoGold>("expansao.json");
  if (!integra(g)) return <ExpansaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const ref = g.referencias;
  const ev = g.evidencias;
  const r = g.estagios.ralie;
  const p = provenienciasDoLeitor(g);
  const etapas = metricasEtapas(g);
  const dataSiga = dataTexto(g.estagios.data_referencia);
  const conf = ultimaConfiabilidade(g);
  const cenario = capacidadeNoCenario(g);
  const evidenciaDe = (m: MetricaEtapa) => (m.id === "operacao" ? ev.capacidade_total : m.id === "construcao_nao_iniciada" ? ev.outorgado_sem_obra : undefined);
  const enderecoAbertura = `${ROTA_EXPANSAO}#chegando`;
  const oQueMudou = mudancaCarteira(g);
  const comoInterpretar = tx(
    <>
      Potência fiscalizada é a que a ANEEL registra para a usina em operação; potência outorgada é a do ato de outorga, usada em construção e obra não iniciada. As etapas são fases do SIGA e
      não se somam. O RALIE é o acompanhamento da fiscalização das unidades geradoras em implantação, com data própria: não é o mesmo retrato do SIGA.
    </>,
    <>
      Inspected capacity is the capacity ANEEL records for the plant in operation; granted capacity is the one in the grant act, used for construction and construction not started. The stages
      are SIGA phases and are not added. The RALIE is the inspection&apos;s monitoring of the generating units under implementation, with its own date: it is not the same snapshot as the SIGA.
    </>,
  );
  const naoConcluir = tx(
    <>
      Que a carteira vá virar capacidade em operação, nem em que prazo. Também não permite somar a carteira ao parque em operação, nem converter MW em energia ou em garantia física.
    </>,
    <>
      That the portfolio will become capacity in operation, or in what time frame. Nor does it allow adding the portfolio to the fleet in operation, or converting MW into energy or physical
      guarantee.
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="expansao" />
      <MarcaVisita secao="energia:expansao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["SIGA", "RALIE", "PDE", "ANEEL", "EPE", "SIGET"]}
          titulo={perguntaExpansao()}
          lead={tx(
            "Veja a potência já em operação, a que está em obras e a que ainda não começou a ser construída. Depois, compare os cronogramas das usinas com a expansão da rede; capacidade prevista ainda não é energia disponível.",
            "See the capacity already in operation, the capacity under construction and the capacity whose construction has not started. Then compare the plants' schedules with the grid expansion; forecast capacity is not yet available energy.",
          )}
          recorte={tx(`SIGA de ${dataSiga} · RALIE de ${dataTexto(r.data_ralie)} · MW`, `SIGA of ${dataSiga} · RALIE of ${dataTexto(r.data_ralie)} · MW`)}
          fonte={tx("ANEEL, SIGA e RALIE", "ANEEL, SIGA and RALIE")}
          referencia={tx(
            <>
              SIGA da ANEEL de {dataTexto(ref.siga)}; RALIE na fotografia de {dataTexto(ref.ralie)} (histórico desde {dataTexto(ref.ralie_historico_desde)}); liberações comerciais até{" "}
              {dataTexto(ref.liberacoes_ultima_data)}; atos de outorga até {dataTexto(ref.atos)}; SIGET de {dataTexto(ref.siget)}; leilões de transmissão até {dataTexto(ref.leiloes_transmissao)};
              linhas da EPE capturadas em {dataTexto(ref.rede_epe_capturada_em)}; {ref.pde}. Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              ANEEL&apos;s SIGA of {dataTexto(ref.siga)}; RALIE in the snapshot of {dataTexto(ref.ralie)} (history since {dataTexto(ref.ralie_historico_desde)}); commercial releases through{" "}
              {dataTexto(ref.liberacoes_ultima_data)}; grant acts through {dataTexto(ref.atos)}; SIGET of {dataTexto(ref.siget)}; transmission auctions through {dataTexto(ref.leiloes_transmissao)};
              EPE lines captured on {dataTexto(ref.rede_epe_capturada_em)}; {ref.pde}. Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <ExpansaoDatas
              itens={[
                { rotulo: "SIGA", texto: tx(`até ${dataSiga}`, `through ${dataSiga}`), natureza: "OBSERVADO" },
                {
                  rotulo: "RALIE",
                  texto: tx(
                    `fotografia de ${dataTexto(ref.ralie)}, histórico desde ${dataTexto(ref.ralie_historico_desde)}`,
                    `snapshot of ${dataTexto(ref.ralie)}, history since ${dataTexto(ref.ralie_historico_desde)}`,
                  ),
                  natureza: "OBSERVADO",
                },
                { rotulo: tx("Liberações comerciais", "Commercial releases"), texto: tx(`até ${dataTexto(ref.liberacoes_ultima_data)}`, `through ${dataTexto(ref.liberacoes_ultima_data)}`), natureza: "OBSERVADO" },
                { rotulo: tx("Atos de outorga", "Grant acts"), texto: tx(`até ${dataTexto(ref.atos)}`, `through ${dataTexto(ref.atos)}`), natureza: "OBSERVADO" },
                { rotulo: "SIGET", texto: tx(`até ${dataTexto(ref.siget)}`, `through ${dataTexto(ref.siget)}`), natureza: "OBSERVADO" },
                {
                  rotulo: tx("Leilões de transmissão", "Transmission auctions"),
                  texto: tx(`até ${dataTexto(ref.leiloes_transmissao)}`, `through ${dataTexto(ref.leiloes_transmissao)}`),
                  natureza: "OBSERVADO",
                },
                {
                  rotulo: tx("Linhas da EPE", "EPE lines"),
                  texto: tx(`capturadas em ${dataTexto(ref.rede_epe_capturada_em)}`, `captured on ${dataTexto(ref.rede_epe_capturada_em)}`),
                  natureza: "OBSERVADO",
                },
                { rotulo: tx("Plano decenal", "Ten-year plan"), texto: ref.pde, natureza: "CENARIO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas colunas={4} rotulo={tx("Indicadores da expansão", "Expansion indicators")} nota={notaEtapas()}>
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
                  endereco={enderecoAbertura}
                />
              ))}
              <Numero
                variante="faixa"
                rotulo={tx("Prevista e liberada em 12 meses", "Forecast and released within 12 months")}
                natureza="CALCULADO"
                evidencia={ev.confiabilidade_ultima ?? null}
                formato="pct"
                casas={1}
                unidade={tx("da potência prevista", "of forecast capacity")}
                periodo={conf ? tx(`previsões de ${dataTexto(conf.ralie)}`, `forecasts of ${dataTexto(conf.ralie)}`) : undefined}
                cor="var(--serie-referencia)"
                nota={tx("Coorte passada, não probabilidade.", "Past cohort, not probability.")}
                motivoAusencia={tx("Sem janela de 12 meses encerrada nesta publicação.", "No closed 12-month window in this release.")}
                endereco={`${rotaPainel("p041")}#p041`}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            "O que está outorgado e em obra, quando deve entrar, se a rede acompanha e como o planejamento oficial enxerga a matriz. Carteira, cronograma e cenário aparecem separados do que já opera: outorga não é obra, obra não é entrada certa e cenário não é previsão.",
            "What is granted and under construction, when it should come online, whether the grid keeps up and how official planning sees the power mix. Portfolio, schedule and scenario appear separately from what already operates: a grant is not construction, construction is not a guaranteed entry and a scenario is not a forecast.",
          )}
        </CabecalhoModulo>
        <ExpansaoNavegacao atual="sintese" />

        <ModoProfundidade>
          <Bloco id="expansao">
            <PainelEvidencia
              id="chegando"
              pergunta={perguntaCapacidade()}
              subtitulo={tx(
                "Unidades geradoras em implantação acompanhadas pela fiscalização da ANEEL, por tipo de geração · MW · fotografia do RALIE",
                "Generating units under implementation monitored by ANEEL's inspection, by generation type · MW · RALIE snapshot",
              )}
              porQueImporta={tx(
                <>
                  A carteira mostra o que pode vir a operar e de que fontes, em escala com o que já opera. Outorga e obra não garantem a entrada em operação: parte das outorgas já foi
                  revogada ou extinta, e o desfecho de cada grupo de usinas está na página da carteira.
                </>,
                <>
                  The portfolio shows what may come to operate and from which sources, in scale with what already operates. A grant and construction do not guarantee entry into operation:
                  some of the grants have already been revoked or extinguished, and the outcome of each group of plants is on the portfolio page.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={p.ralie}
              complementares={[
                { rotulo: tx("Etapas do SIGA", "SIGA stages"), p: p.estagios },
                { rotulo: tx("Previsões liberadas no prazo", "Forecasts released on time"), p: p.confiabilidade },
              ]}
            >
              <div className="space-y-6">
                <div className="grid gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:items-start">
                  <Numero
                    variante="faixa"
                    rotulo={tx("Unidades em implantação no RALIE", "Units under implementation in the RALIE")}
                    natureza="CALCULADO"
                    evidencia={ev.ralie_em_implantacao ?? null}
                    casas={1}
                    unidade="MW"
                    periodo={tx(`RALIE de ${dataTexto(r.data_ralie)}`, `RALIE of ${dataTexto(r.data_ralie)}`)}
                    cor="var(--cor-energia)"
                    nota={tx(
                      "Potência das unidades geradoras acompanhadas pela fiscalização; não é energia nem garantia física.",
                      "Capacity of the generating units monitored by the inspection; it is not energy or physical guarantee.",
                    )}
                    motivoAusencia={tx("Sem a fotografia do RALIE nesta publicação.", "No RALIE snapshot in this release.")}
                    endereco={enderecoAbertura}
                  />
                  <GraficoBarras
                    titulo={tx(
                      `Carteira em implantação por tipo de geração, fotografia do RALIE de ${dataTexto(r.data_ralie)} (MW das unidades)`,
                      `Portfolio under implementation by generation type, RALIE snapshot of ${dataTexto(r.data_ralie)} (MW of the units)`,
                    )}
                    dados={linhasRalieTipoNoGrafico(g)}
                    chaveCategoria="id"
                    chaveRotulo="tipo"
                    series={[{ id: "mw", rotulo: tx("Unidades em implantação", "Units under implementation"), cor: "var(--cor-energia)" }]} // i18n: dado
                    unidade="MW"
                    casas={1}
                    orientacao="horizontal"
                    rotulosValor
                  />
                </div>
                {/* a faixa de cima já traz os números; a resposta vem depois da figura para que ela comece na primeira tela */}
                <RespostaCurta id="sintese" depois veredito={vereditoSintese(g) || respostaSintese(g)}>
                  {respostaSintese(g)}
                </RespostaCurta>
                <ExpansaoNota>{notaRetratosSigaRalie(g)}</ExpansaoNota>
                <ExpansaoRecorte
                  periodo={tx(
                    <>
                      RALIE de {dataTexto(r.data_ralie)} (carteira em implantação); SIGA de {dataSiga} (etapas)
                    </>,
                    <>
                      RALIE of {dataTexto(r.data_ralie)} (portfolio under implementation); SIGA of {dataSiga} (stages)
                    </>,
                  )}
                  universo={tx(
                    <>
                      {inteiro(r.usinas)} usinas e {inteiro(r.ugs)} unidades geradoras no RALIE; usinas do SIGA nas fases Operação, Construção e Construção não iniciada
                    </>,
                    <>
                      {inteiro(r.usinas)} plants and {inteiro(r.ugs)} generating units in the RALIE; SIGA plants in the Operation, Construction and Construction not started phases
                    </>,
                  )}
                  unidade={tx(
                    "MW de potência: das unidades em implantação (RALIE), outorgada (construção e obra não iniciada) e fiscalizada (operação); não é energia",
                    "MW of capacity: of the units under implementation (RALIE), granted (construction and construction not started) and inspected (operation); it is not energy",
                  )}
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <ExpansaoCapitulos
                  itens={[
                    {
                      id: "p040",
                      resposta: (
                        <RespostaCurta id="p040" tamanho="sm" veredito={vereditoCarteira(g) || respostaCarteira(g)}>
                          {respostaCarteira(g)}
                        </RespostaCurta>
                      ),
                      contexto: tx(
                        <>
                          Fases do SIGA de {dataSiga}; desfecho das usinas acompanhadas pelo RALIE desde {dataTexto(ref.ralie_historico_desde)}; outorgas encerradas desde{" "}
                          {g.estagios.encerramentos.desde}.
                        </>,
                        <>
                          SIGA phases of {dataSiga}; outcome of the plants monitored by the RALIE since {dataTexto(ref.ralie_historico_desde)}; grants terminated since{" "}
                          {g.estagios.encerramentos.desde}.
                        </>,
                      ),
                      limite: tx(
                        "quanto da carteira atual vai entrar: o desfecho dos grupos de usinas de anos anteriores não é probabilidade para a carteira atual.",
                        "how much of the current portfolio will come online: the outcome of groups of plants from earlier years is not a probability for the current portfolio.",
                      ),
                    },
                    {
                      id: "p041",
                      resposta: (
                        <RespostaCurta id="p041" tamanho="sm" veredito={vereditoCronograma(g) || respostaCronograma(g)}>
                          {respostaCronograma(g)}
                        </RespostaCurta>
                      ),
                      contexto: tx(
                        <>
                          Previsões da fotografia de {dataTexto(g.cronograma.data_ralie)}; confiabilidade nas {g.cronograma.confiabilidade.length} fotografias mensais com a janela de 12 meses
                          encerrada, desde {dataTexto(g.cronograma.confiabilidade[0]?.ralie)}, contra as liberações até {dataTexto(ref.liberacoes_ultima_data)}.
                        </>,
                        <>
                          Forecasts of the snapshot of {dataTexto(g.cronograma.data_ralie)}; reliability in the {g.cronograma.confiabilidade.length} monthly snapshots with the 12-month window
                          closed, since {dataTexto(g.cronograma.confiabilidade[0]?.ralie)}, against the releases through {dataTexto(ref.liberacoes_ultima_data)}.
                        </>,
                      ),
                      limite: tx(
                        "a data provável de cada usina: boa parte da carteira tem previsão numa data convencional atribuída em bloco.",
                        "the likely date of each plant: a large part of the portfolio is forecast for a conventional date assigned in bulk.",
                      ),
                    },
                    {
                      id: "p042",
                      resposta: (
                        <RespostaCurta id="p042" tamanho="sm" veredito={vereditoTransmissao(g) || respostaTransmissao(g)}>
                          {respostaTransmissao(g)}
                        </RespostaCurta>
                      ),
                      numero: (
                        <Numero
                          variante="faixa"
                          rotulo={tx("Linhas novas em obras de transmissão em andamento", "New lines in transmission works in progress")}
                          natureza="CALCULADO"
                          evidencia={ev.transmissao_em_andamento ?? null}
                          casas={1}
                          cor="var(--serie-comp-2)"
                          endereco={`${rotaPainel("p042")}#p042`}
                          motivoAusencia={tx("Sem o SIGET nesta publicação.", "No SIGET in this release.")}
                        />
                      ),
                      contexto: tx(
                        <>
                          SIGET de {dataTexto(g.transmissao.obras.data_referencia)}; leilões de transmissão até o {g.transmissao.leiloes.ultimo_leilao.leilao ?? "último do arquivo"} (
                          {dataTexto(g.transmissao.leiloes.ultimo_leilao.data)}); rede da EPE capturada em {dataTexto(ref.rede_epe_capturada_em)}; por UF e por ano.
                        </>,
                        <>
                          SIGET of {dataTexto(g.transmissao.obras.data_referencia)}; transmission auctions through {g.transmissao.leiloes.ultimo_leilao.leilao ?? "the last one in the file"} (
                          {dataTexto(g.transmissao.leiloes.ultimo_leilao.data)}); EPE grid captured on {dataTexto(ref.rede_epe_capturada_em)}; by state and by year.
                        </>,
                      ),
                      limite: tx(
                        "se a rede é suficiente para escoar a geração de uma UF: isso depende do desenho da rede (topologia) e dos limites dela, não de km ou MVA.",
                        "whether the grid is enough to carry a state's generation: that depends on the grid's design (topology) and its limits, not on km or MVA.",
                      ),
                    },
                    {
                      id: "p043",
                      resposta: (
                        <RespostaCurta id="p043" tamanho="sm" veredito={vereditoCenarios(g) || respostaCenarios(g)}>
                          {respostaCenarios(g)}
                        </RespostaCurta>
                      ),
                      numero: (
                        <Numero
                          variante="faixa"
                          rotulo={tx(`Capacidade nacional em ${mesTexto(cenario.fim?.ref)} no cenário de referência`, `National capacity in ${mesTexto(cenario.fim?.ref)} in the reference scenario`)}
                          natureza="CENARIO"
                          evidencia={ev.pde_capacidade_2035 ?? null}
                          casas={1}
                          cor="var(--serie-comp-4)"
                          endereco={`${rotaPainel("p043")}#p043`}
                          motivoAusencia={tx("Sem a Figura 3-25 nesta publicação.", "No Figure 3-25 in this release.")}
                        />
                      ),
                      contexto: tx(
                        <>
                          {g.cenarios.edicao}, data-base {g.cenarios.data_base_premissas}, horizonte {g.cenarios.horizonte}; realizado do SIGA e carteira do RALIE em camadas separadas.
                        </>,
                        <>
                          {g.cenarios.edicao}, base date {mesPorExtensoEn(g.cenarios.data_base_premissas)}, horizon {g.cenarios.horizonte.replace(" a ", " to ")}; SIGA actual and RALIE portfolio in
                          separate layers.
                        </>,
                      ),
                      limite: tx(
                        "que o cenário vai se realizar, nem que a distância entre o cenário e o realizado é atraso: as categorias não coincidem uma a uma.",
                        "that the scenario will come true, nor that the gap between the scenario and the actual is a delay: the categories do not match one to one.",
                      ),
                    },
                  ]}
                />

                <SecaoDoPainel id="camadas" titulo={tx("Três camadas e cinco unidades que não se misturam", "Three layers and five units that do not mix")}>
                  <ul className="grid gap-x-8 gap-y-4 md:grid-cols-3">
                    {camadas().map(([n, d]) => (
                      <li key={n} className="border-l-2 border-linha pl-4">
                        <p className="rotulo text-mineral">{n}</p>
                        <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{d}</p>
                      </li>
                    ))}
                  </ul>
                  <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
                    {unidades().map(([n, d]) => (
                      <li key={n} className="border-l-2 border-linha pl-4">
                        <p className="rotulo text-mineral">{n}</p>
                        <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{d}</p>
                      </li>
                    ))}
                  </ul>
                </SecaoDoPainel>

                {g.ressalvas.length > 0 && (
                  <SecaoDoPainel id="ressalvas" titulo={tx("Ressalvas da validação desta publicação", "Validation caveats of this release")} nivel="analisar">
                    <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                      {g.ressalvas.map((x) => {
                        const rv = ressalvaLegivel(datasLegiveis(x, "pt"));
                        return (
                          <li key={x}>
                            <TrechoPortugues regiao="expansao-ressalva">{rv.texto}</TrechoPortugues>
                            {rv.campo && <span data-nivel="auditar">{tx(<> Campo da base publicada: {rv.campo}.</>, <> Field of the published dataset: {rv.campo}.</>)}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </SecaoDoPainel>
                )}

                <div id="arquivos" className="scroll-mt-28">
                  <SeguirPainel
                    ancora="chegando"
                    proximo={{ href: rotaPainel("p040"), pergunta: painel("p040").pergunta }}
                    downloads={downloadsNoIdioma(g.downloads, DOWNLOAD_EXPANSAO_TRANSICAO_EN, idiomaEnergia())}
                    extra={
                      <p className="max-w-prose2 pb-1 text-xs text-carvao-muted">
                        {tx(
                          "CSV com ponto e vírgula, ponto decimal e campo vazio para ausência; os JSON são lidos pelos mapas sob demanda.",
                          "CSV with semicolons, a decimal point and an empty field for missing data; the JSON files are read by the maps on demand.",
                        )}
                      </p>
                    }
                  />
                </div>
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
