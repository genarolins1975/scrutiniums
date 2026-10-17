"use client";

import Link from "@/components/i18n/LinkIdioma";
import { useMemo, useRef } from "react";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { LinkDoPainel } from "@/components/energia/LinkDoPainel";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, nomeSubmercado } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";
import { LIMIAR_SEPARACAO, textoPicoFrenteAoLimite, textoPonteLimiar, type PonteSeparacao } from "@/lib/energia/pld";
import { MIME_CSV, gerarCsv, nomeArquivo, type ColunaTabela } from "@/lib/energia/tabela";
import type { RegimeLimites } from "@/lib/energia/tipos-pld";

type StatSm = {
  media: number;
  min: number;
  quando_min: string;
  max: number;
  quando_max: string;
  desvio_padrao: number | null;
  permanencia: { baixa: number; central: number; alta: number };
  frac_menor_valor_ano: number;
};

export type PeriodoPld = {
  id: string;
  rotulo: string;
  inicio: string;
  fim: string;
  nHoras: number;
  stats: Record<"SE" | "S" | "NE" | "N", StatSm>;
  diferenca: { horas_acima_limiar: number; frac_horas_acima_limiar: number; maior: number; quando_maior: string };
  serie: Record<string, string | number | null>[];
  formatoX: "hora" | "data" | "mes";
  descricaoSerie: string;
};

// Sul e Norte levam traço, SE/CO e Nordeste linha cheia: as quatro séries deixam de depender só do matiz (roxo e azul, verde e laranja)
const SMS = [
  { id: "SE", cor: "var(--serie-sm-se)", tracejada: false },
  { id: "S", cor: "var(--serie-sm-s)", tracejada: true },
  { id: "NE", cor: "var(--serie-sm-ne)", tracejada: false },
  { id: "N", cor: "var(--serie-sm-n)", tracejada: true },
] as const;

/** Nome do submercado no idioma da página (Sudeste/Centro-Oeste, Sul, Nordeste, Norte). */
const rotuloSm = (id: string, idioma: Idioma) => nomeSubmercado(id, idioma);
/** Sigla curta da série: SE/CO no português, SE/CW no inglês; as demais são o próprio código. */
const siglaSm = (id: string, idioma: Idioma) => (id === "SE" ? tx("SE/CO", "SE/CW", idioma) : id);
const LOCALE_NUM: Record<Idioma, string> = { pt: "pt-BR", en: "en-US" }; // i18n: dado

const n = (v: number | null | undefined, c = 2, idioma: Idioma = "pt") =>
  v === null || v === undefined ? tx("sem dado", "no data", idioma) : v.toLocaleString(LOCALE_NUM[idioma], { minimumFractionDigits: c, maximumFractionDigits: c });
const p = (v: number, idioma: Idioma = "pt") => `${(v * 100).toLocaleString(LOCALE_NUM[idioma], { maximumFractionDigits: 1 })}%`;
/**
 * Submercados cujas linhas se sobrepõem no gráfico: em todos os pontos do período, a
 * distância entre eles fica abaixo de 0,5% da amplitude do eixo. Devolve cada grupo com a
 * maior distância observada, para a nota dizer o número em vez de afirmar igualdade.
 */
function sobrepostos(serie: Record<string, string | number | null>[]): { ids: string[]; maior: number }[] {
  const vals = serie.flatMap((r) => SMS.map((s) => r[s.id])).filter((v): v is number => typeof v === "number");
  if (!vals.length) return [];
  const tol = Math.max(0.005, 0.005 * (Math.max(...vals) - Math.min(...vals)));
  const dist = (a: string, b: string) => {
    let m = 0;
    for (const r of serie) {
      const x = r[a];
      const y = r[b];
      if (x === null || y === null) {
        if (x !== y) return Infinity;
        continue;
      }
      m = Math.max(m, Math.abs(Number(x) - Number(y)));
    }
    return m;
  };
  const grupos: { ids: string[]; maior: number }[] = [];
  for (const s of SMS) {
    const g = grupos.find((grupo) => grupo.ids.every((id) => dist(id, s.id) <= tol));
    if (g) {
      g.maior = Math.max(g.maior, ...g.ids.map((id) => dist(id, s.id)));
      g.ids.push(s.id);
    } else grupos.push({ ids: [s.id], maior: 0 });
  }
  return grupos.filter((g) => g.ids.length > 1);
}

