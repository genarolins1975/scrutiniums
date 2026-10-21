import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import type { ReactNode } from "react";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { PrevisoesArquivo } from "@/components/energia/PrevisoesArquivo";
import { PrevisoesAtual } from "@/components/energia/PrevisoesAtual";
import {
  PrevisoesAnalise,
  PrevisoesAuditoria,
  PrevisoesAviso,
  PrevisoesAvisosRodada,
  PrevisoesCapitulos,
  PrevisoesDatas,
  PrevisoesFichaLinha,
  PrevisoesIndisponivel,
  PrevisoesLegenda,
  PrevisoesPainel,
  PrevisoesRecorte,
  PrevisoesResposta,
  PrevisoesSeguir,
  PrevisoesTermos,
} from "@/components/energia/PrevisoesPagina";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, datasLegiveis, nomeSubmercado, num, plural } from "@/lib/energia/formato";
import { gold, integra, lerGold } from "@/lib/energia/gold";
import { GOVERNANCA_PREVISOES_EN, identificador, traducaoExata, traducaoPrevisoes } from "@/lib/energia/i18n/mercado-preco";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import {
  colunasRevisoes,
  COR_SM,
  GOLD_PREVISOES,
  ROTA_PREVISOES,
  SUBMERCADOS,
  avaliacaoPorFrequencia,
  avisoDaRotina,
  avisosDaRodada,
  diasSemRodada,
  downloadsDoPainel,
  enderecoPainel,
  instanteBR,
  linhasArquivo,
  linhasGrade,
  linhasPublicadoNoCorte,
  linhasRevisoes,
  oQueMudouRodada,
  particoesCitadas,
  perguntaPainel,
  primeiraEntregaAMaturar,
  proximoPainel,
  provenienciaParaLeitor,
  resumoB0,
  resumoRodadas,
  respostaP013,
  rodadasRecentes,
  semCodigoDeEstado,
  temRodada,
  termosPrevisoes,
  textoAlertas,
  textoEmissao,
  textoTolerancia,
  vereditoP013,
  type AvisoRodada,
} from "@/lib/energia/previsoes";
import { lerCsvPrevisoes } from "@/lib/energia/previsoes-arquivos";
import type { Submercado } from "@/lib/energia/tipos";
import type { PrevisoesDesempenhoGold, Rodada } from "@/lib/energia/tipos-previsoes";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/pld/previsoes", {
    title: tx("O que foi publicado antes do resultado: previsão do PLD e arquivo de emissões", "What was published before the outcome: PLD forecast and forecast archive"),
    description: tx(
      "Referência experimental B0 para as próximas quatro semanas e três meses nos quatro submercados, com origem, corte, entrega e a prova de cada número, o PLD já publicado no corte, as condições da rodada, a avaliação depois do resultado e o arquivo imutável de todas as emissões.",
      "Experimental benchmark B0 for the next four weeks and three months in the four submarkets, with origin, cutoff, delivery and the evidence for each number, the spot price (PLD) already published at the cutoff, the conditions of the run, the evaluation after the outcome and the immutable archive of all issues.",
    ),
    alternates: { canonical: ROTA_PREVISOES },
  }, anterior);
}

const CSV_EMISSOES = "/energia/series/previsoes_emissoes.csv";
/** Rodadas levadas ao HTML (o CSV completo é o download): cerca de 28 linhas por rodada. */
const MAX_RODADAS_PAGINA = 14;

/** Frase fixa da gold de previsões: a forma inglesa pela tabela exata; sem entrada, o texto sai em português marcado. */
function Gold({ texto, regiao = "previsoes-gold" }: { texto: string | null | undefined; regiao?: string }) {
  if (!texto) return null;
  const en = traducaoPrevisoes(texto, idiomaEnergia());
  return en ? <>{en}</> : <TrechoPortugues regiao={regiao}>{texto}</TrechoPortugues>;
}

/** Estado curto de um achado da governança na página inglesa: forma inglesa pela tabela exata; sem entrada, o texto publicado marcado. */
function estadoAchado(estado: string): ReactNode {
  return traducaoExata(GOVERNANCA_PREVISOES_EN, estado, "en") ?? <TrechoPortugues regiao="previsoes-achados">{estado}</TrechoPortugues>;
}

