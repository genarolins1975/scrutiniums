import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { AguaAfluencia } from "@/components/energia/AguaAfluencia";
import { AguaPontes } from "@/components/energia/AguaPontes";
import { AguaAviso, AguaDatas, AguaFontes, AguaIndisponivel, AguaNavegacao, AguaRegras, AguaSeguir } from "@/components/energia/AguaPagina";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  COR_REGIAO,
  SUBSISTEMAS,
  anoInicial,
  colunasCapturas,
  colunasMltAnos,
  colunasPmo,
  colunasRevisoesCapturas,
  colunasRevisoesMlt,
  nomesProprios,
  colunasUnidade,
  curtoRegiao,
  entidadesEna,
  linhasCapturas,
  linhasMltAnos,
  linhasPmo,
  linhasRevisoesCapturas,
  linhasRevisoesMlt,
  linhasUnidade,
  listaMeses,
  listaTexto,
  mesesSemPmo,
  nomeProprio,
  nomeRegiao,
  perguntaPainel,
  provenienciaComRevisoesDaPagina,
  regraCapturaEna,
  regraFaixaEna,
  rotaPainel,
  serieDiferencaMlt,
  serieMltImplicita,
  serieMltJanJul,
  serieMltMensal,
  serieRegioes,
  situacaoAtualidade,
  textoConferenciaBacias,
  textoMltNaoConcluir,
  textoMudancaAfluencia,
  textoMudancaMltNoMes,
  textoRevisoesCapturas,
  textosMlt,
} from "@/lib/energia/agua";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import type { AguaDetalheGold } from "@/lib/energia/tipos-agua";
import { tx } from "@/lib/energia/idioma";
import { comNomes } from "@/components/energia/AguaLegenda";
import { NOME_RELATORIO_PMO } from "@/lib/energia/i18n/agua-carga-rede";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/agua-e-clima/afluencia", {
    title: tx("Água e clima: a água que chega aos reservatórios", "Water and climate: the water reaching the reservoirs"),
    description: tx(
      "Energia natural afluente (ENA) de 30 dias em % da MLT por subsistema, REE e bacia do ONS, como razão de somas, contra a faixa da mesma janela nos anos anteriores, e a versão da MLT do conjunto aberto comparada com a do PMO.",
      "30-day natural inflow energy (ENA) in % of the long-term average (MLT) by subsystem, REE and ONS basin, as a ratio of sums, against the range of the same window in previous years, and the version of the open-dataset MLT compared with the PMO's.",
    ),
    alternates: { canonical: "/setor-eletrico/agua-e-clima/afluencia" },
  }, anterior);
}

const fonte = () => tx("ONS, ENA Diário por Subsistema, por REE e por Bacia (captura mais recente de cada ano)", "ONS, daily ENA by subsystem, REE and basin (most recent capture of each year)");

