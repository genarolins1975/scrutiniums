"use client";

import { useMemo, type ReactNode } from "react";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { PldEscolha } from "@/components/energia/PldControles";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, num } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";
import {
  colunasRelacao,
  colunasSemanas,
  COR_SM,
  curtoSm,
  nomeSm,
  SUBMERCADOS,
  limitesPorSemana,
  limitesVigentesEm,
  linhasRelacaoAnual,
  linhasSemanais,
  respostaP009,
  rotaPainel,
  textoCmoFrenteAosLimites,
  valoresAlcancamTeto,
  vereditoP009,
} from "@/lib/energia/pld";
import type { Submercado } from "@/lib/energia/tipos";
import type { BlocoCmoPld, RegimeLimites } from "@/lib/energia/tipos-pld";

/**
 * P009, CMO e formação de preço: submercado (?sm=) e intervalo do gráfico semanal
 * (?de=, ?ate=) ficam na URL; busca, ordem e filtros das tabelas também (prefixos
 * sem e rel). A resposta, as medidas da faixa, o gráfico semanal e a tabela
 * equivalente leem as mesmas linhas (linhasSemanais); a comparação horária mostra o PLD
 * e o CMO do DESSEM na MESMA hora para os quatro submercados, em pequenos múltiplos
 * na mesma escala (nunca dois eixos). Nenhuma diferença é calculada aqui: as da
 * semana de referência vêm prontas da gold, e as horárias por ano também.
 *
 * Ordem da página: resposta e escolha do submercado, figura principal
 * (a semana operativa; piso e tetos do ato entram quando algum valor os alcança), faixa de medidas (depois da figura, para que ela apareça
 * na primeira tela), recorte, tabela (que segue o intervalo escolhido no gráfico), os quatro submercados da semana lado a lado (`quatroSubmercados`), notas do painel (`notas`) e as duas comparações
 * complementares, visíveis em Entender, cada uma com a sua pergunta.
 */
const ESQUEMA = {
  sm: campo(tiposUrl.opcao(SUBMERCADOS), "SE" as Submercado),
  de: campo(tiposUrl.data(), ""),
  ate: campo(tiposUrl.data(), ""),
};

const opcoesSm = (idioma: Idioma) => SUBMERCADOS.map((sm) => ({ id: sm, rotulo: curtoSm(sm, idioma), detalhe: nomeSm(sm, idioma) }));

export type HorarioCmo = { t: string[]; pld: Record<Submercado, (number | null)[]>; cmo: Record<Submercado, (number | null)[]> };

