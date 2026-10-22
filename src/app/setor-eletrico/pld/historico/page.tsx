import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { PldHistorico } from "@/components/energia/PldHistorico";
import { PldAviso, PldControles, PldIndisponivel, PldNavegacao, PldSeguir } from "@/components/energia/PldPagina";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, horaLocal, mesAno, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { tx } from "@/lib/energia/idioma";
import {
  colunasPerimetros,
  colunasRevisoesCarga,
  curtoSm,
  SUBMERCADOS,
  atualidadePld,
  linhasPerimetros,
  linhasRevisoesCarga,
  marcosNumerados,
  perguntaPainel,
  proximoPainel,
  textoComparabilidade,
  textoRegimesDistribuicao,
  textoSensibilidadePeso,
} from "@/lib/energia/pld";
import { fichasPld } from "@/lib/energia/pld-arquivos";
import type { PldDetalheGold } from "@/lib/energia/tipos-pld";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/pld/historico", {
    title: tx("PLD: histórico e distribuição", "PLD: history and distribution"),
    description: tx(
      "O PLD do dia comparado com o mesmo mês e a mesma semana de anos anteriores, médias mensais temporal e ponderadas pela carga com o perímetro do peso declarado, moeda constante, distribuição por regime anual de limites, perfil hora × mês e mapa hora × dia.",
      "The day's spot price (PLD) compared with the same month and the same week of previous years, monthly time-weighted and load-weighted averages with the declared weight perimeter, constant currency, distribution by annual limits regime, hour × month profile and hour × day map.",
    ),
    alternates: { canonical: "/setor-eletrico/pld/historico" },
  }, anterior);
}

function fonte(): string {
  return tx(
    "CCEE, PLD horário por submercado; ONS, Balanço de Energia e Carga Verificada; IBGE, IPCA",
    "CCEE, hourly PLD by submarket; ONS, Energy Balance and Verified Load; IBGE, IPCA",
  );
}

