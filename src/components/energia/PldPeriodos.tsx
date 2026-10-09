"use client";

import Link from "next/link";
import { useMemo, useRef } from "react";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { LinkDoPainel } from "@/components/energia/LinkDoPainel";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
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
  { id: "SE", rotulo: "Sudeste/Centro-Oeste", sigla: "SE/CO", cor: "var(--serie-sm-se)", tracejada: false },
  { id: "S", rotulo: "Sul", sigla: "S", cor: "var(--serie-sm-s)", tracejada: true },
  { id: "NE", rotulo: "Nordeste", sigla: "NE", cor: "var(--serie-sm-ne)", tracejada: false },
  { id: "N", rotulo: "Norte", sigla: "N", cor: "var(--serie-sm-n)", tracejada: true },
] as const;

const n = (v: number | null | undefined, c = 2) =>
  v === null || v === undefined ? "sem dado" : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
const p = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
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

const quando = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)} ${s.slice(11, 13)}h`;

/** Colunas do arquivo do período escolhido: o momento (hora, dia ou mês, em ISO) e o PLD dos quatro submercados. */
const COLUNAS_RECORTE: ColunaTabela[] = [
  { id: "x", rotulo: "Momento", tipo: "texto" },
  { id: "SE", rotulo: "PLD Sudeste/Centro-Oeste", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "S", rotulo: "PLD Sul", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "NE", rotulo: "PLD Nordeste", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "N", rotulo: "PLD Norte", tipo: "numero", unidade: "R$/MWh", casas: 2 },
];

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
  const pico = textoPicoFrenteAoLimite(at.stats.SE.max, at.stats.SE.quando_max, regimes);
  // marca do dia (ou da hora) do máximo horário do SE/CO: nas abas de médias, o pico não aparece na curva e a marca diz onde ele ocorreu
  const xMax = at.formatoX === "hora" ? at.stats.SE.quando_max : at.formatoX === "data" ? at.stats.SE.quando_max.slice(0, 10) : at.stats.SE.quando_max.slice(0, 7);
  const mediasNoGrafico = at.formatoX !== "hora";

  function baixarRecorte() {
    const linhas = at.serie.map((r) => ({ x: String(r.x), SE: r.SE, S: r.S, NE: r.NE, N: r.N }));
    baixar(nomeArquivo(`pld-periodo-${at.id}`, [], "csv", versao), gerarCsv(COLUNAS_RECORTE, linhas), MIME_CSV);
  }

  return (
    <div>
      <div role="tablist" aria-label="Período" className="flex flex-wrap gap-1 border-b border-linha">
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
          {quando(at.inicio)} a {quando(at.fim)} · {at.nHoras.toLocaleString("pt-BR")} horas · {at.descricaoSerie}
        </p>
        <div className="mt-3">
          <GraficoLinhas
            titulo={`PLD dos quatro submercados, ${at.rotulo.toLowerCase()}`}
            dados={at.serie}
            chaveX="x"
            series={SMS.map((s) => ({ id: s.id, rotulo: s.rotulo, sigla: s.sigla, cor: s.cor, tracejada: s.tracejada }))}
            unidade="R$/MWh"
            casas={2}
            formatoX={at.formatoX}
            altura={280}
            marcos={[{ x: xMax, rotulo: `máximo horário do SE/CO${mediasNoGrafico ? "" : `: ${n(at.stats.SE.max)}`}` }]}
          />
        </div>
        {at.serie.length > 0 &&
          sobrepostos(at.serie).map((g) => {
            const nomes = g.ids.map((id) => SMS.find((s) => s.id === id)!.rotulo).join(", ").replace(/, ([^,]*)$/, " e $1");
            return (
              <p key={g.ids.join("-")} className="mt-2 text-xs text-carvao-muted">
                {g.maior === 0
                  ? `${nomes} tiveram o mesmo valor em todos os pontos deste período: as linhas se sobrepõem no gráfico.`
                  : `${nomes} ficaram a no máximo R$ ${n(g.maior)}/MWh um do outro em todos os pontos deste período: no gráfico, as linhas se sobrepõem. Os valores de cada um estão na tabela.`}
              </p>
            );
          })}
        <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-0">
          <button type="button" onClick={baixarRecorte} className={COR_LINK}>
            Baixar este período (CSV)
          </button>
          <LinkDoPainel ancora="periodos" rotulo="Copiar link deste período" />
        </div>

        <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-mineral">
          Respostas e estatísticas abaixo: calculadas pela Scrutiniums a partir dos valores horários publicados pela CCEE
          <SeloNatureza natureza="CALCULADO" />
        </p>
        <dl className="mt-2 grid gap-px border border-linha bg-linha md:grid-cols-3">
          <div className="bg-superficie p-4">
            <dt className="rotulo text-mineral">Há diferença entre submercados?</dt>
            <dd className="mt-1 text-sm text-carvao">
              {d.horas_acima_limiar === 0
                ? `Não: nenhuma hora com diferença acima de R$ ${n(limiar, 2)}/MWh entre o maior e o menor preço da hora.`
                : `Sim, em ${d.horas_acima_limiar.toLocaleString("pt-BR")} horas (${p(d.frac_horas_acima_limiar)}) a diferença entre o maior e o menor preço da hora passou de R$ ${n(limiar, 2)}/MWh. Maior diferença: R$ ${n(d.maior)}/MWh em ${quando(d.quando_maior)}.`}
              <span className="mt-1 block text-xs text-mineral" data-texto="criterio-da-diferenca">
                {textoPonteLimiar(limiar, ponte?.[at.id])}{" "}
                <Link href="/setor-eletrico/pld/diferencas-regionais" className="underline underline-offset-4">
                  Abrir Diferenças regionais
                </Link>
                .
              </span>
            </dd>
          </div>
          <div className="bg-superficie p-4">
            <dt className="rotulo text-mineral">Quanto do período ficou no menor valor horário do ano?</dt>
            <dd className="mt-1 text-sm text-carvao">
              {SMS.map((s) => `${s.id === "SE" ? "SE/CO" : s.id} ${p(at.stats[s.id].frac_menor_valor_ano)}`).join(" · ")} das {at.nHoras.toLocaleString("pt-BR")} horas do período.
              <span className="mt-1 block text-xs text-mineral">
                {notaMenorValor ? `${notaMenorValor} ` : "O menor valor horário observado no ano não é o piso regulatório. "}O piso de cada ano está na{" "}
                <Link href="/setor-eletrico/pld/limites" className="underline underline-offset-4">
                  página de limites
                </Link>
                .
              </span>
            </dd>
          </div>
          <div className="bg-superficie p-4">
            <dt className="rotulo text-mineral">Houve picos?</dt>
            <dd className="mt-1 text-sm text-carvao">
              Máximo no Sudeste/Centro-Oeste: R$&nbsp;{n(at.stats.SE.max)}/MWh em {quando(at.stats.SE.quando_max)}
              {pico ? `, ${pico}` : ""}.
              {mediasNoGrafico && (
                <span className="mt-1 block text-xs text-mineral" data-texto="picos-fora-do-grafico">
                  O gráfico desta aba mostra médias {at.formatoX === "data" ? "diárias" : "mensais"}, e o máximo é um valor horário: a marca vertical indica o {at.formatoX === "data" ? "dia" : "mês"} em que ele ocorreu.
                </span>
              )}
            </dd>
          </div>
        </dl>

        <div className="tabela-scroll mt-5" tabIndex={0} role="region" aria-label="Estatísticas do período por submercado (rolável)">
          <table className="w-full border-collapse text-sm tabular-nums sm:min-w-[40rem]">
            <caption className="sr-only">Estatísticas do PLD no período por submercado</caption>
            <thead>
              <tr className="text-left text-xs text-mineral">
                <th scope="col" className="border-b border-linha py-2 pr-3 font-medium">Submercado</th>
                <th scope="col" className="border-b border-linha px-2 py-2 font-medium">Média</th>
                <th scope="col" className="border-b border-linha px-2 py-2 font-medium">Mínimo</th>
                <th scope="col" className="border-b border-linha px-2 py-2 font-medium">Máximo</th>
                <th scope="col" className="hidden border-b border-linha px-2 py-2 font-medium sm:table-cell">Volatilidade (desvio padrão)</th>
                <th scope="col" className="hidden border-b border-linha px-2 py-2 font-medium sm:table-cell">Horas em faixa baixa · central · alta</th>
              </tr>
            </thead>
            <tbody>
              {SMS.flatMap((s) => {
                const st = at.stats[s.id];
                const faixas = `${p(st.permanencia.baixa)} · ${p(st.permanencia.central)} · ${p(st.permanencia.alta)}`;
                return [
                  <tr key={s.id} className="border-b border-linha max-sm:border-b-0">
                    <th scope="row" className="py-2 pr-3 text-left font-normal text-carvao">
                      <span aria-hidden="true" className="mr-2 inline-block h-2 w-2" style={{ background: s.cor }} />
                      <span className="sm:hidden">
                        <abbr title={s.rotulo} className="no-underline">
                          {s.sigla}
                        </abbr>
                      </span>
                      <span className="hidden sm:inline">{s.rotulo}</span>
                    </th>
                    <td className="px-2 py-2 text-carvao">R$&nbsp;{n(st.media)}</td>
                    <td className="px-2 py-2 text-carvao">R$&nbsp;{n(st.min)}</td>
                    <td className="px-2 py-2 text-carvao">R$&nbsp;{n(st.max)}</td>
                    <td className="hidden px-2 py-2 text-carvao sm:table-cell">R$&nbsp;{n(st.desvio_padrao)}</td>
                    <td className="hidden px-2 py-2 text-carvao sm:table-cell">{faixas}</td>
                  </tr>,
                  // celular: volatilidade e faixas descem para uma segunda linha do mesmo submercado, em vez de empurrar colunas para fora da tela
                  <tr key={`${s.id}-mais`} className="border-b border-linha sm:hidden">
                    <td colSpan={4} className="px-2 pb-2 pt-0 text-xs text-carvao-muted">
                      Volatilidade (desvio padrão): R$&nbsp;{n(st.desvio_padrao)}. Horas em faixa baixa · central · alta: {faixas}.
                    </td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-mineral">
          Valores em R$/MWh nominais. Faixas: abaixo do 25º percentil, entre o 25º e o 75º e acima do 75º percentil da distribuição horária de cada submercado desde 01/01/2021.
          Diferença entre submercados: critério de R$&nbsp;{n(limiar, 2)}/MWh nesta página e de R$&nbsp;{n(LIMIAR_SEPARACAO, 2)}/MWh em Diferenças regionais.
        </p>
      </div>
    </div>
  );
}
