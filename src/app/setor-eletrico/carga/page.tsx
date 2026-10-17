import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { CargaHistorico } from "@/components/energia/CargaHistorico";
import { CargaMetricas, CargaNivel } from "@/components/energia/CargaNivel";
import { CargaAviso, CargaCapitulos, CargaFontes, CargaIndisponivel, CargaSeguir } from "@/components/energia/CargaPagina";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { Unidade } from "@/components/evidencia/Unidade";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  REGIOES,
  colunasComparacoesTodas,
  curtoRegiao,
  linhasComparacoesTodas,
  marcosRegimes,
  nomeRegiao,
  paraTabela,
  parentesesMmgd,
  perguntaPainel,
  rotaPainel,
  rotuloJanelaA07,
  rotuloSituacaoRevisao,
  serieColunar,
  situacaoAtualidade,
  textoAvisoRegimes,
  textoRegimesCarga,
  textoRevisoes,
} from "@/lib/energia/carga";
import { carimbo, dataBR, mesAno, num, plural, sinal, valorExibidoNoIdioma } from "@/lib/energia/formato";
import { gold, integra, lerGold } from "@/lib/energia/gold";
import { TIPO_REGRA_CARGA_EN, rotuloDaGold } from "@/lib/energia/i18n/agua-carga-rede";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { CargaDetalheGold } from "@/lib/energia/tipos-carga";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/carga", {
    title: tx("Carga: nível e crescimento do consumo do sistema elétrico", "Load: level and growth of power system consumption"),
    description: tx(
      "Carga de energia diária do SIN e dos subsistemas (ONS) com comparações de calendário equivalente, médias mensais e anuais dentro do mesmo regime metodológico, revisões entre capturas, validação física e a reprodução da variação de sete dias publicada antes, com o que ela não permite concluir.",
      "Daily energy load of the SIN and the subsystems (ONS) with equivalent-calendar comparisons, monthly and annual averages within the same methodological regime, revisions between captures, physical validation and the reproduction of the seven-day change published earlier, with what it does not allow one to conclude.",
    ),
    alternates: { canonical: "/setor-eletrico/carga" },
  }, anterior);
}

const fonteDiaria = () => tx("ONS, Carga de Energia Diária (validada pelo observatório)", "ONS, Daily Energy Load (validated by the observatory)");

