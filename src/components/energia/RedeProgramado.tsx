"use client";

import { useMemo, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { RedeEscolha } from "@/components/energia/RedeControles";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { formatos } from "@/lib/energia/formato";
import { porIdioma } from "@/lib/energia/idioma";
import {
  COR_PAR,
  LIMIAR_NULO_MWMED,
  PARES_PROGRAMADO,
  avisoMesIncompleto,
  colunasMaioresDesvios,
  colunasProgramaRepetido,
  colunasProgramadoDiario,
  colunasProgramadoMensal,
  curtoPar,
  colunasDistribuicao,
  ehFronteira,
  linhasDistribuicao,
  linhasMaioresDesvios,
  linhasMateriaisMensal,
  linhasProgramaRepetido,
  linhasProgramadoDiario,
  linhasProgramadoMensal,
  medidasProgramado,
  nomePar,
  paraTabela,
  respostaProgramado,
  semCaminhosInternos,
  sentidoNegativo,
  sentidoPositivo,
  textoProgramaRepetido,
  vereditoProgramado,
  type BaseDesvio,
} from "@/lib/energia/rede";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { ParProgramado, ProgramadoRede } from "@/lib/energia/tipos-rede";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";

/**
 * P031, programado e verificado. O recorte fica na URL: fronteira ou país (?par=),
 * base da distribuição (?base=com|sem, com ou sem os dias rotulados por programa
 * repetido) e pares comparados mês a mês (?pares=, até quatro); busca, ordem, filtros
 * e página de cada tabela também (prefixos dist, d30.p, md, mm, mp.t, rep). Escolher um
 * par na faixa ou na tabela muda a resposta, a ficha de prova, a série diária e a mensal
 * juntas. Desvio é diferença entre medida e programa, nunca chamado de falha.
 */
const BASES = ["com", "sem"] as const; // i18n: dado
const ESQUEMA = {
  par: campo(tiposUrl.opcao(PARES_PROGRAMADO), "N_NE"),
  base: campo(tiposUrl.opcao(BASES), "com"), // i18n: dado
  pares: campo(tiposUrl.lista(tiposUrl.opcao(PARES_PROGRAMADO), { max: LIMITE_COMPARACAO }), ["N_NE", "N_SE", "NE_SE", "S_SE"] as ParProgramado[]),
};

const opcoesPar = (idioma: Idioma) => PARES_PROGRAMADO.map((p) => ({ id: p, rotulo: curtoPar(p, idioma), detalhe: nomePar(p, idioma) }));
const opcoesBase = (idioma: Idioma) => [
  {
    id: "com" as const, // i18n: dado
    rotulo: porIdioma(idioma, { pt: "Todos os dias", en: "All days" }),
    detalhe: porIdioma(idioma, { pt: "Distribuição com todos os dias comparados", en: "Distribution with every compared day" }),
  },
  {
    id: "sem" as const, // i18n: dado
    rotulo: porIdioma(idioma, { pt: "Sem dias rotulados", en: "Without flagged days" }),
    detalhe: porIdioma(idioma, { pt: "Distribuição sem os dias de programa repetido", en: "Distribution without the repeated-schedule days" }),
  },
];

/**
 * Faixa de métricas da abertura: o desvio absoluto médio e a mediana, as horas com desvio material e as horas no sentido oposto ao
 * programa, para a fronteira ou o país e a base escolhidos. Lê da URL o mesmo par e a mesma base que o painel (por isso é cliente) e as
 * linhas da distribuição (medidasProgramado), as mesmas da resposta, da faixa de desvios e da tabela: nenhum número é calculado aqui.
 * Desvio é a diferença entre o verificado e o programado, nunca chamado de falha.
 */
export function RedeProgramadoMetricas({
  programado,
  evidencias,
}: {
  programado: Pick<ProgramadoRede, "distribuicao" | "limiar_material_mwmed" | "inicio" | "fim">;
  /** Fichas de prova do desvio absoluto médio por par (chave desvio_medio.<par>); a ficha prova a base com todos os dias. */
  evidencias: Record<string, Evidencia>;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const { dataBR, num, plural } = formatos(idioma);
  const mw = tx("MWmed", "MWavg");
  const [v] = useEstadoUrl(ESQUEMA);
  const par = v.par as ParProgramado;
  const base = v.base as BaseDesvio;
  const m = medidasProgramado(programado, par, base, idioma);
  const ficha = base === "com" ? (evidencias[`desvio_medio.${par}`] ?? null) : null;
  const periodo = m
    ? tx(`${dataBR(m.inicio)} a ${dataBR(m.fim)}`, `${dataBR(m.inicio)} to ${dataBR(m.fim)}`)
    : tx(`${dataBR(programado.inicio)} a ${dataBR(programado.fim)}`, `${dataBR(programado.inicio)} to ${dataBR(programado.fim)}`);
  const semHoras = tx("Sem horas com programado e verificado comparáveis nesta publicação.", "No hours with comparable scheduled and verified values in this release.");
  const deHoras = m ? tx(`De ${num(m.horas, 0)} horas comparadas.`, `Out of ${num(m.horas, 0)} hours compared.`) : undefined;
  const horas = tx("horas", "hours");
  return (
    <FaixaMetricas
      colunas={4}
      rotulo={tx("Desvio do fluxo verificado em relação ao programado", "Deviation of the verified flow from the scheduled flow")}
      nota={tx(
        `Desvio é a diferença entre o verificado e o programado na mesma hora; a fonte não informa o motivo.${base === "sem" ? " Base sem os dias rotulados por programa repetido: a ficha de prova cobre só a base com todos os dias." : ""}`,
        `The deviation is the difference between verified and scheduled in the same hour; the source does not state the reason.${base === "sem" ? " Basis without the days flagged for a repeated schedule: the evidence card only covers the basis with all days." : ""}`,
      )}
    >
      <Numero
        variante="faixa"
        rotulo={tx(`Desvio absoluto médio por hora, ${m?.nome ?? nomePar(par, "pt")}`, `Mean absolute deviation per hour, ${m?.nome ?? nomePar(par, "en")}`)}
        natureza="CALCULADO"
        valor={ficha ? undefined : (m?.desvio_abs_medio_mwmed ?? null)}
        evidencia={ficha}
        // mesmas casas do valor exibido na ficha de prova (a gold publica o desvio médio inteiro)
        casas={0}
        unidade={mw}
        periodo={periodo}
        cor={COR_PAR[par]}
        nota={
          m
            ? `${deHoras}${
                m.dias_excluidos
                  ? tx(` Sem ${plural(m.dias_excluidos, "dia rotulado", "dias rotulados")}.`, ` Without ${plural(m.dias_excluidos, "flagged day", "flagged days")}.`)
                  : ""
              }`
            : undefined
        }
        motivoAusencia={semHoras}
        endereco="/setor-eletrico/rede/programado#p031"
      />
      <Numero
        variante="faixa"
        rotulo={tx("Mediana do desvio absoluto por hora", "Median absolute deviation per hour")}
        natureza="CALCULADO"
        valor={m?.p50_abs_mwmed ?? null}
        formato="num"
        casas={1}
        unidade={mw}
        periodo={periodo}
        cor="var(--serie-referencia)"
        nota={tx("Metade das horas teve desvio absoluto menor ou igual a este valor.", "Half of the hours had an absolute deviation less than or equal to this value.")}
        motivoAusencia={semHoras}
      />
      <Numero
        variante="faixa"
        rotulo={tx(`Horas com desvio de ${num(programado.limiar_material_mwmed, 0)} MWmed ou mais`, `Hours with a deviation of ${num(programado.limiar_material_mwmed, 0)} MWavg or more`)}
        natureza="CALCULADO"
        valor={m?.horas_materiais ?? null}
        formato="num"
        casas={0}
        unidade={horas}
        periodo={periodo}
        cor="var(--serie-5)"
        nota={deHoras}
        motivoAusencia={semHoras}
      />
      <Numero
        variante="faixa"
        rotulo={tx("Horas com o fluxo no sentido oposto ao programado", "Hours with the flow opposite to the schedule")}
        natureza="CALCULADO"
        valor={m?.horas_inversao ?? null}
        formato="num"
        casas={0}
        unidade={horas}
        periodo={periodo}
        cor="var(--serie-3)"
        nota={
          m
            ? tx(
                `Verificado e programado com sinais contrários, os dois acima de ${num(LIMIAR_NULO_MWMED, 0)} MWmed. ${deHoras}`,
                `Verified and scheduled with opposite signs, both above ${num(LIMIAR_NULO_MWMED, 0)} MWavg. ${deHoras}`,
              )
            : undefined
        }
        motivoAusencia={semHoras}
      />
    </FaixaMetricas>
  );
}

export function RedeProgramado({
  programado,
  fonte,
  versao,
  regraMaterialidade,
  notas,
  aposPrincipal,
}: {
  /** Regra de materialidade publicada na gold (limiar, sensibilidade e o que o desvio não é). */
  regraMaterialidade: string;
  programado: Pick<ProgramadoRede, "distribuicao" | "limiar_material_mwmed" | "limiares_sensibilidade_mwmed" | "programa_repetido" | "diario" | "mensal" | "maiores_desvios" | "maiores_desvios_fora_dos_dias_rotulados" | "inicio" | "fim" | "justificativa_limiar">;
  /** Fichas de prova do desvio absoluto médio por par (chave desvio_medio.<par>). */
  evidencias: Record<string, Evidencia>;
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel: o que mudou e a ressalva essencial), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
  /** Conteúdo depois das notas (os capítulos do módulo), antes das seções complementares. */
  aposPrincipal?: ReactNode;
}) {
  const idioma = useIdioma();
  const tx = useTx();
  const { dataBR, horaLocal, num } = formatos(idioma);
  const mw = tx("MWmed", "MWavg");
  const horas = tx("horas", "hours");
  const sim = tx("sim", "yes");
  const p = programado;
  const justificativaLimiar = p.justificativa_limiar;
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const par = v.par as ParProgramado;
  const base = v.base as BaseDesvio;
  const escolhidos = v.pares as ParProgramado[];
  const dist = useMemo(() => linhasDistribuicao(p, base, idioma), [p, base, idioma]);
  const diario = useMemo(() => linhasProgramadoDiario(p, par, idioma), [p, par, idioma]);
  const mensal = useMemo(() => linhasProgramadoMensal(p, par), [p, par]);
  const materiais = useMemo(() => linhasMateriaisMensal(p, escolhidos), [p, escolhidos]);
  const maiores = useMemo(() => linhasMaioresDesvios(base === "sem" ? p.maiores_desvios_fora_dos_dias_rotulados : p.maiores_desvios, idioma), [p, base, idioma]);
  const repetido = useMemo(() => linhasProgramaRepetido(p, idioma), [p, idioma]);
  const selecionar = (id: string | null) => id && (PARES_PROGRAMADO as readonly string[]).includes(id) && definir({ par: id as ParProgramado });
  // aviso só quando as horas comparadas do último mês ficam abaixo das do calendário
  const avisoUltimoMes = avisoMesIncompleto(p.mensal.meses.at(-1), p.mensal.por_par[par]?.horas.at(-1), idioma);
  const recorteBase = base === "sem" ? tx("sem os dias rotulados", "without the flagged days") : tx("todos os dias", "all days");

  return (
    <div className="space-y-6">
      <div className="grid gap-y-4">
        <RespostaCurta id="p031" vivo veredito={vereditoProgramado(p, par, base, idioma)}>
          {respostaProgramado(p, par, base, idioma)}
        </RespostaCurta>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <RedeEscolha legenda={tx("Fronteira ou país", "Boundary or country")} opcoes={opcoesPar(idioma)} valor={par} onEscolher={(x) => definir({ par: x })} />
          <RedeEscolha legenda={tx("Base", "Basis")} opcoes={opcoesBase(idioma)} valor={base} onEscolher={(x) => definir({ base: x })} />
        </div>
        <p className="max-w-prose2 text-sm text-carvao-muted" data-dia-rotulado="">
          {tx(
            <>
              Dia rotulado é um dia em que o mesmo valor programado se repetiu por {p.programa_repetido.minimo_horas} horas seguidas ou mais; &ldquo;Sem dias rotulados&rdquo; os deixa de fora, e só vale para as
              fronteiras entre subsistemas.
            </>,
            <>
              A flagged day is a day on which the same scheduled value repeated for {p.programa_repetido.minimo_horas} consecutive hours or more; &ldquo;Without flagged days&rdquo; leaves them
              out, and it only applies to the boundaries between subsystems.
            </>,
          )}
        </p>
      </div>

      <GraficoBarras
        titulo={tx(`Faixa dos desvios absolutos por hora, ${recorteBase}`, `Range of absolute deviations per hour, ${recorteBase}`)}
        dados={paraTabela(dist)}
        chaveCategoria="id"
        chaveRotulo="par"
        series={[
          { id: "p50_abs_mwmed", rotulo: tx("Mediana", "Median"), cor: "var(--escala-seq-2)" },
          { id: "p90_abs_mwmed", rotulo: tx("Percentil 90", "90th percentile"), cor: "var(--escala-seq-3)" },
          { id: "p99_abs_mwmed", rotulo: tx("Percentil 99", "99th percentile"), cor: "var(--escala-seq-4)" },
          { id: "max_abs_mwmed", rotulo: tx("Maior", "Largest"), cor: "var(--escala-seq-5)" },
        ]}
        unidade={mw}
        casas={0}
        orientacao="horizontal"
        referencias={[{ valor: p.limiar_material_mwmed, rotulo: tx("limiar material", "materiality threshold") }]}
        selecionado={par}
        onSelecionar={selecionar}
      />
      <TabelaInterativa
        titulo={tx(`Tabela equivalente: distribuição dos desvios por fronteira e país, ${recorteBase}`, `Equivalent table: distribution of deviations by boundary and country, ${recorteBase}`)}
        colunas={colunasDistribuicao(p, idioma)}
        linhas={paraTabela(dist)}
        chaveLinha="id"
        colunaRotulo="par"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`rede-desvios-distribuicao-${base}`}
        chaveUrl="dist"
        selecionado={par}
        onSelecionar={selecionar}
        nota={tx(
          `Viés positivo: o verificado ficou, em média, mais no sentido positivo do par do que o programa. Sentido oposto: programa e verificado com sinais contrários, os dois acima de ${num(LIMIAR_NULO_MWMED, 0)} MWmed.`,
          `Positive bias: the verified flow was, on average, further in the positive direction of the pair than the schedule. Opposite direction: schedule and verified with opposite signs, both above ${num(LIMIAR_NULO_MWMED, 0)} MWavg.`,
        )}
      />

      <div className="max-w-prose2 space-y-2 text-sm leading-relaxed text-carvao-muted">
        <p>
          <TrechoPortugues regiao="regra de materialidade da rede">{semCaminhosInternos(regraMaterialidade)}</TrechoPortugues>
        </p>
        {justificativaLimiar && (
          <p>
            <TrechoPortugues regiao="justificativa do limiar material">{justificativaLimiar}</TrechoPortugues>
          </p>
        )}
      </div>

      <GraficoLinhas
        titulo={tx(`Saldo programado e verificado por dia, ${nomePar(par, "pt")}`, `Scheduled and verified net flow by day, ${nomePar(par, "en")}`)}
        dados={diario}
        chaveX="d"
        formatoX="data"
        series={[
          { id: "verificado_mwh", rotulo: tx("Verificado", "Verified"), cor: COR_PAR[par] },
          { id: "programado_mwh", rotulo: tx("Programado", "Scheduled"), cor: "var(--serie-referencia)", tracejada: true },
        ]}
        unidade="MWh"
        casas={0}
        zeroNoEixo
        legendaInterativa
      />
      <p className="text-sm text-carvao-muted" data-sinal-do-saldo="">
        {tx(
          <>
            Saldo positivo: {sentidoPositivo(par, "pt")}; negativo: {sentidoNegativo(par, "pt")}.
          </>,
          <>
            Positive net flow: {sentidoPositivo(par, "en")}; negative: {sentidoNegativo(par, "en")}.
          </>,
        )}
      </p>
      <TabelaInterativa
        titulo={tx(`Tabela equivalente: ${nomePar(par, "pt")} por dia`, `Equivalent table: ${nomePar(par, "en")} by day`)}
        colunas={colunasProgramadoDiario(idioma)}
        linhas={paraTabela(diario)}
        chaveLinha="id"
        colunaRotulo="d"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`rede-programado-diario-${par}`}
        chaveUrl="d30.p"
        ordemInicial={{ coluna: "d", direcao: "desc" }}
        nota={tx(
          "Saldos do dia somados com sinal; a soma dos desvios absolutos usa o módulo de cada hora e por isso pode ser maior que a diferença entre os saldos.",
          "Daily net flows summed with their sign; the sum of absolute deviations uses the absolute value of each hour and so can be larger than the difference between the net flows.",
        )}
      />

      <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="rotulo text-mineral">{tx("Período", "Period")}</dt>
          <dd className="mt-0.5">
            {tx(
              <>
                {dataBR(p.inicio)} a {dataBR(p.fim)}, hora a hora (a fonte não publica programado antes de {dataBR(p.inicio)}); série diária dos últimos {p.diario.dias.length} dias
              </>,
              <>
                {dataBR(p.inicio)} to {dataBR(p.fim)}, hour by hour (the source does not publish scheduled values before {dataBR(p.inicio)}); daily series for the last{" "}
                {p.diario.dias.length} days
              </>,
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="rotulo text-mineral">{tx("Universo", "Scope")}</dt>
          <dd className="mt-0.5">
            {nomePar(par, idioma)}
            {ehFronteira(par)
              ? tx(`; positivo ${sentidoPositivo(par, "pt")}`, `; positive ${sentidoPositivo(par, "en")}`)
              : tx("; positivo é exportação do Brasil", "; positive is export from Brazil")}
            {base === "sem" ? tx("; sem os dias rotulados por programa repetido", "; without the days flagged for a repeated schedule") : tx("; todos os dias comparados", "; all compared days")}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="rotulo text-mineral">{tx("Unidade", "Unit")}</dt>
          <dd className="mt-0.5">
            {tx(
              "MWmed por hora (desvio = verificado − programado); MWh nas somas diárias e mensais",
              "MWavg per hour (deviation = verified − scheduled); MWh in the daily and monthly sums",
            )}
          </dd>
        </div>
      </dl>

      {notas}

      {aposPrincipal}

      <SecaoDoPainel
        id="maiores-desvios"
        titulo={tx(
          `Quais foram as horas de maior desvio${base === "sem" ? ", fora dos dias rotulados" : ""}?`,
          `Which were the hours with the largest deviation${base === "sem" ? ", outside the flagged days" : ""}?`,
        )}
        lead={tx(
          `São as ${maiores.length} horas em que o fluxo medido mais se afastou do programado, cada uma com o programado, o verificado e o desvio. As cinco primeiras estão abaixo; a tabela traz todas.`,
          `These are the ${maiores.length} hours in which the measured flow deviated most from the schedule, each with the scheduled value, the verified value and the deviation. The first five are below; the table has all of them.`,
        )}
      >
        <ol className="max-w-prose2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-carvao" data-maiores-desvios="">
          {maiores.slice(0, 5).map((l) => (
            <li key={l.id}>
              {tx(
                <>
                  {horaLocal(l.hora)}, {l.par}: desvio de {num(l.desvio_mwmed, 1)} MWmed (verificado {num(l.verificado_mwmed, 1)}, programado {num(l.programado_mwmed, 1)})
                  {l.dia_rotulado === "sim" ? "; dia rotulado por programa repetido" : ""}
                  {l.inversao === "sim" ? "; sentido oposto ao programa" : ""}.
                </>,
                <>
                  {horaLocal(l.hora)}, {l.par}: deviation of {num(l.desvio_mwmed, 1)} MWavg (verified {num(l.verificado_mwmed, 1)}, scheduled {num(l.programado_mwmed, 1)})
                  {l.dia_rotulado === sim ? "; day flagged for a repeated schedule" : ""}
                  {l.inversao === sim ? "; opposite to the schedule" : ""}.
                </>,
              )}
            </li>
          ))}
        </ol>
        <TabelaInterativa
          titulo={tx(
            `Os ${maiores.length} maiores desvios absolutos${base === "sem" ? " fora dos dias rotulados" : ""}`,
            `The ${maiores.length} largest absolute deviations${base === "sem" ? " outside the flagged days" : ""}`,
          )}
          colunas={colunasMaioresDesvios(idioma)}
          linhas={paraTabela(maiores)}
          chaveLinha="id"
          colunaRotulo="hora"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`rede-maiores-desvios-${base}`}
          chaveUrl="md"
          nota={tx(
            "Cada linha diz se a hora é de dia rotulado por programa repetido; nos países a regra não rotula dias (não se aplica). Troque a base para ver a lista sem esses dias.",
            "Each row says whether the hour is on a day flagged for a repeated schedule; for the countries the rule does not flag days (not applicable). Switch the basis to see the list without those days.",
          )}
        />
      </SecaoDoPainel>

      <SecaoDoPainel
        id="mes-a-mes"
        titulo={tx("Em quantas horas por mês o desvio foi material?", "In how many hours per month was the deviation material?")}
        lead={tx(
          `Horas com desvio de ${num(p.limiar_material_mwmed, 0)} MWmed ou mais, por mês, para até quatro fronteiras ou países na mesma escala.`,
          `Hours with a deviation of ${num(p.limiar_material_mwmed, 0)} MWavg or more, by month, for up to four boundaries or countries on the same scale.`,
        )}
      >
        <Comparador
          rotulo={tx(`Pares no gráfico (até ${LIMITE_COMPARACAO})`, `Pairs in the chart (up to ${LIMITE_COMPARACAO})`)}
          entidades={PARES_PROGRAMADO.map((x) => ({ id: x, rotulo: nomePar(x, idioma), sinonimos: [curtoPar(x, idioma)] }))}
          selecionadas={escolhidos}
          onMudar={(ids) => definir({ pares: ids as ParProgramado[] })}
          dicaBusca={tx("Buscar, por exemplo Norte, Sul, Argentina", "Search, for example North, South, Argentina")}
          vazio={tx("Nenhum par escolhido. Escolha até quatro para ver as horas materiais na mesma escala.", "No pair chosen. Choose up to four to see the material hours on the same scale.")}
        >
          {() => null}
        </Comparador>
        {escolhidos.length > 0 && (
          <>
            <GraficoLinhas
              titulo={tx(
                `Horas com desvio de ${num(p.limiar_material_mwmed, 0)} MWmed ou mais, por mês`,
                `Hours with a deviation of ${num(p.limiar_material_mwmed, 0)} MWavg or more, by month`,
              )}
              dados={materiais}
              chaveX="m"
              formatoX="mes"
              series={escolhidos.map((x) => ({ id: x, rotulo: nomePar(x, idioma), sigla: curtoPar(x, idioma), cor: COR_PAR[x] }))}
              unidade={horas}
              casas={0}
              zeroNoEixo
            />
            <TabelaInterativa
              titulo={tx("Tabela equivalente: horas materiais por mês", "Equivalent table: material hours by month")}
              colunas={[
                { id: "m", rotulo: tx("Mês", "Month"), tipo: "data" as const },
                ...escolhidos.map((x) => ({ id: x, rotulo: nomePar(x, idioma), tipo: "numero" as const, unidade: horas, casas: 0 })),
              ]}
              linhas={paraTabela(materiais)}
              chaveLinha="id"
              colunaRotulo="m"
              fonte={fonte}
              versao={versao}
              nomeArquivo={`rede-horas-materiais-${escolhidos.join("-")}`}
              chaveUrl="mm"
              ordemInicial={{ coluna: "m", direcao: "desc" }}
            />
          </>
        )}
        {avisoUltimoMes && <p className="text-sm text-carvao-muted">{avisoUltimoMes}</p>}
        <TabelaInterativa
          titulo={tx(`Tabela por mês: ${nomePar(par, "pt")}`, `Table by month: ${nomePar(par, "en")}`)}
          colunas={colunasProgramadoMensal(par, idioma)}
          linhas={paraTabela(mensal)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`rede-programado-mensal-${par}`}
          chaveUrl="mp.t"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
        />
      </SecaoDoPainel>

      <SecaoDoPainel id="programa-repetido" nivel="analisar" titulo={tx("Programa repetido: dias rotulados", "Repeated schedule: flagged days")}>
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-resposta="p031-repetido" data-resposta-depois="">
          {textoProgramaRepetido(p, idioma)}
        </p>
        <p className="text-sm text-carvao-muted">
          <TrechoPortugues regiao="regra do programa repetido">{p.programa_repetido.regra}</TrechoPortugues>
        </p>
        <TabelaInterativa
          titulo={tx("Dias rotulados, por fronteira", "Flagged days, by boundary")}
          colunas={colunasProgramaRepetido(idioma)}
          linhas={paraTabela(repetido)}
          chaveLinha="id"
          colunaRotulo="fronteira"
          fonte={fonte}
          versao={versao}
          nomeArquivo="rede-programa-repetido"
          chaveUrl="rep"
          semLinhas={tx("Nenhum dia rotulado por programa repetido.", "No day flagged for a repeated schedule.")}
        />
      </SecaoDoPainel>
    </div>
  );
}
