import type { Metadata, ResolvingMetadata } from "next";
import type { ReactNode } from "react";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { CargaClima, CargaClimaMetricas } from "@/components/energia/CargaClima";
import { CargaAviso, CargaDatas, CargaFontes, CargaIndisponivel, CargaNavegacao, CargaSeguir } from "@/components/energia/CargaPagina";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { REGIOES, ROTULO_GRUPO, decomposicaoEscolhida, nomeRegiao, partesDaDiferenca, perguntaPainel, rotaPainel, rotuloGrupo } from "@/lib/energia/carga";
import { CargaCascata } from "@/components/energia/CargaCascata";
import { ParaLer } from "@/components/energia/Didatica";
import { carimbo, dataBR, mesAno, num, normaLegivel, sinal } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { CATEGORIA_CALENDARIO_EN, rotuloDaGold } from "@/lib/energia/i18n/agua-carga-rede";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { CargaDetalheGold } from "@/lib/energia/tipos-carga";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/carga/clima-e-calendario", {
    title: tx("Carga: clima e calendário", "Load: climate and calendar"),
    description: tx(
      "Decomposição estatística da carga diária do SIN e dos subsistemas em calendário, temperatura, sazonalidade e tendência, estimada só com o passado e avaliada fora da amostra, com intervalos, resíduos, referência ingênua e sensibilidade. Associação, não causa.",
      "Statistical breakdown of the daily load of the SIN and the subsystems into calendar, temperature, seasonality and trend, estimated with the past only and evaluated out of sample, with intervals, residuals, a naive baseline and sensitivity. Association, not cause.",
    ),
    alternates: { canonical: "/setor-eletrico/carga/clima-e-calendario" },
  }, anterior);
}

const fonteModelo = () =>
  tx(
    "Decomposição estatística do observatório sobre ONS (carga diária), NASA POWER (temperatura) e IBGE (população)",
    "Statistical breakdown by the observatory on ONS (daily load), NASA POWER (temperature) and IBGE (population)",
  );

const colunasCoef = (): ColunaTabela[] => [
  // nomes das variáveis do modelo: identificadores em português, marcados como nome na página inglesa
  { id: "variavel", rotulo: tx("Variável", "Variable"), tipo: "texto", idiomaTexto: "nome" },
  { id: "grupo", rotulo: tx("Grupo", "Group"), tipo: "texto", categorica: true },
  { id: "coeficiente", rotulo: tx("Coeficiente (log)", "Coefficient (log)"), tipo: "numero", casas: 6 },
  { id: "ativa", rotulo: tx("Ativa no treino", "Active in training"), tipo: "texto", categorica: true },
];
const colunasLeis = (): ColunaTabela[] => [
  { id: "norma", rotulo: tx("Norma", "Law"), tipo: "texto" },
  { id: "estabelece", rotulo: tx("Estabelece", "Establishes"), tipo: "texto", idiomaTexto: "portugues" },
  { id: "ementa", rotulo: tx("Ementa conferida no Senado", "Summary checked at the Senate"), tipo: "texto", categorica: true },
  { id: "texto", rotulo: tx("Texto relido", "Text reread"), tipo: "texto", categorica: true },
  { id: "situacao", rotulo: tx("Situação do texto", "Text status"), tipo: "texto", idiomaTexto: "portugues" },
];
const colunasEventos = (): ColunaTabela[] => [
  { id: "data", rotulo: tx("Data", "Date"), tipo: "data" },
  { id: "nome", rotulo: tx("Evento", "Event"), tipo: "texto", idiomaTexto: "nome" },
  { id: "categoria", rotulo: tx("Categoria", "Category"), tipo: "texto", categorica: true },
];
const colunasPesos = (): ColunaTabela[] => [
  { id: "regiao", rotulo: tx("Região", "Region"), tipo: "texto", categorica: true },
  { id: "uf", rotulo: tx("UF", "State"), tipo: "texto" },
  { id: "capital", rotulo: tx("Capital (centroide do município)", "Capital (municipality centroid)"), tipo: "texto", idiomaTexto: "nome" },
  { id: "peso", rotulo: tx("Peso na região", "Weight in the region"), tipo: "percentual", casas: 2 },
];