const quando = (s: string, idioma: Idioma = "pt") =>
  tx(`${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)} ${s.slice(11, 13)}h`, `${dataBR(s, "en")} at ${s.slice(11, 13)}h`, idioma);

/** Colunas do arquivo do período escolhido: o momento (hora, dia ou mês, em ISO) e o PLD dos quatro submercados. */
function colunasRecorte(idioma: Idioma): ColunaTabela[] {
  return [
    { id: "x", rotulo: tx("Momento", "Time", idioma), tipo: "texto" },
    ...SMS.map((s) => ({ id: s.id, rotulo: `PLD ${rotuloSm(s.id, idioma)}`, tipo: "numero" as const, unidade: "R$/MWh", casas: 2 })),
  ];
}

function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const COR_LINK = "inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao";

/**
 * O que está acontecendo, por período: dia de referência | 7 dias | 30 dias | 12 meses |
 * Histórico. Todas as respostas vêm de regras publicadas (ver "Como
 * classificamos"); a tabela abaixo do gráfico é a mesma informação em texto.
 *
 * O período escolhido fica na URL (?per=), junto com o modo de profundidade e a âncora, e o link copiado leva o recorte. O arquivo do
 * período baixa só a série que o gráfico mostra, com a mesma formatação das tabelas do observatório.
 */