const colunasCapturas = (): ColunaTabela[] => [
  { id: "captura", rotulo: tx("Captura", "Capture"), tipo: "texto", categorica: true },
  { id: "d", rotulo: tx("Dia", "Day"), tipo: "data" },
  ...(["SE", "S", "NE", "N", "SIN"] as const).map((sm): ColunaTabela => ({ id: sm, rotulo: curtoRegiao(sm), tipo: "numero", unidade: tx("MWmed", "MWavg"), casas: 3 })),
  { id: "fora", rotulo: tx("Fora do domínio", "Out of domain"), tipo: "texto" },
];
/** Colunas da tabela do A07; os anos das duas janelas vêm da referência do achado na gold. */
const colunasA07Regioes = (ano: string, anoAnt: string): ColunaTabela[] => [
  { id: "regiao", rotulo: tx("Região", "Region"), tipo: "texto" },
  { id: "mesmas", rotulo: tx("Mesmas datas", "Same dates"), tipo: "percentual", casas: 2 },
  { id: "equivalente", rotulo: tx("Mesmos dias da semana", "Same days of the week"), tipo: "percentual", casas: 2 },
  { id: "curva", rotulo: tx("Curva horária, mesmas datas", "Hourly curve, same dates"), tipo: "percentual", casas: 2 },
  { id: "global", rotulo: tx("Carga global (API), mesmas datas", "Global load (API), same dates"), tipo: "percentual", casas: 2 },
  { id: "mmgd", rotulo: tx("MMGD (API), mesmas datas", "MMGD (API), same dates"), tipo: "percentual", casas: 2 },
  { id: "liquida", rotulo: tx("Carga líquida (API), mesmas datas", "Net load (API), same dates"), tipo: "percentual", casas: 2 },
  { id: "pontos", rotulo: tx("Aumento da MMGD em pontos da carga global", "MMGD increase in points of the global load"), tipo: "numero", unidade: tx("p.p.", "pp"), casas: 2 },
  { id: "temp_a", rotulo: tx(`Temperatura em ${ano}`, `Temperature in ${ano}`), tipo: "numero", unidade: "°C", casas: 1 },
  { id: "temp_b", rotulo: tx(`Temperatura nas mesmas datas de ${anoAnt}`, `Temperature on the same dates of ${anoAnt}`), tipo: "numero", unidade: "°C", casas: 1 },
];
const colunasResiduos = (): ColunaTabela[] => [
  { id: "regiao", rotulo: tx("Região", "Region"), tipo: "texto", categorica: true },
  { id: "janela", rotulo: tx("Janela", "Window"), tipo: "texto", categorica: true },
  { id: "inicio", rotulo: tx("Início", "Start"), tipo: "data" },
  { id: "fim", rotulo: tx("Fim", "End"), tipo: "data" },
  { id: "dias", rotulo: tx("Dias previstos", "Predicted days"), tipo: "numero", casas: 0 }, // i18n: dado
  { id: "dias_janela", rotulo: tx("Dias da janela", "Days in the window"), tipo: "numero", casas: 0 },
  { id: "real", rotulo: tx("Real", "Actual"), tipo: "numero", unidade: tx("MWmed", "MWavg"), casas: 0 },
  { id: "previsto", rotulo: tx("Previsto", "Predicted"), tipo: "numero", unidade: tx("MWmed", "MWavg"), casas: 0 },
  { id: "residuo_pct", rotulo: tx("Real contra previsto", "Actual against predicted"), tipo: "percentual", casas: 2 },
  { id: "dias_acima_p90", rotulo: tx("Dias acima do intervalo de 80%", "Days above the 80% interval"), tipo: "numero", casas: 0 },
  { id: "dias_abaixo_p10", rotulo: tx("Dias abaixo do intervalo de 80%", "Days below the 80% interval"), tipo: "numero", casas: 0 },
];
const colunasRevisoes = (): ColunaTabela[] => [
  { id: "sm", rotulo: tx("Subsistema", "Subsystem"), tipo: "texto", categorica: true },
  { id: "dia", rotulo: tx("Dia", "Day"), tipo: "data" }, // i18n: dado
  { id: "valor_ant", rotulo: tx("Valor anterior", "Previous value"), tipo: "numero", unidade: tx("MWmed", "MWavg"), casas: 3 },
  { id: "valor", rotulo: tx("Valor revisado", "Revised value"), tipo: "numero", unidade: tx("MWmed", "MWavg"), casas: 3 }, // i18n: dado
  { id: "diferenca", rotulo: tx("Diferença", "Difference"), tipo: "numero", unidade: tx("MWmed", "MWavg"), casas: 3 },
  { id: "diferenca_pct", rotulo: tx("Diferença relativa", "Relative difference"), tipo: "percentual", casas: 4 },
  { id: "situacao", rotulo: tx("Situação", "Status"), tipo: "texto", categorica: true },
  { id: "capturado_em_ant", rotulo: tx("Captura anterior", "Previous capture"), tipo: "texto" },
  { id: "capturado_em", rotulo: tx("Captura", "Capture"), tipo: "texto" },
];
const colunasOcorrencias = (): ColunaTabela[] => [
  { id: "sm", rotulo: tx("Subsistema", "Subsystem"), tipo: "texto", categorica: true },
  { id: "dia", rotulo: tx("Dia", "Day"), tipo: "data" }, // i18n: dado
  { id: "valor", rotulo: tx("Valor da fonte", "Source value"), tipo: "numero", unidade: tx("MWmed", "MWavg"), casas: 3 }, // i18n: dado
  { id: "regras", rotulo: tx("Regras violadas", "Rules violated"), tipo: "texto" },
  { id: "situacao", rotulo: tx("Situação", "Status"), tipo: "texto", categorica: true },
  { id: "conferencia", rotulo: tx("Conferência", "Cross-check"), tipo: "texto", idiomaTexto: "portugues" },
];
const colunasEsperados = (): ColunaTabela[] => [
  { id: "sm", rotulo: tx("Subsistema", "Subsystem"), tipo: "texto" },
  { id: "inicio", rotulo: tx("Primeiro dia", "First day"), tipo: "data" },
  { id: "fim", rotulo: tx("Último dia", "Last day"), tipo: "data" },
  { id: "esperados", rotulo: tx("Dias esperados", "Expected days"), tipo: "numero", casas: 0 },
  { id: "presentes", rotulo: tx("Presentes", "Present"), tipo: "numero", casas: 0 },
  { id: "ausentes", rotulo: tx("Ausentes na fonte", "Missing in the source"), tipo: "numero", casas: 0 },
  { id: "quarentena", rotulo: tx("Em quarentena", "In quarantine"), tipo: "numero", casas: 0 },
];
const colunasAusentes = (): ColunaTabela[] => [
  { id: "sm", rotulo: tx("Subsistema", "Subsystem"), tipo: "texto", categorica: true },
  { id: "dia", rotulo: tx("Dia", "Day"), tipo: "data" }, // i18n: dado
  { id: "estado", rotulo: tx("Estado no arquivo da última captura da fonte", "Status in the file of the latest source capture"), tipo: "texto", categorica: true },
  { id: "valor_arquivo_atual", rotulo: tx("Valor no arquivo da última captura", "Value in the file of the latest capture"), tipo: "numero", unidade: tx("MWmed", "MWavg"), casas: 3 },
];
const rotuloAusencia = (): Record<string, string> => ({
  celula_vazia_na_fonte: tx("célula vazia na fonte", "empty cell in the source"),
  linha_ausente_na_fonte: tx("linha ausente na fonte", "row missing in the source"),
  presente_no_arquivo_atual: tx("presente no arquivo da última captura", "present in the file of the latest capture"),
  nao_conferido: tx("não conferido", "not checked"),
});

