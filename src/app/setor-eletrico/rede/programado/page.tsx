import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { RedeAviso, RedeCapitulos, RedeDatas, RedeDicionarios, RedeIndisponivel, RedeNavegacao, RedeSeguir } from "@/components/energia/RedePagina";
import { RedeProgramado, RedeProgramadoMetricas } from "@/components/energia/RedeProgramado";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, horaLocal, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { tx } from "@/lib/energia/idioma";
import { FRONTEIRAS, NOME_PAIS, curtoFronteira, ehFronteira, nomeFronteira, nomePais, perguntaPainel, provenienciaLegivel, rotaPainel, situacaoAtualidade, textoConferenciaPdo } from "@/lib/energia/rede";
import { ParaLer } from "@/components/energia/Didatica";
import type { FronteiraRede, GoldRedeDetalhe, PaisRede } from "@/lib/energia/tipos-rede";

export const dynamic = "force-static";
/** Descrição com o início do programado lido da gold (nenhuma data escrita à mão). */
function metadadosDaPagina(): Metadata {
  const g = lerGold<GoldRedeDetalhe>("rede_detalhe.json");
  const inicio = integra(g) && g.programado.inicio ? dataBR(g.programado.inicio) : null;
  const desde = inicio ? tx(`, desde ${inicio}`, `, since ${inicio}`) : "";
  return {
    title: tx("Rede: quanto o fluxo se afastou do programa", "Grid: how far the flow deviated from the schedule"),
    description: tx(
      `Intercâmbio verificado contra o programado (ONS) nas quatro fronteiras entre subsistemas e com Argentina e Uruguai${desde}: distribuição dos desvios, horas materiais, sentido oposto ao programa, maiores desvios e dias de programa repetido, com o programa do exterior conferido no PDO das conversoras.`,
      `Verified interchange against the scheduled interchange (ONS) at the four boundaries between subsystems and with Argentina and Uruguay${desde}: distribution of deviations, material hours, direction opposite to the schedule, largest deviations and repeated-schedule days, with the exterior schedule checked against the converter stations' PDO.`,
    ),
    alternates: { canonical: "/setor-eletrico/rede/programado" },
  };
}

export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/rede/programado", metadadosDaPagina(), anterior);
}

const fonteProgramado = () =>
  tx(
    "ONS, intercâmbios entre subsistemas e com outros países, verificado e programado (releitura do módulo Rede)",
    "ONS, interchanges between subsystems and with other countries, verified and scheduled (Grid module re-read)",
  );