export default function AfluenciaPage() {
  const g = lerGold<AguaDetalheGold>("agua_detalhe.json");
  if (!integra(g)) return <AguaIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const f = g.afluencia;
  const ev = g.evidencias;
  const prov = g.proveniencia;
  const entidades = entidadesEna(f);
  const atual = situacaoAtualidade(g.dias_referencia.ena, g.gerado_em, 3, tx("o ONS publica a ENA do dia anterior", "ONS publishes the previous day's ENA"));
  const versao = g.dias_referencia.ena;
  // o arquivo diário de 2000 em diante é a base da faixa: o CSV do painel começa em 2022, então a base entra à parte
  const downloads = [
    ...g.downloads.filter((d) => /agua_subsistemas_diario|agua_ear_recortes|agua_mlt_mudancas/.test(d.url)),
    {
      rotulo: tx("ENA diária por subsistema e SIN, série completa, a base da faixa usual (CSV)", "Daily ENA by subsystem and SIN, full series, the baseline of the usual range (CSV)"),
      url: "/energia/series/ena_diario.csv",
    },
  ];
  const conf = f.conferencia_bacias_sin;
  const implicita = serieMltImplicita(f.mlt);
  const desdeImplicita = anoInicial(implicita[0]?.x);
  const semPmo = mesesSemPmo(f.mlt);
  const mudancaNoMes = textoMudancaMltNoMes(f.mlt);
  const oQueMudou = (
    <>
      {atual.texto} {textoMudancaAfluencia(entidades)}
    </>
  );
  const comoInterpretar = tx(
    <>
      A ENA é a energia produzível a partir das vazões naturais que chegam aos reservatórios; o ONS a deriva da vazão natural reconstituída, e ela não é uma medição direta. 100% é
      a MLT dos mesmos dias. A ENA de 30 dias é a soma da ENA dividida pela soma da MLT vigente em cada dia, nunca a média dos percentuais diários; o SIN soma as ENA e as MLT
      dos quatro subsistemas. A faixa usual vai do 10º ao 90º percentil da mesma janela de 30 dias nos anos da base (mínimo de 5 anos).
    </>,
    <>
      The ENA is the energy that can be produced from the natural flows reaching the reservoirs; ONS derives it from the reconstructed natural flow, and it is not a direct
      measurement. 100% is the MLT for the same days. The 30-day ENA is the sum of the ENA divided by the sum of the MLT in force on each day, never the average of the daily
      percentages; the SIN adds up the ENAs and MLTs of the four subsystems. The usual range runs from the 10th to the 90th percentile of the same 30-day window in the baseline
      years (minimum of 5 years).
    </>,
  );
  const naoConcluir = tx(
    <>
      Afluência alta não quer dizer reservatório cheio: o armazenamento depende também de quanto se gera, verte e transfere (painel de reservatórios). O percentual da MLT é outra
      régua que o da energia armazenada (EAR), e os dois não se comparam. {textoMltNaoConcluir(f.mlt)}
    </>,
    <>
      High inflow does not mean a full reservoir: storage also depends on how much is generated, spilled and transferred (reservoirs panel). The percentage of MLT is a different
      yardstick from that of stored energy (EAR), and the two are not compared. {textoMltNaoConcluir(f.mlt)}
    </>,
  );
  const mwmed = tx("MWmed", "MWavg");
  const reeNovos = listaTexto(
    f.ree_novos_por_data.map((x) => tx(`${listaTexto(x.novos.map((n) => nomeProprio(n)))} em ${dataBR(x.data)}`, `${listaTexto(x.novos.map((n) => nomeProprio(n)))} on ${dataBR(x.data)}`)),
  );

  return (
    <>
      <CabecalhoEnergia atual="agua-e-clima" />
      <MarcaVisita secao="energia:agua-e-clima" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <AguaNavegacao atual="p018" />
        <CabecalhoModulo
          rotulo={tx("Água e clima", "Water and climate")}
          siglas={["ENA", "MLT", "REE", "SIN", "MWmed", "EAR", "ONS", "PMO"]}
          titulo={perguntaPainel("p018")}
          lead={tx(
            "A energia natural afluente (ENA) é a energia das vazões que chegam aos reservatórios e poderá ser guardada ou gerada; aqui, em 30 dias e em % da média de longo termo (MLT) do ONS.",
            "Natural inflow energy (ENA) is the energy of the flows reaching the reservoirs, which can be stored or generated; here, over 30 days and in % of the ONS long-term average (MLT).",
          )}
          limite={tx(
            "Afluência alta não quer dizer reservatório cheio: o armazenamento depende também de quanto se gera, verte e transfere.",
            "High inflow does not mean a full reservoir: storage also depends on how much is generated, spilled and transferred.",
          )}
          recorte={tx(`Até ${dataBR(g.dias_referencia.ena)} · SIN, REE e bacias · % da MLT`, `Through ${dataBR(g.dias_referencia.ena)} · SIN, REEs and basins · % of MLT`)}
          fonte={tx("ONS, ENA Diário", "ONS, daily ENA")}
          referencia={tx(
            <>
              ONS, ENA Diário por Subsistema, por REE e por Bacia, até {dataBR(g.dias_referencia.ena)}; MLT do Relatório Executivo do PMO; processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              ONS, <Nome>ENA Diário por Subsistema, por REE e por Bacia</Nome> (daily ENA by subsystem, REE and basin), through {dataBR(g.dias_referencia.ena)}; MLT from the PMO
              Executive Report (<Nome>Relatório Executivo do PMO</Nome>); processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <AguaDatas
              itens={[{ rotulo: tx("ENA, derivada pelo ONS das vazões naturais reconstituídas", "ENA, derived by ONS from reconstructed natural flows"), dia: g.dias_referencia.ena, natureza: "OBSERVADO" }]}
            />
          }
        >
          {tx(
            <>
              A <Termo slug="ena">ENA</Termo> converte em energia as vazões naturais que chegam aos reservatórios. Em % da <Termo slug="mlt">MLT</Termo>, ela diz se a água que chega está acima ou
              abaixo da média de longo termo usada pelo ONS. Para isso, a página soma 30 dias de ENA e 30 dias de MLT antes de dividir, compara o resultado com a mesma janela dos anos
              anteriores e mostra que a própria MLT muda de versão.
            </>,
            <>
              The <Termo slug="ena">ENA</Termo> (natural inflow energy) converts the natural flows reaching the reservoirs into energy. In % of the <Termo slug="mlt">MLT</Termo>, it says
              whether the incoming water is above or below the long-term average used by ONS. To do so, the page adds 30 days of ENA and 30 days of MLT before dividing, compares the result
              with the same window in previous years and shows that the MLT itself changes version.
            </>,
          )}
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="ena">
            <PainelEvidencia
              id="p018"
              pergunta={tx("Cada região frente à mediana da mesma janela", "Each region against the median of the same window")}
              subtitulo={tx("ENA derivada pelo ONS, de 30 dias, em % da MLT, contra a faixa da mesma janela", "30-day ENA derived by ONS, in % of MLT, against the range of the same window")}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>
                  A água que chega é a energia que poderá ser guardada ou gerada nas próximas semanas. Somar 30 dias suaviza a oscilação diária, e a comparação com a mesma
                  janela de outros anos separa a estação chuvosa de uma afluência fora do comum.
                </>,
                <>
                  The incoming water is the energy that can be stored or generated in the coming weeks. Adding 30 days smooths out the daily oscillation, and the comparison with the same
                  window in other years separates the rainy season from unusual inflow.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={provenienciaComRevisoesDaPagina(prov.ena_30d!, f.revisoes_entre_capturas_30d.filter((r) => r.serie === "ena_bruta_mwmed"), tx("da ENA bruta", "of the gross ENA"))}
              complementares={[
                ...(prov.ena_30d_ree ? [{ rotulo: tx("ENA de 30 dias por REE", "30-day ENA by REE"), p: prov.ena_30d_ree }] : []),
                ...(prov.ena_30d_bacia ? [{ rotulo: tx("ENA de 30 dias por bacia", "30-day ENA by basin"), p: prov.ena_30d_bacia }] : []),
                ...(prov.mlt ? [{ rotulo: tx("Mudanças da MLT por usina", "MLT changes by plant"), p: prov.mlt }] : []),
              ]}
            >
              <div className="space-y-6">
                {atual.defasada && <AguaAviso tipo="alerta">{atual.texto}</AguaAviso>}
                <AguaAfluencia
                  entidades={entidades}
                  serie={serieRegioes(f.serie_30d_semanal)}
                  passoDias={f.serie_30d_semanal.passo_dias}
                  reeNovos={f.ree_novos_por_data}
                  fonte={fonte()}
                  versao={versao}
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  evidencias={{ ena30d: ev.ena_30d_sin, enaArm30d: ev.ena_arm_30d_sin }}
                  revisoes={f.revisoes_entre_capturas_30d}
                  enderecoMedidas={`${rotaPainel("p018")}#p018`}
                />

                <SecaoDoPainel
                  id="mlt"
                  titulo={tx("Qual MLT? A referência muda de versão", "Which MLT? The reference changes version")}
                  lead={tx(
                    "A MLT, o 100% desta página, não é fixa: muda quando usinas entram ou saem e quando o ONS troca a versão dela. Por isso o percentual de 30 dias de épocas diferentes pode misturar referências diferentes.",
                    "The MLT, the 100% on this page, is not fixed: it changes when plants come in or go out and when ONS changes its version. That is why the 30-day percentage from different periods can mix different references.",
                  )}
                >
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-texto="mlt-resumo">
                    {tx(
                      <>
                        Em Analisar: a MLT dos arquivos de ENA do ONS contra a do relatório mensal do Programa Mensal de Operação (PMO), a MLT de cada subsistema em 15 de janeiro e
                        em 15 de julho, em que cada degrau é uma troca de versão, e as mudanças por usina.
                      </>,
                      <>
                        Under Analyze: the MLT of the ONS ENA files against that of the monthly report of the Monthly Operation Program (<Nome>Programa Mensal de Operação</Nome>, PMO), the MLT of
                        each subsystem on 15 January and 15 July, where each step is a change of version, and the changes by plant.
                      </>,
                    )}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="mlt-detalhes"
                  nivel="analisar"
                  titulo={tx("Como a MLT do PMO, a do conjunto aberto e as mudanças por usina se comparam", "How the PMO MLT, the open-dataset MLT and the changes by plant compare")}
                  lead={tx(
                    "Conjunto aberto: os arquivos de ENA que o ONS publica abertos, de onde a página lê a MLT. PMO: o Programa Mensal de Operação, relatório mensal do ONS. MLT implícita: a MLT que sai da ENA dividida pelo percentual da MLT, os dois lidos desses arquivos.",
                    "Open dataset: the ENA files that ONS publishes openly, from which the page reads the MLT. PMO: the Monthly Operation Program, a monthly ONS report. Implicit MLT: the MLT that results from the ENA divided by the percentage of MLT, both read from those files.",
                  )}
                >
                  <GraficoLinhas
                    titulo={tx(
                      "Diferença da MLT do conjunto aberto contra a do PMO no início de cada mês, por subsistema, em %",
                      "Difference between the open-dataset MLT and the PMO's at the start of each month, by subsystem, in %",
                    )}
                    dados={serieDiferencaMlt(f.mlt)}
                    chaveX="m"
                    formatoX="mes"
                    series={SUBSISTEMAS.map((sm) => ({ id: sm, rotulo: nomeRegiao(sm), sigla: curtoRegiao(sm), cor: COR_REGIAO[sm] }))}
                    banda={{
                      inferior: "tol_inf",
                      superior: "tol_sup",
                      rotulo: tx(`Tolerância de ${num(f.mlt.pmo.tolerancia_pct, 2)}% (o PMO publica MWmed inteiros)`, `Tolerance of ${num(f.mlt.pmo.tolerancia_pct, 2)}% (the PMO publishes whole MWavg)`),
                    }}
                    unidade="%"
                    casas={2}
                    zeroNoEixo
                    altura={260}
                  />
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-texto="mlt-lacuna">
                    {tx(
                      "Positivo: a MLT do conjunto aberto é maior que a do PMO. Fora da faixa de tolerância, as duas diferem.",
                      "Positive: the open-dataset MLT is higher than the PMO's. Outside the tolerance band, the two differ.",
                    )}
                    {semPmo.length > 0
                      ? tx(
                          ` Sem relatório do PMO coletado em ${listaMeses(semPmo)}: nesses meses não há comparação, e as linhas são interrompidas.`,
                          ` No PMO report collected in ${listaMeses(semPmo)}: in those months there is no comparison, and the lines are interrupted.`,
                        )
                      : ""}{" "}
                    {mudancaNoMes}
                  </p>
                  {ev.mlt_pmo_vs_aberto && (
                    <p className="text-sm text-carvao">
                      {tx(
                        "Diferença entre a MLT do conjunto aberto e a do PMO no Sudeste/Centro-Oeste, no mês mais recente: ",
                        "Difference between the open-dataset MLT and the PMO's in the Southeast/Center-West, in the most recent month: ",
                      )}
                      <ComproveNumero
                        variante="valor" // i18n: dado
                        evidencia={ev.mlt_pmo_vs_aberto}
                      />
                    </p>
                  )}
                  <PequenosMultiplos
                    titulo={tx(
                      `MLT implícita de cada subsistema no dia 15 de janeiro e no dia 15 de julho${desdeImplicita ? `, desde ${desdeImplicita}` : ""}`,
                      `Implicit MLT of each subsystem on 15 January and 15 July${desdeImplicita ? `, since ${desdeImplicita}` : ""}`,
                    )}
                    dados={serieMltJanJul(f.mlt)}
                    chaveX="x"
                    formatoX="texto"
                    unidade={mwmed}
                    casas={0}
                    escala="livre"
                    colunas={4}
                    nivelTitulo={4}
                    paineis={SUBSISTEMAS.map((sm) => ({
                      id: sm,
                      titulo: nomeRegiao(sm),
                      series: [
                        // o mesmo rótulo em todos os painéis: a legenda os junta em dois (a cor é a do subsistema, e o título do painel o nomeia)
                        { id: `${sm}_1`, rotulo: tx("15 de janeiro", "15 January"), cor: COR_REGIAO[sm], espessura: 2 },
                        { id: `${sm}_7`, rotulo: tx("15 de julho", "15 July"), cor: COR_REGIAO[sm], tracejada: true, espessura: 2 },
                      ],
                    }))}
                  />
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        Linha contínua: 15 de janeiro; linha tracejada: 15 de julho. MLT implícita = ENA ÷ (% da MLT ÷ 100), lida dos próprios arquivos. Ela cresce com a entrada de
                        usinas e muda quando o ONS troca a versão da referência; janeiro e julho mostram a estação chuvosa e a seca, e cada degrau é uma mudança de versão.{" "}
                        {f.mlt.anos_regra}.
                      </>,
                      <>
                        Solid line: 15 January; dashed line: 15 July. Implicit MLT = ENA ÷ (% of MLT ÷ 100), read from the files themselves. It grows as plants come in and changes when
                        ONS changes the version of the reference; January and July show the rainy and the dry season, and each step is a change of version.{" "}
                        <TrechoPortugues regiao="agua-mlt-anos-regra">{f.mlt.anos_regra}</TrechoPortugues>.
                      </>,
                    )}
                  </p>
                  <GraficoLinhas
                    titulo={tx("MLT do Sudeste/Centro-Oeste no PMO e no conjunto aberto, mês a mês", "MLT of the Southeast/Center-West in the PMO and in the open dataset, month by month")}
                    dados={serieMltMensal(f.mlt, "SE")}
                    chaveX="m"
                    formatoX="mes"
                    series={[
                      { id: "pmo", rotulo: tx("MLT do PMO (relatório do mês)", "PMO MLT (report for the month)"), cor: "var(--cor-previsto)" },
                      { id: "inicio", rotulo: tx("Conjunto aberto, início do mês", "Open dataset, start of the month"), cor: "var(--serie-sm-se)" },
                      { id: "fim", rotulo: tx("Conjunto aberto, fim do mês", "Open dataset, end of the month"), cor: "var(--serie-referencia)", tracejada: true },
                    ]}
                    unidade={mwmed}
                    casas={0}
                  />
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao" data-textos="mlt">
                    {textosMlt(f.mlt, g.dias_referencia.ena.slice(0, 4)).map((t) => (
                      <li key={t}>{comNomes(t, [NOME_RELATORIO_PMO])}</li>
                    ))}
                  </ul>
                  <TabelaInterativa
                    titulo={tx("MLT mensal do PMO contra a MLT implícita do conjunto aberto, por subsistema", "Monthly PMO MLT against the implicit open-dataset MLT, by subsystem")}
                    colunas={colunasPmo()}
                    linhas={linhasPmo(f.mlt)}
                    chaveLinha="id"
                    colunaRotulo="mes"
                    fonte={tx(
                      "ONS, Relatório Executivo do PMO (tabela MLT das ENAs) e ENA Diário por Subsistema",
                      "ONS, PMO Executive Report (MLT table of the ENAs) and daily ENA by subsystem",
                    )}
                    versao={versao}
                    nomeArquivo="agua-mlt-pmo"
                    chaveUrl="pmo"
                    ordemInicial={{ coluna: "mes", direcao: "desc" }}
                    nota={tx(
                      `Tolerância de ${num(f.mlt.pmo.tolerancia_pct, 2)}%: o PMO publica MWmed inteiros. Relatórios coletados: ${f.mlt.pmo.relatorios.length}.`,
                      `Tolerance of ${num(f.mlt.pmo.tolerancia_pct, 2)}%: the PMO publishes whole MWavg. Reports collected: ${f.mlt.pmo.relatorios.length}.`,
                    )}
                  />
                  <TabelaInterativa
                    titulo={tx("Mudanças da MLT de usinas existentes fora do dia 1º", "MLT changes of existing plants outside the 1st day of the month")}
                    colunas={colunasRevisoesMlt()}
                    linhas={linhasRevisoesMlt(f.mlt)}
                    chaveLinha="id"
                    colunaRotulo="data"
                    fonte={tx("ONS, ENA Diário por Reservatório", "ONS, daily ENA by reservoir")}
                    versao={versao}
                    nomeArquivo="agua-mlt-revisoes"
                    nota={tx(
                      "Comparação por igualdade com a MLT vigente na mesma data 1 e 2 anos antes; a lista por usina está no CSV de mudanças da MLT.",
                      "Comparison by equality with the MLT in force on the same date 1 and 2 years earlier; the list by plant is in the MLT changes CSV.",
                    )}
                  />
                  <TabelaInterativa
                    titulo={tx("MLT do fim de janeiro e de julho comparada com a do ano anterior, por usina", "MLT at the end of January and July compared with the previous year's, by plant")}
                    colunas={colunasMltAnos()}
                    linhas={linhasMltAnos(f.mlt)}
                    chaveLinha="id"
                    colunaRotulo="ano" // i18n: dado
                    fonte={tx("ONS, ENA Diário por Reservatório", "ONS, daily ENA by reservoir")}
                    versao={versao}
                    nomeArquivo="agua-mlt-anos"
                    ordemInicial={{ coluna: "ano", direcao: "desc" }} // i18n: dado
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="unidade" nivel="auditar" titulo={tx("Unidade, capturas e conferências", "Unit, captures and checks")}>
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      <>
                        Os dicionários do ONS chamam de MWmês as colunas de ENA por subsistema, REE e bacia, e de MWmed as por reservatório. A soma das usinas reproduz o
                        subsistema nas mesmas colunas: é a mesma unidade, MWmed (média do dia).
                      </>,
                      <>
                        The ONS data dictionaries call the ENA columns by subsystem, REE and basin MWmonth (<Nome>MWmês</Nome>), and those by reservoir MWavg (MWmed). The sum of the plants
                        reproduces the subsystem in the same columns: it is the same unit, MWavg (average over the day).
                      </>,
                    )}
                  </p>
                  <TabelaInterativa
                    titulo={tx("Soma da ENA das usinas contra a ENA do subsistema", "Sum of the plants' ENA against the subsystem's ENA")}
                    colunas={colunasUnidade()}
                    linhas={linhasUnidade(f.mlt)}
                    chaveLinha="id"
                    colunaRotulo="sm"
                    fonte={tx("ONS, ENA Diário por Reservatório e por Subsistema", "ONS, daily ENA by reservoir and by subsystem")}
                    versao={versao}
                    nomeArquivo="agua-ena-unidade"
                    nota={tx(
                      "O dia de exemplo é o mais recente comparado, não o dia da maior diferença. Esta publicação não informa em que anos a soma das usinas difere do subsistema nem o dia da maior diferença.",
                      "The example day is the most recent one compared, not the day of the largest difference. This release does not report in which years the sum of the plants differs from the subsystem nor the day of the largest difference.",
                    )}
                  />
                  {conf && (
                    <p className="text-sm text-carvao-muted" data-texto="conferencia-bacias">
                      {textoConferenciaBacias(conf)}
                    </p>
                  )}
                  {f.ree_novos_por_data.length > 0 && (
                    <p className="text-sm text-carvao-muted">
                      {tx(
                        <>
                          REE que aparecem no arquivo de ENA depois do início do conjunto:{" "}
                          {reeNovos}; a faixa desses REE usa só anos do
                          perímetro atual.
                        </>,
                        <>
                          REEs that appear in the ENA file after the start of the dataset:{" "}
                          {comNomes(reeNovos, nomesProprios(f.ree_novos_por_data.flatMap((x) => x.novos)))}; the range of those REEs uses only
                          years of the current perimeter.
                        </>,
                      )}
                    </p>
                  )}
                  <p className="text-sm text-carvao-muted">{textoRevisoesCapturas(f.revisoes_entre_capturas_30d)}</p>
                  <TabelaInterativa
                    titulo={tx(
                      "Revisões do ONS na ENA nos últimos 30 dias entre a captura anterior e a recaptura",
                      "ONS revisions of the ENA over the last 30 days between the previous capture and the recapture",
                    )}
                    colunas={colunasRevisoesCapturas()}
                    linhas={linhasRevisoesCapturas(f.revisoes_entre_capturas_30d)}
                    chaveLinha="id"
                    colunaRotulo="sm"
                    fonte={tx("ONS, ENA Diário por Subsistema (duas capturas)", "ONS, daily ENA by subsystem (two captures)")}
                    versao={versao}
                    nomeArquivo="agua-ena-revisoes-capturas"
                    semLinhas={tx("Nenhuma revisão entre as capturas.", "No revision between the captures.")}
                  />
                  <TabelaInterativa
                    titulo={tx("Captura usada em cada ano", "Capture used in each year")}
                    colunas={colunasCapturas()}
                    linhas={linhasCapturas(f.captura_por_ano)}
                    chaveLinha="id"
                    colunaRotulo="ano" // i18n: dado
                    fonte={tx("ONS, ENA Diário por Subsistema", "ONS, daily ENA by subsystem")}
                    versao={versao}
                    nomeArquivo="agua-ena-capturas"
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="regras-p018" nivel="auditar" titulo={tx("Regras, fontes e arquivos", "Rules, sources and files")}>
                  <AguaRegras
                    regras={{ ...g.regras, faixa_sazonal: regraFaixaEna(), captura: regraCapturaEna() }}
                    chaves={["ena_30d", "mlt", "faixa_sazonal", "captura"]}
                    proprias={["faixa_sazonal", "captura"]}
                  />
                  <AguaFontes provs={[prov.ena_30d, prov.ena_30d_ree, prov.ena_30d_bacia, prov.mlt]} />
                </SecaoDoPainel>

                <AguaPontes
                  itens={[
                    {
                      slug: "agua-e-clima",
                      rotulo: tx("Conferência com a Visão geral e o PLD", "Check against the Overview and PLD pages"),
                      href: `${rotaPainel("p017")}#conferencia-resumo`,
                      assunto: tx(
                        "Se a Visão geral ou o PLD mostram outro valor de ENA ou de EAR, a página de armazenamento (em Auditar) põe os dois lado a lado, cada um com o seu dia.",
                        "If the Overview or PLD pages show a different ENA or EAR value, the storage page (under Audit) puts the two side by side, each with its own day.",
                      ),
                    },
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

                <AguaSeguir ancora="p018" proximo={{ href: `${rotaPainel("p019")}#p019`, pergunta: perguntaPainel("p019") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
