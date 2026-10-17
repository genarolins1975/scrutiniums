import { AtalhoLeitura } from "@/components/energia/LeiturasIntegradas";
import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TransicaoCapitulos, TransicaoDatas, TransicaoIndisponivel, TransicaoNavegacao, TransicaoRecorte, TransicaoSeguir } from "@/components/energia/TransicaoPagina";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { marcarNomes } from "@/lib/energia/i18n/qualidade-perdas";
import {
  grandezas,
  ligacaoGeracao,
  perguntaTransicao,
  semDado,
  conectadaNoAnoDeReferencia,
  dadosFatorAnual,
  data,
  inteiro,
  kgPorMwh,
  linhasAnualCobertas,
  mes,
  mudancaEmissoes,
  mudancaMmgdAno,
  notaAnosDaCapacidade,
  pctTexto,
  periodoFatorAnual,
  perguntaPainel,
  primeiroAnoCoberto,
  referenciaAnual,
  respostaEmissoes,
  respostaMmgd,
  respostaOns,
  rotaPainel,
  vereditoEmissoes,
  vereditoMmgd,
  vereditoOns,
} from "@/lib/energia/transicao";
import type { GoldTransicao } from "@/lib/energia/tipos-transicao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/transicao", {
    title: tx("Transição e ambiente: geração distribuída e emissões", "Transition and environment: distributed generation and emissions"),
    description: tx(
      "Como a matriz está mudando: capacidade de micro e minigeração distribuída adicionada por ano (cadastro da ANEEL) e intensidade das emissões da geração no SIN (fator médio do MCTI) em séries separadas, a energia que a MMGD entrega ao SIN (estimativa do ONS) e um painel completo para cada pergunta.",
      "How the power mix is changing: distributed micro and mini generation (MMGD) capacity added per year (ANEEL register) and the emissions intensity of generation in the SIN (MCTI average factor) in separate series, the energy that MMGD delivers to the SIN (ONS estimate) and a full panel for each question.",
    ),
    alternates: { canonical: "/setor-eletrico/transicao" },
  }, anterior);
}

/** Painéis de outros módulos que continuam a mesma narrativa, com a pergunta de cada um. */
function ligacoes() {
  const geracao = ligacaoGeracao();
  return [
    {
      href: "/setor-eletrico/carga/perfil-horario#p026",
      rotulo: tx("Carga: MMGD e perfil horário", "Load: MMGD and hourly profile"),
      texto: tx(
        "Qual parcela da carga é estimada e quando ocorre o pico? A mesma estimativa de MMGD do ONS, hora a hora.",
        "What share of the load is estimated, and when does the peak occur? The same ONS MMGD estimate, hour by hour.",
      ),
    },
    {
      href: geracao.href,
      rotulo: tx("Geração: matriz efetiva", "Generation: actual power mix"),
      texto: tx(
        `${geracao.pergunta} A composição da geração do SIN por fonte, segundo o ONS; o fator médio do MCTI também se refere à geração no SIN.`,
        `${geracao.pergunta} The composition of SIN generation by source, according to the ONS; the MCTI average factor also refers to generation in the SIN.`,
      ),
    },
    {
      href: "/setor-eletrico/expansao",
      rotulo: tx("Expansão", "Expansion"),
      texto: tx("O que está sendo construído e quando pode entrar? A geração centralizada que se soma à distribuída.", "What is being built and when can it come online? The centralized generation that adds to the distributed one."),
    },
  ];
}

/**
 * Abertura da Transição e ambiente: dois visuais separados, a capacidade de MMGD adicionada por ano (cadastro da ANEEL, em MW) e a
 * intensidade das emissões do SIN (fator médio do MCTI, em tCO2/MWh), sem afirmar que a primeira explica a segunda e sem emissões
 * evitadas, porque não há contrafactual. As três perguntas das páginas vêm depois, cada uma com a resposta curta, a grandeza e a
 * unidade que usa e o caminho para o painel completo. Os números são agregados por território; nenhum titular de unidade aparece.
 */