export function PldCmo({
  c,
  horario,
  marcos,
  fichas,
  fonte,
  versao,
  notasEntreLimites,
  notas,
  avisoGrafico,
  quatroSubmercados,
  notaMarcos,
  regimes = [],
}: {
  c: Pick<BlocoCmoPld, "semanal" | "semana_referencia" | "relacao_anual">;
  /** Últimas 168 horas (pld_horario_recente.json), só PLD e CMO; null quando o arquivo falta. */
  horario: HorarioCmo | null;
  marcos: { x: string; rotulo: string }[];
  fichas: Record<string, Evidencia>;
  fonte: string;
  versao: string;
  /** Por submercado, a frase que concilia as horas entre os limites daqui com as da página de limites (notaHorasEntreLimites). */
  notasEntreLimites?: Partial<Record<Submercado, string | null>>;
  /** Notas do painel (NotasDoPainel), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
  /** Aviso sobre o recorte do gráfico semanal frente ao CSV, junto do gráfico. */
  avisoGrafico?: ReactNode;
  /** Os quatro submercados da semana de referência lado a lado, com a nota descritiva (montada no servidor). */
  quatroSubmercados?: ReactNode;
  /** O que a marca vertical do gráfico semanal diz (sequência de semanas com CMO semanal zero). */
  notaMarcos?: ReactNode;
  /** Piso e tetos por trecho de vigência, para desenhar no gráfico semanal e comparar com o CMO da semana de referência. */
  regimes?: RegimeLimites[];
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const idioma = useIdioma();
  const tx = useTx();
  const sm = v.sm as Submercado;
  const nome = nomeSm(sm, idioma);
  const notaEntreLimites = notasEntreLimites?.[sm] ?? null;
  const linhas = useMemo(() => linhasSemanais(c as BlocoCmoPld, sm), [c, sm]);
  const relacao = useMemo(() => linhasRelacaoAnual(c as BlocoCmoPld, sm, idioma), [c, sm, idioma]);
  const ref = c.semana_referencia;
  const x = ref?.por_sm.find((p) => p.sm === sm) ?? null;
  const intervalo = useMemo(() => (v.de && v.ate ? { inicio: v.de, fim: v.ate } : null), [v.de, v.ate]);
  // piso e tetos do ato vigente em cada semana entram no gráfico quando algum valor semanal alcança o teto estrutural
  const comLimites = useMemo(() => valoresAlcancamTeto(linhas, regimes), [linhas, regimes]);
  const dadosGrafico = useMemo(() => {
    if (!comLimites) return linhas;
    const lim = limitesPorSemana(linhas.map((l) => l.fim), regimes);
    return linhas.map((l, k) => ({ ...l, piso: lim[k].piso, teto_horario: lim[k].teto_horario, teto_estrutural: lim[k].teto_estrutural }));
  }, [comLimites, linhas, regimes]);
  // a tabela e o arquivo dela seguem o intervalo escolhido no gráfico
  const linhasTabela = useMemo(() => (intervalo ? linhas.filter((l) => l.fim >= intervalo.inicio && l.fim <= intervalo.fim) : linhas), [linhas, intervalo]);
  const avisoLimites = ref ? textoCmoFrenteAosLimites(sm, x?.decomp ?? null, limitesVigentesEm(regimes, ref.fim), idioma) : null;
  const horas = useMemo(
    () =>
      horario
        ? horario.t.map((t, i) => {
            const linha: Record<string, string | number | null> = { t };
            for (const s of SUBMERCADOS) {
              linha[`pld_${s}`] = horario.pld[s][i] ?? null;
              linha[`cmo_${s}`] = horario.cmo[s][i] ?? null;
            }
            return linha;
          })
        : [],
    [horario],
  );
  const situacoes = relacao.map((r) => ({ id: r.id, rotulo: r.ano, piso: r.piso, teto_horario: r.teto_horario, teto_estrutural_no_dia: r.teto_estrutural_no_dia, entre: r.entre }));
  const endereco = `${rotaPainel("p009")}#p009`;

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p009" vivo veredito={vereditoP009(c as BlocoCmoPld, sm, idioma)}>
          {respostaP009(c as BlocoCmoPld, sm, idioma)}
          {notaEntreLimites ? <span className="mt-2 block">{notaEntreLimites}</span> : null}
        </RespostaCurta>
        <PldEscolha legenda={tx("Submercado", "Submarket")} opcoes={opcoesSm(idioma)} valor={sm} onEscolher={(s) => definir({ sm: s })} />
      </div>

      {avisoLimites && (
        <p className="max-w-prose2 border-l-2 border-mineral pl-3 text-sm leading-relaxed text-carvao" data-texto="cmo-e-limites">
          {avisoLimites}
        </p>
      )}

      <div className="space-y-3">
        <GraficoLinhas
          titulo={tx(`CMO semanal do DECOMP, média do DESSEM e média do PLD por semana operativa, ${nome}`, `DECOMP weekly CMO, DESSEM average and PLD average by operating week, ${nome}`)}
          dados={dadosGrafico}
          chaveX="fim"
          formatoX="data"
          series={[
            { id: "decomp", rotulo: tx("CMO semanal do DECOMP (ONS)", "DECOMP weekly CMO (ONS)"), sigla: "DECOMP", cor: "var(--serie-referencia)", tracejada: true },
            { id: "dessem", rotulo: tx("Média do CMO do DESSEM na semana (ONS)", "Average DESSEM CMO in the week (ONS)"), sigla: "DESSEM", cor: "var(--serie-hidraulica)" },
            { id: "pld", rotulo: tx("Média do PLD na semana (CCEE)", "Average PLD in the week (CCEE)"), sigla: "PLD", cor: COR_SM[sm], espessura: 2.5 },
            ...(comLimites
              ? [
                  { id: "teto_horario", rotulo: tx("Teto horário do PLD no ato vigente", "PLD hourly cap in the act in force"), sigla: tx("teto horário", "hourly cap"), cor: "var(--cor-mineral)", tracejada: true, espessura: 1.25 },
                  { id: "teto_estrutural", rotulo: tx("Teto estrutural do PLD no ato vigente", "PLD structural cap in the act in force"), sigla: tx("teto estrutural", "structural cap"), cor: "var(--cor-mineral)", tracejada: true, espessura: 1.25 },
                  { id: "piso", rotulo: tx("Piso do PLD no ato vigente", "PLD floor in the act in force"), sigla: tx("piso", "floor"), cor: "var(--cor-mineral)", tracejada: true, espessura: 1.25 },
                ]
              : []),
          ]}
          unidade="R$/MWh"
          casas={2}
          zeroNoEixo
          marcos={marcos}
          zoom
          intervalo={intervalo}
          onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
          legendaInterativa
        />
        <p className="text-xs leading-relaxed text-carvao-muted">
          {tx(
            "Cada ponto é uma semana operativa, marcada pela sexta-feira que a encerra (a data que o ONS publica). Semana com meia hora ou hora ausente fica sem média, e a linha tem uma lacuna.",
            "Each point is an operating week, marked by the Friday that closes it (the date ONS publishes). A week with a missing half-hour or hour has no average, and the line has a gap.",
          )}
          {comLimites &&
            tx(
              " As linhas tracejadas de cima e de baixo são o piso e os tetos do PLD no ato vigente em cada semana; elas aparecem quando algum valor do gráfico alcança o teto estrutural.",
              " The dashed lines at the top and bottom are the PLD floor and caps in the act in force in each week; they appear when a value in the chart reaches the structural cap.",
            )}
        </p>
        {notaMarcos && <p className="text-xs leading-relaxed text-carvao-muted">{notaMarcos}</p>}
        {avisoGrafico}
      </div>

      <FaixaMetricas colunas={4} rotulo={tx(`Medidas da semana de referência, ${nome}`, `Measures for the reference week, ${nome}`)}>
        <Numero
          variante="faixa"
          rotulo={tx("CMO semanal do DECOMP", "DECOMP weekly CMO")}
          natureza="ESTIMADO"
          valor={x?.decomp ?? null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          periodo={ref ? tx(`semana de ${dataBR(ref.inicio, idioma)} a ${dataBR(ref.fim, idioma)}`, `week from ${dataBR(ref.inicio, idioma)} to ${dataBR(ref.fim, idioma)}`) : undefined}
          motivoAusencia={tx("Sem semana operativa completa com os três produtos.", "No complete operating week with all three products.")}
          cor={COR_SM[sm]}
          nota={tx("Valor do modelo para a semana inteira, como publicado pelo ONS.", "Model value for the whole week, as published by ONS.")}
        />
        <Numero
          variante="faixa"
          rotulo={tx("Média do CMO do DESSEM na semana", "Average DESSEM CMO in the week")}
          natureza="CALCULADO"
          evidencia={fichas[`dessem_semana_${sm}`] ?? null}
          valor={x?.dessem ?? null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          motivoAusencia={tx("Semana sem as 336 meias horas publicadas.", "Week without the 336 published half-hours.")}
          cor={COR_SM[sm]}
          endereco={endereco}
        />
        <Numero
          variante="faixa"
          rotulo={tx("Média do PLD na semana", "Average PLD in the week")}
          natureza="CALCULADO"
          evidencia={fichas[`pld_semana_${sm}`] ?? null}
          valor={x?.pld ?? null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          motivoAusencia={tx("Semana sem as 168 horas publicadas.", "Week without the 168 published hours.")}
          cor={COR_SM[sm]}
          endereco={endereco}
        />
        <Numero
          variante="faixa"
          rotulo={tx("PLD médio menos a média do DESSEM, mesma semana", "Average PLD minus the DESSEM average, same week")}
          natureza="CALCULADO"
          valor={x?.pld_menos_dessem ?? null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          motivoAusencia={tx("Sem as duas médias da semana.", "Without both averages for the week.")}
          nota={tx("Diferença entre produtos diferentes no mesmo intervalo; não mede erro de nenhum deles.", "Difference between different products over the same interval; it does not measure an error in either of them.")}
        />
      </FaixaMetricas>

      <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
        <div>
          <dt className="rotulo text-mineral">{tx("Período", "Period")}</dt>
          <dd className="mt-0.5">
            {tx(
              <>
                {ref ? `Semana operativa de ${dataBR(ref.inicio)} a ${dataBR(ref.fim)} (sábado a sexta)` : "sem semana completa"}; gráfico com {num(linhas.length, 0)} semanas (
                {linhas.length ? `${dataBR(linhas[0].inicio)} a ${dataBR(linhas[linhas.length - 1].fim)}` : "sem semanas"})
              </>,
              <>
                {ref ? `Operating week from ${dataBR(ref.inicio, idioma)} to ${dataBR(ref.fim, idioma)} (Saturday to Friday)` : "no complete week"}; chart with {num(linhas.length, 0, idioma)} weeks (
                {linhas.length ? `${dataBR(linhas[0].inicio, idioma)} to ${dataBR(linhas[linhas.length - 1].fim, idioma)}` : "no weeks"})
              </>,
            )}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Universo", "Universe")}</dt>
          <dd className="mt-0.5">
            {tx(
              `Submercado ${nome} (CCEE) e subsistema de mesmo nome (ONS); semana só com as 336 meias horas e as 168 horas`,
              `${nome} submarket (CCEE) and the subsystem of the same name (ONS); weeks only with all 336 half-hours and 168 hours`,
            )}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Unidade", "Unit")}</dt>
          <dd className="mt-0.5">
            {tx("R$/MWh nominais", "Nominal R$/MWh")}
            <span data-nivel="analisar">{tx(" (a média semanal do DECOMP aparece como R$/MW no dicionário do ONS)", " (the DECOMP weekly average appears as R$/MW in the ONS data dictionary)")}</span>
          </dd>
        </div>
      </dl>

      <TabelaInterativa
        titulo={tx(
          `Tabela equivalente: semanas operativas de ${nome}${intervalo ? " no intervalo escolhido no gráfico" : ""}`,
          `Equivalent table: operating weeks for ${nome}${intervalo ? " in the interval chosen in the chart" : ""}`,
        )}
        colunas={colunasSemanas(idioma)}
        linhas={linhasTabela}
        chaveLinha="id"
        colunaRotulo="fim"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`pld-cmo-semanal-${sm}${intervalo ? `-${intervalo.inicio}-a-${intervalo.fim}` : ""}`}
        chaveUrl="sem" // i18n: dado
        ordemInicial={{ coluna: "fim", direcao: "desc" }}
        nota={
          intervalo
            ? tx(
                "A tabela e o arquivo dela trazem só as semanas do intervalo escolhido no gráfico; o histórico desde 2021, com os quatro submercados, está no CSV semanal (download no rodapé do painel).",
                "The table and its file contain only the weeks in the interval chosen in the chart; the history since 2021, with all four submarkets, is in the weekly CSV (download in the panel footer).",
              )
            : tx(
                "A tabela traz as semanas do gráfico; o histórico desde 2021, com os quatro submercados, está no CSV semanal (download no rodapé do painel).",
                "The table contains the weeks in the chart; the history since 2021, with all four submarkets, is in the weekly CSV (download in the panel footer).",
              )
        }
      />

      {quatroSubmercados}

      {notas}

      <SecaoDoPainel
        id="mesma-hora"
        titulo={tx("Como o PLD e o CMO do DESSEM se comparam na mesma hora?", "How do the PLD and the DESSEM CMO compare in the same hour?")}
        lead={tx("Últimas 168 horas, um painel por submercado, na mesma escala.", "Last 168 hours, one panel per submarket, on the same scale.")}
      >
        {horario && horas.length ? (
          <PequenosMultiplos
            titulo={tx("PLD horário e CMO do DESSEM na mesma hora, por submercado", "Hourly PLD and DESSEM CMO in the same hour, by submarket")}
            dados={horas}
            chaveX="t"
            formatoX="hora"
            unidade="R$/MWh"
            casas={2}
            colunas={2}
            paineis={SUBMERCADOS.map((s) => ({
              id: s,
              titulo: nomeSm(s, idioma),
              series: [
                { id: `pld_${s}`, rotulo: tx(`PLD da hora, ${curtoSm(s, idioma)}`, `Hourly PLD, ${curtoSm(s, idioma)}`), sigla: "PLD", cor: COR_SM[s], espessura: 2 },
                { id: `cmo_${s}`, rotulo: tx(`CMO do DESSEM na hora, ${curtoSm(s, idioma)}`, `Hourly DESSEM CMO, ${curtoSm(s, idioma)}`), sigla: "DESSEM", cor: "var(--serie-hidraulica)", tracejada: true },
              ],
            }))}
          />
        ) : (
          <p className="text-sm text-carvao-muted">
            {tx(
              "A janela das últimas 168 horas não está nesta publicação; o histórico horário completo está no CSV horário, em Baixar os dados.",
              "The window of the last 168 hours is not in this publication; the full hourly history is in the hourly CSV, under Download the data.",
            )}
          </p>
        )}
        <p className="text-xs leading-relaxed text-carvao-muted">
          {tx(
            "O CMO do DESSEM da hora é a média das meias horas que começam em h:00 e h:30; hora com meia hora ausente fica sem valor. O DESSEM do dia D é calculado em D-1, e o arquivo do ONS já traz o dia seguinte: a curva pode terminar depois do PLD.",
            "The hourly DESSEM CMO is the average of the half-hours starting at h:00 and h:30; an hour with a missing half-hour has no value. DESSEM for day D is calculated on D-1, and the ONS file already includes the following day: the curve can end after the PLD.",
          )}
        </p>
      </SecaoDoPainel>

      <SecaoDoPainel id="relacao-anual" titulo={tx(`Em quantas horas de cada ano o PLD ficou entre os limites: ${nome}`, `In how many hours of each year was the PLD between the limits: ${nome}`)}>
        <GraficoBarras
          titulo={tx(`Horas de cada ano pela situação do PLD frente aos limites, ${nome}`, `Hours of each year by the PLD's position relative to the limits, ${nome}`)}
          dados={situacoes}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={[
            { id: "piso", rotulo: tx("no piso", "at the floor"), cor: "var(--escala-seq-2)" },
            { id: "entre", rotulo: tx("entre os limites", "between the limits"), cor: "var(--escala-seq-4)" }, // i18n: dado
            { id: "teto_estrutural_no_dia", rotulo: tx("em dia com média no teto estrutural", "on a day with the average at the structural cap"), cor: "var(--serie-termica)" },
            { id: "teto_horario", rotulo: tx("no teto horário", "at the hourly cap"), cor: "var(--escala-div-neg-2)" },
          ]}
          unidade={tx("horas", "hours")}
          casas={0}
          empilhado
        />
        <p className="text-sm leading-relaxed text-carvao-muted">
          {tx(
            "No piso e nos tetos, o PLD é o limite do ato, e a diferença para o CMO mede o limite, não a formação do preço. Por isso a tabela separa as horas entre os limites, onde as duas séries podem ser comparadas como produtos diferentes no mesmo intervalo.",
            "At the floor and the caps, the PLD is the act's limit, and the difference from the CMO measures the limit, not price formation. That is why the table separates the hours between the limits, where the two series can be compared as different products over the same interval.",
          )}
        </p>
        <TabelaInterativa
          titulo={tx(`Tabela equivalente: PLD menos CMO do DESSEM na mesma hora, por ano, ${nome}`, `Equivalent table: PLD minus DESSEM CMO in the same hour, by year, ${nome}`)}
          colunas={colunasRelacao(idioma)}
          linhas={relacao}
          chaveLinha="id"
          colunaRotulo="ano" // i18n: dado
          fonte={fonte}
          versao={versao}
          nomeArquivo={`pld-relacao-cmo-${sm}`}
          chaveUrl="rel"
          nota={tx(
            "As colunas de horas contam só as horas com PLD e CMO do DESSEM publicados; a página de limites conta todas as horas com PLD, por isso os totais de horas no piso podem ser maiores lá. Horas sem CMO publicado ficam fora das diferenças; o ano marcado como parcial ainda está em curso.",
            "The hour columns count only hours with a published PLD and DESSEM CMO; the limits page counts all hours with a PLD, so the totals of hours at the floor can be larger there. Hours without a published CMO are left out of the differences; the year marked as partial is still under way.",
          )}
        />
      </SecaoDoPainel>
    </div>
  );
}
