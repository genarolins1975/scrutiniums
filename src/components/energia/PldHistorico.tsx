"use client";

import { useMemo, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { PldEscolha, PldLista } from "@/components/energia/PldControles";
import { PldFaixas } from "@/components/energia/PldFaixas";
import { PldHoraDia } from "@/components/energia/PldHoraDia";
import { PldMapaHoras } from "@/components/energia/PldMapaHoras";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR as dataBRBase, mesAno as mesAnoBase, num as numBase } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import {
  colunasMensais,
  colunasRegimesDist,
  colunasSazonal,
  COR_SM,
  curtoMedida,
  curtoSm,
  doSm,
  ESCALA_PLD,
  horasDoDia,
  MEDIDAS_MENSAIS,
  nomeSm,
  rotuloMedida,
  SUBMERCADOS,
  faixasRegimes,
  inflacaoAcumulada,
  linhasMensais,
  linhasSazonal,
  nomeMes,
  perfilHoraMes,
  respostaP011,
  rotaPainel,
  serieMedidaPorSm,
  serieSazonal,
  textoInflacao,
  vereditoP011,
  type MedidaMensal,
} from "@/lib/energia/pld";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { Submercado } from "@/lib/energia/tipos";
import type { BlocoHistorico } from "@/lib/energia/tipos-pld";

/**
 * P011, histórico e distribuição: submercado (?sm=), moeda do gráfico mensal
 * (?moeda=), intervalo (?de=, ?ate=), submercados comparados (?sms=, até quatro) e
 * medida comparada (?med=) ficam na URL; busca, ordem e filtros das tabelas também
 * (prefixos mes, saz e reg). Média temporal e médias ponderadas pela carga aparecem
 * sempre com o nome; o mês parcial e as mudanças de perímetro do peso ficam
 * marcados no gráfico e na tabela. A resposta, as medidas da faixa, o gráfico e a tabela
 * leem as mesmas linhas mensais da gold.
 *
 * Ordem da página: resposta e escolha do submercado, figura principal (a faixa sazonal: a pergunta da
 * página é "está alto para esta época?"), faixa de medidas (a média do dia e as três médias do mês, cada
 * uma com o nome e o peso declarados, e a definição de cada régua junto delas, logo antes do gráfico das
 * médias mensais, que é onde as réguas são comparadas), as médias
 * mensais em moeda nominal ou constante, tabela, notas do painel e as outras visões que dão a régua,
 * todas visíveis em Entender com a sua pergunta: distribuição por regime anual de limites, perfil por
 * hora e mês e mapa hora por dia (em tela estreita, por faixa de quatro horas). A comparação entre
 * submercados fica em Analisar.
 */
const ESQUEMA = {
  sm: campo(tiposUrl.opcao(SUBMERCADOS), "SE" as Submercado),
  moeda: campo(tiposUrl.opcao(["nominal", "constante"] as const), "nominal" as "nominal" | "constante"),
  de: campo(tiposUrl.data(), ""),
  ate: campo(tiposUrl.data(), ""),
  med: campo(tiposUrl.opcao(MEDIDAS_MENSAIS), "temporal" as MedidaMensal),
  sms: campo(tiposUrl.lista(tiposUrl.opcao(SUBMERCADOS), { max: LIMITE_COMPARACAO }), [...SUBMERCADOS] as Submercado[]),
};

export type HistoricoP011 = Pick<BlocoHistorico, "mensal" | "sazonal_mes" | "posicao_referencia" | "mes_corrente" | "regimes" | "perfil_hora_mes" | "hora_dia" | "deflator">;