export default function PrevisoesPage() {
  const idioma = idiomaEnergia();
  const g = lerGold<PrevisoesDesempenhoGold>(GOLD_PREVISOES);
  if (!integra(g)) return <PrevisoesIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const at = g.previsao_atual;
  const comRodada = temRodada(at);
  const linhas = comRodada ? linhasGrade(at.celulas, g.prospectivo.apuracoes, idioma) : [];
  const pub = at.ja_publicado_no_corte;
  const atraso = comRodada ? diasSemRodada(at.origem, g.rotina.dias_vencidos_ate) : null;
  const csv = lerCsvPrevisoes(CSV_EMISSOES);
  const estados = Object.fromEntries(g.modelos.map((m) => [m.codigo, m.estado]));
  const todas = csv ? linhasArquivo(csv.linhas, estados, idioma) : [];
  const recorte = rodadasRecentes(todas, MAX_RODADAS_PAGINA);
  const rodadasArquivo = resumoRodadas(todas, idioma);
  const evidenciasAtual = Object.fromEntries(Object.entries(g.evidencias).filter(([k]) => k.startsWith("b0_") || k.startsWith("pld_no_corte_")));
  const versao = g.gerado_em.slice(0, 10);
  const fonteGrade = tx("Observatório, rodada de previsão do PLD (referência B0 sobre o PLD horário da CCEE)", "Observatory, PLD forecast run (B0 benchmark on the CCEE hourly PLD)");
  const fonteArquivo = tx("Observatório, arquivo imutável de emissões de previsão", "Observatory, immutable forecast archive");
  const ref = g.governanca.referencia_experimental;
  const reex = g.prospectivo.reexecucao;
  const particoes = particoesCitadas(g);
  const revisoes = linhasRevisoes(g, idioma);
  const publicadoNoCorte = linhasPublicadoNoCorte(pub);
  const apuradas = g.prospectivo.apuracoes.filter((a) => a.realizado !== null).length;
  const proxima = primeiraEntregaAMaturar(g.prospectivo.apuracoes);
  const retido = !g.desempenho.publicado;
  const transcritas = rodadasArquivo.filter((r) => r.transcrito);
  const termos = termosPrevisoes(g.definicoes, idioma);
  const emProducao = g.modelos.filter((m) => m.estado === "PRODUCAO").map((m) => m.codigo);
  const dia = versao;
  // média das 24 horas do dia de origem na página PLD (pld.json), só quando é o mesmo dia da rodada
  const pldPagina = gold.pld();
  const mediaDiaPaginaPld = integra(pldPagina) && pub && pldPagina.dia_referencia === pub.origem ? Object.fromEntries(pldPagina.cartoes.map((c) => [c.sm, c.media_dia])) : null;

  // avisos materiais: os da rodada mais recente (emissão, código) mais a governança da rotina; os de cada rodada do arquivo
  const rodadaAtualGold = comRodada ? g.prospectivo.rodadas.find((r) => r.run_id === at.run_id) : undefined;
  const rodadaAtual: Pick<Rodada, "modo" | "emitido_em" | "atraso_min" | "alertas" | "versao_codigo" | "celulas" | "com_numero" | "motivos" | "registrado_no_portal_em"> | null = comRodada
    ? (rodadaAtualGold ?? {
        modo: at.modo,
        emitido_em: at.emitido_em,
        atraso_min: at.atraso_min,
        alertas: at.alertas,
        versao_codigo: at.versao_codigo,
        celulas: at.celulas.length,
        com_numero: at.celulas.filter((c) => c.previsao !== null).length,
        motivos: [],
        registrado_no_portal_em: null,
      })
    : null;
  const avisoRotina = avisoDaRotina(g.rotina, idioma);
  const avisosAtual: AvisoRodada[] = [...(rodadaAtual ? avisosDaRodada(rodadaAtual, idioma) : []), ...(avisoRotina ? [avisoRotina] : [])];
  const avisosPorRodada = Object.fromEntries(g.prospectivo.rodadas.map((r) => [r.run_id, avisosDaRodada(r, idioma)]));

  // submercado da faixa de métricas: o Sudeste/Centro-Oeste, ou o primeiro com número
  const smMetricas: Submercado = linhas.some((l) => l.submercado === "SE") ? "SE" : (linhas[0]?.submercado ?? "SE");
  const semanal = resumoB0(linhas, smMetricas, "W", idioma);
  const mensal = resumoB0(linhas, smMetricas, "M", idioma);
  const avaliacao = avaliacaoPorFrequencia(g, idioma);
  const frasePrazo =
    atraso !== null && atraso > 0
      ? tx(
          `Fonte defasada: a verificação de ${carimbo(g.rotina.verificado_em)} já tinha o prazo de ${dataBR(g.rotina.dias_vencidos_ate)} vencido, e a rodada mais recente é de ${comRodada ? dataBR(at.origem) : ""}, ${plural(atraso, "dia", "dias")} antes.`,
          `Outdated source: the check of ${carimbo(g.rotina.verificado_em)} already had the deadline of ${dataBR(g.rotina.dias_vencidos_ate)} passed, and the latest run is from ${comRodada ? dataBR(at.origem) : ""}, ${plural(atraso, "day", "days")} earlier.`,
        )
      : tx(
          `Na verificação de ${carimbo(g.rotina.verificado_em)}, nenhum prazo de rodada posterior a ${comRodada ? dataBR(at.origem) : "esta rodada"} tinha vencido.`,
          `At the check of ${carimbo(g.rotina.verificado_em)}, no run deadline after ${comRodada ? dataBR(at.origem) : "this run"} had passed.`,
        );

  const recorte13 = (
    <PrevisoesRecorte
      periodo={
        linhas.length
          ? tx(
              `Entregas de ${dataBR(linhas.reduce((a, l) => (l.inicio < a ? l.inicio : a), linhas[0].inicio))} a ${dataBR(linhas.reduce((a, l) => (l.fim > a ? l.fim : a), linhas[0].fim))}; rodada de ${comRodada ? dataBR(at.origem) : ""}, corte às 07h00 de Brasília`,
              `Deliveries from ${dataBR(linhas.reduce((a, l) => (l.inicio < a ? l.inicio : a), linhas[0].inicio))} to ${dataBR(linhas.reduce((a, l) => (l.fim > a ? l.fim : a), linhas[0].fim))}; run of ${comRodada ? dataBR(at.origem) : ""}, cutoff at 07:00 Brasília time`,
            )
          : tx("sem rodada com células", "no run with cells")
      }
      universo={tx(
        <>
          Quatro <Termo slug="submercado">submercados</Termo> (SE/CO, Sul, Nordeste e Norte), sete horizontes (W1 a W4 e M1 a M3); modelo B0, referência experimental
        </>,
        <>
          Four <Termo slug="submercado">submarkets</Termo> (SE/CW, South, Northeast and North), seven horizons (W1 to W4 and M1 to M3); model B0, experimental benchmark
        </>,
      )}
      unidade={tx("R$/MWh nominais", "nominal R$/MWh")}
    />
  );

  const oQueMudou13 = (
    <>
      {oQueMudouRodada(g, idioma)} {frasePrazo}
    </>
  );
  const comoInterpretar13 = (
    <>
      {tx(
        "O B0 repete a média do PLD do último período completo disponível às 07h do dia de origem: a última semana de sábado a sexta para W1 a W4 e o último mês civil para M1 a M3. As quatro semanas têm o mesmo número, e os três meses também. Cada número é a média simples de todas as horas da entrega, não ponderada pelo consumo.",
        "B0 repeats the average PLD of the latest complete period available at 07h on the origin day: the last Saturday-to-Friday week for W1 to W4 and the last calendar month for M1 to M3. The four weeks have the same number, and so do the three months. Each number is the simple average of all hours of the delivery, not weighted by consumption.",
      )}
    </>
  );
  const naoConcluir13 = (
    <>
      {tx(
        "Não é previsão aprovada nem diz que o preço vai ficar onde está: a persistência ignora chuva, reservatórios e vazões, e as diferenças entre submercados repetem as da semana usada, sem indicar qual terá o preço mais alto. Sem faixa calibrada, não há probabilidade associada ao número.",
        "It is not an approved forecast and does not say the price will stay where it is: persistence ignores rain, reservoirs and inflows, and the differences between submarkets repeat those of the week used, without indicating which will have the highest price. Without a calibrated band, there is no probability attached to the number.",
      )}{" "}
      {apuradas === 0
        ? tx(
            `Não permite medir o acerto do B0: nenhuma entrega prevista terminou${proxima ? ` (a primeira termina em ${dataBR(proxima.termina)})` : ""}`,
            `It does not allow the accuracy of B0 to be measured: no forecast delivery has ended${proxima ? ` (the first ends on ${dataBR(proxima.termina)})` : ""}`,
          )
        : tx(
            `O acerto prospectivo tem só ${plural(apuradas, "previsão apurada", "previsões apuradas")}`,
            `The prospective accuracy has only ${plural(apuradas, "settled forecast", "settled forecasts")}`,
          )}
      {retido
        ? tx(", e os resultados do teste fora da amostra estão retidos (painel de desempenho).", ", and the out-of-sample test results are withheld (performance panel).")
        : tx("; o teste fora da amostra está no painel de desempenho.", "; the out-of-sample test is in the performance panel.")}{" "}
      {tx(
        "O PLD já publicado no corte vale só para as horas restantes do dia de origem e não entra em nenhuma entrega.",
        "The PLD already published at the cutoff applies only to the remaining hours of the origin day and is not part of any delivery.",
      )}
    </>
  );
  const ultimaRodada = rodadasArquivo[rodadasArquivo.length - 1];
  const oQueMudou15 = (
    <>
      {ultimaRodada
        ? tx(
            `Última inclusão no arquivo em ${dataBR(ultimaRodada.registrado)}: ${ultimaRodada.rotulo.toLowerCase()}, com ${ultimaRodada.celulas} registros.`,
            `Latest inclusion in the archive on ${dataBR(ultimaRodada.registrado)}: ${ultimaRodada.rotulo.charAt(0).toLowerCase()}${ultimaRodada.rotulo.slice(1)}, with ${ultimaRodada.celulas} records.`,
          )
        : tx("Nenhum registro incluído.", "No record included.")}{" "}
      <Gold texto={g.prospectivo.leitura} />
    </>
  );
  const comoInterpretar15 = (
    <>
      {tx(
        "Cada linha é uma célula de uma rodada: modelo, horizonte, entrega e submercado. A data de inclusão diz quando o registro entrou no arquivo do observatório; quando é posterior à emissão, o registro foi transcrito de outra fonte e não é emissão original. O realizado e o erro só aparecem depois que a entrega termina. Escolha um dia para ver o arquivo como estava ao fim dele (registros incluídos depois somem e a resposta é refeita para esse recorte), uma rodada para filtrar a tabela e uma linha para ver o registro inteiro; a exportação leva exatamente as linhas exibidas.",
        "Each row is a cell of a run: model, horizon, delivery and submarket. The inclusion date says when the record entered the observatory's archive; when it is later than the issue, the record was transcribed from another source and is not an original issue. The actual value and the error only appear after the delivery ends. Choose a day to see the archive as it was at the end of it (records included later disappear and the answer is redone for that selection), a run to filter the table and a row to see the whole record; the export carries exactly the rows shown.",
      )}
    </>
  );
  const naoConcluir15 = (
    <>
      {apuradas === 0
        ? tx("Não mede desempenho: sem entrega terminada, não há erro a calcular.", "It does not measure performance: with no delivery ended, there is no error to calculate.")
        : tx(
            `O erro das ${plural(apuradas, "previsão apurada", "previsões apuradas")} é amostra pequena, não desempenho.`,
            `The error of the ${plural(apuradas, "settled forecast", "settled forecasts")} is a small sample, not performance.`,
          )}{" "}
      {tx(
        "Não permite saber se o número estava certo antes que a entrega termine. Rodada sem número não é previsão de preço zero: é ausência, com o motivo gravado.",
        "It does not tell whether the number was right before the delivery ends. A run without a number is not a forecast of a zero price: it is an absence, with the reason recorded.",
      )}{" "}
      {g.rotina.comprovada ? (
        tx("A rotina diária está comprovada pelo critério publicado.", "The daily routine is demonstrated by the published criterion.")
      ) : idioma === "en" ? (
        <>
          {plural(rodadasArquivo.length, "recorded run does not demonstrate", "recorded runs do not demonstrate", idioma)} the daily routine: <Gold texto={g.rotina.criterio_comprovacao} />
        </>
      ) : (
        `${plural(rodadasArquivo.length, "rodada registrada não comprova", "rodadas registradas não comprovam")} a rotina diária: ${g.rotina.criterio_comprovacao.charAt(0).toLowerCase()}${g.rotina.criterio_comprovacao.slice(1)}` // i18n: dado
      )}
    </>
  );

  const linhasAvaliacao: { rotulo: string; valores: ReactNode[] }[] = [
    { rotulo: tx("Previsões com número", "Forecasts with a number"), valores: avaliacao.map((a) => a.registradas) },
    { rotulo: tx("Com realizado", "With actual"), valores: avaliacao.map((a) => a.apuradas) },
    { rotulo: tx("Aguardando o fim da entrega", "Waiting for the delivery to end"), valores: avaliacao.map((a) => a.aguardando) },
    {
      rotulo: tx("Primeira a terminar", "First to end"),
      valores: avaliacao.map((a) => (a.proxima ? tx(`${a.proxima.entrega}, em ${dataBR(a.proxima.termina)}`, `${a.proxima.entrega}, on ${dataBR(a.proxima.termina)}`) : tx("nenhuma pendente", "none pending"))),
    },
    {
      rotulo: tx("Teste fora da amostra", "Out-of-sample test"),
      valores: avaliacao.map((a) =>
        a.entregasTeste !== null
          ? tx(
              `${a.entregasTeste} entregas distintas${a.minimo !== null ? `, contra o mínimo de ${a.minimo} para calibrar a faixa (${a.estadoCalibracao})` : ""}`,
              `${a.entregasTeste} distinct deliveries${a.minimo !== null ? `, against the minimum of ${a.minimo} to calibrate the band (${a.estadoCalibracao})` : ""}`,
            )
          : tx("sem dado", "no data"),
      ),
    },
    {
      rotulo: tx("Faixa de incerteza", "Uncertainty band"),
      valores: avaliacao.map((a) => {
        const doGrupo = linhas.filter((l) => l.horizonte.startsWith(a.frequencia));
        const comFaixa = doGrupo.filter((l) => l.p10 !== null && l.p90 !== null).length;
        return comFaixa === 0 ? tx("nenhuma publicada", "none published") : tx(`${comFaixa} de ${doGrupo.length} células`, `${comFaixa} of ${doGrupo.length} cells`);
      }),
    },
  ];

  return (
    <>
      <CabecalhoEnergia atual="pld-modelos" />
      <MarcaVisita secao="energia:pld-previsoes" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["PLD", "SIN", "CCEE"]}
          titulo={tx("O que foi publicado antes do resultado?", "What was published before the outcome?")}
          lead={tx(
            "Veja a referência experimental B0 para cada região e período de entrega: ela repete o último valor completo disponível. O arquivo preserva o que foi publicado antes de conhecer o resultado, para permitir a conferência posterior.",
            "See the experimental benchmark B0 for each region and delivery period: it repeats the latest complete value available. The archive preserves what was published before the outcome was known, so that it can be checked later.",
          )}
          recorte={
            comRodada
              ? tx(
                  `Rodada de ${dataBR(at.origem)} · corte às 07h00 de Brasília · 4 submercados · R$/MWh nominais`,
                  `Run of ${dataBR(at.origem)} · cutoff at 07:00 Brasília time · 4 submarkets · nominal R$/MWh`,
                )
              : tx("Nenhuma rodada com células nesta publicação · R$/MWh nominais", "No run with cells in this publication · nominal R$/MWh")
          }
          fonte={tx("Observatório, referência B0 sobre o PLD horário da CCEE", "Observatory, B0 benchmark on the CCEE hourly PLD")}
          referencia={tx(
            <>
              Rodada de {comRodada ? dataBR(at.origem) : "sem data"} com o <Termo slug="pld">PLD</Termo> horário da CCEE até {dataBR(g.dados.ultimo_dia_pld)}; arquivo com{" "}
              {plural(todas.length, "registro", "registros")} de {plural(rodadasArquivo.length, "rodada", "rodadas")}; processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              Run of {comRodada ? dataBR(at.origem) : "no date"} with the CCEE hourly <Termo slug="pld">spot price (PLD)</Termo> through {dataBR(g.dados.ultimo_dia_pld)}; archive with{" "}
              {plural(todas.length, "record", "records", idioma)} from {plural(rodadasArquivo.length, "run", "runs", idioma)}; processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <PrevisoesDatas
              itens={[
                {
                  rotulo: tx("Rodada mais recente", "Latest run"),
                  texto: comRodada
                    ? tx(`origem em ${dataBR(at.origem)}, emitida em ${instanteBR(at.emitido_em)}`, `origin on ${dataBR(at.origem)}, issued on ${instanteBR(at.emitido_em, idioma)}`)
                    : tx("sem rodada com células", "no run with cells"),
                  natureza: "PREVISTO",
                },
                { rotulo: tx("PLD horário da CCEE", "CCEE hourly PLD"), texto: tx(`até ${dataBR(g.dados.ultimo_dia_pld)}`, `through ${dataBR(g.dados.ultimo_dia_pld)}`), natureza: "OBSERVADO" },
                {
                  rotulo: tx("Arquivo de emissões", "Forecast archive"),
                  texto: rodadasArquivo.length
                    ? tx(
                        `${plural(rodadasArquivo.length, "rodada", "rodadas")}, última inclusão em ${dataBR(ultimaRodada.registrado)}`,
                        `${plural(rodadasArquivo.length, "run", "runs", idioma)}, latest inclusion on ${dataBR(ultimaRodada.registrado)}`,
                      )
                    : tx("sem rodada registrada", "no run recorded"),
                  natureza: "PREVISTO",
                },
                { rotulo: tx("Verificação da rotina", "Routine check"), texto: carimbo(g.rotina.verificado_em), natureza: "CALCULADO" },
              ]}
            />
          }
          metricas={
            <>
              <FaixaMetricas colunas={4} rotulo={tx("Indicadores da rodada mais recente e do acompanhamento", "Indicators of the latest run and of the follow-up")}>
                <Numero
                  variante="faixa"
                  rotulo={tx(`B0 semanal, ${nomeSubmercado(smMetricas, "pt", true)}`, `Weekly B0, ${nomeSubmercado(smMetricas, idioma, true)}`)}
                  natureza="PREVISTO"
                  valor={semanal.valor}
                  evidencia={semanal.evidencia ? evidenciasAtual[semanal.evidencia] : undefined}
                  formato="reais"
                  casas={2}
                  unidade="R$/MWh"
                  periodo={semanal.periodo || undefined}
                  nota={semanal.usadoCurto}
                  motivoAusencia={tx("A rodada mais recente não tem número semanal para este submercado.", "The latest run has no weekly number for this submarket.")}
                  cor={COR_SM[smMetricas]}
                  endereco={`${ROTA_PREVISOES}#p013`}
                />
                <Numero
                  variante="faixa"
                  rotulo={tx(`B0 mensal, ${nomeSubmercado(smMetricas, "pt", true)}`, `Monthly B0, ${nomeSubmercado(smMetricas, idioma, true)}`)}
                  natureza="PREVISTO"
                  valor={mensal.valor}
                  evidencia={mensal.evidencia ? evidenciasAtual[mensal.evidencia] : undefined}
                  formato="reais"
                  casas={2}
                  unidade="R$/MWh"
                  periodo={mensal.periodo || undefined}
                  nota={mensal.usadoCurto}
                  motivoAusencia={tx("A rodada mais recente não tem número mensal para este submercado.", "The latest run has no monthly number for this submarket.")}
                  cor={COR_SM[smMetricas]}
                  endereco={`${ROTA_PREVISOES}#p013`}
                />
                <Numero
                  variante="faixa"
                  rotulo={tx("Modelos aprovados", "Approved models")}
                  natureza="CALCULADO"
                  valor={emProducao.length}
                  formato="num"
                  casas={0}
                  unidade={emProducao.length === 1 ? tx("modelo", "model") : tx("modelos", "models")}
                  periodo={tx(`registro de ${dataBR(dia)}`, `registry of ${dataBR(dia)}`)}
                  cor="var(--serie-referencia)"
                  nota={emProducao.length ? tx(`Em produção: ${emProducao.join(", ")}.`, `In production: ${emProducao.join(", ")}.`) : tx("Sem previsão oficial: o B0 é referência.", "No official forecast: B0 is a benchmark.")}
                />
                <Numero
                  variante="faixa"
                  rotulo={tx("Previsões com resultado", "Forecasts with an outcome")}
                  natureza="CALCULADO"
                  valor={apuradas}
                  formato="num"
                  casas={0}
                  unidade={tx(`de ${g.prospectivo.apuracoes.length} com número`, `of ${g.prospectivo.apuracoes.length} with a number`)}
                  periodo={tx("após a emissão", "after issue")}
                  cor="var(--serie-referencia)"
                  nota={proxima ? tx(`A primeira entrega termina em ${dataBR(proxima.termina)}.`, `The first delivery ends on ${dataBR(proxima.termina)}.`) : undefined}
                />
              </FaixaMetricas>
              <PrevisoesAvisosRodada avisos={avisosAtual} />
            </>
          }
        >
          {tx(
            `${emProducao.length ? "" : "Nenhum modelo de previsão do PLD está aprovado: "}o que aparece aqui é uma referência simples, a persistência (B0), que repete o PLD médio do último período completo, identificada como tal, com a prova de cada número. O segundo painel guarda todas as emissões como foram registradas, antes do resultado, para que o desempenho possa ser medido depois sem reescrever nada. Como cada número é calculado está no registro de modelos.`,
            `${emProducao.length ? "W" : "No PLD forecast model is approved: w"}hat appears here is a simple benchmark, persistence (B0), which repeats the average PLD of the latest complete period, identified as such, with the evidence for each number. The second panel keeps all issues as they were recorded, before the outcome, so that performance can be measured later without rewriting anything. How each number is calculated is in the model registry.`,
          )}
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="atual">
            <PrevisoesPainel id="p013">
              <PainelEvidencia
                id="p013"
                pergunta={perguntaPainel("p013")}
                subtitulo={tx(
                  "Rodada mais recente: referência experimental B0 por submercado e entrega · R$/MWh nominais, média temporal simples das horas",
                  "Latest run: experimental benchmark B0 by submarket and delivery · nominal R$/MWh, simple time-weighted average of the hours",
                )}
                natureza="PREVISTO"
                porQueImporta={tx(
                  "Quem compra, vende ou planeja consumo quer saber o preço das próximas semanas e meses. Um número de previsão só serve se vier com o que o produziu, a informação disponível no corte e o quanto se pode confiar nele. O número publicado aqui é chamado de referência, não de previsão aprovada.",
                  "Whoever buys, sells or plans consumption wants to know the price in the coming weeks and months. A forecast number is only useful if it comes with what produced it, the information available at the cutoff and how far it can be trusted. The number published here is called a benchmark, not an approved forecast.",
                )}
                oQueMudou={oQueMudou13}
                comoInterpretar={comoInterpretar13}
                naoConcluir={naoConcluir13}
                naoConcluirNoCorpo
                proveniencia={provenienciaParaLeitor(comRodada && at.proveniencia ? at.proveniencia : g.proveniencia)}
                complementares={pub ? [{ rotulo: tx("PLD já publicado no corte", "PLD already published at the cutoff"), p: pub.proveniencia }] : []}
              >
                <div className="space-y-6">
                  {!(comRodada && linhas.length > 0) && (
                    <PrevisoesResposta id="p013" veredito={vereditoP013(g, idioma)}>
                      {respostaP013(g, idioma)}
                    </PrevisoesResposta>
                  )}
                  {comRodada && linhas.length > 0 ? (
                    <PrevisoesAtual
                      linhas={linhas}
                      origem={at.origem}
                      evidencias={evidenciasAtual}
                      publicado={pub ? { origem: pub.origem, submercados: pub.submercados } : null}
                      fonte={fonteGrade}
                      versao={versao}
                      endereco={enderecoPainel("p013")}
                      mediaDiaPaginaPld={mediaDiaPaginaPld}
                      resposta={
                        <PrevisoesResposta id="p013" veredito={vereditoP013(g, idioma)} depois>
                          {respostaP013(g, idioma)}
                        </PrevisoesResposta>
                      }
                      recorte={recorte13}
                      notas={<NotasDoPainel oQueMudou={oQueMudou13} comoInterpretar={comoInterpretar13} naoConcluir={naoConcluir13} />}
                      aposPrincipal={
                        <>
                          <PrevisoesAviso>
                            <Gold texto={semCodigoDeEstado(at.bandas)} /> {at.candidatos.emitidos ? "" : <Gold texto={at.candidatos.motivo} />}
                          </PrevisoesAviso>
                          <PrevisoesTermos itens={termos} />
                          <PrevisoesCapitulos pagina="previsoes" />
                        </>
                      }
                      noCorteGrafico={
                        pub && publicadoNoCorte.length > 0 ? (
                          <GraficoLinhas
                            titulo={tx(`PLD horário de ${dataBR(pub.origem)} já publicado no corte, por submercado`, `Hourly PLD for ${dataBR(pub.origem)} already published at the cutoff, by submarket`)}
                            dados={publicadoNoCorte}
                            chaveX="h"
                            formatoX="hora"
                            series={SUBMERCADOS.filter((sm) => pub.submercados[sm]?.horas).map((sm) => ({ id: sm, rotulo: nomeSubmercado(sm, idioma, true), cor: COR_SM[sm] }))}
                            unidade="R$/MWh"
                            casas={2}
                            altura={260}
                          />
                        ) : null
                      }
                      avaliacao={
                        <SecaoDoPainel
                          id="avaliacao"
                          titulo={tx("Como cada entrega será avaliada depois do resultado", "How each delivery will be evaluated after the outcome")}
                          lead={tx(
                            "Semanas e meses têm avaliação própria: os horizontes, as amostras do teste e as entregas que terminam primeiro são diferentes.",
                            "Weeks and months have their own evaluation: the horizons, the test samples and the deliveries that end first are different.",
                          )}
                        >
                          <div
                            className="tabela-scroll"
                            tabIndex={0}
                            role="region"
                            aria-label={tx("Avaliação depois do resultado, semanas e meses (rolável)", "Evaluation after the outcome, weeks and months (scrollable)")}
                            data-avaliacao-frequencias=""
                          >
                            <table className="w-full min-w-[28rem] border-collapse text-sm">
                              <caption className="sr-only">{tx("Avaliação depois do resultado, com semanas e meses em colunas próprias", "Evaluation after the outcome, with weeks and months in their own columns")}</caption>
                              <thead>
                                <tr className="text-left text-xs text-mineral">
                                  <th scope="col" className="border-b-2 border-linha px-2 py-2 font-medium first:pl-0">
                                    {tx("Medida", "Measure")}
                                  </th>
                                  {avaliacao.map((a) => (
                                    <th key={a.frequencia} scope="col" className="border-b-2 border-linha px-2 py-2 font-medium" data-avaliacao={a.frequencia}>
                                      {tx(
                                        `${a.rotulo}, ${a.horizontes[0]} a ${a.horizontes[a.horizontes.length - 1]}`,
                                        `${a.rotulo}, ${a.horizontes[0]} to ${a.horizontes[a.horizontes.length - 1]}`,
                                      )}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {linhasAvaliacao.map((l) => (
                                  <tr key={l.rotulo} className="border-b border-linha align-top">
                                    <th scope="row" className="px-2 py-2 text-left text-xs font-normal text-mineral first:pl-0">
                                      {l.rotulo}
                                    </th>
                                    {l.valores.map((v, i) => (
                                      <td key={avaliacao[i].frequencia} className="px-2 py-2 leading-snug text-carvao">
                                        {v}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <PrevisoesLegenda>
                            <Gold texto={g.definicoes.realizado} />{" "}
                            {tx(
                              "Erro e viés só serão calculados com entregas terminadas; o desempenho fora da amostra está no painel de desempenho.",
                              "Error and bias will only be calculated with ended deliveries; out-of-sample performance is in the performance panel.",
                            )}
                          </PrevisoesLegenda>
                        </SecaoDoPainel>
                      }
                    />
                  ) : (
                    <>
                      <PrevisoesAviso tipo="alerta">
                        {tx("Nenhuma rodada com células está registrada nesta publicação", "No run with cells is recorded in this publication")}
                        {!comRodada ? (
                          <>
                            : <TrechoPortugues regiao="previsoes-motivo">{at.motivo}</TrechoPortugues>
                          </>
                        ) : (
                          ""
                        )}
                        {tx(". A grade 4 × 7 aparece quando a primeira rodada for emitida.", ". The 4 × 7 grid appears when the first run is issued.")}
                      </PrevisoesAviso>
                      {recorte13}
                    </>
                  )}

                  {comRodada && (
                    <PrevisoesAuditoria id="rodada" titulo={tx("A rodada: corte, emissão, código e condições da referência experimental", "The run: cutoff, issue, code and conditions of the experimental benchmark")}>
                      <dl>
                        <PrevisoesFichaLinha rotulo={tx("Identificador", "Identifier")}>
                          <code className="font-mono text-xs">{at.run_id}</code>
                        </PrevisoesFichaLinha>
                        <PrevisoesFichaLinha rotulo={tx("Corte e prazo", "Cutoff and deadline")}>
                          {tx(
                            `corte em ${instanteBR(at.cutoff)}; prazo de emissão ${at.prazo ? instanteBR(at.prazo) : "não registrado"} (Brasília)`,
                            `cutoff on ${instanteBR(at.cutoff, idioma)}; issue deadline ${at.prazo ? instanteBR(at.prazo, idioma) : "not recorded"} (Brasília time)`,
                          )}
                        </PrevisoesFichaLinha>
                        <PrevisoesFichaLinha rotulo={tx("Emissão", "Issue")}>
                          {textoEmissao(at, idioma)}.{" "}
                          {at.alertas.length ? tx(`Alertas registrados: ${textoAlertas(at.alertas)}.`, `Recorded alerts: ${textoAlertas(at.alertas, idioma)}.`) : ""}
                        </PrevisoesFichaLinha>
                        <PrevisoesFichaLinha rotulo={tx("Versão do código", "Code version")}>
                          <code className="font-mono text-xs">{at.versao_codigo ?? tx("não registrada", "not recorded")}</code>
                        </PrevisoesFichaLinha>
                        <PrevisoesFichaLinha rotulo={tx("Referência experimental", "Experimental benchmark")}>
                          {ref.autorizada ? tx("autorizada", "authorized") : tx("não autorizada", "not authorized")} (<TrechoPortugues regiao="previsoes-referencia">{ref.fundamento}</TrechoPortugues>);{" "}
                          {tx(`verificada em ${dataBR(ref.verificada_em)}. Não equivale a`, `checked on ${dataBR(ref.verificada_em)}. It is not equivalent to`)}{" "}
                          <TrechoPortugues regiao="previsoes-referencia">{ref.nao_equivale_a}</TrechoPortugues>.
                        </PrevisoesFichaLinha>
                        {ref.condicoes.map((c) => (
                          <PrevisoesFichaLinha key={c.id} rotulo={tx(`Condição: ${c.id.replace(/_/g, " ")}`, `Condition: ${c.id.replace(/_/g, " ")}`)}>
                            <TrechoPortugues regiao="previsoes-referencia">{c.descricao}</TrechoPortugues>: {c.verificada ? tx("verificada", "checked") : tx("não verificada", "not checked")}.{" "}
                            <TrechoPortugues regiao="previsoes-referencia">{c.evidencia}</TrechoPortugues>
                          </PrevisoesFichaLinha>
                        ))}
                        <PrevisoesFichaLinha rotulo={tx("Faixas", "Bands")}>
                          <TrechoPortugues regiao="previsoes-referencia">{ref.faixas}</TrechoPortugues>
                        </PrevisoesFichaLinha>
                        <PrevisoesFichaLinha rotulo={tx("Reexecução", "Rerun")}>
                          {tx(
                            `${reex.conferidas} ${reex.conferidas === 1 ? "previsão refeita" : "previsões refeitas"} com o dado como estava no corte, ${reex.divergentes.length ? `${reex.divergentes.length} com divergência` : "nenhuma divergente"} (tolerância ${textoTolerancia(reex.tolerancia)}). É conferência do próprio observatório, não aprovação metodológica independente.`,
                            `${reex.conferidas} ${reex.conferidas === 1 ? "forecast redone" : "forecasts redone"} with the data as it was at the cutoff, ${reex.divergentes.length ? `${reex.divergentes.length} with divergence` : "none divergent"} (tolerance ${textoTolerancia(reex.tolerancia, idioma)}). It is the observatory's own check, not an independent methodological approval.`,
                          )}
                        </PrevisoesFichaLinha>
                      </dl>
                    </PrevisoesAuditoria>
                  )}

                  <PrevisoesSeguir
                    ancora="p013"
                    proximo={{ href: enderecoPainel(proximoPainel("p013").id), pergunta: proximoPainel("p013", idioma).pergunta }}
                    downloads={downloadsDoPainel(g, "p013")}
                  />
                </div>
              </PainelEvidencia>
            </PrevisoesPainel>
          </Bloco>

          <Bloco id="arquivo">
            <PrevisoesPainel id="p015">
              <PainelEvidencia
                id="p015"
                pergunta={perguntaPainel("p015")}
                subtitulo={tx("Arquivo de emissões: arquivo imutável, uma linha por célula · R$/MWh e minutos", "Forecast archive: immutable archive, one row per cell · R$/MWh and minutes")}
                natureza="PREVISTO"
                porQueImporta={tx(
                  "Só se mede uma previsão com o que foi registrado antes do resultado. Se um número pudesse ser trocado depois, qualquer modelo pareceria acertar. Aqui cada emissão fica como saiu, com corte, horário, versão e motivo de falha; correção vira registro novo que aponta para o original.",
                  "A forecast can only be measured against what was recorded before the outcome. If a number could be swapped afterwards, any model would seem right. Here each issue stays as it came out, with cutoff, time, version and failure reason; a correction becomes a new record that points to the original.",
                )}
                oQueMudou={oQueMudou15}
                comoInterpretar={comoInterpretar15}
                naoConcluir={naoConcluir15}
                naoConcluirNoCorpo
                proveniencia={g.proveniencia}
              >
                <div className="space-y-6">
                  {csv ? (
                    <PrevisoesArquivo
                      linhas={recorte.linhas}
                      total={todas.length}
                      omitidas={recorte.omitidas}
                      fonte={fonteArquivo}
                      versao={versao}
                      avisos={avisosPorRodada}
                      notas={<NotasDoPainel oQueMudou={oQueMudou15} comoInterpretar={comoInterpretar15} naoConcluir={naoConcluir15} />}
                      recorte={
                        <PrevisoesRecorte
                          periodo={
                            rodadasArquivo.length
                              ? tx(
                                  `Rodadas de ${dataBR(rodadasArquivo[0].origem)} a ${dataBR(rodadasArquivo[rodadasArquivo.length - 1].origem)}`,
                                  `Runs from ${dataBR(rodadasArquivo[0].origem)} to ${dataBR(rodadasArquivo[rodadasArquivo.length - 1].origem)}`,
                                )
                              : tx("sem rodada registrada", "no run recorded")
                          }
                          universo={tx("Todas as células emitidas, com e sem número, de todos os modelos registrados", "All issued cells, with and without a number, from all registered models")}
                          unidade={tx("R$/MWh nominais (previsão, faixa, realizado e erro); minutos (atraso)", "Nominal R$/MWh (forecast, band, actual and error); minutes (delay)")}
                        />
                      }
                    />
                  ) : (
                    <>
                      <p data-resposta="p015" className="max-w-prose2 text-base leading-relaxed text-carvao md:text-lg">
                        {tx(
                          "O arquivo de emissões (CSV) não pôde ser lido nesta publicação; nenhum registro é exibido em vez de um registro de reserva.",
                          "The forecast archive (CSV) could not be read in this publication; no record is shown instead of a fallback record.",
                        )}
                      </p>
                      <PrevisoesRecorte
                        periodo={tx("sem leitura do arquivo", "archive not read")}
                        universo={tx("células emitidas", "issued cells")}
                        unidade={tx("R$/MWh nominais; minutos", "nominal R$/MWh; minutes")}
                      />
                    </>
                  )}
                  {csv && csv.invalidas > 0 && (
                    <PrevisoesAviso tipo="alerta">
                      {tx(
                        `${csv.invalidas} ${csv.invalidas === 1 ? "linha do CSV ficou fora" : "linhas do CSV ficaram fora"} por ter número de campos diferente do cabeçalho.`,
                        `${csv.invalidas} CSV ${csv.invalidas === 1 ? "row was" : "rows were"} left out for having a number of fields different from the header.`,
                      )}
                    </PrevisoesAviso>
                  )}

                  <PrevisoesAnalise id="revisoes" titulo={tx("Revisão entre rodadas para a mesma entrega", "Revision between runs for the same delivery")}>
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                      {revisoes.some((r) => r.rodadas > 1)
                        ? tx(
                            "Para cada entrega e submercado, as previsões com número de cada rodada e a mudança da última sobre a anterior.",
                            "For each delivery and submarket, the forecasts with a number from each run and the change of the latest over the previous one.",
                          )
                        : tx(
                            `Nenhuma das ${revisoes.length} entregas e submercados tem duas previsões com número: só a rodada mais recente tem números: não há revisão a mostrar.`,
                            `None of the ${revisoes.length} deliveries and submarkets has two forecasts with a number: only the latest run has numbers, so there is no revision to show.`,
                          )}
                    </p>
                    <TabelaInterativa
                      titulo={tx("Previsões por entrega e rodada", "Forecasts by delivery and run")}
                      colunas={colunasRevisoes(idioma)}
                      linhas={revisoes}
                      chaveLinha="id"
                      colunaRotulo="entrega"
                      fonte={fonteArquivo}
                      versao={versao}
                      nomeArquivo="previsoes-pld-revisoes-entre-rodadas"
                      chaveUrl="rev"
                      semLinhas={tx("Nenhuma entrega tem previsão com número.", "No delivery has a forecast with a number.")}
                    />
                  </PrevisoesAnalise>

                  <PrevisoesAnalise id="rotina" titulo={tx("Rotina diária: o que está escrito e o que já foi comprovado", "Daily routine: what is written and what has been demonstrated")}>
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
                      <Gold texto={g.rotina.leitura} />
                    </p>
                    <dl>
                      <PrevisoesFichaLinha rotulo={tx("Horários", "Times")}>
                        <TrechoPortugues regiao="previsoes-rotina">{g.rotina.horarios}</TrechoPortugues>
                      </PrevisoesFichaLinha>
                      <PrevisoesFichaLinha rotulo={tx("Fuso", "Time zone")}>
                        <TrechoPortugues regiao="previsoes-rotina">{g.rotina.fuso}</TrechoPortugues>
                      </PrevisoesFichaLinha>
                      <PrevisoesFichaLinha rotulo={tx("Execuções agendadas", "Scheduled runs")}>
                        {tx(
                          `${g.rotina.execucoes_agendadas} registradas: ${g.rotina.no_prazo} no prazo, ${g.rotina.atrasadas} atrasadas, ${g.rotina.falhas} com falha; ${g.rotina.dias_sem_rodada_total} ${g.rotina.dias_sem_rodada_total === 1 ? "dia" : "dias"} sem rodada desde ${g.rotina.inicio_operacao_agendada ? dataBR(g.rotina.inicio_operacao_agendada) : "o início da operação agendada, que ainda não aconteceu"}.`,
                          `${g.rotina.execucoes_agendadas} recorded: ${g.rotina.no_prazo} on time, ${g.rotina.atrasadas} late, ${g.rotina.falhas} failed; ${g.rotina.dias_sem_rodada_total} ${g.rotina.dias_sem_rodada_total === 1 ? "day" : "days"} without a run since ${g.rotina.inicio_operacao_agendada ? dataBR(g.rotina.inicio_operacao_agendada) : "the start of scheduled operation, which has not happened yet"}.`,
                        )}
                      </PrevisoesFichaLinha>
                      {(g.rotina.incidentes ?? []).map((x) => (
                        <PrevisoesFichaLinha key={x.de} rotulo={tx("Rodadas não registradas", "Runs not recorded")}>
                          {tx(`De ${dataBR(x.de)} a ${dataBR(x.ate)}, ${x.execucoes} execuções agendadas: `, `From ${dataBR(x.de)} to ${dataBR(x.ate)}, ${x.execucoes} scheduled runs: `)}
                          <Gold texto={x.motivo} />{" "}
                          <a href={x.fonte} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">{tx("execuções", "runs")}</a>
                          {" · "}
                          <a href={x.correcao} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">{tx("correção", "fix")}</a>
                        </PrevisoesFichaLinha>
                      ))}
                      <PrevisoesFichaLinha rotulo={tx("Critério", "Criterion")}>
                        <Gold texto={g.rotina.criterio_comprovacao} />
                      </PrevisoesFichaLinha>
                      <PrevisoesFichaLinha rotulo={tx("Comprovada", "Demonstrated")}>{g.rotina.comprovada ? tx("sim", "yes") : tx("não", "no")}</PrevisoesFichaLinha>
                      <PrevisoesFichaLinha rotulo={tx("Verificado em", "Checked on")}>
                        {tx(
                          `${carimbo(g.rotina.verificado_em)}; prazos vencidos até ${dataBR(g.rotina.dias_vencidos_ate)}`,
                          `${carimbo(g.rotina.verificado_em)}; deadlines passed through ${dataBR(g.rotina.dias_vencidos_ate)}`,
                        )}
                      </PrevisoesFichaLinha>
                    </dl>
                  </PrevisoesAnalise>

                  <PrevisoesAuditoria id="imutabilidade" titulo={tx("Imutabilidade, reexecução e achados", "Immutability, rerun and findings")}>
                    <p className="text-sm leading-relaxed text-carvao-muted">
                      {tx(
                        "Registros novos entram em partições mensais encadeadas: cada registro guarda o sha256 do anterior, e qualquer alteração, remoção ou reordenação quebra a cadeia.",
                        "New records go into chained monthly partitions: each record keeps the sha256 of the previous one, and any change, removal or reordering breaks the chain.",
                      )}{" "}
                      {transcritas.length
                        ? tx(
                            `${transcritas.map((r) => r.rotulo).join(", ")}: registros transcritos, incluídos no arquivo depois da emissão, no arquivo legado congelado.`,
                            `${transcritas.map((r) => r.rotulo).join(", ")}: transcribed records, included in the archive after issue, in the frozen legacy archive.`,
                          )
                        : tx("Nenhum registro foi transcrito depois da emissão.", "No record was transcribed after issue.")}{" "}
                      {tx(
                        `A reexecução refez ${reex.conferidas} ${reex.conferidas === 1 ? "previsão arquivada" : "previsões arquivadas"} com o dado como estava no corte: ${reex.divergentes.length ? `${reex.divergentes.length} divergentes` : "nenhuma divergente"} (tolerância ${textoTolerancia(reex.tolerancia)}).`,
                        `The rerun redid ${reex.conferidas} ${reex.conferidas === 1 ? "archived forecast" : "archived forecasts"} with the data as it was at the cutoff: ${reex.divergentes.length ? `${reex.divergentes.length} divergent` : "none divergent"} (tolerance ${textoTolerancia(reex.tolerancia, idioma)}).`,
                      )}
                    </p>
                    {particoes.length > 0 && (
                      <ul className="space-y-1 text-sm">
                        {particoes.map((p) => (
                          <li key={p.url}>
                            <a href={p.url} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 [overflow-wrap:anywhere]">
                              {idioma === "en" ? <Nome>{datasLegiveis(p.rotulo, "pt")}</Nome> : datasLegiveis(p.rotulo)}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-sm leading-relaxed text-carvao-muted">
                      <TrechoPortugues regiao="previsoes-achados">{g.prospectivo.calibracao_regra_antiga.descricao}</TrechoPortugues>{" "}
                      {tx(
                        `Registros afetados: ${g.prospectivo.calibracao_regra_antiga.registros}; com estado de calibração diferente depois da correção: ${g.prospectivo.calibracao_regra_antiga.status_diferente}.`,
                        `Records affected: ${g.prospectivo.calibracao_regra_antiga.registros}; with a different calibration state after the correction: ${g.prospectivo.calibracao_regra_antiga.status_diferente}.`,
                      )}
                    </p>
                    <dl>
                      <PrevisoesFichaLinha rotulo={tx<ReactNode>(`Achado A08 (${g.governanca.achados.A08.estado})`, <>Finding A08 ({estadoAchado(g.governanca.achados.A08.estado)})</>)}>
                        <TrechoPortugues regiao="previsoes-achados">
                          {g.governanca.achados.A08.diagnostico} Correção: {g.governanca.achados.A08.correcao} {g.governanca.achados.A08.confirmacao}
                        </TrechoPortugues>
                      </PrevisoesFichaLinha>
                      <PrevisoesFichaLinha rotulo={tx<ReactNode>(`Achado A09 (${g.governanca.achados.A09.estado})`, <>Finding A09 ({estadoAchado(g.governanca.achados.A09.estado)})</>)}>
                        <TrechoPortugues regiao="previsoes-achados">{g.governanca.achados.A09.leitura}</TrechoPortugues>
                      </PrevisoesFichaLinha>
                    </dl>
                    <p className="text-xs text-mineral">
                      {tx(`${num(todas.length, 0)} linhas no CSV; para reproduzir:`, `${num(todas.length, 0)} rows in the CSV; to reproduce:`)}{" "}
                      {identificador(
                        "python3 pipeline/energia/executar_modulo.py previsoes --sem-coleta", // i18n: dado
                        idioma,
                      )}
                      .
                    </p>
                  </PrevisoesAuditoria>

                  <PrevisoesSeguir
                    ancora="p015"
                    proximo={{ href: enderecoPainel(proximoPainel("p015").id), pergunta: proximoPainel("p015", idioma).pergunta }}
                    downloads={[...downloadsDoPainel(g, "p015"), ...particoes]}
                  />
                </div>
              </PainelEvidencia>
            </PrevisoesPainel>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
