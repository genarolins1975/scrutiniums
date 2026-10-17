import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { AguaArmazenamento } from "@/components/energia/AguaArmazenamento";
import { AguaPontes } from "@/components/energia/AguaPontes";
import {
  AguaAnalise,
  AguaAuditoria,
  AguaAviso,
  AguaDatas,
  AguaFontes,
  AguaIndisponivel,
  AguaNavegacao,
  AguaParteAusente,
  AguaRegras,
  AguaSeguir,
} from "@/components/energia/AguaPagina";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { Numero } from "@/components/energia/Numero";
import { RedirecionaAncoraAntiga } from "@/components/energia/RedirecionaAncoraAntiga";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  ANCORAS_AFLUENCIA,
  LIMITE_VARIACAO_CAPACIDADE,
  anoInicial,
  colunasCapturas,
  colunasEventos,
  colunasFimDeAno,
  colunasQuebraRee,
  colunasReservatoriosPorAno,
  colunasResumo,
  colunasRevisoesCapturas,
  entidadesEar,
  linhasCapturas,
  linhasEventos,
  linhasFimDeAno,
  linhasQuebraRee,
  linhasReservatoriosPorAno,
  linhasResumo,
  linhasRevisoesCapturas,
  periodoBase,
  perguntaPainel,
  provenienciaComRevisoesDaPagina,
  respostaCapacidade,
  revisoesCapacidade,
  rotaPainel,
  serieMensalEar,
  serieRegioes,
  situacaoAtualidade,
  textoJanelasDaVariacao,
  textoMesParcial,
  textoMudancaArmazenamento,
  textoQuebraRee,
  textoReconciliacaoEar,
  textoResumo,
  textoRevisoesCapturas,
  textoRevisoesFichaEar,
  textoTiposDeEvento,
  textoToleranciaEventos,
} from "@/lib/energia/agua";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { gold, integra, lerGold } from "@/lib/energia/gold";
import type { AguaDetalheGold } from "@/lib/energia/tipos-agua";
import { tx } from "@/lib/energia/idioma";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/agua-e-clima", {
    title: tx("Água e clima: energia armazenada nos reservatórios", "Water and climate: energy stored in the reservoirs"),
    description: tx(
      "Energia armazenada (EAR) do SIN, dos subsistemas, dos REE e das bacias do ONS, em MWmês e em % da capacidade, contra a faixa do mesmo dia nos anos anteriores, com as mudanças de capacidade e a reconciliação entre os recortes.",
      "Stored energy (EAR) of the SIN, the subsystems, the REEs and the ONS basins, in MWmonth and in % of capacity, against the range for the same day in previous years, with the capacity changes and the reconciliation between the areas.",
    ),
    alternates: { canonical: "/setor-eletrico/agua-e-clima" },
  }, anterior);
}

const fonte = () => tx("ONS, EAR Diário por Subsistema, por REE e por Bacia (captura mais recente de cada ano)", "ONS, EAR Diário por Subsistema, por REE e por Bacia (daily EAR by subsystem, REE and basin; most recent capture of each year)");
const URLS_P017 = ["agua_subsistemas_diario", "agua_ear_recortes_diario", "agua_ear_recortes_mensal", "agua_capacidade_eventos"];