export function PldHistorico({
  h,
  marcos,
  legendaMarcos,
  mesFichas,
  fichas,
  anoReferencia,
  diaReferencia,
  fonte,
  versao,
  notas,
  definicoes,
  notasRegimes,
  urlBalanco,
  urlCargaVerificada,
}: {
  h: HistoricoP011;
  /** Marcas do gráfico mensal já numeradas (1, 2); o texto de cada uma vem em `legendaMarcos`. */
  marcos: { x: string; rotulo: string }[];
  legendaMarcos: { n: number; data: string; texto: string }[];
  /** Mês das fichas ponderadas (último mês completo com as três médias), "AAAA-MM". */
  mesFichas: string | null;
  fichas: Record<string, Evidencia>;
  anoReferencia: number;
  diaReferencia: string;
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
  /** Definição de cada régua e dos termos (perímetro, MMGD, moeda constante), em texto visível junto das medidas. */
  definicoes?: ReactNode;
  /** Por submercado, o que a distribuição desde 2021 mistura (nominal e regimes de limites diferentes). */
  notasRegimes?: Partial<Record<Submercado, string | null>>;
  /** Conjunto do Balanço de Energia nos Subsistemas, no ONS (peso da média ponderada pela carga). */
  urlBalanco?: string | null;
  /** Arquivo da carga verificada com e sem MMGD publicado pelo observatório (peso da média ponderada sem MMGD). */
  urlCargaVerificada?: string;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const idioma = useIdioma();
  const tx = useTx();
  const dataBR = (iso: string | null | undefined) => dataBRBase(iso, idioma);
  const mesAno = (m: string) => mesAnoBase(m, idioma);
  const num = (x: number | null | undefined, casas = 1) => numBase(x, casas, idioma);
  const sm = v.sm as Submercado;
  const nome = nomeSm(sm, idioma);
  const bloco = h as BlocoHistorico;
  const linhas = useMemo(() => linhasMensais(bloco, sm, idioma), [bloco, sm, idioma]);
  // o eixo mensal usa o primeiro dia do mês como data (o filtro de intervalo da URL é uma data)
  const serie = useMemo(() => linhas.map((l) => ({ ...l, x: `${l.m}-01` })), [linhas]);
  const marcosX = marcos.map((m) => ({ x: `${m.x}-01`, rotulo: m.rotulo }));
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;
  const escolhidos = v.sms as Submercado[];
  const medida = v.med as MedidaMensal;
  const comparacao = useMemo(() => serieMedidaPorSm(bloco, medida, escolhidos).map((l) => ({ ...l, x: `${l.m}-01` })), [bloco, medida, escolhidos]);
  const sazonal = useMemo(() => serieSazonal(bloco, sm, anoReferencia, idioma), [bloco, sm, anoReferencia, idioma]);
  const sazonalTabela = useMemo(() => linhasSazonal(bloco, sm, idioma), [bloco, sm, idioma]);
  const faixas = useMemo(() => faixasRegimes(bloco, sm, idioma), [bloco, sm, idioma]);
  const perfil = useMemo(() => perfilHoraMes(bloco, sm, idioma), [bloco, sm, idioma]);
  const inflacao = useMemo(() => textoInflacao(inflacaoAcumulada(bloco.mensal), idioma), [bloco, idioma]);
  const pos = h.posicao_referencia.find((x) => x.sm === sm);
  const i = mesFichas ? h.mensal.meses.indexOf(mesFichas) : -1;
  const endereco = `${rotaPainel("p011")}#p011`;
  const ultimoMes = h.mensal.meses[h.mensal.meses.length - 1];
  const parcialUltimo = h.mensal.parcial[h.mensal.parcial.length - 1];
  const nominal = v.moeda === "nominal";
  const iUltimo = h.mensal.meses.length - 1;
  const trocaDeMes =
    mesFichas && ultimoMes !== mesFichas ? (
      <p data-troca-de-mes="">
        {tx(
          `As três médias mensais usam ${mesAno(mesFichas)}, o último mês com as médias calculadas em todas as horas do mês. ${mesAno(ultimoMes)} aparece na tabela e no gráfico, mas`,
          `The three monthly averages use ${mesAno(mesFichas)}, the latest month with the averages calculated over every hour of the month. ${mesAno(ultimoMes)} appears in the table and the chart, but`,
        )}{" "}
        {h.mensal[sm].horas_com_carga[iUltimo] < h.mensal[sm].horas[iUltimo]
          ? tx(
              `a carga do balanço tem ${num(h.mensal[sm].horas_com_carga[iUltimo], 0)} das ${num(h.mensal[sm].horas[iUltimo], 0)} horas do mês, e as ponderadas de ${mesAno(ultimoMes)} usam só as horas com carga publicada.`,
              `the balance load has ${num(h.mensal[sm].horas_com_carga[iUltimo], 0)} of the ${num(h.mensal[sm].horas[iUltimo], 0)} hours of the month, and the weighted averages for ${mesAno(ultimoMes)} use only hours with published load.`,
            )
          : tx("ainda não tem as três médias calculadas nas mesmas horas.", "does not yet have the three averages calculated over the same hours.")}
      </p>
    ) : null;
  const linkArquivo = "underline underline-offset-4 text-energia-dark hover:text-carvao";

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p011" vivo veredito={vereditoP011(bloco, sm, idioma)}>
          {respostaP011(bloco, sm, idioma)}
        </RespostaCurta>
        <PldEscolha
          legenda={tx("Submercado", "Submarket")}
          opcoes={SUBMERCADOS.map((s) => ({ id: s, rotulo: curtoSm(s, idioma), detalhe: nomeSm(s, idioma) }))}
          valor={sm}
          onEscolher={(s) => definir({ sm: s })}
        />
      </div>

      {/* a pergunta da página: onde a média do dia fica entre as médias diárias do mesmo mês nos anos anteriores */}
      <SecaoDoPainel id="sazonalidade" titulo={tx("Qual é a faixa das médias diárias nesta época do ano, em anos anteriores?", "What is the range of daily averages at this time of year, in previous years?")}>
        <GraficoLinhas
          titulo={tx(
            `Médias diárias do PLD por mês do ano (anos anteriores a ${anoReferencia}) e média mensal de ${anoReferencia}, ${nome}`,
            `Daily PLD averages by month of the year (years before ${anoReferencia}) and monthly average for ${anoReferencia}, ${nome}`,
          )}
          dados={sazonal}
          chaveX="mes"
          formatoX="texto"
          series={[
            { id: "p50", rotulo: tx("Mediana das médias diárias", "Median of daily averages"), sigla: tx("mediana", "median"), cor: "var(--serie-referencia)" },
            { id: "ano", rotulo: tx(`Média mensal de ${anoReferencia} (média das horas)`, `Monthly average for ${anoReferencia} (average of the hours)`), sigla: String(anoReferencia), cor: COR_SM[sm], espessura: 2.5 }, // i18n: dado
          ]}
          banda={{ inferior: "p10", superior: "p90", rotulo: tx("percentil 10 a 90 das médias diárias", "percentile 10 to 90 of daily averages") }}
          unidade="R$/MWh"
          casas={2}
          zeroNoEixo
        />
        <div className="space-y-1.5 text-xs leading-relaxed text-carvao-muted" data-texto="sazonal-nominal">
          <p>
            {tx(
              `A faixa é a distribuição das médias diárias do mesmo mês nos anos anteriores; a linha de ${anoReferencia} é a média do mês inteiro, naturalmente menos dispersa que os dias.`,
              `The band is the distribution of daily averages for the same month in previous years; the ${anoReferencia} line is the average for the whole month, naturally less dispersed than the days.`,
            )}{" "}
            {notasRegimes?.[sm] ?? tx("Os valores são nominais, e cada ano anterior teve piso e tetos próprios.", "The values are nominal, and each previous year had its own floor and caps.")}
          </p>
          {inflacao && <p>{inflacao}</p>}
          <p>
            {tx(
              "A série semanal do PLD de 2001 a 2020, que a CCEE também publica, tem outra granularidade e ainda não está integrada: a referência começa em janeiro de 2021.",
              "The weekly PLD series from 2001 to 2020, which CCEE also publishes, has a different granularity and is not yet integrated: the reference starts in January 2021.",
            )}
          </p>
        </div>
        <TabelaInterativa
          titulo={tx(`Tabela equivalente: percentis das médias diárias por mês, ${nome}`, `Equivalent table: percentiles of daily averages by month, ${nome}`)}
          colunas={colunasSazonal(idioma)}
          linhas={sazonalTabela}
          chaveLinha="id"
          colunaRotulo="mes"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`pld-sazonal-${sm}`}
          chaveUrl="saz"
        />
      </SecaoDoPainel>

      <FaixaMetricas
        colunas={4}
        rotulo={tx(`Médias do PLD ${doSm(sm, "pt")}, cada uma com o seu peso`, `PLD averages ${doSm(sm, idioma)}, each with its own weight`)}
        nota={
          definicoes || trocaDeMes ? (
            <div className="space-y-2">
              {definicoes}
              {trocaDeMes}
            </div>
          ) : undefined
        }
      >
        <Numero
          variante="faixa"
          rotulo={tx(`Média diária de ${dataBR(pos?.dia ?? diaReferencia)}`, `Daily average for ${dataBR(pos?.dia ?? diaReferencia)}`)}
          natureza="CALCULADO"
          valor={pos?.media_dia ?? null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          periodo={dataBR(pos?.dia ?? diaReferencia)}
          motivoAusencia={tx("Dia sem as 24 horas publicadas.", "Day without all 24 hours published.")}
          cor={COR_SM[sm]}
          nota={
            pos && pos.mesmo_mes.percentil !== null
              ? pos.mesmo_mes.empates === 0
                ? tx(
                    `Em ${num(pos.mesmo_mes.percentil, 1)}% dos ${num(pos.mesmo_mes.n_dias, 0)} dias de ${nomeMes(pos.mesmo_mes.mes, idioma)} de anos anteriores, a média diária foi menor.`,
                    `On ${num(pos.mesmo_mes.percentil, 1)}% of the ${num(pos.mesmo_mes.n_dias, 0)} days in ${nomeMes(pos.mesmo_mes.mes, idioma)} of previous years, the daily average was lower.`,
                  )
                : tx(
                    `Percentil ${num(pos.mesmo_mes.percentil, 1)} entre ${num(pos.mesmo_mes.n_dias, 0)} dias do mesmo mês de anos anteriores.`,
                    `Percentile ${num(pos.mesmo_mes.percentil, 1)} among ${num(pos.mesmo_mes.n_dias, 0)} days of the same month in previous years.`,
                  )
              : undefined
          }
        />
        <Numero
          variante="faixa"
          rotulo={tx(`Média temporal de ${mesFichas ? mesAno(mesFichas) : "mês sem dado"}`, `Time-weighted average for ${mesFichas ? mesAno(mesFichas) : "month with no data"}`)}
          natureza="CALCULADO"
          valor={i >= 0 ? (h.mensal[sm].temporal[i] ?? null) : null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          periodo={mesFichas ? mesAno(mesFichas) : undefined}
          motivoAusencia={tx("Sem mês completo com as três médias.", "No complete month with the three averages.")}
          nota={
            <>
              {tx("Todas as horas pesam igual. Média simples das horas do mês, sem ficha de prova própria.", "Every hour weighs the same. Simple average of the hours of the month, with no evidence sheet of its own.")}
              <span data-nivel="auditar">{tx(" No arquivo baixado, é a coluna media_temporal de pld_mensal.csv.", " In the downloaded file, it is the media_temporal column of pld_mensal.csv.")}</span>
            </>
          }
        />
        <Numero
          variante="faixa"
          rotulo={tx(`Ponderada pela carga do balanço, ${mesFichas ? mesAno(mesFichas) : ""}`, `Weighted by balance load, ${mesFichas ? mesAno(mesFichas) : ""}`)}
          natureza="CALCULADO"
          evidencia={mesFichas ? (fichas[`ponderada_${mesFichas}_${sm}`] ?? null) : null}
          valor={i >= 0 ? (h.mensal[sm].ponderada_carga[i] ?? null) : null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          motivoAusencia={tx("Sem carga do balanço em todas as horas do mês.", "No balance load in every hour of the month.")}
          endereco={endereco}
          nota={
            <>
              {tx("Peso estimado: inclui a MMGD estimada pelo ONS desde 2023.", "Estimated weight: includes MMGD estimated by ONS since 2023.")}
              {urlBalanco ? (
                <>
                  {" "}
                  {tx("A carga do balanço está no", "The balance load is in the")}{" "}
                  <a href={urlBalanco} target="_blank" rel="noopener noreferrer" className={linkArquivo}>
                    {tx("conjunto de dados do ONS", "ONS dataset")}
                  </a>
                  .
                </>
              ) : null}
            </>
          }
        />
        <Numero
          variante="faixa"
          rotulo={tx(`Ponderada pela carga sem MMGD, ${mesFichas ? mesAno(mesFichas) : ""}`, `Weighted by load without MMGD, ${mesFichas ? mesAno(mesFichas) : ""}`)}
          natureza="CALCULADO"
          evidencia={mesFichas ? (fichas[`ponderada_sem_mmgd_${mesFichas}_${sm}`] ?? null) : null}
          valor={i >= 0 ? (h.mensal[sm].ponderada_carga_sem_mmgd[i] ?? null) : null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          motivoAusencia={tx("Sem a carga verificada da API do ONS no mês.", "No verified load from the ONS API in the month.")}
          endereco={endereco}
          nota={
            <>
              {tx("Mesma base de carga em toda a série.", "Same load basis across the series.")}
              {urlCargaVerificada ? (
                <>
                  {" "}
                  {tx("A carga por hora, com e sem MMGD, está em", "Hourly load, with and without MMGD, is in the")}{" "}
                  <a href={urlCargaVerificada} download className={linkArquivo}>
                    {tx("arquivo da carga verificada (CSV)", "verified load file (CSV)")}
                  </a>
                  .
                </>
              ) : null}
            </>
          }
        />
      </FaixaMetricas>

      <SecaoDoPainel id="medias-mensais" titulo={tx("Como as três médias do mês evoluíram desde 2021?", "How have the three monthly averages evolved since 2021?")}>
        <div className="space-y-3">
          <PldEscolha
            legenda={tx("Moeda no gráfico mensal", "Currency in the monthly chart")}
            opcoes={[
              { id: "nominal" as const, rotulo: tx("Nominal, três médias", "Nominal, three averages") },
              { id: "constante" as const, rotulo: tx("Temporal, nominal e em moeda constante", "Time-weighted, nominal and in constant currency") },
            ]}
            valor={v.moeda}
            onEscolher={(m) => definir({ moeda: m })}
          />
          <GraficoLinhas
            titulo={
              nominal
                ? tx(`PLD médio mensal ${doSm(sm, "pt")}: média temporal e médias ponderadas pela carga`, `Monthly average PLD ${doSm(sm, idioma)}: time-weighted average and load-weighted averages`)
                : tx(`PLD médio mensal, média temporal nominal e em moeda constante, ${nome}`, `Monthly average PLD, nominal time-weighted average and in constant currency, ${nome}`)
            }
            dados={serie}
            chaveX="x"
            formatoX="mes"
            series={
              nominal
                ? [
                    { id: "temporal", rotulo: rotuloMedida("temporal", idioma), sigla: curtoMedida("temporal", idioma), cor: COR_SM[sm], espessura: 2.5 },
                    { id: "ponderada_carga", rotulo: rotuloMedida("ponderada_carga", idioma), sigla: curtoMedida("ponderada_carga", idioma), cor: "var(--serie-referencia)", tracejada: true },
                    { id: "ponderada_carga_sem_mmgd", rotulo: rotuloMedida("ponderada_carga_sem_mmgd", idioma), sigla: curtoMedida("ponderada_carga_sem_mmgd", idioma), cor: "var(--serie-hidraulica)" },
                  ]
                : [
                    { id: "temporal", rotulo: tx("Média temporal nominal", "Nominal time-weighted average"), sigla: "nominal", cor: COR_SM[sm], espessura: 2.5 },
                    { id: "real", rotulo: rotuloMedida("real", idioma), sigla: tx("moeda constante", "constant currency"), cor: "var(--serie-referencia)", tracejada: true },
                  ]
            }
            unidade="R$/MWh"
            casas={2}
            zeroNoEixo
            marcos={marcosX}
            zoom
            intervalo={intervalo}
            onIntervalo={(iv) => definir({ de: iv?.inicio ?? "", ate: iv?.fim ?? "" })}
            legendaInterativa
          />
          {legendaMarcos.length > 0 && (
            <ol className="space-y-0.5 text-xs leading-relaxed text-carvao-muted" data-legenda="marcas-do-grafico" aria-label={tx("Marcas verticais do gráfico", "Vertical marks in the chart")}>
              {legendaMarcos.map((m) => (
                <li key={m.n}>
                  <span className="font-medium text-carvao">{m.n}</span> {m.data}: <TrechoPortugues regiao="pld-marca-perimetro">{m.texto}</TrechoPortugues>.
                </li>
              ))}
            </ol>
          )}
          <p className="text-xs leading-relaxed text-carvao-muted">
            {tx(
              <>
                Marcas numeradas: mudanças do perímetro da carga do balanço declaradas pelo ONS; a ponderada pelo balanço só se compara entre meses do mesmo perímetro, e a ponderada
                sem MMGD atravessa as mudanças. Mês sem as horas de carga publicadas fica com a ponderada calculada nas horas disponíveis (coluna &ldquo;mesmas horas&rdquo; da tabela).
                Moeda constante só existe até o último mês com IPCA publicado.
              </>,
              <>
                Numbered marks: changes to the balance load perimeter declared by ONS; the balance-weighted average can only be compared between months with the same perimeter, and the
                average weighted without MMGD spans the changes. A month without the published load hours has the weighted average calculated over the available hours (column &ldquo;same hours&rdquo; in the table).
                Constant currency only exists up to the latest month with published IPCA.
              </>,
            )}
            {nominal && (
              <span data-texto="escala-das-tres-medias">
                {" "}
                {tx(
                  "A escala vai de zero ao maior preço da série, e por isso as três linhas parecem juntas; a diferença entre elas no último mês completo está em O que mudou, mais abaixo.",
                  "The scale runs from zero to the highest price in the series, which is why the three lines look close together; the difference between them in the latest complete month is in What changed, further down.",
                )}
              </span>
            )}
          </p>
        </div>

        <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
          <div>
            <dt className="rotulo text-mineral">{tx("Período", "Period")}</dt>
            <dd className="mt-0.5">
              {tx(
                `Dia de referência ${dataBR(diaReferencia)}; meses de ${mesAno(h.mensal.meses[0])} a ${mesAno(ultimoMes)}${parcialUltimo ? " (último mês parcial)" : ""}; percentis com os anos anteriores a ${anoReferencia}`,
                `Reference day ${dataBR(diaReferencia)}; months from ${mesAno(h.mensal.meses[0])} to ${mesAno(ultimoMes)}${parcialUltimo ? " (latest month partial)" : ""}; percentiles with the years before ${anoReferencia}`,
              )}
            </dd>
          </div>
          <div>
            <dt className="rotulo text-mineral">{tx("Universo", "Universe")}</dt>
            <dd className="mt-0.5">
              {tx(
                `Horas com PLD publicado ${doSm(sm, "pt")}; ponderadas só nas horas com carga positiva publicada`,
                `Hours with a published PLD ${doSm(sm, idioma)}; weighted averages only over hours with positive published load`,
              )}
            </dd>
          </div>
          <div>
            <dt className="rotulo text-mineral">{tx("Unidade", "Unit")}</dt>
            <dd className="mt-0.5">
              {tx(
                `R$/MWh nominais; moeda constante: valores corrigidos pelo IPCA para os reais de ${h.deflator.mes_base ? mesAno(h.deflator.mes_base) : "mês sem índice"}`,
                `Nominal R$/MWh; constant currency: values adjusted by IPCA to reais of ${h.deflator.mes_base ? mesAno(h.deflator.mes_base) : "month with no index"}`,
              )}
            </dd>
          </div>
        </dl>

        <TabelaInterativa
          titulo={tx(`Tabela equivalente: PLD médio mensal, ${nome}`, `Equivalent table: monthly average PLD, ${nome}`)}
          colunas={colunasMensais(idioma)}
          linhas={linhas}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`pld-mensal-${sm}`}
          chaveUrl="mes"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
        />
      </SecaoDoPainel>

      {notas}

      <SecaoDoPainel id="distribuicao" titulo={tx("Como o preço horário se distribui em cada regime anual de limites?", "How is the hourly price distributed in each annual limits regime?")}>
        <PldFaixas faixas={faixas} titulo={tx(`PLD horário por ano, ${nome} (R$/MWh)`, `Hourly PLD by year, ${nome} (R$/MWh)`)} />
        <p className="text-xs leading-relaxed text-carvao-muted">
          {tx(
            "Anos com muitas horas no piso têm a caixa encostada no tracejado: são horas com preço igual por regra (empates no piso), não preços parecidos por acaso.",
            "Years with many hours at the floor have the box against the dashed line: these are hours with a price equal by rule (ties at the floor), not prices that happen to be similar.",
          )}
        </p>
        <TabelaInterativa
          titulo={tx(`Tabela equivalente: quantis do PLD horário por ano, ${nome}`, `Equivalent table: quantiles of the hourly PLD by year, ${nome}`)}
          colunas={colunasRegimesDist(idioma)}
          linhas={faixas.map((f) => ({ ...f, parcial: f.parcial ? tx("sim", "yes") : tx("não", "no") }))}
          chaveLinha="id"
          colunaRotulo="rotulo"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`pld-distribuicao-${sm}`}
          chaveUrl="reg"
        />
      </SecaoDoPainel>

      <SecaoDoPainel
        id="perfil-hora-mes"
        titulo={tx("Como o PLD médio varia pelas horas do dia, mês a mês?", "How does the average PLD vary by hour of the day, month by month?")}
        lead={tx("Média de cada hora do dia em cada um dos últimos 12 meses.", "Average of each hour of the day in each of the last 12 months.")}
      >
        <PldMapaHoras
          titulo={tx(`PLD médio por hora do dia em cada mês, ${nome}`, `Average PLD by hour of the day in each month, ${nome}`)}
          linhas={perfil.linhas}
          colunas={horasDoDia(idioma)}
          nomeLinhas={tx("Mês", "Month")}
          nomeColunas={tx("Hora", "Hour")}
          valores={perfil.valores}
          escala={ESCALA_PLD}
          unidade="R$/MWh"
          casas={2}
          passoRotuloColunas={3}
          nota={tx(
            "Escala fixa em R$/MWh nominais, a mesma do mapa hora × dia: a mesma cor é o mesmo preço em qualquer submercado e mês.",
            "Fixed scale in nominal R$/MWh, the same as the hour × day map: the same color is the same price in any submarket and month.",
          )}
        />
      </SecaoDoPainel>

      <SecaoDoPainel id="mapa-hora-dia" titulo={tx("Como o PLD varia hora a hora nos últimos dias?", "How does the PLD vary hour by hour in recent days?")}>
        <PldHoraDia url={h.hora_dia.url} sm={sm} nota={h.hora_dia.nota} />
      </SecaoDoPainel>

      <SecaoDoPainel id="comparar" titulo={tx("Comparar submercados na mesma escala", "Compare submarkets on the same scale")} nivel="analisar">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <PldLista rotulo={tx("Medida", "Measure")} opcoes={MEDIDAS_MENSAIS.map((m) => ({ id: m, rotulo: rotuloMedida(m, idioma) }))} valor={medida} onEscolher={(m) => definir({ med: m })} />
        </div>
        <Comparador
          rotulo={tx(`Submercados no gráfico (até ${LIMITE_COMPARACAO})`, `Submarkets in the chart (up to ${LIMITE_COMPARACAO})`)}
          entidades={SUBMERCADOS.map((s) => ({ id: s, rotulo: nomeSm(s, idioma), sinonimos: [curtoSm(s, idioma), nomeSm(s, "pt")] }))}
          selecionadas={escolhidos}
          onMudar={(ids) => definir({ sms: ids as Submercado[] })}
          dicaBusca={tx("Sul, Nordeste, Norte", "South, Northeast, North")}
          vazio={tx("Nenhum submercado escolhido. Escolha até quatro para ver a mesma medida na mesma escala.", "No submarket chosen. Choose up to four to see the same measure on the same scale.")}
        >
          {() => null}
        </Comparador>
        {escolhidos.length > 0 && (
          <GraficoLinhas
            titulo={tx(`${rotuloMedida(medida, idioma)}, por submercado`, `${rotuloMedida(medida, idioma)}, by submarket`)}
            dados={comparacao}
            chaveX="x"
            formatoX="mes"
            series={escolhidos.map((s) => ({ id: s, rotulo: nomeSm(s, idioma), sigla: curtoSm(s, idioma), cor: COR_SM[s] }))}
            unidade="R$/MWh"
            casas={2}
            zeroNoEixo
            marcos={medida === "ponderada_carga" ? marcosX : []}
          />
        )}
        <p className="text-xs text-carvao-muted">
          {tx(
            `Medida: ${curtoMedida(medida, idioma)}. Os valores de cada submercado estão na tabela mensal ao escolher o submercado acima e no CSV mensal.`,
            `Measure: ${curtoMedida(medida, idioma)}. The values for each submarket are in the monthly table when you choose the submarket above, and in the monthly CSV.`,
          )}
        </p>
      </SecaoDoPainel>
    </div>
  );
}