export default function PldHistoricoPage() {
  const FONTE = fonte();
  const g = lerGold<PldDetalheGold>("pld_detalhe.json");
  if (!integra(g)) return <PldIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const h = g.historico;
  const pond = h.ponderacao;
  const atual = atualidadePld(g.referencia.dia, g.gerado_em);
  const versao = g.referencia.dia;
  const mesFichas = pond.sensibilidade_peso?.mes ?? null;
  const fichas = mesFichas ? fichasPld(g.evidencias.arquivo, SUBMERCADOS.flatMap((sm) => [`ponderada_${mesFichas}_${sm}`, `ponderada_sem_mmgd_${mesFichas}_${sm}`])) : {}; // i18n: dado
  const anoRef = Number(g.referencia.dia.slice(0, 4));
  const retiradas = [...pond.horas_retiradas, ...pond.peso_sem_mmgd.horas_retiradas];
  const { marcos, legenda: legendaMarcos } = marcosNumerados(h);
  // o que a distribuição desde 2021 mistura, por submercado: valores nominais e anos com limites diferentes (gold de limites)
  const notasRegimes = Object.fromEntries(SUBMERCADOS.map((sm) => [sm, g.limites.disponivel ? textoRegimesDistribuicao(g.limites, sm) : null]));
  const URL_CARGA_VERIFICADA = "/energia/series/carga_verificada_horaria.csv";
  const quebras = pond.quebras.map((q) => dataBR(q.data));

  const oQueMudou = (
    <>
      {atual.texto} {pond.sensibilidade_peso ? textoSensibilidadePeso(pond.sensibilidade_peso) : ""}
    </>
  );
  const comoInterpretar = (
    <>
      {tx(
        "O percentil diz em que posição a média do dia fica entre as médias diárias do mesmo mês (e da mesma semana do ano, na numeração ISO) nos anos anteriores: 50 é o meio. A média temporal dá o mesmo peso a cada hora; a ponderada pela carga dá mais peso às horas de maior consumo. A ponderada pelo balanço muda de base dentro da série (as marcas no gráfico mostram quando); a ponderada sem MMGD usa a mesma base em toda a série.",
        "The percentile says where the day's average sits among the daily averages of the same month (and of the same week of the year, in ISO numbering) in previous years: 50 is the middle. The time-weighted average gives each hour the same weight; the load-weighted average gives more weight to hours of higher consumption. The balance-weighted average changes basis within the series (the marks in the chart show when); the average weighted without MMGD uses the same basis across the series.",
      )}
    </>
  );
  const naoConcluir = (
    <>
      {tx(
        "Percentil alto não é previsão de queda, nem baixo de alta. A série começa em 2021: são no máximo cinco anos anteriores, cada um com piso e tetos próprios. A média ponderada usa a carga do sistema publicada pelo ONS, não o consumo contabilizado pela CCEE, e não é o preço pago por nenhum consumidor.",
        "A high percentile is not a forecast of a fall, nor a low one of a rise. The series starts in 2021: there are at most five previous years, each with its own floor and caps. The weighted average uses the system load published by ONS, not the consumption accounted by CCEE, and is not the price paid by any consumer.",
      )}
    </>
  );

  const definicoes = (
    <>
      {tx(
        <>
          <p>
            <span className="font-medium text-carvao">Três réguas para o mesmo mês:</span> a temporal dá o mesmo peso a cada hora; a ponderada pelo balanço pesa mais as horas de
            maior consumo, com a carga do Balanço de Energia nos Subsistemas do ONS como peso, que não vai nos arquivos desta página; a ponderada sem{" "}
            <Termo slug="geracao-distribuida">MMGD</Termo> usa a carga verificada pelo ONS, sem a micro e minigeração distribuída.
          </p>
          <p>
            <span className="font-medium text-carvao">Perímetro</span> é o que a carga do balanço inclui; muda em {quebras.length ? quebras.join(" e ") : "datas declaradas pelo ONS"}, e a
            ponderada pelo balanço só se compara entre meses do mesmo perímetro. <span className="font-medium text-carvao">Moeda constante</span> é o valor corrigido pelo IPCA para os
            reais de {h.deflator.mes_base ? mesAno(h.deflator.mes_base) : "um mês-base"}.
          </p>
        </>,
        <>
          <p>
            <span className="font-medium text-carvao">Three yardsticks for the same month:</span> the time-weighted average gives each hour the same weight; the balance-weighted
            average gives more weight to hours of higher consumption, using the load from the ONS Energy Balance by Subsystem as the weight, which is not included in the files on
            this page; the average weighted without <Termo slug="geracao-distribuida">MMGD</Termo> uses the load verified by ONS, without distributed micro and mini generation.
          </p>
          <p>
            <span className="font-medium text-carvao">Perimeter</span> is what the balance load includes; it changes on {quebras.length ? quebras.join(" and ") : "dates declared by ONS"},
            and the balance-weighted average can only be compared between months with the same perimeter. <span className="font-medium text-carvao">Constant currency</span> is the value
            adjusted by IPCA to reais of {h.deflator.mes_base ? mesAno(h.deflator.mes_base) : "a base month"}.
          </p>
        </>,
      )}
    </>
  );

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:pld" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["MMGD", "IPCA", "CCEE", "ONS", "IBGE"]}
          rotulo={tx("Preço de Liquidação das Diferenças", "Spot price (PLD)")}
          titulo={perguntaPainel("p011")}
          lead={
            <>
              {tx(
                <>
                  O mesmo <Termo slug="pld">PLD</Termo> pode parecer alto ou baixo conforme a régua: o mesmo mês de anos anteriores, a média de todas as horas ou a média que pesa
                  mais as horas de maior consumo. Aqui, as réguas lado a lado, cada uma com o nome.
                </>,
                <>
                  The same <Termo slug="pld">spot price (PLD)</Termo> can look high or low depending on the yardstick: the same month of previous years, the average of all hours or the
                  average that gives more weight to hours of higher consumption. Here, the yardsticks side by side, each with its name.
                </>,
              )}
            </>
          }
          recorte={tx(
            `${dataBR(g.referencia.dia)} · meses de ${mesAno(h.mensal.meses[0])} a ${mesAno(h.mensal.meses[h.mensal.meses.length - 1])} · R$/MWh nominais e em moeda constante`,
            `${dataBR(g.referencia.dia)} · months from ${mesAno(h.mensal.meses[0])} to ${mesAno(h.mensal.meses[h.mensal.meses.length - 1])} · nominal R$/MWh and in constant currency`,
          )}
          fonte={tx("CCEE, ONS e IBGE", "CCEE, ONS and IBGE")}
          referencia={
            <>
              {tx(
                `CCEE (PLD até ${horaLocal(g.referencia.ultima_hora_pld)}), ONS (carga do balanço até ${g.referencia.ultima_hora_carga ? horaLocal(g.referencia.ultima_hora_carga) : "sem dado"}) e IBGE (IPCA até ${g.referencia.ultimo_mes_ipca ? mesAno(g.referencia.ultimo_mes_ipca) : "sem dado"}); processado em ${carimbo(g.gerado_em)}.`,
                `CCEE (PLD through ${horaLocal(g.referencia.ultima_hora_pld)}), ONS (balance load through ${g.referencia.ultima_hora_carga ? horaLocal(g.referencia.ultima_hora_carga) : "no data"}) and IBGE (IPCA through ${g.referencia.ultimo_mes_ipca ? mesAno(g.referencia.ultimo_mes_ipca) : "no data"}); processed on ${carimbo(g.gerado_em)}.`,
              )}
            </>
          }
        >
          {tx(
            "Este painel mostra as réguas lado a lado, cada uma com o nome; a faixa sazonal, a distribuição do preço por ano e o perfil por hora vêm em seguida, cada um com a sua pergunta.",
            "This panel shows the yardsticks side by side, each with its name; the seasonal band, the price distribution by year and the hourly profile follow, each with its own question.",
          )}
        </CabecalhoModulo>
        <PldNavegacao atual="p011" />
        <ModoProfundidade>
          <Bloco id="historico">
            <PainelEvidencia
              id="p011"
              pergunta={tx("O dia frente aos anos anteriores e às médias do mês", "The day against previous years and the month's averages")}
              subtitulo={tx(
                "Média diária frente ao mesmo mês e à mesma semana de anos anteriores; médias mensais · R$/MWh",
                "Daily average against the same month and the same week of previous years; monthly averages · R$/MWh",
              )}
              porQueImporta={tx(
                "O PLD tem forte componente sazonal (chuva e reservatórios) e regimes de limites que mudam a cada ano. Comparar com a mesma época de anos anteriores evita chamar de alto um preço comum para o mês, e separar a média temporal da ponderada pela carga evita misturar duas perguntas diferentes.",
                "The PLD has a strong seasonal component (rain and reservoirs) and limits regimes that change every year. Comparing with the same time of previous years avoids calling a price that is usual for the month high, and separating the time-weighted average from the load-weighted one avoids mixing two different questions.",
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.historico_mensal}
              complementares={[
                { rotulo: tx("Sobre o peso: carga do balanço", "On the weight: balance load"), p: g.proveniencia.peso_carga_balanco },
                ...(g.proveniencia.peso_carga_sem_mmgd ? [{ rotulo: tx("Sobre o peso: carga sem MMGD", "On the weight: load without MMGD"), p: g.proveniencia.peso_carga_sem_mmgd }] : []),
                { rotulo: tx("Sobre os percentis sazonais", "On the seasonal percentiles"), p: g.proveniencia.sazonal },
                { rotulo: tx("Sobre a distribuição e os mapas", "On the distribution and the maps"), p: g.proveniencia.distribuicao },
              ]}
            >
              <div className="space-y-6">
                {atual.defasada && <PldAviso tipo="alerta">{atual.texto}</PldAviso>}
                {g.referencia.ultima_hora_carga && g.referencia.ultima_hora_carga < g.referencia.ultima_hora_pld && (
                  <div data-nivel="analisar">
                    <PldAviso>
                      {tx(
                        `A carga do balanço do ONS vai até ${horaLocal(g.referencia.ultima_hora_carga)} e a carga verificada sem MMGD até ${pond.peso_sem_mmgd.ultima_hora ? horaLocal(pond.peso_sem_mmgd.ultima_hora) : "sem dado"}; o PLD, até ${horaLocal(g.referencia.ultima_hora_pld)}. No mês em curso, as ponderadas usam só as horas com carga publicada (coluna “mesmas horas” da tabela) e podem mudar com as próximas publicações e revisões do ONS.`,
                        `The ONS balance load runs through ${horaLocal(g.referencia.ultima_hora_carga)} and the verified load without MMGD through ${pond.peso_sem_mmgd.ultima_hora ? horaLocal(pond.peso_sem_mmgd.ultima_hora) : "no data"}; the PLD, through ${horaLocal(g.referencia.ultima_hora_pld)}. In the current month, the weighted averages use only the hours with published load (column “same hours” in the table) and can change with upcoming ONS publications and revisions.`,
                      )}
                    </PldAviso>
                  </div>
                )}
                <PldHistorico
                  h={{
                    mensal: h.mensal,
                    sazonal_mes: h.sazonal_mes,
                    posicao_referencia: h.posicao_referencia,
                    mes_corrente: h.mes_corrente,
                    regimes: h.regimes,
                    perfil_hora_mes: h.perfil_hora_mes,
                    hora_dia: h.hora_dia,
                    deflator: h.deflator,
                  }}
                  marcos={marcos}
                  legendaMarcos={legendaMarcos}
                  definicoes={definicoes}
                  notasRegimes={notasRegimes}
                  urlBalanco={g.proveniencia.peso_carga_balanco.fonte.url_dataset ?? null}
                  urlCargaVerificada={URL_CARGA_VERIFICADA}
                  mesFichas={mesFichas}
                  fichas={fichas}
                  anoReferencia={anoRef}
                  diaReferencia={g.referencia.dia}
                  fonte={FONTE}
                  versao={versao}
                  notas={<NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />}
                />

                <SecaoDoPainel id="peso" titulo={tx("O peso da média ponderada: perímetro, quebras e conferência", "The weight of the weighted average: perimeter, breaks and check")} nivel="auditar">
                  <p className="text-sm leading-relaxed text-carvao">
                    {tx("Peso da ponderada pelo balanço:", "Weight of the balance-weighted average:")}{" "}
                    <TrechoPortugues regiao="pld-peso">{pond.peso.replace(" (ver perimetros)", " (tabela de perímetros abaixo)")}</TrechoPortugues>.
                  </p>
                  <p className="text-sm leading-relaxed text-carvao">
                    {tx("Peso da ponderada sem MMGD:", "Weight of the average without MMGD:")}{" "}
                    {pond.peso_sem_mmgd.disponivel ? (
                      <TrechoPortugues regiao="pld-peso">{pond.peso_sem_mmgd.peso}</TrechoPortugues>
                    ) : (
                      <>
                        {tx("indisponível", "unavailable")} (
                        {pond.peso_sem_mmgd.motivo ? <TrechoPortugues regiao="pld-peso">{pond.peso_sem_mmgd.motivo}</TrechoPortugues> : tx("sem motivo publicado", "no reason published")})
                      </>
                    )}
                    .
                  </p>
                  <p className="text-sm leading-relaxed text-carvao-muted" data-textos="comparabilidade">{textoComparabilidade(h)}</p>
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    <TrechoPortugues regiao="pld-peso">{pond.ressalva}</TrechoPortugues>
                  </p>
                  <TabelaInterativa
                    titulo={tx(
                      "Perímetros da carga do balanço declarados pelo ONS e a conferência contra a carga verificada",
                      "Balance load perimeters declared by ONS and the check against the verified load",
                    )}
                    colunas={colunasPerimetros()}
                    linhas={linhasPerimetros(h)}
                    chaveLinha="id"
                    colunaRotulo="perimetro"
                    fonte={tx("ONS, descrição do conjunto Carga de Energia; API de carga verificada", "ONS, description of the Energy Load dataset; verified load API")}
                    versao={versao}
                    nomeArquivo="pld-perimetros-carga"
                  />
                  <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    {pond.quebras.map((q) => (
                      <li key={q.data}>
                        {tx(`${dataBR(q.data)} (${q.de} para ${q.para}):`, `${dataBR(q.data)} (${q.de} to ${q.para}):`)}{" "}
                        <TrechoPortugues regiao="pld-marca-perimetro">{q.descricao}</TrechoPortugues>{" "}
                        {q.inicio_observado_no_balanco
                          ? tx(`Início observado no dado horário: ${dataBR(q.inicio_observado_no_balanco)}. `, `Start observed in the hourly data: ${dataBR(q.inicio_observado_no_balanco)}. `)
                          : ""}
                        <TrechoPortugues regiao="pld-marca-perimetro">{q.nota}</TrechoPortugues>
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-carvao-muted">
                    {tx("Conferência mês a mês:", "Month-by-month check:")}{" "}
                    {pond.conferencia_perimetro.disponivel ? (
                      tx(
                        `${num(pond.conferencia_perimetro.meses_divergentes.length, 0)} meses-subsistema divergentes do perímetro declarado. `,
                        `${num(pond.conferencia_perimetro.meses_divergentes.length, 0)} subsystem-months diverging from the declared perimeter. `,
                      )
                    ) : (
                      <>
                        {tx("indisponível", "unavailable")} (<TrechoPortugues regiao="pld-peso">{pond.conferencia_perimetro.motivo}</TrechoPortugues>).{" "}
                      </>
                    )}
                    <TrechoPortugues regiao="pld-peso">{pond.conferencia_perimetro.metodo}</TrechoPortugues>
                  </p>
                  <p className="text-xs text-carvao-muted">
                    <TrechoPortugues regiao="pld-peso">{pond.fonte_perimetro.nota}</TrechoPortugues>
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="revisoes" titulo={tx("Revisões da carga e o efeito na ponderada", "Load revisions and the effect on the weighted average")} nivel="auditar">
                  <p className="text-sm text-carvao-muted">
                    <TrechoPortugues regiao="pld-peso">{pond.controle_fisico}</TrechoPortugues>
                  </p>
                  {retiradas.length > 0 ? (
                    <PldAviso tipo="alerta">
                      {tx(
                        `Horas retiradas do peso por carga menor ou igual a zero: ${retiradas.map((r) => `${r.sm} em ${mesAno(r.mes)}, ${num(r.horas, 0)} horas`).join("; ")}.`, // i18n: dado
                        `Hours removed from the weight for load less than or equal to zero: ${retiradas.map((r) => `${curtoSm(r.sm)} in ${mesAno(r.mes)}, ${num(r.horas, 0)} hours`).join("; ")}.`,
                      )}
                    </PldAviso>
                  ) : (
                    <p className="text-sm text-carvao-muted">{tx("Nenhuma hora retirada do peso na publicação vigente.", "No hour removed from the weight in the current publication.")}</p>
                  )}
                  <TabelaInterativa
                    titulo={tx("Revisões da carga do balanço entre capturas, por subsistema e mês", "Balance load revisions between captures, by subsystem and month")}
                    colunas={colunasRevisoesCarga()}
                    linhas={linhasRevisoesCarga(h)}
                    chaveLinha="id"
                    colunaRotulo="mes"
                    fonte={tx("ONS, Balanço de Energia nos Subsistemas (capturas do observatório)", "ONS, Energy Balance by Subsystem (observatory captures)")}
                    versao={versao}
                    nomeArquivo="pld-revisoes-carga"
                    semLinhas={tx("Nenhuma revisão da carga detectada entre as capturas integradas.", "No load revision detected between the integrated captures.")}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="deflator" titulo={tx("Moeda constante", "Constant currency")} nivel="auditar">
                  <p className="text-sm text-carvao-muted">
                    <TrechoPortugues regiao="pld-deflator">
                      {h.deflator.indice}. {h.deflator.regra}
                    </TrechoPortugues>{" "}
                    {tx(
                      `Mês-base: ${h.deflator.mes_base ? mesAno(h.deflator.mes_base) : "sem índice"}${h.deflator.indice_base !== null ? ` (índice ${num(h.deflator.indice_base, 2)})` : ""}. O IPCA mede preços ao consumidor; a moeda constante é perspectiva adicional, não substitui o valor nominal.`,
                      `Base month: ${h.deflator.mes_base ? mesAno(h.deflator.mes_base) : "no index"}${h.deflator.indice_base !== null ? ` (index ${num(h.deflator.indice_base, 2)})` : ""}. IPCA measures consumer prices; constant currency is an additional perspective and does not replace the nominal value.`,
                    )}
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel id="controles" titulo={tx("Controles automáticos da construção", "Automatic build checks")} nivel="auditar">
                  <PldControles controles={g.controles.filter((x) => /carga|Perímetro|peso/i.test(x.nome))} />
                </SecaoDoPainel>

                <PldSeguir
                  ancora="p011"
                  proximo={proximoPainel("p011")}
                  downloads={[
                    ...g.downloads.filter((d) => /mensal|sazonal|hora_dia|cmo_horario/.test(d.url)),
                    {
                      rotulo: tx(
                        "Carga verificada, MMGD e carga líquida por hora desde 2024, o peso da ponderada sem MMGD (CSV)",
                        "Verified load, MMGD and net load by hour since 2024, the weight of the average without MMGD (CSV)",
                      ),
                      url: URL_CARGA_VERIFICADA,
                    },
                  ]}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