export default function ClimaCalendarioPage() {
  const g = lerGold<CargaDetalheGold>("carga_detalhe.json");
  if (!integra(g)) return <CargaIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const idioma = idiomaEnergia();
  const FONTE = fonteModelo();
  const sim = tx("sim", "yes");
  const nao = tx("não", "no");
  const p = g.p027;
  const ev = g.evidencias;
  // abertura: a mesma decomposição da faixa de métricas no estado padrão (SIN, variante principal, mesmos dias da semana)
  const dSin = decomposicaoEscolhida(g.a07, "SIN", "principal", "equivalente");
  const partesSin = dSin ? partesDaDiferenca(dSin) : null;
  const mSin = p?.metricas.SIN ?? null;
  const t = g.temperatura;
  const fontesMes = Object.entries(t.fontes_por_mes);
  const porProduto = new Map<string, string[]>();
  for (const [m, f] of fontesMes) porProduto.set(f, [...(porProduto.get(f) ?? []), m]);
  const downloads = g.downloads.filter((d) => /decomposicao|temperatura|calendario/.test(d.url));
  const categorias = g.calendario.categorias;
  const categoria = (c: string) => rotuloDaGold(CATEGORIA_CALENDARIO_EN, (categorias as Record<string, string>)[c] ?? c, idioma);
  const oQueMudou = p ? (
    tx(
      <>
        Último ajuste com origem em {dataBR(p.ultimo_ajuste_sin.origem)} ({num(p.ultimo_ajuste_sin.dias_treino, 0)} dias de treino até{" "}
        {dataBR(p.ultimo_ajuste_sin.ultimo_dia_treino)}). {p.leitura}
      </>,
      <>
        Latest fit with origin on {dataBR(p.ultimo_ajuste_sin.origem)} ({num(p.ultimo_ajuste_sin.dias_treino, 0)} training days through{" "}
        {dataBR(p.ultimo_ajuste_sin.ultimo_dia_treino)}). <TrechoPortugues regiao="leitura da decomposição">{p.leitura}</TrechoPortugues>
      </>,
    )
  ) : (
    <>{tx("A decomposição não foi publicada nesta versão.", "The breakdown was not published in this version.")}</>
  );
  const comoInterpretar = tx(
    <>
      O modelo é estimado só com dias anteriores a cada origem mensal e prevê o mês com a temperatura e o calendário que de fato ocorreram (avaliação ex post, não
      previsão de carga). Contribuição é a mudança da previsão associada a um grupo de variáveis, com o resto fixo, em log × 100 (perto de pontos percentuais). O
      intervalo vem dos erros fora da amostra de origens anteriores. A referência ingênua repete a carga do mesmo dia da semana 364 dias antes.
    </>,
    <>
      The model is estimated with days before each monthly origin only and predicts the month with the temperature and the calendar that actually occurred (ex post
      evaluation, not a load forecast). Contribution is the change in the prediction associated with a group of variables, with the rest held fixed, in log × 100 (close
      to percentage points). The interval comes from the out-of-sample errors of earlier origins. The naive baseline repeats the load of the same weekday 364 days earlier.
    </>,
  );
  const naoConcluir = tx(
    <>
      A contribuição da temperatura não é efeito causal nem &ldquo;parcela explicada&rdquo;. O resíduo não é atividade econômica: é o que o modelo não reproduz,
      incluindo erro de medida da temperatura, MMGD e revisões da carga. A temperatura é de reanálise e análise de modelo (NASA POWER), não de estação.
    </>,
    <>
      The contribution of temperature is neither a causal effect nor an &ldquo;explained share&rdquo;. The residual is not economic activity: it is what the model does not
      reproduce, including temperature measurement error, MMGD and load revisions. The temperature comes from reanalysis and model analysis (NASA POWER), not from stations.
    </>,
  );
  const especificacao: (readonly [string, ReactNode])[] = p
    ? [
        [tx("Alvo", "Target"), <TrechoPortugues key="alvo" regiao="especificação do modelo">{p.especificacao.alvo}</TrechoPortugues>],
        [tx("Estimador", "Estimator"), <TrechoPortugues key="estimador" regiao="especificação do modelo">{p.especificacao.estimador}</TrechoPortugues>],
        [tx("Início do treino", "Training start"), dataBR(p.especificacao.inicio_treino)],
        [tx("Primeira origem", "First origin"), dataBR(p.especificacao.primeira_origem)],
        [tx("Origens", "Origins"), <TrechoPortugues key="origens" regiao="especificação do modelo">{p.especificacao.origens}</TrechoPortugues>],
        [tx("Intervalo", "Interval"), <TrechoPortugues key="intervalo" regiao="especificação do modelo">{p.especificacao.intervalo}</TrechoPortugues>],
        [tx("Contribuições", "Contributions"), <TrechoPortugues key="contribuicoes" regiao="especificação do modelo">{p.especificacao.contribuicoes}</TrechoPortugues>],
        [tx("Temperatura", "Temperature"), <TrechoPortugues key="temperatura" regiao="especificação do modelo">{p.especificacao.temperatura}</TrechoPortugues>],
      ]
    : [];
  const variaveisPorGrupo = p
    ? (Object.keys(ROTULO_GRUPO) as (keyof typeof ROTULO_GRUPO)[])
        .map((gr) => `${rotuloGrupo(gr).toLowerCase()} (${p.especificacao.variaveis.filter((x) => x.grupo === gr).map((x) => x.nome).join(", ")})`)
        .join("; ")
    : "";
  // em inglês, os nomes das variáveis (identificadores do modelo, em português) saem como código
  const variaveisPorGrupoEn: ReactNode = p
    ? (Object.keys(ROTULO_GRUPO) as (keyof typeof ROTULO_GRUPO)[]).map((gr, i) => (
        <span key={gr}>
          {i ? "; " : ""}
          {rotuloGrupo(gr).toLowerCase()} (<code>{p.especificacao.variaveis.filter((x) => x.grupo === gr).map((x) => x.nome).join(", ")}</code>)
        </span>
      ))
    : "";
  const dobras = p ? REGIOES.map((r) => `${nomeRegiao(r)} ${p.especificacao.nos_temperatura[r].map((x) => `${num(x, 2)} °C`).join(tx(" e ", " and "))}`).join("; ") : "";
  const produtos = Array.from(porProduto.entries())
    .map(([f, ms]) =>
      ms.length === 1
        ? tx(`${f} em ${mesAno(ms[0])}`, `${f} in ${mesAno(ms[0])}`)
        : tx(`${f} em ${ms.length} meses (${mesAno(ms[0])} a ${mesAno(ms[ms.length - 1])})`, `${f} in ${ms.length} months (${mesAno(ms[0])} to ${mesAno(ms[ms.length - 1])})`),
    )
    .join("; ");

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:carga" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          rotulo={tx("Carga · Clima e calendário", "Load · Climate and calendar")}
          siglas={["MWmed", "SIN", "MMGD", "ONS", "IBGE"]}
          titulo={perguntaPainel("p027")}
          lead={
            dSin && partesSin
              ? tx(
                  `Uma parte. De ${dataBR(dSin.inicio)} a ${dataBR(dSin.fim)}, a carga do SIN ficou ${sinal(partesSin.diferenca, 2)} pontos (${sinal(dSin.variacao_real_pct, 2)}%) contra os mesmos dias da semana um ano antes. Um modelo estatístico, testado em dias que não viu, associa ${sinal(partesSin.clima, 2)} pontos a calendário, temperatura e estação do ano e ${sinal(partesSin.nivelTendencia, 2)} ao nível e à tendência; ${sinal(partesSin.residuo, 2)} pontos ficam sem explicação no modelo. É associação, não causa.`,
                  `Part of it. From ${dataBR(dSin.inicio)} to ${dataBR(dSin.fim)}, the SIN load was ${sinal(partesSin.diferenca, 2)} points (${sinal(dSin.variacao_real_pct, 2)}%) against the same days of the week a year earlier. A statistical model, tested on days it did not see, associates ${sinal(partesSin.clima, 2)} points with calendar, temperature and season and ${sinal(partesSin.nivelTendencia, 2)} with level and trend; ${sinal(partesSin.residuo, 2)} points remain unexplained by the model. It is association, not cause.`,
                )
              : tx(
                  "Quanto da diferença de carga entre duas janelas acompanha calendário, temperatura e estação do ano, segundo um modelo testado em dias que não viu. É associação, não causa.",
                  "How much of the load difference between two windows goes along with calendar, temperature and season, according to a model tested on days it did not see. It is association, not cause.",
                )
          }
          recorte={
            p
              ? tx(
                  `${dataBR(p.periodo_avaliacao.inicio)} a ${dataBR(p.periodo_avaliacao.fim)} · SIN e subsistemas · MWmed e %`,
                  `${dataBR(p.periodo_avaliacao.inicio)} to ${dataBR(p.periodo_avaliacao.fim)} · SIN and subsystems · MWavg and %`,
                )
              : undefined
          }
          fonte={tx("decomposição estatística do observatório sobre ONS, NASA POWER e IBGE", "statistical breakdown by the observatory on ONS, NASA POWER and IBGE data")}
          referencia={tx(
            <>
              ONS (carga diária) até {dataBR(g.dia_referencia)}, NASA POWER (temperatura) e IBGE (população); processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              ONS (daily load) through {dataBR(g.dia_referencia)}, NASA POWER (temperature) and IBGE (population); processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <CargaDatas
              itens={[
                { rotulo: tx("Carga diária", "Daily load"), dia: g.dia_referencia, natureza: "OBSERVADO" },
                { rotulo: tx("Decomposição estatística", "Statistical breakdown"), dia: p?.periodo_avaliacao.fim ?? null, natureza: "ESTIMADO" },
              ]}
            />
          }
          metricas={
            p ? (
              <CargaClimaMetricas
                p027={{ metricas: p.metricas, periodo_avaliacao: p.periodo_avaliacao }}
                a07={{ decomposicao: g.a07.decomposicao }}
                evidencia={ev.p027_mape_sin ?? null}
              />
            ) : undefined
          }
        >
          {tx(
            <>
              Quanto da carga de cada dia acompanha o calendário (dia da semana, feriados, fim de ano), a temperatura e a estação do ano, segundo um modelo estatístico estimado só
              com o passado e conferido em dias que ele não viu. É decomposição estatística: mostra associação, não causa.
            </>,
            <>
              How much of each day&apos;s load goes along with the calendar (day of the week, holidays, year-end), the temperature and the season, according to a statistical model
              estimated with the past only and checked on days it did not see. It is a statistical breakdown: it shows association, not cause.
            </>,
          )}
        </CabecalhoModulo>
        <CargaNavegacao atual="p027" />
        <ParaLer
          id="para-ler-clima"
          itens={[
            {
              termo: tx("Pontos (log × 100)", "Points (log × 100)"),
              definicao: tx(
                "A escala em que o modelo soma as peças. Para diferenças pequenas, 1 ponto é quase 1%; quanto maior a diferença, mais os dois se afastam, e por isso a página mostra os dois.",
                "The scale in which the model adds up the pieces. For small differences, 1 point is almost 1%; the larger the difference, the more the two drift apart, which is why the page shows both.",
              ),
              exemplo:
                dSin && partesSin
                  ? tx(
                      `${sinal(partesSin.diferenca, 2)} pontos correspondem a ${sinal(dSin.variacao_real_pct, 2)}% nesta janela.`,
                      `${sinal(partesSin.diferenca, 2)} points correspond to ${sinal(dSin.variacao_real_pct, 2)}% in this window.`,
                    )
                  : undefined,
            },
            {
              termo: tx("Modelo estatístico (estimado)", "Statistical model (estimated)"),
              definicao: tx(
                "Uma conta que aprende, com os anos anteriores, como a carga costuma variar com o dia da semana, os feriados, a temperatura e a época do ano. Os números dele são estimativas, marcadas como Estimado.",
                "A calculation that learns, from previous years, how the load usually varies with the day of the week, holidays, temperature and time of year. Its figures are estimates, marked as Estimated.",
              ),
            },
            {
              termo: tx("Fora da amostra", "Out of sample"),
              definicao: tx(
                "O modelo é testado em dias que ele não usou para aprender, como uma prova com perguntas novas. É o teste honesto de quanto ele acerta.",
                "The model is tested on days it did not use to learn, like an exam with new questions. It is the honest test of how well it does.",
              ),
            },
            {
              termo: tx("Erro absoluto médio", "Mean absolute error"),
              definicao: tx(
                "Quanto, em média, a previsão errou para mais ou para menos em cada dia, em % da carga real.",
                "How much, on average, the prediction missed up or down on each day, in % of the actual load.",
              ),
              exemplo: mSin
                ? tx(
                    `No SIN, ${num(mSin.mape_pct, 2)}% em ${num(mSin.dias, 0)} dias; repetir a carga do mesmo dia da semana um ano antes (a referência ingênua) erraria ${num(mSin.mape_referencia_364d_pct, 2)}%.`,
                    `In the SIN, ${num(mSin.mape_pct, 2)}% over ${num(mSin.dias, 0)} days; repeating the load of the same weekday a year earlier (the naive baseline) would miss by ${num(mSin.mape_referencia_364d_pct, 2)}%.`,
                  )
                : undefined,
            },
            {
              termo: tx("Resíduo", "Residual"),
              definicao: tx(
                "O que sobra da diferença depois das peças do modelo. Não é atividade econômica: junta tudo o que o modelo não vê, inclusive erro de medida.",
                "What is left of the difference after the model's pieces. It is not economic activity: it gathers everything the model does not see, including measurement error.",
              ),
            },
            {
              termo: tx("Intervalo de 80%", "80% interval"),
              definicao: tx(
                "A faixa em que, pelos erros passados do modelo, a carga real deveria cair em cerca de 8 de cada 10 dias. Dia fora da faixa é dia que o modelo não esperava.",
                "The range in which, given the model's past errors, the actual load should fall on about 8 out of 10 days. A day outside the range is a day the model did not expect.",
              ),
              exemplo: mSin
                ? tx(`No SIN, a carga real caiu dentro da faixa em ${num(mSin.cobertura_80_pct, 1)}% dos dias testados.`, `In the SIN, the actual load fell within the range on ${num(mSin.cobertura_80_pct, 1)}% of the days tested.`)
                : undefined,
            },
          ]}
        />
        <ModoProfundidade>
          <Bloco id="clima">
            <PainelEvidencia
              id="p027"
              pergunta={
                p
                  ? tx(
                      `A janela de ${dataBR(g.a07.referencia.inicio)} a ${dataBR(g.a07.referencia.fim)} contra um ano antes, decomposta`,
                      `The window from ${dataBR(g.a07.referencia.inicio)} to ${dataBR(g.a07.referencia.fim)} against one year earlier, broken down`,
                    )
                  : perguntaPainel("p027")
              }
              subtitulo={tx(
                "Decomposição estatística da carga diária, fora da amostra · MWmed, % e log × 100",
                "Statistical breakdown of the daily load, out of sample · MWavg, % and log × 100",
              )}
              natureza="ESTIMADO"
              porQueImporta={tx(
                <>
                  Uma semana quente ou com feriado muda a carga sem que o consumo de fundo mude. Separar o que acompanha clima e calendário do que sobra (o resíduo) evita ler
                  essas oscilações como tendência, sem atribuir causa.
                </>,
                <>
                  A hot week or one with a holiday changes the load without the underlying consumption changing. Separating what goes along with climate and calendar from what
                  is left (the residual) avoids reading these swings as a trend, without attributing cause.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.modelo}
              complementares={[
                { rotulo: tx("Temperatura ponderada", "Weighted temperature"), p: g.proveniencia.temperatura },
                { rotulo: tx("Carga diária comparada", "Compared daily load"), p: g.proveniencia.comparacoes },
              ]}
            >
              <div className="space-y-6">
                {p ? (
                  <CargaClima
                    p027={{
                      metricas: p.metricas,
                      periodo_avaliacao: p.periodo_avaliacao,
                      sensibilidade: p.sensibilidade,
                      por_origem_sin: p.por_origem_sin,
                      recente_sin: p.recente_sin,
                      resposta_temperatura: p.resposta_temperatura,
                    }}
                    a07={{ decomposicao: g.a07.decomposicao, comparacoes: g.a07.comparacoes }}
                    achado={{ inicio: g.a07.referencia.inicio, fim: g.a07.referencia.fim, dias_janela: g.a07.janela_modelo.dias_janela, motivo: g.a07.janela_modelo.motivo }}
                    diaReferencia={g.dia_referencia}
                    fonte={FONTE}
                    versao={p.periodo_avaliacao.fim}
                    notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                    didatico={<CargaCascata a07={{ decomposicao: g.a07.decomposicao }} />}
                  />
                ) : (
                  <CargaAviso tipo="alerta">
                    {tx(
                      <>
                        A decomposição estatística não foi publicada nesta versão da gold: {g.proveniencia.modelo.limitacoes.join(" ")} A série de carga e as comparações de
                        calendário continuam na página Nível e crescimento.
                      </>,
                      <>
                        The statistical breakdown was not published in this version of the gold:{" "}
                        <TrechoPortugues regiao="limitações do modelo">{g.proveniencia.modelo.limitacoes.join(" ")}</TrechoPortugues> The load series and the calendar
                        comparisons remain on the Level and growth page.
                      </>,
                    )}
                  </CargaAviso>
                )}

                <SecaoDoPainel
                  id="calendario"
                  nivel="analisar"
                  titulo={tx("Calendário usado: feriados por lei e pontos facultativos", "Calendar used: holidays by law and optional days off")}
                >
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        Categorias do calendário: {Object.values(categorias).join("; ")}. Pontos facultativos (Carnaval, Cinzas, Corpus Christi) entram no modelo como variáveis
                        próprias e numa variante sem eles.
                      </>,
                      <>
                        Calendar categories: {Object.keys(categorias).map(categoria).join("; ")}. Optional days off (<Nome>Carnaval</Nome>, <Nome>Cinzas</Nome>,{" "}
                        <Nome>Corpus Christi</Nome>) enter the model as variables of their own and in a variant without them.
                      </>,
                    )}
                  </p>
                  <TabelaInterativa
                    titulo={tx("Feriados e pontos facultativos nos últimos 12 meses", "Holidays and optional days off in the last 12 months")}
                    colunas={colunasEventos()}
                    linhas={g.calendario.eventos_12m.map((e) => ({ id: e.data, data: e.data, nome: e.nome, categoria: categoria(e.categoria) }))}
                    chaveLinha="id"
                    colunaRotulo="nome"
                    fonte={tx("Senado Federal (leis de feriados) e portarias anuais de pontos facultativos", "Senado Federal (holiday laws) and annual ordinances on optional days off")}
                    versao={g.dia_referencia}
                    nomeArquivo="carga-calendario-12-meses"
                    chaveUrl="cal"
                  />
                </SecaoDoPainel>

                {p && (
                  <SecaoDoPainel id="modelo" nivel="auditar" titulo={tx("Especificação, coeficientes e erros do modelo", "Model specification, coefficients and errors")}>
                    <dl className="grid gap-2 text-sm text-carvao-muted md:grid-cols-2">
                      {especificacao.map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-carvao">{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="text-sm text-carvao-muted">
                      {tx(
                        <>
                          Variáveis por grupo:{" "}
                          {variaveisPorGrupo}
                          . Dobras de temperatura: {dobras}.
                        </>,
                        <>
                          Variables by group: {variaveisPorGrupoEn}. Temperature breakpoints: {dobras}.
                        </>,
                      )}
                    </p>
                    <p className="text-sm text-carvao-muted">
                      {tx(
                        <>
                          Erros diários do SIN fora da amostra (real contra previsto): 5% abaixo de {num(p.erros_sin_pct.p05, 2)}%, quartis de {num(p.erros_sin_pct.p25, 2)}% e{" "}
                          {num(p.erros_sin_pct.p75, 2)}%, mediana de {num(p.erros_sin_pct.mediana, 2)}%, 5% acima de {num(p.erros_sin_pct.p95, 2)}%. Desvio padrão do resíduo
                          no último treino: {num(p.ultimo_ajuste_sin.dp_residuo_treino_log100, 2)} em log × 100.
                        </>,
                        <>
                          SIN daily out-of-sample errors (actual against predicted): 5% below {num(p.erros_sin_pct.p05, 2)}%, quartiles of {num(p.erros_sin_pct.p25, 2)}% and{" "}
                          {num(p.erros_sin_pct.p75, 2)}%, median of {num(p.erros_sin_pct.mediana, 2)}%, 5% above {num(p.erros_sin_pct.p95, 2)}%. Standard deviation of the
                          residual in the latest training: {num(p.ultimo_ajuste_sin.dp_residuo_treino_log100, 2)} in log × 100.
                        </>,
                      )}
                    </p>
                    <TabelaInterativa
                      titulo={tx(
                        `Coeficientes do SIN no ajuste com origem em ${dataBR(p.ultimo_ajuste_sin.origem)}`,
                        `SIN coefficients in the fit with origin on ${dataBR(p.ultimo_ajuste_sin.origem)}`,
                      )}
                      colunas={colunasCoef()}
                      linhas={p.coeficientes_sin.map((x) => ({ id: x.variavel, variavel: x.variavel, grupo: rotuloGrupo(x.grupo), coeficiente: x.coeficiente, ativa: x.ativa ? sim : nao }))}
                      chaveLinha="id"
                      colunaRotulo="variavel"
                      fonte={FONTE}
                      versao={p.ultimo_ajuste_sin.origem}
                      nomeArquivo="carga-decomposicao-coeficientes-sin"
                      chaveUrl="coef"
                    />
                  </SecaoDoPainel>
                )}

                <SecaoDoPainel id="temperatura" nivel="auditar" titulo={tx("Temperatura: produto, pontos e pesos", "Temperature: product, points and weights")}>
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        Produto da NASA POWER por mês:{" "}
                        {produtos}
                        . Pesos: população residente estimada por UF (IBGE{t.ano_populacao ? `, ${t.ano_populacao}` : ""}), normalizada dentro de cada região.
                      </>,
                      <>
                        NASA POWER product by month: {produtos}. Weights: estimated resident population by state (IBGE{t.ano_populacao ? `, ${t.ano_populacao}` : ""}),
                        normalized within each region.
                      </>,
                    )}
                  </p>
                  <TabelaInterativa
                    titulo={tx("Peso de cada capital na temperatura da região", "Weight of each capital in the region's temperature")}
                    colunas={colunasPesos()}
                    linhas={REGIOES.flatMap((r) =>
                      Object.entries(t.pesos[r] ?? {}).map(([uf, peso]) => ({ id: `${r}:${uf}`, regiao: nomeRegiao(r), uf, capital: t.capitais[uf]?.nome ?? uf, peso: peso * 100 })),
                    )}
                    chaveLinha="id"
                    colunaRotulo="uf"
                    fonte={tx("IBGE (SIDRA 6579 e malhas) e NASA POWER", "IBGE (SIDRA 6579 and boundary files) and NASA POWER")}
                    versao={t.ano_populacao ?? g.dia_referencia}
                    nomeArquivo="carga-temperatura-pesos"
                    chaveUrl="pesos"
                  />
                  <TabelaInterativa
                    titulo={tx("Leis dos feriados nacionais", "National holiday laws")}
                    colunas={colunasLeis()}
                    linhas={g.calendario.leis.map((l) => ({
                      id: l.id,
                      norma: normaLegivel(l.norma),
                      estabelece: l.estabelece,
                      ementa: l.conferida_ementa ? sim : nao,
                      texto: l.conferida_texto ? sim : nao,
                      situacao: l.texto_situacao,
                    }))}
                    chaveLinha="id"
                    colunaRotulo="norma"
                    fonte={tx("Senado Federal, dados abertos da legislação", "Senado Federal, open legislation data")}
                    versao={g.dia_referencia}
                    nomeArquivo="carga-leis-feriados"
                    chaveUrl="leis"
                  />
                  <CargaFontes fontes={g.fontes.filter((f) => ["temperatura", "populacao", "centroides", "leis"].includes(f.id))} />
                </SecaoDoPainel>

                <CargaSeguir ancora="p027" proximo={{ href: `${rotaPainel("p025")}#p025`, pergunta: perguntaPainel("p025") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