export default function RedeProgramadoPage() {
  const g = lerGold<GoldRedeDetalhe>("rede_detalhe.json");
  if (!integra(g)) return <RedeIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const FONTE = fonteProgramado();
  const p = g.programado;
  // glossário: a primeira fronteira (a da faixa de métricas) e o maior desvio com sentido invertido fora dos dias rotulados
  const dist0 = p.distribuicao[FRONTEIRAS[0]] ?? null;
  const inversao = p.maiores_desvios_fora_dos_dias_rotulados.find((x) => x.inversao && ehFronteira(x.par)) ?? null;
  const vp = p.versao_programa;
  const ev = g.evidencias;
  const atual = situacaoAtualidade(g.referencia.dia, g.gerado_em);
  const versao = g.referencia.dia;
  const downloads = g.downloads.filter((d) => /programado|pdo/.test(d.url));
  // a data em que o campo programado entrou no conjunto vem do próprio dicionário, nunca escrita à mão
  const versaoProg = g.achados.dicionarios.ons_rede_intercambio_nacional?.versoes.find((x) => /prog/.test(x.descricao)) ?? null;
  const evDesvio = Object.fromEntries(Object.entries(ev).filter(([k]) => k.startsWith("desvio_medio.")));
  const periodo = tx(`${dataBR(p.inicio)} a ${dataBR(p.fim)}`, `${dataBR(p.inicio)} to ${dataBR(p.fim)}`);
  const sequencias = Object.entries(p.programa_repetido.maior_sequencia_fora_dos_dias_rotulados)
    .map(([k, n]) => {
      const nome = ehFronteira(k) ? curtoFronteira(k) : k in NOME_PAIS ? tx(k, nomePais(k as PaisRede, "en")) : k;
      const valor = n === null ? tx("sem dado", "no data") : `${n} ${n === 1 ? tx("hora", "hour") : tx("horas", "hours")}`;
      return `${nome} ${valor}`;
    })
    .join("; ");
  const oQueMudou = (
    <>
      {atual.texto}{" "}
      {vp.revisoes_do_programado_entre_capturas === 0
        ? tx(
            `O programado não mudou entre ${vp.capturas_comparadas ?? "as"} capturas comparadas.`,
            `The scheduled values did not change between the ${vp.capturas_comparadas != null ? `${vp.capturas_comparadas} ` : ""}captures compared.`,
          )
        : tx(
            `O programado mudou entre capturas em ${num(vp.revisoes_do_programado_entre_capturas, 0)} valores.`,
            `The scheduled values changed between captures in ${num(vp.revisoes_do_programado_entre_capturas, 0)} values.`,
          )}
    </>
  );
  const comoInterpretar = tx(
    <>
      Desvio é verificado menos programado, na mesma hora e no mesmo sentido do nome do par; o desvio absoluto ignora o sinal. A faixa mostra a mediana, os percentis 90 e 99 e o
      maior desvio de cada par: no percentil 90, por exemplo, 90% das horas têm desvio absoluto menor ou igual a esse valor. A linha marca o limiar material.
    </>,
    <>
      The deviation is verified minus scheduled, in the same hour and in the same direction as the pair name; the absolute deviation ignores the sign. The range shows the
      median, the 90th and 99th percentiles and the largest deviation of each pair: at the 90th percentile, for example, 90% of the hours have an absolute deviation less than or
      equal to that value. The line marks the materiality threshold.
    </>,
  );
  const naoConcluir = tx(
    <>
      Que o desvio foi falha, erro de previsão do ONS ou decisão errada: o programa é fechado antes da operação e a fonte não informa o motivo do afastamento. Também não se sabe
      qual revisão do programa das fronteiras foi publicada, e o histórico começa em {dataBR(p.inicio)}.
    </>,
    <>
      That the deviation was a failure, an ONS forecasting error or a wrong decision: the schedule is closed before operation and the source does not state the reason for the
      deviation. Nor is it known which revision of the boundary schedule was published, and the history starts on {dataBR(p.inicio)}.
    </>,
  );

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:rede" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["MWmed", "PDO", "SIN", "ONS"]}
          rotulo={tx("Rede · Programado e verificado", "Grid · Scheduled and verified")}
          titulo={perguntaPainel("p031")}
          lead={tx(
            "O fluxo medido em cada hora contra o programado antes da operação, nas quatro fronteiras entre subsistemas e nas trocas com Argentina e Uruguai. Desvio é diferença, não falha.",
            "The flow measured in each hour against the schedule set before operation, at the four boundaries between subsystems and in the exchanges with Argentina and Uruguay. A deviation is a difference, not a failure.",
          )}
          recorte={tx(`${periodo}, hora a hora · fronteiras e países · MWmed e MWh`, `${periodo}, hour by hour · boundaries and countries · MWavg and MWh`)}
          fonte={tx("ONS, intercâmbio verificado e programado", "ONS, verified and scheduled interchange")}
          referencia={tx(
            <>
              ONS, intercâmbio verificado e programado de {dataBR(p.inicio)} a {dataBR(p.fim)}; processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              ONS, verified and scheduled interchange from {dataBR(p.inicio)} to {dataBR(p.fim)}; processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <RedeDatas
              itens={[
                {
                  rotulo: tx("Verificado e programado", "Verified and scheduled"),
                  texto: tx(`de ${dataBR(p.inicio)} a ${dataBR(p.fim)}`, `from ${dataBR(p.inicio)} to ${dataBR(p.fim)}`),
                  natureza: g.proveniencia.programado.natureza,
                },
                {
                  rotulo: tx("Série diária", "Daily series"),
                  texto: p.diario.dias.length
                    ? tx(
                        `de ${dataBR(p.diario.dias[0])} a ${dataBR(p.diario.dias[p.diario.dias.length - 1])}`,
                        `from ${dataBR(p.diario.dias[0])} to ${dataBR(p.diario.dias[p.diario.dias.length - 1])}`,
                      )
                    : null,
                  natureza: g.proveniencia.programado.natureza,
                },
              ]}
            />
          }
          metricas={<RedeProgramadoMetricas programado={{ distribuicao: p.distribuicao, limiar_material_mwmed: p.limiar_material_mwmed, inicio: p.inicio, fim: p.fim }} evidencias={evDesvio} />}
        >
          {tx(
            <>
              O <Termo slug="intercambio">intercâmbio</Termo> programado é o fluxo que se esperava em cada hora antes da operação; o verificado é o fluxo medido. Os dois estão
              publicados lado a lado de {dataBR(p.inicio)} em diante
              {versaoProg ? ` (o campo do programado entrou na versão ${versaoProg.versao} do dicionário de dados do ONS, de ${versaoProg.data.replaceAll("-", "/")})` : ""}. Este painel mede quanto
              o verificado se afastou do programado em cada fronteira entre regiões e nas trocas com a Argentina e o Uruguai.
            </>,
            <>
              The scheduled <Termo slug="intercambio">interchange</Termo> is the flow that was expected in each hour before operation; the verified one is the measured flow. The
              two are published side by side from {dataBR(p.inicio)} onward
              {versaoProg ? ` (the scheduled field entered version ${versaoProg.versao} of the ONS data dictionary, dated ${dataBR(versaoProg.data)})` : ""}. This panel measures how
              far the verified flow deviated from the scheduled flow at each boundary between regions and in the exchanges with Argentina and Uruguay.
            </>,
          )}
        </CabecalhoModulo>
        <RedeNavegacao atual="p031" />
        <ParaLer
          id="para-ler-programado"
          itens={[
            {
              termo: tx("Programado", "Scheduled"),
              definicao: tx(
                "Quanto o ONS planejou, antes da operação, que passaria em cada fronteira em cada hora. É o plano.",
                "How much ONS planned, before operation, would pass at each boundary in each hour. It is the plan.",
              ),
            },
            {
              termo: tx("Verificado", "Verified"),
              definicao: tx(
                "Quanto de fato passou, medido nas linhas da fronteira. É o que aconteceu.",
                "How much actually passed, measured on the boundary lines. It is what happened.",
              ),
            },
            {
              termo: tx("Desvio e desvio absoluto", "Deviation and absolute deviation"),
              definicao: tx(
                "Desvio é verificado menos programado na mesma hora. O absoluto ignora o sinal: conta só o tamanho da diferença. Desvio não é falha: a operação se ajusta à carga, ao vento, ao sol e às máquinas disponíveis depois de fechado o plano.",
                "Deviation is verified minus scheduled in the same hour. The absolute one ignores the sign: it counts only the size of the difference. A deviation is not a failure: operation adjusts to load, wind, sun and available machines after the plan is closed.",
              ),
              exemplo: dist0
                ? tx(
                    `${nomeFronteira(FRONTEIRAS[0], "pt")}: desvio absoluto médio de ${num(dist0.desvio_abs_medio_mwmed, 1)} MWmed, ${num((100 * dist0.desvio_abs_medio_mwmed) / dist0.programado_abs_mediano_mwmed, 0)}% do programa mediano da fronteira (${num(dist0.programado_abs_mediano_mwmed, 1)} MWmed, em módulo).`,
                    `${nomeFronteira(FRONTEIRAS[0], "en")}: average absolute deviation of ${num(dist0.desvio_abs_medio_mwmed, 1)} MWavg, ${num((100 * dist0.desvio_abs_medio_mwmed) / dist0.programado_abs_mediano_mwmed, 0)}% of the boundary's median schedule (${num(dist0.programado_abs_mediano_mwmed, 1)} MWavg, in absolute value).`,
                  )
                : undefined,
            },
            {
              termo: tx("Mediana, percentil 90 e percentil 99", "Median, 90th and 99th percentile"),
              definicao: tx(
                "Ordene as horas do menor ao maior desvio. A mediana é o desvio do meio; o percentil 90 é o desvio que só 10% das horas superam; o 99, só 1%. Mostram o desvio comum e o raro.",
                "Sort the hours from smallest to largest deviation. The median is the middle one; the 90th percentile is the deviation only 10% of hours exceed; the 99th, only 1%. They show the usual deviation and the rare one.",
              ),
            },
            {
              termo: tx("Limiar de desvio material", "Material deviation threshold"),
              definicao: tx(
                `${num(p.limiar_material_mwmed, 0)} MWmed numa hora: escolha do observatório para contar as horas com desvio acima do habitual, não um critério do ONS. As contagens com outros limiares estão em Analisar.`,
                `${num(p.limiar_material_mwmed, 0)} MWavg in an hour: the observatory's choice to count hours with a deviation above the usual, not an ONS criterion. Counts with other thresholds are under Analyze.`,
              ),
            },
            {
              termo: tx("Sinal negativo e sentido oposto", "Negative sign and opposite direction"),
              definicao: tx(
                "Valor negativo é energia no sentido contrário ao nome da fronteira. Sentido oposto ao programado é quando o plano previa um sentido e a energia passou no outro.",
                "A negative value is energy in the direction opposite to the boundary's name. Opposite to the schedule is when the plan expected one direction and energy passed in the other.",
              ),
              exemplo: inversao
                ? tx(
                    `Em ${horaLocal(inversao.hora)}, ${nomeFronteira(inversao.par as FronteiraRede, "pt")}: programado ${num(inversao.programado_mwmed, 1)} MWmed, verificado ${num(inversao.verificado_mwmed, 1)} MWmed.`,
                    `At ${horaLocal(inversao.hora)}, ${nomeFronteira(inversao.par as FronteiraRede, "en")}: scheduled ${num(inversao.programado_mwmed, 1)} MWavg, verified ${num(inversao.verificado_mwmed, 1)} MWavg.`,
                  )
                : undefined,
            },
          ]}
        />
        <ModoProfundidade>
          <Bloco id="programado">
            <PainelEvidencia
              id="p031"
              pergunta={tx("O desvio de cada hora contra o programa", "The deviation of each hour against the schedule")}
              subtitulo={tx(
                "Desvio horário entre o intercâmbio verificado e o programado · MWmed por hora e MWh por dia",
                "Hourly deviation between the verified and the scheduled interchange · MWavg per hour and MWh per day",
              )}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>
                  O programa é o fluxo que se esperava em cada fronteira antes da operação; a distância até o verificado mostra quanto a operação real se afastou dele e em quais
                  horas, inclusive quando o fluxo correu no sentido contrário ao programado.
                </>,
                <>
                  The schedule is the flow that was expected at each boundary before operation; the distance to the verified flow shows how far actual operation deviated from it
                  and in which hours, including when the flow ran opposite to the schedule.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={provenienciaLegivel(g.proveniencia.programado)}
            >
              <div className="space-y-6">
                {atual.defasada && <RedeAviso tipo="alerta">{atual.texto}</RedeAviso>}
                <RedeProgramado
                  programado={{
                    distribuicao: p.distribuicao,
                    limiar_material_mwmed: p.limiar_material_mwmed,
                    limiares_sensibilidade_mwmed: p.limiares_sensibilidade_mwmed,
                    justificativa_limiar: p.justificativa_limiar,
                    programa_repetido: p.programa_repetido,
                    diario: p.diario,
                    mensal: p.mensal,
                    maiores_desvios: p.maiores_desvios,
                    maiores_desvios_fora_dos_dias_rotulados: p.maiores_desvios_fora_dos_dias_rotulados,
                    inicio: p.inicio,
                    fim: p.fim,
                  }}
                  evidencias={evDesvio}
                  fonte={FONTE}
                  versao={versao}
                  regraMaterialidade={g.regras.materialidade}
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                  aposPrincipal={<RedeCapitulos atual="p031" />}
                />

                <SecaoDoPainel id="programa-e-revisao" nivel="analisar" titulo={tx("De onde vem o valor programado", "Where the scheduled value comes from")}>
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    <TrechoPortugues regiao="versão do programa">{vp.texto}</TrechoPortugues>
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="pdo"
                  nivel="auditar"
                  titulo={tx("Conferência do programa do exterior com o PDO das conversoras", "Check of the exterior schedule against the converter stations' PDO")}
                >
                  <p className="text-sm text-carvao-muted">{textoConferenciaPdo(p)}</p>
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        O PDO publica o valor de cada conversora por meia hora e com a importação positiva; a conferência usa menos a média das duas meias horas. Para as fronteiras entre
                        subsistemas não há programa por fronteira em outro conjunto público para a mesma conferência.
                      </>,
                      <>
                        The PDO publishes the value of each converter station by half hour and with imports positive; the check uses minus the average of the two half hours. For the
                        boundaries between subsystems there is no schedule by boundary in another public dataset for the same check.
                      </>,
                    )}
                  </p>
                  <RedeDicionarios dicionarios={[g.achados.dicionarios.ons_rede_pdo_conversoras, g.achados.dicionarios.ons_rede_intercambio_internacional].filter(Boolean)} />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="maiores-sequencias"
                  nivel="auditar"
                  titulo={tx("Sequências de programa repetido fora dos dias rotulados", "Repeated-schedule runs outside the flagged days")}
                >
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        Maior sequência de horas seguidas com exatamente o mesmo valor programado, fora dos dias rotulados:{" "}
                        {sequencias}
                        . A regra rotula a partir de {p.programa_repetido.minimo_horas} horas.
                      </>,
                      <>
                        Longest run of consecutive hours with exactly the same scheduled value, outside the flagged days: {sequencias}. The rule flags from{" "}
                        {p.programa_repetido.minimo_horas} hours.
                      </>,
                    )}
                  </p>
                </SecaoDoPainel>

                <RedeSeguir ancora="p031" proximo={{ href: `${rotaPainel("p028")}#p028`, pergunta: perguntaPainel("p028") }} downloads={downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