export default function AguaPage() {
  const g = lerGold<AguaDetalheGold>("agua_detalhe.json");
  if (!integra(g)) return <AguaIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  // resumo de operação (hidrologia.json): só para a conferência do modo Auditar; os números
  // desta página vêm todos de agua_detalhe.json
  const hid = gold.hidrologia();
  const h = integra(hid) ? hid : null;
  const REVISOES_CAPACIDADE = revisoesCapacidade();

  const a = g.armazenamento;
  const ev = g.evidencias;
  const prov = g.proveniencia;
  const entidades = entidadesEar(a);
  const sin = entidades.find((x) => x.tipo === "subsistema" && x.id === "SIN") ?? null;
  const atual = situacaoAtualidade(g.dias_referencia.ear, g.gerado_em, 3, tx("o ONS publica a EAR do dia anterior", "ONS publishes the previous day's EAR"));
  const versao = g.dias_referencia.ear;
  const downloads = [
    ...g.downloads.filter((d) => URLS_P017.some((u) => d.url.includes(u))),
    // a série diária completa, em %, que dá a faixa de cada data: o diário do painel começa depois (a base da faixa não cabe nele)
    {
      rotulo: tx(
        "EAR diária por subsistema e SIN em % da EAR máxima, série completa, a base da faixa usual (CSV)",
        "Daily EAR by subsystem and SIN in % of maximum EAR, full series, the baseline of the usual range (CSV)",
      ),
      url: "/energia/series/ear_diario.csv",
    },
  ];
  const rec = g.reconciliacao_ear;
  const quebra = a.quebras_perimetro_ree[0] ?? null;
  // a variação por reservatório pode faltar numa publicação sem os dados hidráulicos: sem ela, a outra janela não é dita
  const decomposicoes = g.reservatorios?.decomposicao_ear ?? [];
  // as fichas da EAR dizem o que a tabela de revisões da própria página mostra
  const revisoesEar = textoRevisoesFichaEar(rec.revisoes_entre_capturas_30d);
  // ano inicial da contagem de capacidade e base da faixa do SIN: lidos da gold, não escritos aqui
  const desdeCap = anoInicial(a.capacidade.inicio);
  const oQueMudouAgua = (
    <>
                      {atual.texto} {textoMudancaArmazenamento(entidades)} {textoJanelasDaVariacao(sin?.dia ?? null, decomposicoes)}
                    </>
  );
  const comoInterpretarAgua = tx(
    <>
                      A mediana é o valor do meio: metade dos anos da base ficou abaixo dele na data, e metade acima. A área sombreada vai do 10º ao 90º percentil do mesmo
                      dia do calendário nos anos completos da base: fora dela, a EAR está entre os 10% de anos mais baixos ou mais altos da data. O SIN é a soma das energias dividida pela soma das capacidades, nunca a média dos percentuais. Com menos de
                      5 anos na base não há faixa, e recorte sem armazenamento (só usinas a fio d&apos;água) aparece como não se aplica. A figura da faixa da data mostra a
                      mesma faixa em % e em MWmês, conforme a unidade escolhida.
                    </>,
    <>
      The median is the middle value: half of the baseline years were below it on that date, and half above. The shaded area runs from the 10th to the 90th percentile of the same
      calendar day in the complete baseline years: outside it, the EAR is among the 10% lowest or highest years for that date. The SIN is the sum of the energies divided by the sum of
      the capacities, never the average of the percentages. With fewer than 5 years in the baseline there is no range, and an area without storage (only run-of-river plants) appears as
      not applicable. The figure of the range for the date shows the same range in % and in MWmonth, according to the unit chosen.
    </>,
  );
  const naoConcluirAgua = tx(
    <>
                      A posição na faixa não mede risco de desabastecimento nem diz qual será o preço. A EAR máxima mudou ao longo da base, então a faixa em %
                      compara capacidades diferentes (a faixa em MWmês está na figura da faixa da data e na tabela); quando a EAR máxima variou mais de{" "}
                      {num(LIMITE_VARIACAO_CAPACIDADE * 100, 0)}% na base, a posição frente à faixa não é dita. Um SIN dentro da faixa pode esconder um subsistema ou uma
                      bacia apertada. A variação da EAR não se explica só pela ENA: a conta por reservatório está no painel de reservatórios.
                    </>,
    <>
      The position in the range does not measure the risk of supply shortage nor say what the price will be. The maximum EAR changed over the baseline, so the range in % compares
      different capacities (the range in MWmonth is in the figure of the range for the date and in the table); when the maximum EAR varied by more than{" "}
      {num(LIMITE_VARIACAO_CAPACIDADE * 100, 0)}% over the baseline, the position against the range is not stated. A SIN within the range can hide a tight subsystem or basin. The change
      in EAR is not explained by the ENA alone: the reservoir-by-reservoir balance is in the reservoirs panel.
    </>,
  );
  const baseSin = a.subsistemas.find((s) => s.sm === "SIN")?.periodo_base ?? null;
  const daEarMax = tx("da EAR máxima", "of maximum EAR");

  return (
    <>
      <CabecalhoEnergia atual="agua-e-clima" />
      <MarcaVisita secao="energia:agua-e-clima" />
      <RedirecionaAncoraAntiga ancoras={ANCORAS_AFLUENCIA} destino={rotaPainel("p018")} />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <AguaNavegacao atual="p017" />
        <CabecalhoModulo
          siglas={["EAR", "SIN", "REE", "ENA", "MLT", "ONS", "PLD"]}
          titulo={perguntaPainel("p017")}
          lead={tx(
            "A energia armazenada (EAR) é a reserva de água, medida em energia, com que o Sistema Interligado Nacional (SIN) conta nos meses secos; aqui, por região e frente à mediana (o valor do meio) da mesma data nos anos anteriores.",
            "Stored energy (EAR) is the water reserve, measured in energy, that the National Interconnected System (SIN) relies on in the dry months; here, by region and against the median (the middle value) for the same date in previous years.",
          )}
          limite={tx("A posição na faixa não mede risco de desabastecimento nem diz qual será o preço.", "The position in the range does not measure the risk of supply shortage nor say what the price will be.")}
          recorte={
            sin?.dia
              ? tx(`${dataBR(sin.dia)} · SIN e subsistemas · % da EAR máxima e MWmês`, `${dataBR(sin.dia)} · SIN and subsystems · % of maximum EAR and MWmonth`)
              : undefined
          }
          fonte={tx("ONS, energia armazenada (EAR) e energia natural afluente (ENA)", "ONS, stored energy (EAR) and natural inflow energy (ENA)")}
          referencia={tx(
            <>
              ONS (EAR, ENA e dados hidráulicos), NASA POWER (chuva e temperatura estimadas) e ECMWF pelo Open-Meteo (previsão); processado em{" "}
              {carimbo(g.gerado_em)}.
            </>,
            <>
              ONS (EAR, ENA and hydraulic data), NASA POWER (estimated rainfall and temperature) and ECMWF through Open-Meteo (forecast); processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <AguaDatas
              itens={[
                { rotulo: tx("EAR, derivada pelo ONS, não medição direta", "EAR, derived by ONS, not a direct measurement"), dia: g.dias_referencia.ear, natureza: "OBSERVADO" },
                { rotulo: tx("ENA, derivada pelo ONS das vazões naturais reconstituídas", "ENA, derived by ONS from reconstructed natural flows"), dia: g.dias_referencia.ena, natureza: "OBSERVADO" },
                {
                  rotulo: tx("Reservatórios (afluência e defluência derivadas pelo ONS)", "Reservoirs (inflow and outflow derived by ONS)"),
                  dia: g.dias_referencia.reservatorios,
                  natureza: "OBSERVADO",
                },
                { rotulo: tx("Chuva por satélite", "Satellite rainfall"), dia: g.dias_referencia.precipitacao, natureza: "ESTIMADO" },
                { rotulo: tx("Temperatura de reanálise", "Reanalysis temperature"), dia: g.dias_referencia.temperatura, natureza: "ESTIMADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx(
                "Indicadores do armazenamento no SIN, fixos: não mudam com o recorte escolhido nos gráficos",
                "SIN storage indicators, fixed: they do not change with the area chosen in the charts",
              )}
            >
              <Numero
                variante="faixa"
                rotulo={tx("Armazenamento do SIN", "SIN storage")}
                natureza="CALCULADO"
                evidencia={ev.ear_sin}
                revisoes={revisoesEar}
                nota={tx("Últimos dias são provisórios.", "The last few days are provisional.")}
                formato="pct"
                casas={1}
                unidade={daEarMax}
                cor="var(--cor-energia)"
                endereco={`${rotaPainel("p017")}#p017`}
              />
              {sin && sin.p50 !== null && (
                <Numero
                  variante="faixa"
                  rotulo={tx("Mediana do SIN na mesma data", "SIN median for the same date")}
                  natureza="CALCULADO"
                  valor={sin.p50}
                  formato="pct"
                  casas={1}
                  unidade={daEarMax}
                  periodo={tx(`mesmo dia do ano em ${periodoBase(sin.periodo_base)}`, `same day of the year in ${periodoBase(sin.periodo_base)}`)}
                  cor="var(--serie-referencia)"
                />
              )}
              <Numero
                variante="faixa"
                rotulo={tx("Energia armazenada do SIN", "SIN stored energy")}
                natureza="CALCULADO"
                evidencia={ev.ear_sin_mwmes}
                revisoes={revisoesEar}
                formato="num"
                casas={0}
                unidade={tx("MWmês", "MWmonth")}
                cor="var(--cor-energia)"
                endereco={`${rotaPainel("p017")}#p017`}
              />
              {sin && sin.variacao_30d_pp !== null && (
                <Numero
                  variante="faixa"
                  rotulo={tx("Variação do SIN em 30 dias", "SIN change over 30 days")}
                  natureza="CALCULADO"
                  valor={sin.variacao_30d_pp}
                  formato="num"
                  casas={1}
                  unidade={tx("p.p. da EAR máxima", "pp of maximum EAR")}
                  periodo={sin.dia ? tx(`30 dias até ${dataBR(sin.dia)}`, `30 days through ${dataBR(sin.dia)}`) : undefined}
                />
              )}
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              A <Termo slug="ear">EAR</Termo> é a energia que a água guardada nos reservatórios produziria nas usinas, em <Unidade u="MWmês" />; a{" "}
              <Termo slug="ena">ENA</Termo> é a energia das vazões naturais que chegam a eles, comparada com a <Termo slug="mlt">MLT</Termo>. As quatro páginas
              respondem, nesta ordem: quanto está guardado, se a água que chega está acima do normal, como chuva e temperatura se relacionam com a água e com a
              demanda, e por que o armazenamento mudou, reservatório por reservatório.
            </>,
            <>
              The <Termo slug="ear">EAR</Termo> (stored energy) is the energy that the water held in the reservoirs would produce in the plants, in <Unidade u="MWmês" />; the{" "}
              <Termo slug="ena">ENA</Termo> (natural inflow energy) is the energy of the natural flows reaching them, compared with the <Termo slug="mlt">MLT</Termo> (long-term
              average). The four pages answer, in this order: how much is stored, whether the incoming water is above normal, how rainfall and temperature relate to water and to
              demand, and why storage changed, reservoir by reservoir.
            </>,
          )}
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="ear">
            <PainelEvidencia
              id="p017"
              pergunta={tx("Cada região frente à mediana da mesma data", "Each region against the median for the same date")}
              subtitulo={tx(
                "EAR derivada pelo ONS: SIN, subsistemas, reservatórios equivalentes de energia (REE) e bacias · MWmês e % da EAR máxima",
                "EAR derived by ONS: SIN, subsystems, equivalent energy reservoirs (REE) and basins · MWmonth and % of maximum EAR",
              )}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>
                  A EAR diz quanta energia o sistema tem guardada em água. Em MWmês ela mostra o tamanho do estoque; em % da EAR máxima, quão cheio está cada
                  recorte. Comparar com o mesmo dia de anos anteriores separa a estação do ano de uma situação fora do comum.
                </>,
                <>
                  The EAR says how much energy the system has stored in water. In MWmonth it shows the size of the stock; in % of maximum EAR, how full each area is. Comparing with the
                  same day in previous years separates the season of the year from an unusual situation.
                </>,
              )}
              oQueMudou={oQueMudouAgua}
              comoInterpretar={comoInterpretarAgua}
              naoConcluir={naoConcluirAgua}
              naoConcluirNoCorpo
              proveniencia={provenienciaComRevisoesDaPagina(prov.ear_sin!, rec.revisoes_entre_capturas_30d.filter((r) => r.serie === "ear_mwmes"), tx("da EAR", "of the EAR"))}
              complementares={[
                ...(prov.ear_ree ? [{ rotulo: tx("EAR por REE", "EAR by REE"), p: prov.ear_ree }] : []),
                ...(prov.ear_bacia ? [{ rotulo: tx("EAR por bacia", "EAR by basin"), p: prov.ear_bacia }] : []),
                ...(prov.capacidade ? [{ rotulo: tx("Mudanças de capacidade", "Capacity changes"), p: prov.capacidade }] : []),
              ]}
            >
              <div className="space-y-6">
                {atual.defasada && <AguaAviso tipo="alerta">{atual.texto}</AguaAviso>}
                <div id="padrao" className="scroll-mt-28">
                  <AguaArmazenamento
                    entidades={entidades}
                    diaria={serieRegioes(a.serie_diaria_mwmes)}
                    mensal={serieMensalEar(a.serie_mensal_mwmes)}
                    textoMensal={textoMesParcial(a.serie_mensal_mwmes)}
                    fonte={fonte()}
                    versao={versao}
                    notas={<NotasDoPainel oQueMudou={oQueMudouAgua} comoInterpretar={comoInterpretarAgua} naoConcluir={naoConcluirAgua} />}
                    decomposicoes={decomposicoes}
                    revisoes={rec.revisoes_entre_capturas_30d}
                    destaquesHistoria={
                      <Numero
                        variante="faixa"
                        rotulo={tx(
                          `Mudanças da capacidade de armazenamento (EAR máxima)${desdeCap ? ` desde ${desdeCap}` : ""}`,
                          `Changes in storage capacity (maximum EAR)${desdeCap ? ` since ${desdeCap}` : ""}`,
                        )}
                        natureza="CALCULADO"
                        evidencia={ev.capacidade}
                        revisoes={REVISOES_CAPACIDADE}
                        formato="num"
                        casas={0}
                        unidade={tx("mudanças", "changes")}
                        cor="var(--serie-referencia)"
                        nota={
                          a.capacidade.eventos_fechados === a.capacidade.n_eventos
                            ? tx(
                                "Cada mudança é um dia em que a EAR máxima de um subsistema mudou. Todas foram atribuídas a reservatórios, e a diferença que sobra em cada uma (o resíduo) está publicada.",
                                "Each change is a day on which the maximum EAR of a subsystem changed. All were attributed to reservoirs, and the difference left over in each one (the residual) is published.",
                              )
                            : tx(
                                `Cada mudança é um dia em que a EAR máxima de um subsistema mudou. ${a.capacidade.eventos_fechados} de ${a.capacidade.n_eventos} foram atribuídas a reservatórios dentro da tolerância; a diferença que sobra em cada uma (o resíduo) está publicada.`,
                                `Each change is a day on which the maximum EAR of a subsystem changed. ${a.capacidade.eventos_fechados} of ${a.capacidade.n_eventos} were attributed to reservoirs within the tolerance; the difference left over in each one (the residual) is published.`,
                              )
                        }
                        endereco={`${rotaPainel("p017")}#capacidade`}
                      />
                    }
                  />
                </div>

                <AguaAnalise
                  id="capacidade"
                  titulo={tx(`Mudanças da capacidade de armazenamento${desdeCap ? ` desde ${desdeCap}` : ""}`, `Changes in storage capacity${desdeCap ? ` since ${desdeCap}` : ""}`)}
                >
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-resposta="p017-capacidade">
                    {respostaCapacidade(a.capacidade, a.dia)}
                  </p>
                  {ev.capacidade && <ComproveNumero evidencia={{ ...ev.capacidade, revisoes: REVISOES_CAPACIDADE }} />}
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-texto="tipos-de-evento">
                    {textoTiposDeEvento()}
                  </p>
                  <TabelaInterativa
                    titulo={tx(
                      "Dias em que a EAR máxima de um subsistema mudou, com os reservatórios que explicam a mudança",
                      "Days on which the maximum EAR of a subsystem changed, with the reservoirs that explain the change",
                    )}
                    colunas={colunasEventos()}
                    linhas={linhasEventos(a.capacidade.eventos)}
                    chaveLinha="id"
                    colunaRotulo="data"
                    fonte={tx("ONS, EAR Diário por Reservatório e por Subsistema", "ONS, EAR Diário por Reservatório e por Subsistema (daily EAR by reservoir and by subsystem)")}
                    versao={versao}
                    nomeArquivo="agua-capacidade-eventos"
                    chaveUrl="cap"
                    ordemInicial={{ coluna: "data", direcao: "desc" }}
                    nota={textoToleranciaEventos(a.capacidade.eventos)}
                  />
                  <TabelaInterativa
                    titulo={tx("EAR máxima no último dia de cada ano, por subsistema e SIN", "Maximum EAR on the last day of each year, by subsystem and SIN")}
                    colunas={colunasFimDeAno()}
                    linhas={linhasFimDeAno(a.capacidade)}
                    chaveLinha="id"
                    colunaRotulo="ano" // i18n: dado
                    fonte={tx("ONS, EAR Diário por Subsistema", "ONS, EAR Diário por Subsistema (daily EAR by subsystem)")}
                    versao={versao}
                    nomeArquivo="agua-ear-maxima-fim-de-ano"
                    ordemInicial={{ coluna: "ano", direcao: "desc" }} // i18n: dado
                    nota={tx("O último ano é parcial: o dia usado é o último publicado.", "The last year is partial: the day used is the last one published.")}
                  />
                </AguaAnalise>

                {quebra && (
                  <AguaAnalise id="perimetro-ree" titulo={tx("A reconfiguração dos REE no fim de 2017", "The reconfiguration of the REEs at the end of 2017")}>
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-texto="quebra-ree">
                      {textoQuebraRee(quebra)}
                    </p>
                    <TabelaInterativa
                      titulo={tx(`EAR máxima de cada REE antes e depois de ${dataBR(quebra.data)}`, `Maximum EAR of each REE before and after ${dataBR(quebra.data)}`)}
                      colunas={colunasQuebraRee()}
                      linhas={linhasQuebraRee(quebra)}
                      chaveLinha="id"
                      colunaRotulo="nome"
                      fonte={tx("ONS, EAR Diário por REE", "ONS, EAR Diário por REE (daily EAR by REE)")}
                      versao={quebra.data}
                      nomeArquivo="agua-ree-reconfiguracao"
                    />
                  </AguaAnalise>
                )}

                <AguaAuditoria id="reconciliacao" titulo={tx("O mesmo SIN por caminhos diferentes, e as capturas usadas", "The same SIN by different routes, and the captures used")}>
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-carvao-muted" data-textos="reconciliacao">
                    {textoReconciliacaoEar(rec).map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  {ev.ear_sin_mwmes && <ComproveNumero evidencia={{ ...ev.ear_sin_mwmes, revisoes: revisoesEar }} rotulo={tx("Comprove a soma do SIN", "Check the SIN sum")} />}
                  <TabelaInterativa
                    titulo={tx(
                      "Anos e subsistemas em que a soma dos reservatórios difere do subsistema além da tolerância",
                      "Years and subsystems in which the sum of the reservoirs differs from the subsystem beyond the tolerance",
                    )}
                    colunas={colunasReservatoriosPorAno()}
                    linhas={linhasReservatoriosPorAno(rec)}
                    chaveLinha="id"
                    colunaRotulo="ano" // i18n: dado
                    fonte={tx("ONS, EAR Diário por Reservatório e por Subsistema", "ONS, EAR Diário por Reservatório e por Subsistema (daily EAR by reservoir and by subsystem)")}
                    versao={versao}
                    nomeArquivo="agua-reconciliacao-reservatorios"
                    semLinhas={tx("Nenhum ano fora da tolerância.", "No year outside the tolerance.")}
                    nota={tx(
                      "Causa não identificada; o dado do ONS não é corrigido. A diferença aparece também como ressalva da publicação.",
                      "Cause not identified; the ONS data is not corrected. The difference also appears as a caveat of the release.",
                    )}
                  />
                  <p className="text-sm text-carvao-muted">{textoRevisoesCapturas(rec.revisoes_entre_capturas_30d)}</p>
                  <TabelaInterativa
                    titulo={tx("Revisões do ONS nos últimos 30 dias entre a captura anterior e a recaptura", "ONS revisions over the last 30 days between the previous capture and the recapture")}
                    colunas={colunasRevisoesCapturas()}
                    linhas={linhasRevisoesCapturas(rec.revisoes_entre_capturas_30d)}
                    chaveLinha="id"
                    colunaRotulo="sm"
                    fonte={tx("ONS, EAR Diário por Subsistema (duas capturas)", "ONS, EAR Diário por Subsistema (daily EAR by subsystem; two captures)")}
                    versao={versao}
                    nomeArquivo="agua-ear-revisoes-capturas"
                    semLinhas={tx("Nenhuma revisão entre as capturas.", "No revision between the captures.")}
                  />
                  <TabelaInterativa
                    titulo={tx("Captura usada em cada ano", "Capture used in each year")}
                    colunas={colunasCapturas()}
                    linhas={linhasCapturas(rec.captura_por_ano)}
                    chaveLinha="id"
                    colunaRotulo="ano" // i18n: dado
                    fonte={tx("ONS, EAR Diário por Subsistema", "ONS, EAR Diário por Subsistema (daily EAR by subsystem)")}
                    versao={versao}
                    nomeArquivo="agua-ear-capturas"
                  />
                  {g.ressalvas.length > 0 && (
                    <div>
                      <p className="rotulo text-mineral">{tx("Ressalvas desta publicação", "Caveats of this release")}</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                        {g.ressalvas.map((r) => (
                          <li key={r}>
                            <TrechoPortugues regiao="agua-ressalva">{r}</TrechoPortugues>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </AguaAuditoria>

                <AguaAuditoria id="regras-p017" titulo={tx("Regras, fontes e arquivos", "Rules, sources and files")}>
                  <AguaRegras regras={g.regras} chaves={["ear_agregada", "ear_absoluta", "faixa_sazonal", "nao_se_aplica", "capacidade", "captura"]} />
                  <AguaFontes provs={[prov.ear_sin, prov.ear_ree, prov.ear_bacia, prov.capacidade]} />
                </AguaAuditoria>

                <AguaPontes
                  itens={[
                    {
                      slug: "geracao",
                      assunto: tx(
                        "Quanto cada fonte gerou, a hidrelétrica inclusive: outro painel, com outra fonte de dados.",
                        "How much each source generated, hydropower included: another panel, with another data source.",
                      ),
                    },
                    { slug: "pld", assunto: tx("O PLD por submercado: outro painel, com outra fonte de dados.", "The spot price (PLD) by submarket: another panel, with another data source.") },
                    {
                      slug: "conta-de-luz",
                      assunto: tx(
                        "Tarifas e componentes da conta de luz por distribuidora: outro painel, com outra fonte de dados.",
                        "Tariffs and components of the electricity bill by distribution utility: another panel, with another data source.",
                      ),
                    },
                  ]}
                />

                <AguaSeguir
                  ancora="p017"
                  proximo={{
                    href: `${rotaPainel("p018")}#p018`,
                    pergunta: perguntaPainel("p018"),
                  }}
                  downloads={downloads}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          <Bloco id="resumo-operacao" nivel="auditar">
            {h ? (
              <PainelEvidencia
                id="conferencia-resumo"
                nivel="auditar"
                pergunta={tx(
                  "Por que a Visão geral e o PLD podem mostrar outro número de EAR e de ENA?",
                  "Why can the Overview and PLD pages show a different EAR and ENA figure?",
                )}
                subtitulo={tx(
                  "Resumo de operação (hidrologia.json) e esta página, cada um com o seu dia · % da EAR máxima e % da MLT",
                  "Operation summary (hidrologia.json) and this page, each with its own day · % of maximum EAR and % of MLT",
                )}
                natureza="CALCULADO"
                porQueImporta={tx(
                  <>Quem chega da Visão geral ou do PLD encontra aqui a mesma grandeza; esta conferência mostra de onde vem cada número e o dia de cada um.</>,
                  <>Readers coming from the Overview or PLD pages find the same quantity here; this check shows where each figure comes from and the day of each one.</>,
                )}
                oQueMudou={<>{textoResumo(h, g.dias_referencia.ear, g.dias_referencia.ena, baseSin)}</>}
                comoInterpretar={tx(
                  <>Cada linha traz o valor do resumo e o desta página com o dia de cada um. Nenhuma diferença é calculada: dias diferentes não se subtraem.</>,
                  <>Each row shows the summary value and this page's value with the day of each. No difference is calculated: different days are not subtracted.</>,
                )}
                naoConcluir={tx(
                  <>
                    Uma diferença entre as duas publicações não indica erro de cálculo: a captura e o dia de referência podem ser outros, e o ONS revisa os dias
                    recentes.
                  </>,
                  <>
                    A difference between the two releases does not indicate a calculation error: the capture and the reference day may differ, and ONS revises recent days.
                  </>,
                )}
                proveniencia={h.proveniencia.ena30}
                complementares={[
                  { rotulo: tx("EAR do SIN no resumo", "SIN EAR in the summary"), p: h.proveniencia.ear_sin },
                  {
                    rotulo: tx("Faixa histórica do resumo", "Historical range in the summary"),
                    p: h.proveniencia.padrao,
                  },
                  {
                    rotulo: tx("EAR mensal do resumo", "Monthly EAR in the summary"),
                    p: h.proveniencia.ear_mensal ?? h.proveniencia.ear,
                  },
                ]}
              >
                <TabelaInterativa
                  titulo={tx("EAR e ENA de 30 dias no resumo de operação e nesta página", "EAR and 30-day ENA in the operation summary and on this page")}
                  colunas={colunasResumo()}
                  linhas={linhasResumo(h, a, g.afluencia)}
                  chaveLinha="id"
                  colunaRotulo="regiao"
                  fonte={tx(
                    "hidrologia.json (silver principal) e agua_detalhe.json (captura mais recente de cada ano), ONS",
                    "hidrologia.json (main silver capture) and agua_detalhe.json (most recent capture of each year), ONS",
                  )}
                  versao={versao}
                  nomeArquivo="agua-conferencia-resumo"
                />
              </PainelEvidencia>
            ) : (
              <AguaParteAusente
                titulo={tx("Conferência com o resumo de operação", "Check against the operation summary")}
                motivo={textoResumo(null, g.dias_referencia.ear, g.dias_referencia.ena, baseSin)}
              />
            )}
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