export function PldPeriodos({
  periodos,
  limiar,
  ponte,
  regimes = [],
  versao,
  notaMenorValor,
}: {
  periodos: PeriodoPld[];
  limiar: number;
  /** Contagem de separação (R$ 0,01/MWh) da gold regional por período, para ligar os dois critérios quando o período existe lá. */
  ponte?: Record<string, PonteSeparacao | undefined>;
  /** Limites vigentes por trecho: o máximo do período diz quando é igual ao teto horário do ato. */
  regimes?: RegimeLimites[];
  fonte: string;
  versao: string;
  /** Frase sobre o menor valor horário do ano e o piso do ato (conferida na gold de limites). */
  notaMenorValor?: string | null;
}) {
  const ids = periodos.map((x) => x.id);
  const esquema = useMemo(
    () => ({ per: campo(tiposUrl.opcao(ids), ids[0] ?? "") }),
    // os períodos são os mesmos em todo o build
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids.join(",")],
  );
  const [v, definir] = useEstadoUrl(esquema);
  const idioma = useIdioma();
  const tx = useTx();
  const inteiro = (x: number) => x.toLocaleString(LOCALE_NUM[idioma]);
  const sel = v.per as string;
  const abas = useRef<(HTMLButtonElement | null)[]>([]);
  const at = periodos.find((x) => x.id === sel) ?? periodos[0];
  // padrão de abas: setas, Home e End movem a seleção e o foco
  function teclado(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = periodos.length;
    const j =
      e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    definir({ per: periodos[j].id });
    abas.current[j]?.focus();
  }
  const d = at.diferenca;
  const pico = textoPicoFrenteAoLimite(at.stats.SE.max, at.stats.SE.quando_max, regimes, idioma);
  // marca do dia (ou da hora) do máximo horário do SE/CO: nas abas de médias, o pico não aparece na curva e a marca diz onde ele ocorreu
  const xMax = at.formatoX === "hora" ? at.stats.SE.quando_max : at.formatoX === "data" ? at.stats.SE.quando_max.slice(0, 10) : at.stats.SE.quando_max.slice(0, 7);
  const mediasNoGrafico = at.formatoX !== "hora";

  function baixarRecorte() {
    const linhas = at.serie.map((r) => ({ x: String(r.x), SE: r.SE, S: r.S, NE: r.NE, N: r.N }));
    baixar(nomeArquivo(`pld-periodo-${at.id}`, [], "csv", versao), gerarCsv(colunasRecorte(idioma), linhas), MIME_CSV);
  }

  return (
    <div>
      <div role="tablist" aria-label={tx("Período", "Period")} className="flex flex-wrap gap-1 border-b border-linha">
        {periodos.map((x, i) => (
          <button
            key={x.id}
            ref={(el) => {
              abas.current[i] = el;
            }}
            id={`pld-aba-${x.id}`}
            role="tab"
            type="button"
            aria-selected={at.id === x.id}
            aria-controls="pld-periodo-painel"
            tabIndex={at.id === x.id ? 0 : -1}
            onClick={() => definir({ per: x.id })}
            onKeyDown={(e) => teclado(e, i)}
            className={`rotulo min-h-[44px] border-b-2 px-3 ${at.id === x.id ? "border-energia text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"}`}
          >
            {x.rotulo}
          </button>
        ))}
      </div>
      <div id="pld-periodo-painel" role="tabpanel" aria-labelledby={`pld-aba-${at.id}`} className="pt-5">
        <p className="text-xs text-mineral">
          {tx(
            `${quando(at.inicio)} a ${quando(at.fim)} · ${at.nHoras.toLocaleString("pt-BR")} horas · `,
            `${quando(at.inicio, idioma)} to ${quando(at.fim, idioma)} · ${inteiro(at.nHoras)} hours · `,
          )}
          {at.descricaoSerie}
        </p>
        <div className="mt-3">
          <GraficoLinhas
            titulo={tx(`PLD dos quatro submercados, ${at.rotulo.toLowerCase()}`, `PLD of the four submarkets, ${at.rotulo.charAt(0).toLowerCase()}${at.rotulo.slice(1)}`)}
            dados={at.serie}
            chaveX="x"
            series={SMS.map((s) => ({ id: s.id, rotulo: rotuloSm(s.id, idioma), sigla: siglaSm(s.id, idioma), cor: s.cor, tracejada: s.tracejada }))}
            unidade="R$/MWh"
            casas={2}
            formatoX={at.formatoX}
            altura={280}
            marcos={[
              {
                x: xMax,
                rotulo: tx(
                  `máximo horário do SE/CO${mediasNoGrafico ? "" : `: ${n(at.stats.SE.max)}`}`,
                  `hourly maximum in SE/CW${mediasNoGrafico ? "" : `: ${n(at.stats.SE.max, 2, idioma)}`}`,
                ),
              },
            ]}
          />
        </div>
        {at.serie.length > 0 &&
          sobrepostos(at.serie).map((g) => {
            const nomes = g.ids
              .map((id) => rotuloSm(id, idioma))
              .join(", ")
              .replace(/, ([^,]*)$/, tx(" e $1", " and $1"));
            return (
              <p key={g.ids.join("-")} className="mt-2 text-xs text-carvao-muted">
                {g.maior === 0
                  ? tx(
                      `${nomes} tiveram o mesmo valor em todos os pontos deste período: as linhas se sobrepõem no gráfico.`,
                      `${nomes} had the same value at every point in this period: the lines overlap in the chart.`,
                    )
                  : tx(
                      `${nomes} ficaram a no máximo R$ ${n(g.maior)}/MWh um do outro em todos os pontos deste período: no gráfico, as linhas se sobrepõem. Os valores de cada um estão na tabela.`,
                      `${nomes} stayed within R$ ${n(g.maior, 2, idioma)}/MWh of each other at every point in this period: in the chart, the lines overlap. The values for each one are in the table.`,
                    )}
              </p>
            );
          })}
        <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-0">
          <button type="button" onClick={baixarRecorte} className={COR_LINK}>
            {tx("Baixar este período (CSV)", "Download this period (CSV)")}
          </button>
          <LinkDoPainel ancora="periodos" rotulo={tx("Copiar link deste período", "Copy link to this period")} />
        </div>

        <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-mineral">
          {tx(
            "Respostas e estatísticas abaixo: calculadas pela Scrutiniums a partir dos valores horários publicados pela CCEE",
            "Answers and statistics below: calculated by Scrutiniums from the hourly values published by CCEE",
          )}
          <SeloNatureza natureza="CALCULADO" />
        </p>
        <dl className="mt-2 grid gap-px border border-linha bg-linha md:grid-cols-3">
          <div className="bg-superficie p-4">
            <dt className="rotulo text-mineral">{tx("Há diferença entre submercados?", "Is there a difference between submarkets?")}</dt>
            <dd className="mt-1 text-sm text-carvao">
              {d.horas_acima_limiar === 0
                ? tx(
                    `Não: nenhuma hora com diferença acima de R$ ${n(limiar, 2)}/MWh entre o maior e o menor preço da hora.`,
                    `No: no hour with a difference above R$ ${n(limiar, 2, idioma)}/MWh between the highest and the lowest price of the hour.`,
                  )
                : tx(
                    `Sim, em ${d.horas_acima_limiar.toLocaleString("pt-BR")} horas (${p(d.frac_horas_acima_limiar)}) a diferença entre o maior e o menor preço da hora passou de R$ ${n(limiar, 2)}/MWh. Maior diferença: R$ ${n(d.maior)}/MWh em ${quando(d.quando_maior)}.`,
                    `Yes, in ${inteiro(d.horas_acima_limiar)} hours (${p(d.frac_horas_acima_limiar, idioma)}) the difference between the highest and the lowest price of the hour exceeded R$ ${n(limiar, 2, idioma)}/MWh. Largest difference: R$ ${n(d.maior, 2, idioma)}/MWh on ${quando(d.quando_maior, idioma)}.`,
                  )}
              <span className="mt-1 block text-xs text-mineral" data-texto="criterio-da-diferenca">
                {textoPonteLimiar(limiar, ponte?.[at.id], idioma)}{" "}
                <Link href="/setor-eletrico/pld/diferencas-regionais" className="underline underline-offset-4">
                  {tx("Abrir Diferenças regionais", "Open Regional differences")}
                </Link>
                .
              </span>
            </dd>
          </div>
          <div className="bg-superficie p-4">
            <dt className="rotulo text-mineral">{tx("Quanto do período ficou no menor valor horário do ano?", "How much of the period was at the lowest hourly value of the year?")}</dt>
            <dd className="mt-1 text-sm text-carvao">
              {SMS.map((s) => `${siglaSm(s.id, idioma)} ${p(at.stats[s.id].frac_menor_valor_ano, idioma)}`).join(" · ")}
              {tx(` das ${at.nHoras.toLocaleString("pt-BR")} horas do período.`, ` of the ${inteiro(at.nHoras)} hours in the period.`)}
              <span className="mt-1 block text-xs text-mineral">
                {notaMenorValor
                  ? `${notaMenorValor} `
                  : tx("O menor valor horário observado no ano não é o piso regulatório. ", "The lowest hourly value observed in the year is not the regulatory floor. ")}
                {tx("O piso de cada ano está na", "The floor for each year is on the")}{" "}
                <Link href="/setor-eletrico/pld/limites" className="underline underline-offset-4">
                  {tx("página de limites", "limits page")}
                </Link>
                .
              </span>
            </dd>
          </div>
          <div className="bg-superficie p-4">
            <dt className="rotulo text-mineral">{tx("Houve picos?", "Were there spikes?")}</dt>
            <dd className="mt-1 text-sm text-carvao">
              {tx(
                `Máximo no Sudeste/Centro-Oeste: R$ ${n(at.stats.SE.max)}/MWh em ${quando(at.stats.SE.quando_max)}`,
                `Maximum in ${rotuloSm("SE", idioma)}: R$ ${n(at.stats.SE.max, 2, idioma)}/MWh on ${quando(at.stats.SE.quando_max, idioma)}`,
              )}
              {pico ? `, ${pico}` : ""}.
              {mediasNoGrafico && (
                <span className="mt-1 block text-xs text-mineral" data-texto="picos-fora-do-grafico">
                  {at.formatoX === "data"
                    ? tx(
                        "O gráfico desta aba mostra médias diárias, e o máximo é um valor horário: a marca vertical indica o dia em que ele ocorreu.",
                        "The chart in this tab shows daily averages, and the maximum is an hourly value: the vertical mark shows the day on which it occurred.",
                      )
                    : tx(
                        "O gráfico desta aba mostra médias mensais, e o máximo é um valor horário: a marca vertical indica o mês em que ele ocorreu.",
                        "The chart in this tab shows monthly averages, and the maximum is an hourly value: the vertical mark shows the month in which it occurred.",
                      )}
                </span>
              )}
            </dd>
          </div>
        </dl>

        <div
          className="tabela-scroll mt-5"
          tabIndex={0}
          role="region"
          aria-label={tx("Estatísticas do período por submercado (rolável)", "Statistics for the period by submarket (scrollable)")}
        >
          <table className="w-full border-collapse text-sm tabular-nums sm:min-w-[40rem]">
            <caption className="sr-only">{tx("Estatísticas do PLD no período por submercado", "PLD statistics for the period by submarket")}</caption>
            <thead>
              <tr className="text-left text-xs text-mineral">
                <th scope="col" className="border-b border-linha py-2 pr-3 font-medium">
                  {tx("Submercado", "Submarket")}
                </th>
                <th scope="col" className="border-b border-linha px-2 py-2 font-medium">
                  {tx("Média", "Average")}
                </th>
                <th scope="col" className="border-b border-linha px-2 py-2 font-medium">
                  {tx("Mínimo", "Minimum")}
                </th>
                <th scope="col" className="border-b border-linha px-2 py-2 font-medium">
                  {tx("Máximo", "Maximum")}
                </th>
                <th scope="col" className="hidden border-b border-linha px-2 py-2 font-medium sm:table-cell">
                  {tx("Volatilidade (desvio padrão)", "Volatility (standard deviation)")}
                </th>
                <th scope="col" className="hidden border-b border-linha px-2 py-2 font-medium sm:table-cell">
                  {tx("Horas em faixa baixa · central · alta", "Hours in low · central · high band")}
                </th>
              </tr>
            </thead>
            <tbody>
              {SMS.flatMap((s) => {
                const st = at.stats[s.id];
                const faixas = `${p(st.permanencia.baixa, idioma)} · ${p(st.permanencia.central, idioma)} · ${p(st.permanencia.alta, idioma)}`;
                const rotulo = rotuloSm(s.id, idioma);
                return [
                  <tr key={s.id} className="border-b border-linha max-sm:border-b-0">
                    <th scope="row" className="py-2 pr-3 text-left font-normal text-carvao">
                      <span aria-hidden="true" className="mr-2 inline-block h-2 w-2" style={{ background: s.cor }} />
                      <span className="sm:hidden">
                        <abbr title={rotulo} className="no-underline">
                          {siglaSm(s.id, idioma)}
                        </abbr>
                      </span>
                      <span className="hidden sm:inline">{rotulo}</span>
                    </th>
                    <td className="px-2 py-2 text-carvao">R$&nbsp;{n(st.media, 2, idioma)}</td>
                    <td className="px-2 py-2 text-carvao">R$&nbsp;{n(st.min, 2, idioma)}</td>
                    <td className="px-2 py-2 text-carvao">R$&nbsp;{n(st.max, 2, idioma)}</td>
                    <td className="hidden px-2 py-2 text-carvao sm:table-cell">R$&nbsp;{n(st.desvio_padrao, 2, idioma)}</td>
                    <td className="hidden px-2 py-2 text-carvao sm:table-cell">{faixas}</td>
                  </tr>,
                  // celular: volatilidade e faixas descem para uma segunda linha do mesmo submercado, em vez de empurrar colunas para fora da tela
                  <tr key={`${s.id}-mais`} className="border-b border-linha sm:hidden">
                    <td colSpan={4} className="px-2 pb-2 pt-0 text-xs text-carvao-muted">
                      {tx(
                        `Volatilidade (desvio padrão): R$ ${n(st.desvio_padrao)}. Horas em faixa baixa · central · alta: ${faixas}.`,
                        `Volatility (standard deviation): R$ ${n(st.desvio_padrao, 2, idioma)}. Hours in low · central · high band: ${faixas}.`,
                      )}
                    </td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-mineral">
          {tx(
            `Valores em R$/MWh nominais. Faixas: abaixo do 25º percentil, entre o 25º e o 75º e acima do 75º percentil da distribuição horária de cada submercado desde 01/01/2021. Diferença entre submercados: critério de R$ ${n(limiar, 2)}/MWh nesta página e de R$ ${n(LIMIAR_SEPARACAO, 2)}/MWh em Diferenças regionais.`,
            `Values in nominal R$/MWh. Bands: below the 25th percentile, between the 25th and the 75th, and above the 75th percentile of the hourly distribution of each submarket since ${dataBR("2021-01-01", "en")}. Difference between submarkets: criterion of R$ ${n(limiar, 2, idioma)}/MWh on this page and of R$ ${n(LIMIAR_SEPARACAO, 2, idioma)}/MWh in Regional differences.`,
          )}
        </p>
      </div>
    </div>
  );
}