export default function TransicaoPage() {
  const g = lerGold<GoldTransicao>("transicao.json");
  if (!integra(g)) return <TransicaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const m = g.mmgd;
  const o = g.ons_mmgd;
  const e = g.emissoes;
  const conectada = conectadaNoAnoDeReferencia(m);
  const mesOns = o?.ultimo_mes_completo ?? null;
  const periodoFator = e ? periodoFatorAnual(e) : null;
  const anual = linhasAnualCobertas(m);
  const primeiroCoberto = primeiroAnoCoberto(m.controles.cobertura_das_series.inicio_declarado);
  const oQueMudou = (
    <>
      {mudancaMmgdAno(m)} {e ? mudancaEmissoes(e) : ""}
    </>
  );
  const comoInterpretar = tx(
    <>
      Cada gráfico tem a sua escala, o seu período e a sua fonte. A capacidade adicionada é a potência instalada que entrou no cadastro da ANEEL em cada ano, em MW, e não é energia gerada. O
      fator de emissão é a média anual de CO2 da geração despachada no SIN, publicada pelo MCTI, em tCO2/MWh: só CO2 da operação das usinas.
    </>,
    <>
      Each chart has its own scale, period and source. The capacity added is the installed capacity that entered ANEEL&apos;s register each year, in MW, and it is not energy generated. The
      emission factor is the annual average CO2 of the generation dispatched in the SIN, published by the MCTI, in tCO2/MWh: only CO2 from the plants&apos; operation.
    </>,
  );
  const naoConcluir = tx(
    <>
      Que a capacidade adicionada explique a mudança das emissões, nem emissões evitadas: nenhuma das duas séries traz o que teria ocorrido sem a outra. Também não compara CO2 da operação com
      CO2 equivalente de ciclo de vida, nem capacidade (MW) com energia (MWh).
    </>,
    <>
      That the capacity added explains the change in emissions, nor avoided emissions: neither series shows what would have happened without the other. Nor does it compare operational CO2 with
      life-cycle CO2 equivalent, or capacity (MW) with energy (MWh).
    </>,
  );
  const GRANDEZAS = grandezas();
  const sd = semDado();
  const pendencias = g.pendencias.join(" ") || tx("sem motivo registrado", "no reason recorded");
  const respostas = {
    p063: <RespostaCurta id="p063" tamanho="sm" veredito={marcarNomes(vereditoMmgd(m), m.ufs.map((u) => u.nome), idiomaEnergia())}>{marcarNomes(respostaMmgd(m), m.ufs.map((u) => u.nome), idiomaEnergia())}</RespostaCurta>,
    ons: o ? <RespostaCurta id="ons" tamanho="sm" veredito={vereditoOns(o) || respostaOns(o)}>{respostaOns(o)}</RespostaCurta> : null,
    p064: e ? <RespostaCurta id="p064" tamanho="sm" veredito={vereditoEmissoes(e) || respostaEmissoes(e)}>{respostaEmissoes(e)}</RespostaCurta> : null,
  };

  return (
    <>
      <CabecalhoEnergia atual="transicao" />
      <MarcaVisita secao="energia:transicao" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["MMGD", "MWmed", "SIN", "ANEEL", "ONS", "MCTI", "IBGE"]}
          titulo={perguntaTransicao()}
          lead={tx(
            "Acompanhe a potência de geração distribuída adicionada a cada ano e o CO₂ emitido por unidade de energia no Sistema Interligado Nacional (SIN). As séries mostram dimensões distintas da transição; uma não demonstra a causa da outra.",
            "Follow the distributed generation capacity added each year and the CO₂ emitted per unit of energy in the National Interconnected System (SIN). The series show distinct dimensions of the transition; one does not demonstrate the cause of the other.",
          )}
          recorte={tx(
            `MMGD até ${data(m.data_cadastro)} · energia estimada até ${mes(mesOns?.m)} · emissões anuais até ${e?.ultimo_ano?.ano ?? "sem dado"}`,
            `MMGD through ${data(m.data_cadastro)} · estimated energy through ${mes(mesOns?.m)} · annual emissions through ${e?.ultimo_ano?.ano ?? sd}`,
          )}
          fonte={tx("ANEEL, ONS e MCTI", "ANEEL, ONS and MCTI")}
          referencia={tx(
            <>
              Cadastro de MMGD da ANEEL de {data(m.data_cadastro)}; estimativa do ONS até {data(o?.fim_serie)}; fatores de emissão do MCTI até {mes(e?.ultimo_mes?.m)}. Processado em{" "}
              {carimbo(g.gerado_em)}.
            </>,
            <>
              ANEEL MMGD register of {data(m.data_cadastro)}; ONS estimate through {data(o?.fim_serie)}; MCTI emission factors through {mes(e?.ultimo_mes?.m)}. Processed on{" "}
              {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <TransicaoDatas
              itens={[
                { rotulo: tx("Cadastro de MMGD (ANEEL)", "MMGD register (ANEEL)"), texto: tx(`até ${data(m.data_cadastro)}`, `through ${data(m.data_cadastro)}`), natureza: "OBSERVADO" },
                {
                  rotulo: tx("MMGD estimada (ONS)", "Estimated MMGD (ONS)"),
                  texto: o ? tx(`${data(o.inicio_serie)} a ${data(o.fim_serie)}`, `${data(o.inicio_serie)} to ${data(o.fim_serie)}`) : tx("sem dado nesta publicação", "no data in this release"),
                  natureza: "ESTIMADO",
                },
                {
                  rotulo: tx("Fator de emissão (MCTI)", "Emission factor (MCTI)"),
                  texto: e
                    ? tx(`mensal até ${mes(e.ultimo_mes?.m)}, anual até ${e.ultimo_ano?.ano ?? "sem dado"}`, `monthly through ${mes(e.ultimo_mes?.m)}, annual through ${e.ultimo_ano?.ano ?? sd}`)
                    : tx("sem dado nesta publicação", "no data in this release"),
                  natureza: "ESTIMADO",
                },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx("Indicadores da transição", "Transition indicators")}
              nota={tx(
                "Cada medida na sua unidade: MW (ANEEL), MWmed (ONS) e tCO2/MWh (MCTI). Não se somam nem se convertem.",
                "Each measure in its own unit: MW (ANEEL), MWavg (ONS) and tCO2/MWh (MCTI). They are neither added nor converted.",
              )}
            >
              <Numero
                variante="faixa"
                rotulo={tx("MMGD cadastrada", "Registered MMGD")}
                natureza="OBSERVADO"
                evidencia={m.evidencias.potencia}
                casas={1}
                unidade="MW"
                periodo={tx(`cadastro de ${data(m.data_cadastro)}`, `register of ${data(m.data_cadastro)}`)}
                cor="var(--serie-solar)"
                nota={tx("Capacidade instalada, não energia gerada.", "Installed capacity, not energy generated.")}
                endereco={`${rotaPainel("p063")}#p063`}
              />
              <Numero
                variante="faixa"
                rotulo={tx(`MMGD conectada em ${conectada?.ano ?? "sem dado"}`, `MMGD connected in ${conectada?.ano ?? sd}`)}
                natureza="OBSERVADO"
                valor={conectada?.potencia_mw ?? null}
                casas={1}
                unidade="MW"
                periodo={tx("ano completo, pela data de conexão", "full year, by connection date")}
                cor="var(--serie-solar)"
                nota={tx("Capacidade adicionada no ano.", "Capacity added in the year.")}
                motivoAusencia={tx("Sem o último ano completo nesta publicação.", "No last full year in this release.")}
              />
              <Numero
                variante="faixa"
                rotulo={tx("MMGD estimada no SIN", "Estimated MMGD in the SIN")}
                natureza="ESTIMADO"
                evidencia={o?.evidencia ?? null}
                casas={1}
                unidade={tx("MWmed", "MWavg")}
                periodo={mesOns ? tx(`${mes(mesOns.m)}, mês completo`, `${mes(mesOns.m)}, full month`) : undefined}
                cor="var(--cor-carvao)"
                nota={
                  mesOns
                    ? tx(
                        `${pctTexto(mesOns.participacao_carga_global_sin_pct, 2)} da carga global do SIN. Estimativa do ONS, não medição.`,
                        `${pctTexto(mesOns.participacao_carga_global_sin_pct, 2)} of the SIN gross load. ONS estimate, not a measurement.`,
                      )
                    : undefined
                }
                motivoAusencia={tx("Nenhum mês com os quatro submercados completos nesta publicação.", "No month with the four submarkets complete in this release.")}
                endereco={`${rotaPainel("ons")}#ons`}
              />
              <Numero
                variante="faixa"
                rotulo={tx(`Fator de emissão de CO2 em ${e?.ultimo_ano?.ano ?? "sem dado"}`, `CO2 emission factor in ${e?.ultimo_ano?.ano ?? sd}`)}
                natureza="ESTIMADO"
                evidencia={e?.evidencia ?? null}
                casas={4}
                unidade="tCO2/MWh"
                periodo={tx("média anual da geração no SIN", "annual average of generation in the SIN")}
                cor="var(--serie-termica)"
                nota={e?.ultimo_ano ? tx(`${kgPorMwh(e.ultimo_ano.valor)}; só CO2 da operação das usinas.`, `${kgPorMwh(e.ultimo_ano.valor)}; only CO2 from the plants' operation.`) : undefined}
                motivoAusencia={tx("Nenhum ano completo publicado nesta versão.", "No full year published in this version.")}
                endereco={`${rotaPainel("p064")}#p064`}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            "Três perguntas, cada uma com a sua fonte e a sua unidade: onde a micro e minigeração distribuída cresce, quanta energia ela entrega ao sistema e quanto CO2 a geração emite por MWh. Os números são agregados por território; nenhum titular de unidade aparece aqui.",
            "Three questions, each with its own source and unit: where distributed micro and mini generation is growing, how much energy it delivers to the system and how much CO2 generation emits per MWh. The figures are aggregated by territory; no unit holder appears here.",
          )}
        </CabecalhoModulo>
        <TransicaoNavegacao atual="sintese" />

        <AtalhoLeitura
          href="/setor-eletrico/transicao/riscos"
          titulo={tx("Ativos, riscos e novas tecnologias", "Assets, risks and new technologies")}
          texto={tx("Conecte curtailment, clima, data centers, baterias e geração distribuída.", "Connect curtailment, climate, data centers, batteries and distributed generation.")}
        />
        <ModoProfundidade>
          <Bloco id="transicao">
            <PainelEvidencia
              id="panorama"
              pergunta={tx("Capacidade adicionada e intensidade das emissões, em séries separadas", "Capacity added and emissions intensity, in separate series")}
              subtitulo={tx(
                "MMGD conectada por ano (cadastro da ANEEL, MW) e fator médio de emissão de CO2 do SIN por ano (MCTI, tCO2/MWh)",
                "MMGD connected per year (ANEEL register, MW) and average CO2 emission factor of the SIN per year (MCTI, tCO2/MWh)",
              )}
              porQueImporta={tx(
                <>
                  A micro e minigeração distribuída muda o que entra no sistema, e o fator de emissão diz quanto CO2 a geração emitiu por MWh. São duas séries, com fontes e unidades próprias,
                  mostradas lado a lado e lidas cada uma no seu eixo.
                </>,
                <>
                  Distributed micro and mini generation changes what enters the system, and the emission factor says how much CO2 generation emitted per MWh. They are two series, with their own
                  sources and units, shown side by side and each read on its own axis.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={m.proveniencia.cadastro}
              complementares={e ? [{ rotulo: tx("Fator médio de emissão (MCTI)", "Average emission factor (MCTI)"), p: e.proveniencia.medio }] : []}
            >
              <div className="space-y-6">
                <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
                  <div className="min-w-0 space-y-3">
                    <h3 className="sr-only">{tx("Capacidade de MMGD adicionada por ano", "MMGD capacity added per year")}</h3>
                    <GraficoBarras
                      titulo={tx(
                        `Potência de MMGD conectada por ano de conexão, Brasil (cadastro de ${data(m.data_cadastro)})`,
                        `MMGD capacity connected by year of connection, Brazil (register of ${data(m.data_cadastro)})`,
                      )}
                      dados={anual}
                      chaveCategoria="id"
                      chaveRotulo="rotulo"
                      series={[{ id: "potencia_mw", rotulo: tx("Potência conectada no ano", "Capacity connected in the year"), cor: "var(--serie-solar)" }]}
                      unidade="MW"
                      casas={1}
                      altura={280}
                    />
                    <p className="text-xs leading-relaxed text-carvao-muted">{notaAnosDaCapacidade(m)}</p>
                  </div>
                  {e ? (
                    <div className="min-w-0 space-y-3">
                      <h3 className="sr-only">{tx("Intensidade de emissões da geração no SIN", "Emissions intensity of generation in the SIN")}</h3>
                      <GraficoBarras
                        titulo={tx("Fator médio anual de emissão de CO2 do SIN", "Annual average CO2 emission factor of the SIN")}
                        dados={dadosFatorAnual(e)}
                        chaveCategoria="id"
                        chaveRotulo="rotulo"
                        series={[{ id: "medio", rotulo: tx("Fator médio anual", "Annual average factor"), cor: "var(--serie-termica)" }]}
                        unidade="tCO2/MWh"
                        casas={4}
                        referencias={referenciaAnual(e)}
                        altura={280}
                      />
                      <p className="text-xs leading-relaxed text-carvao-muted">
                        {periodoFator
                          ? tx(
                              `Média anual de ${periodoFator.inicio} a ${periodoFator.fim}; o ano corrente não tem fator anual.`,
                              `Annual average from ${periodoFator.inicio} to ${periodoFator.fim}; the current year has no annual factor.`,
                            )
                          : ""}{" "}
                        {tx("A linha tracejada é o último ano publicado.", "The dashed line is the last published year.")}
                      </p>
                    </div>
                  ) : (
                    <p className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
                      {tx(
                        `Os fatores de emissão do MCTI não foram montados nesta publicação (${pendencias}); nenhum fator é estimado no lugar do oficial.`,
                        `The MCTI emission factors were not assembled in this release (${pendencias}); no factor is estimated in place of the official one.`,
                      )}
                    </p>
                  )}
                </div>
                <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                  {tx(
                    "Os dois gráficos descrevem séries distintas, com períodos e universos próprios. A leitura conjunta não atribui a mudança das emissões à MMGD, e nenhuma emissão evitada é calculada.",
                    "The two charts describe distinct series, with their own periods and universes. Reading them together does not attribute the change in emissions to MMGD, and no avoided emission is calculated.",
                  )}
                </p>
                <TransicaoRecorte
                  periodo={tx(
                    <>
                      Capacidade: {anual[0]?.ano ?? primeiroCoberto} a {anual.at(-1)?.ano ?? "sem dado"} (o último ano vai até {data(m.data_cadastro)}); emissões: {periodoFator?.inicio ?? "sem dado"} a{" "}
                      {periodoFator?.fim ?? "sem dado"}
                    </>,
                    <>
                      Capacity: {anual[0]?.ano ?? primeiroCoberto} to {anual.at(-1)?.ano ?? sd} (the last year runs through {data(m.data_cadastro)}); emissions: {periodoFator?.inicio ?? sd} to{" "}
                      {periodoFator?.fim ?? sd}
                    </>,
                  )}
                  universo={tx(
                    <>
                      MMGD: {inteiro(m.resumo.unidades)} unidades no cadastro da ANEEL, no Brasil; emissões: geração despachada no SIN, sem sistemas isolados
                    </>,
                    <>
                      MMGD: {inteiro(m.resumo.unidades)} units in ANEEL&apos;s register, in Brazil; emissions: generation dispatched in the SIN, without isolated systems
                    </>,
                  )}
                  unidade={tx(
                    "MW de potência instalada (capacidade, não energia); tCO2/MWh (só CO2 da operação, não CO2 equivalente)",
                    "MW of installed capacity (capacity, not energy); tCO2/MWh (only operational CO2, not CO2 equivalent)",
                  )}
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <TransicaoCapitulos
                  itens={[
                    {
                      id: "p063",
                      resposta: respostas.p063,
                      grandeza: GRANDEZAS[0],
                      contexto: tx(
                        <>
                          Cadastro vigente em {data(m.data_cadastro)}, por UF, município, distribuidora e perfil; conexões por ano e mês, com os meses depois de {mes(m.corte_provisorio)}{" "}
                          provisórios; população estimada pelo IBGE para {m.ano_populacao ?? "sem dado"}.
                        </>,
                        <>
                          Register in force on {data(m.data_cadastro)}, by state, municipality, distribution utility and profile; connections by year and month, with the months after{" "}
                          {mes(m.corte_provisorio)} provisional; population estimated by the IBGE for {m.ano_populacao ?? sd}.
                        </>,
                      ),
                      limite: tx(
                        "quanta energia cada lugar gera, nem a renda de quem tem o sistema: o cadastro mede capacidade, e o crédito pode ser usado em outro município.",
                        "how much energy each place generates, nor the income of whoever owns the system: the register measures capacity, and the credit may be used in another municipality.",
                      ),
                      href: `${rotaPainel("p063")}#p063`,
                    },
                    ...(o && respostas.ons
                      ? [
                          {
                            id: "ons" as const,
                            resposta: respostas.ons,
                            grandeza: GRANDEZAS[1],
                            contexto: tx(
                              <>
                                Carga verificada do ONS de {data(o.inicio_serie)} a {data(o.fim_serie)}, por submercado e no SIN, em MWmed e em participação na carga global.
                              </>,
                              <>
                                ONS verified load from {data(o.inicio_serie)} to {data(o.fim_serie)}, by submarket and in the SIN, in MWavg and as a share of the gross load.
                              </>,
                            ),
                            limite: tx(
                              "que o valor seja medido (é estimativa da fonte), nem nada fora do SIN; e não se soma à capacidade cadastrada.",
                              "that the value is measured (it is the source's estimate), nor anything outside the SIN; and it is not added to the registered capacity.",
                            ),
                            href: `${rotaPainel("ons")}#ons`,
                          },
                        ]
                      : []),
                    ...(e && respostas.p064
                      ? [
                          {
                            id: "p064" as const,
                            resposta: respostas.p064,
                            grandeza: GRANDEZAS[2],
                            contexto: tx(
                              <>
                                Fator médio do MCTI, mensal até {mes(e.ultimo_mes?.m)} e anual até {e.ultimo_ano?.ano ?? "sem dado"}, só CO2, geração no SIN; fatores do MDL em séries separadas.
                              </>,
                              <>
                                MCTI average factor, monthly through {mes(e.ultimo_mes?.m)} and annual through {e.ultimo_ano?.ano ?? sd}, only CO2, generation in the SIN; CDM factors in separate series.
                              </>,
                            ),
                            limite: tx(
                              "o efeito de consumir ou economizar um MWh a mais (o fator médio não é marginal), emissões em CO2 equivalente, nem intensidade por hora ou por município.",
                              "the effect of consuming or saving one more MWh (the average factor is not marginal), emissions in CO2 equivalent, nor intensity by hour or by municipality.",
                            ),
                            href: `${rotaPainel("p064")}#p064`,
                          },
                        ]
                      : []),
                  ]}
                />
                {!o && (
                  <p className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
                    {tx(
                      `A estimativa de MMGD do ONS não foi montada nesta publicação (${pendencias}); nenhum valor de energia é estimado no lugar.`,
                      `The ONS MMGD estimate was not assembled in this release (${pendencias}); no energy value is estimated in its place.`,
                    )}
                  </p>
                )}
                {!e && (
                  <p className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
                    {tx(
                      `Os fatores de emissão do MCTI não foram montados nesta publicação (${pendencias}); nenhum fator é estimado no lugar do oficial.`,
                      `The MCTI emission factors were not assembled in this release (${pendencias}); no factor is estimated in place of the official one.`,
                    )}
                  </p>
                )}

                <SecaoDoPainel id="ligacoes" titulo={tx("A mesma narrativa em outros painéis", "The same narrative in other panels")}>
                  <ul className="grid gap-x-8 gap-y-4 md:grid-cols-3">
                    {ligacoes().map((l) => (
                      <li key={l.href} className="border-l-2 border-linha pl-4 text-sm">
                        <Link href={l.href} className="inline-flex min-h-[44px] items-center font-medium text-energia-dark underline underline-offset-4 hover:text-carvao">
                          {l.rotulo}
                        </Link>
                        <p className="leading-relaxed text-carvao-muted">{l.texto}</p>
                      </li>
                    ))}
                  </ul>
                </SecaoDoPainel>

                <div id="arquivos" className="scroll-mt-28">
                  <TransicaoSeguir
                    ancora="panorama"
                    href={`${rotaPainel("p063")}#p063`}
                    pergunta={perguntaPainel("p063")}
                    downloads={g.downloads}
                  />
                  <p className="max-w-prose2 pb-1 pt-1 text-xs text-carvao-muted">
                    {tx(
                      "CSV com ponto e vírgula, ponto decimal e campo vazio para ausência; o JSON municipal é lido pelo mapa sob demanda.",
                      "CSV with semicolons, a decimal point and an empty field for missing data; the municipal JSON is read by the map on demand.",
                    )}
                  </p>
                </div>
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