export default function CargaPage() {
  const g = lerGold<CargaDetalheGold>("carga_detalhe.json");
  const c = gold.carga();
  if (!integra(g) || !integra(c)) return <CargaIndisponivel motivo={(g as { motivo?: string } | null)?.motivo ?? (c as { motivo?: string } | null)?.motivo} />;

  const idioma = idiomaEnergia();
  const FONTE = fonteDiaria();
  const ROTULO_AUSENCIA = rotuloAusencia();
  const p = g.p025;
  const a = g.a07;
  const atual = situacaoAtualidade(g.dia_referencia, g.gerado_em);
  const ev = g.evidencias;
  const versao = g.dia_referencia;
  const downloads = [...c.downloads, ...g.downloads.filter((d) => /comparacoes|revisoes/.test(d.url))];
  const val = p.validacao;
  const fimMensal = c.mensal[c.mensal.length - 1];
  const residuosA07 = a.residuos_fora_da_amostra.filter((r) => r.sm === "SIN");
  const inicioMensal = c.mensal[0]?.m.slice(0, 4) ?? "";
  const regimesTexto = g.regimes
    .map(
      (r) =>
        `${dataBR(r.inicio)}${
          r.observado_nos_dados ? tx(` (observado nos dados em ${dataBR(r.observado_nos_dados)})`, ` (observed in the data on ${dataBR(r.observado_nos_dados)})`) : ""
        }`,
    )
    .join(", ");
  const oQueMudou = (
    <>
      {atual.texto} {textoRevisoes(p.revisoes)}
    </>
  );
  const comoInterpretar = tx(
    <>
      &ldquo;Mesmos dias da semana&rdquo; compara com a janela deslocada 364 dias (cada dia da semana com o seu par); &ldquo;mesmas datas&rdquo; compara com o mesmo
      calendário do ano anterior, como a publicação diária do observatório fazia. A variação só existe quando as duas janelas têm todos os dias e estão no mesmo
      regime do ONS: {regimesTexto}.
      A composição de dias úteis, sábados e domingos ou feriados de cada janela aparece abaixo do gráfico de pontos e na tabela equivalente.
    </>,
    <>
      &ldquo;Same days of the week&rdquo; compares with the window shifted by 364 days (each day of the week with its pair); &ldquo;same dates&rdquo; compares with the same
      calendar of the previous year, as the observatory&apos;s daily publication did. The change only exists when both windows have every day and are in the same ONS
      regime: {regimesTexto}. The mix of working days, Saturdays and Sundays or holidays in each window appears below the dot chart and in the equivalent table.
    </>,
  );
  const naoConcluir = tx(
    <>
      A variação da carga não mede atividade econômica: este painel não tem dado de atividade que sustente essa leitura. A carga inclui uma estimativa de MMGD que o
      ONS não publica separada{parentesesMmgd(g.regimes)}, então não se sabe quanto da variação vem dela. A carga não é ajustada por temperatura; a decomposição
      estatística está na página Clima e calendário. As duas bases dão taxas diferentes para a mesma janela, e nenhuma delas isola clima, calendário ou atividade.
    </>,
    <>
      The change in load does not measure economic activity: this panel has no activity data to support that reading. The load includes an MMGD estimate that ONS
      does not publish separately{parentesesMmgd(g.regimes)}, so it is not known how much of the change comes from it. The load is not adjusted for temperature; the
      statistical breakdown is on the Climate and calendar page. The two bases give different rates for the same window, and neither isolates climate, calendar or activity.
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="carga" />
      <MarcaVisita secao="energia:carga" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["MWmed", "MMGD", "SIN", "ONS"]}
          titulo={perguntaPainel("p025")}
          lead={tx(
            "A carga média do sistema interligado (SIN) numa janela de dias, ao lado da janela de um ano antes. Mesmos dias da semana e mesmas datas dão taxas diferentes.",
            "The average load of the interconnected system (SIN) over a window of days, next to the window one year earlier. Same days of the week and same dates give different rates.",
          )}
          recorte={tx(`até ${dataBR(g.dia_referencia)} · SIN e subsistemas · MWmed e %`, `through ${dataBR(g.dia_referencia)} · SIN and subsystems · MWavg and %`)}
          fonte={tx("ONS, Carga de Energia Diária", "ONS, Daily Energy Load")}
          referencia={tx(
            <>
              ONS, Carga de Energia Diária, até {dataBR(g.dia_referencia)}; processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              ONS, Daily Energy Load, through {dataBR(g.dia_referencia)}; processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          metricas={<CargaMetricas comparacoes={p.comparacoes} evidencias={{ equivalente: ev.p025_7d_equivalente ?? null, mesmasDatas: ev.a07_reproducao ?? null }} />}
        >
          {tx(
            <>
              A <Termo slug="carga">carga</Termo> é a energia que o sistema interligado atende, publicada pelo ONS por subsistema; aqui ela vem como a potência média do dia, em{" "}
              <Unidade u="MWmed" /> (1 MWmed durante um dia equivale a 24 MWh). Esta página compara a
              carga média de uma janela de dias com a de uma janela de comparação, e diz quando as duas não têm a mesma mistura de dias úteis, sábados e domingos ou feriados.
              Só compara janelas completas e medidas do mesmo modo: {textoRegimesCarga(g.regimes)}. O perfil horário e a MMGD estão na página MMGD e perfil horário, e a
              decomposição por clima e calendário na página Clima e calendário.
            </>,
            <>
              The <Termo slug="carga">load</Termo> is the energy the interconnected system serves, published by ONS by subsystem; here it is shown as the average power of the day, in{" "}
              <Unidade u="MWmed" /> (1 MWavg over one day equals 24 MWh). This page compares the average load of a window of days with that of a comparison window, and says when
              the two do not have the same mix of working days, Saturdays and Sundays or holidays. It only compares complete windows measured the same way:{" "}
              {textoRegimesCarga(g.regimes)}. The hourly profile and the MMGD are on the MMGD and hourly profile page, and the breakdown by climate and calendar on the Climate
              and calendar page.
            </>,
          )}
        </CabecalhoModulo>
        <ModoProfundidade>
          <Bloco id="nivel">
            <PainelEvidencia
              id="p025"
              pergunta={tx("Cada janela frente à janela de comparação", "Each window against the comparison window")}
              subtitulo={tx(
                "Carga diária por região, janelas comparáveis e médias mensais e anuais · MWmed e %",
                "Daily load by region, comparable windows and monthly and annual averages · MWavg and %",
              )}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>
                  A carga é o lado da demanda no balanço de energia. Comparar janelas com os mesmos dias da semana e o mesmo regime de medição separa o que mudou na carga do
                  que mudou no calendário ou na forma de medir.
                </>,
                <>
                  The load is the demand side of the energy balance. Comparing windows with the same days of the week and the same measurement regime separates what changed in
                  the load from what changed in the calendar or in the way of measuring.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.comparacoes}
              complementares={[{ rotulo: tx("Carga diária por subsistema (série)", "Daily load by subsystem (series)"), p: c.proveniencia.carga }]}
            >
              <div className="space-y-6">
                {atual.defasada && <CargaAviso tipo="alerta">{atual.texto}</CargaAviso>}
                <CargaNivel
                  p025={{ comparacoes: p.comparacoes, mensal: p.mensal, anual: p.anual, acumulado_ano: p.acumulado_ano }}
                  serie={serieColunar(c.serie)}
                  regimes={g.regimes}
                  fonte={FONTE}
                  versao={versao}
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  aposPrincipal={<CargaCapitulos />}
                  historia={
                    <SecaoDoPainel
                      id="historico"
                      titulo={tx(
                        `Como a carga média do SIN evoluiu desde ${inicioMensal}, e o que mudou na medida?`,
                        `How has the average SIN load evolved since ${inicioMensal}, and what changed in the measurement?`,
                      )}
                      lead={tx(
                        "Cada marca no gráfico é uma mudança do que o ONS inclui na carga: antes e depois dela, os níveis não medem a mesma coisa.",
                        "Each mark on the chart is a change in what ONS includes in the load: before and after it, the levels do not measure the same thing.",
                      )}
                    >
                      <CargaHistorico
                        titulo={tx(`Carga média mensal do SIN desde ${inicioMensal}`, `Monthly average SIN load since ${inicioMensal}`)}
                        dados={c.mensal.map((x) => ({ m: x.m, SIN: x.SIN ?? null }))}
                        cor="var(--cor-energia)"
                        marcos={marcosRegimes(g.regimes, c.mensal[0]?.m ?? "", fimMensal?.m ?? "", "mes")}
                      />
                      <CargaAviso>
                        {textoAvisoRegimes(g.regimes)}
                        {fimMensal && fimMensal.m === g.dia_referencia.slice(0, 7)
                          ? tx(
                              ` O último mês (${mesAno(fimMensal.m)}) é parcial, com ${plural(fimMensal.dias, "dia", "dias")}.`,
                              ` The last month (${mesAno(fimMensal.m)}) is partial, with ${plural(fimMensal.dias, "day", "days")}.`,
                            )
                          : ""}
                      </CargaAviso>
                    </SecaoDoPainel>
                  }
                />

                <SecaoDoPainel
                  id="a07"
                  nivel="analisar"
                  titulo={tx(
                    `O ${sinal(a.referencia.variacao_publicada_pct, 1)}% publicado em ${carimbo(a.referencia.gerado_em)}: o que se reproduz e o que não se conclui`,
                    `The ${sinal(a.referencia.variacao_publicada_pct, 1)}% published on ${carimbo(a.referencia.gerado_em)}: what is reproduced and what is not concluded`,
                  )}
                >
                  <div className="max-w-sm">
                    <Numero
                      rotulo={tx(
                        "Variação da carga do SIN: os mesmos 7 dias contra as mesmas datas do ano anterior, a taxa que o observatório publicou antes",
                        "Change in the SIN load: the same 7 days against the same dates of the previous year, the rate the observatory published earlier",
                      )}
                      natureza="CALCULADO"
                      evidencia={ev.a07_reproducao}
                      formato="pct"
                      casas={2}
                      tamanho="medio"
                      cor="var(--serie-referencia)"
                      nota={tx(
                        `Variação maior que zero não indica, sozinha, mais atividade econômica.${ev.a07_reproducao ? ` Na ficha de prova: ${ev.a07_reproducao.valor_exibido}, com uma casa.` : ""}`,
                        `A change above zero does not, on its own, indicate more economic activity.${ev.a07_reproducao ? ` In the evidence card: ${valorExibidoNoIdioma(ev.a07_reproducao.valor_exibido, "en")}, with one decimal place.` : ""}`,
                      )}
                      endereco={`${rotaPainel("p025")}#a07`}
                    />
                  </div>
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao" data-textos="a07">
                    {a.textos.map((t) => (
                      <li key={t}>
                        <TrechoPortugues regiao="achado A07 da carga">{t}</TrechoPortugues>
                      </li>
                    ))}
                  </ul>
                  <TabelaInterativa
                    titulo={tx("Variação nas mesmas janelas, por região e produto", "Change over the same windows, by region and product")}
                    colunas={colunasA07Regioes(a.referencia.inicio.slice(0, 4), a.referencia.inicio_anterior.slice(0, 4))}
                    linhas={REGIOES.map((sm) => {
                      const cp = a.comparacoes.find((x) => x.sm === sm);
                      const m = a.mmgd.find((x) => x.sm === sm);
                      const t = a.temperatura.find((x) => x.sm === sm);
                      return {
                        id: sm,
                        regiao: nomeRegiao(sm),
                        mesmas: cp?.mesmas_datas?.variacao_pct ?? null,
                        equivalente: cp?.equivalente?.variacao_pct ?? null,
                        curva: cp?.curva_horaria_mesmas_datas ?? null,
                        global: m?.var_b?.global_pct ?? null,
                        mmgd: m?.var_b?.mmgd_pct ?? null,
                        liquida: m?.var_b?.liquida_pct ?? null,
                        pontos: m?.var_b?.mmgd_na_variacao_pct_pontos ?? null,
                        temp_a: t?.a ?? null,
                        temp_b: t?.b ?? null,
                      };
                    })}
                    chaveLinha="id"
                    colunaRotulo="regiao"
                    fonte={tx(
                      "ONS (carga diária, curva horária e carga verificada) e NASA POWER (temperatura)",
                      "ONS (daily load, hourly curve and verified load) and NASA POWER (temperature)",
                    )}
                    versao={a.referencia.fim}
                    nomeArquivo="carga-a07-regioes"
                    chaveUrl="a07"
                    nota={tx(
                      `Temperatura de ${dataBR(a.janela_modelo.inicio)} a ${dataBR(a.janela_modelo.fim)} (${a.janela_modelo.dias} de ${a.janela_modelo.dias_janela} dias)${a.janela_modelo.motivo ? `: ${a.janela_modelo.motivo}` : ""}.`,
                      `Temperature from ${dataBR(a.janela_modelo.inicio)} to ${dataBR(a.janela_modelo.fim)} (${a.janela_modelo.dias} of ${a.janela_modelo.dias_janela} days)${a.janela_modelo.motivo ? ` (reason, in Portuguese: ${a.janela_modelo.motivo})` : ""}.`,
                    )}
                  />
                  <TabelaInterativa
                    titulo={tx(
                      "Real contra o previsto fora da amostra nas janelas da variação de 7 dias (SIN)",
                      "Actual against out-of-sample predicted in the windows of the 7-day change (SIN)",
                    )}
                    colunas={colunasResiduos()}
                    linhas={paraTabela(residuosA07.map((r) => ({ ...r, id: `${r.sm}:${r.janela}`, regiao: nomeRegiao(r.sm), janela: rotuloJanelaA07(r.janela) })))}
                    chaveLinha="id"
                    colunaRotulo="janela"
                    fonte={tx("Decomposição estatística do observatório", "Statistical breakdown by the observatory")}
                    versao={a.referencia.fim}
                    nomeArquivo="carga-a07-residuos"
                    chaveUrl="a07r"
                  />
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        A divisão da diferença entre calendário, temperatura, sazonalidade, tendência e resíduo, por região e variante do modelo, está na página{" "}
                        <a href={`${rotaPainel("p027")}#p027`} className="text-energia-dark underline underline-offset-4">
                          Clima e calendário
                        </a>
                        ; a parcela de MMGD da carga verificada, na página{" "}
                        <a href={`${rotaPainel("p026")}#p026`} className="text-energia-dark underline underline-offset-4">
                          MMGD e perfil horário
                        </a>
                        .
                      </>,
                      <>
                        The split of the difference into calendar, temperature, seasonality, trend and residual, by region and model variant, is on the{" "}
                        <a href={`${rotaPainel("p027")}#p027`} className="text-energia-dark underline underline-offset-4">
                          Climate and calendar
                        </a>{" "}
                        page; the MMGD share of the verified load, on the{" "}
                        <a href={`${rotaPainel("p026")}#p026`} className="text-energia-dark underline underline-offset-4">
                          MMGD and hourly profile
                        </a>{" "}
                        page.
                      </>,
                    )}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="a07-capturas"
                  nivel="auditar"
                  titulo={tx(
                    `${a.por_captura_2026.length === 1 ? "A captura" : `As ${num(a.por_captura_2026.length, 0)} capturas`} do arquivo de ${a.referencia.fim.slice(0, 4)} usadas na variação de 7 dias`,
                    `${a.por_captura_2026.length === 1 ? "The capture" : `The ${num(a.por_captura_2026.length, 0)} captures`} of the ${a.referencia.fim.slice(0, 4)} file used in the 7-day change`,
                  )}
                >
                  {a.por_captura_2026.map((cap) => (
                    <p key={cap.sha256} className="text-sm text-carvao-muted">
                      {tx(
                        <>
                          Captura de {carimbo(cap.capturado_em)} (sha256 {cap.sha256.slice(0, 12)}…):{" "}
                          {cap.janela_completa && cap.variacao_pct !== null
                            ? `janela completa, variação de ${sinal(cap.variacao_pct, 2)}% sobre as mesmas datas de ${a.referencia.inicio_anterior.slice(0, 4)}.`
                            : "janela incompleta ou com valor fora do domínio: a variação não existe com esta captura."}
                        </>,
                        <>
                          Capture of {carimbo(cap.capturado_em)} (sha256 {cap.sha256.slice(0, 12)}…):{" "}
                          {cap.janela_completa && cap.variacao_pct !== null
                            ? `complete window, change of ${sinal(cap.variacao_pct, 2)}% over the same dates of ${a.referencia.inicio_anterior.slice(0, 4)}.`
                            : "incomplete window or with an out-of-domain value: the change does not exist with this capture."}
                        </>,
                      )}
                    </p>
                  ))}
                  <TabelaInterativa
                    titulo={tx(
                      `Carga diária de cada captura, de ${dataBR(a.referencia.inicio)} a ${dataBR(a.referencia.fim)}`,
                      `Daily load of each capture, from ${dataBR(a.referencia.inicio)} to ${dataBR(a.referencia.fim)}`,
                    )}
                    colunas={colunasCapturas()}
                    linhas={a.por_captura_2026.flatMap((cap) =>
                      cap.dias.map((d) => ({ id: `${cap.capturado_em}:${d.d}`, captura: carimbo(cap.capturado_em), d: d.d, SE: d.SE, S: d.S, NE: d.NE, N: d.N, SIN: d.SIN, fora: d.fora_do_dominio.join(", ") })),
                    )}
                    chaveLinha="id"
                    colunaRotulo="d"
                    fonte={tx("ONS, Carga de Energia Diária (silver principal, capturas guardadas)", "ONS, Daily Energy Load (main silver, stored captures)")}
                    versao={a.referencia.fim}
                    nomeArquivo="carga-a07-capturas"
                    chaveUrl="cap"
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="revisoes" nivel="auditar" titulo={tx("Revisões da fonte entre capturas", "Source revisions between captures")}>
                  <p className="text-sm text-carvao-muted">{textoRevisoes(p.revisoes)}</p>
                  <TabelaInterativa
                    titulo={tx("Valores revisados pela fonte", "Values revised by the source")}
                    colunas={colunasRevisoes()}
                    linhas={paraTabela(
                      p.revisoes.linhas.map((l) => ({
                        ...l,
                        id: `${l.sm}:${l.dia}:${l.capturado_em}`,
                        situacao: rotuloSituacaoRevisao(l.situacao),
                        capturado_em: carimbo(l.capturado_em),
                        capturado_em_ant: carimbo(l.capturado_em_ant),
                      })),
                    )}
                    chaveLinha="id"
                    colunaRotulo="dia" // i18n: dado
                    fonte={tx("ONS, Carga de Energia Diária (capturas do observatório)", "ONS, Daily Energy Load (observatory captures)")}
                    versao={versao}
                    nomeArquivo="carga-revisoes"
                    chaveUrl="rev"
                    ordemInicial={{ coluna: "dia", direcao: "desc" }} // i18n: dado
                  />
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        Curva horária contra a carga diária: {num(p.revisoes.curva_contra_diaria.dias_comparados, 0)} pares comparados,{" "}
                        {num(p.revisoes.curva_contra_diaria.dias_diferentes, 0)} diferentes (tolerância {p.revisoes.curva_contra_diaria.tolerancia}). {p.revisoes.curva_contra_diaria.leitura}
                      </>,
                      <>
                        Hourly curve against the daily load: {num(p.revisoes.curva_contra_diaria.dias_comparados, 0)} pairs compared,{" "}
                        {num(p.revisoes.curva_contra_diaria.dias_diferentes, 0)} different (tolerance{" "}
                        <TrechoPortugues regiao="tolerância da conferência curva contra diária">{p.revisoes.curva_contra_diaria.tolerancia}</TrechoPortugues>).{" "}
                        <TrechoPortugues regiao="leitura da conferência curva contra diária">{p.revisoes.curva_contra_diaria.leitura}</TrechoPortugues>
                      </>,
                    )}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="validacao" nivel="auditar" titulo={tx("Validação física antes da publicação", "Physical validation before publication")}>
                  <ul className="space-y-1 text-sm text-carvao-muted">
                    {val.regras.map((r) => (
                      <li key={r.id}>
                        <span className="text-carvao">{r.id}</span> ({rotuloDaGold(TIPO_REGRA_CARGA_EN, r.tipo, idioma)}
                        {r.critica ? tx(", crítica", ", critical") : ""}): <TrechoPortugues regiao="regra de validação da carga">{r.descricao}</TrechoPortugues>
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        {num(val.valores_verificados, 0)} valores verificados; {val.quarentena.length} em quarentena (publicados como ausência, nunca zero) e{" "}
                        {val.atipicos_conferidos.length} atípicos confirmados no balanço de energia.
                      </>,
                      <>
                        {num(val.valores_verificados, 0)} values checked; {val.quarentena.length} in quarantine (published as missing, never zero) and{" "}
                        {val.atipicos_conferidos.length} atypical values confirmed in the energy balance.
                      </>,
                    )}
                  </p>
                  <TabelaInterativa
                    titulo={tx("Quarentena e atípicos conferidos", "Quarantine and cross-checked atypical values")}
                    colunas={colunasOcorrencias()}
                    linhas={paraTabela(
                      [...val.quarentena, ...val.atipicos_conferidos].map((o) => ({
                        id: `${o.sm}:${o.dia}`,
                        sm: o.sm,
                        dia: o.dia,
                        valor: o.valor,
                        regras: o.regras,
                        situacao: o.situacao === "quarentena" ? tx("quarentena", "quarantine") : tx("atípico conferido", "atypical, cross-checked"),
                        conferencia: o.conferencia,
                      })),
                    )}
                    chaveLinha="id"
                    colunaRotulo="dia" // i18n: dado
                    fonte={tx("Validação do observatório sobre ONS (carga diária e balanço de energia)", "Observatory validation on ONS data (daily load and energy balance)")}
                    versao={versao}
                    nomeArquivo="carga-validacao-ocorrencias"
                    chaveUrl="oc"
                  />
                  <TabelaInterativa
                    titulo={tx("Registros esperados por subsistema", "Expected records by subsystem")}
                    colunas={colunasEsperados()}
                    linhas={Object.entries(val.registros_esperados).map(([sm, r]) => ({ id: sm, sm, ...r }))}
                    chaveLinha="id"
                    colunaRotulo="sm"
                    fonte={tx("Validação do observatório (regra A1)", "Observatory validation (rule A1)")}
                    versao={versao}
                    nomeArquivo="carga-registros-esperados"
                    chaveUrl="esp"
                  />
                  <TabelaInterativa
                    titulo={tx("Dias sem valor e o estado conferido no arquivo da última captura da fonte", "Days without a value and the status checked in the file of the latest source capture")}
                    colunas={colunasAusentes()}
                    linhas={val.ausentes.map((x) => ({ id: `${x.sm}:${x.dia}`, sm: x.sm, dia: x.dia, estado: ROTULO_AUSENCIA[x.estado] ?? x.estado, valor_arquivo_atual: x.valor_arquivo_atual }))}
                    chaveLinha="id"
                    colunaRotulo="dia" // i18n: dado
                    fonte={tx("ONS, Carga de Energia Diária (arquivo da última captura)", "ONS, Daily Energy Load (file of the latest capture)")}
                    versao={versao}
                    nomeArquivo="carga-dias-ausentes"
                    chaveUrl="aus"
                    semLinhas={tx("Nenhum dia sem valor entre o primeiro e o último dia publicado.", "No day without a value between the first and the last published day.")}
                  />
                  {val.historico_fora_do_dominio.length > 0 && (
                    <ul className="space-y-1 text-sm text-carvao-muted">
                      {val.historico_fora_do_dominio.map((f) => (
                        <li key={`${f.sm}:${f.dia}:${f.capturado_em}`}>
                          {tx(
                            <>
                              {nomeRegiao(f.sm)} em {dataBR(f.dia)}: {num(f.valor, 3)} MWmed na captura de {carimbo(f.capturado_em)}
                              {f.revisado_para !== null ? `, revisado pela fonte para ${num(f.revisado_para, 3)} MWmed em ${carimbo(f.revisado_em)}` : ", ainda em quarentena"}.
                            </>,
                            <>
                              {nomeRegiao(f.sm)} on {dataBR(f.dia)}: {num(f.valor, 3)} MWavg in the capture of {carimbo(f.capturado_em)}
                              {f.revisado_para !== null ? `, revised by the source to ${num(f.revisado_para, 3)} MWavg on ${carimbo(f.revisado_em)}` : ", still in quarantine"}.
                            </>,
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel id="comparacoes-todas" nivel="auditar" titulo={tx("Todas as comparações publicadas", "All published comparisons")}>
                  <TabelaInterativa
                    titulo={tx("Comparações por região, janela e tipo", "Comparisons by region, window and type")}
                    colunas={colunasComparacoesTodas()}
                    linhas={paraTabela(linhasComparacoesTodas(p))}
                    chaveLinha="id"
                    colunaRotulo="rotulo"
                    fonte={FONTE}
                    versao={versao}
                    nomeArquivo="carga-comparacoes"
                    chaveUrl="cmp.t"
                  />
                  <CargaFontes fontes={g.fontes.filter((f) => f.id === "diaria" || f.id === "leis")} />
                </SecaoDoPainel>

                <CargaSeguir ancora="p025" proximo={{ href: `${rotaPainel("p026")}#p026`, pergunta: perguntaPainel("p026") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
