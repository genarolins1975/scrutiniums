"use client";

import { useMemo, useState } from "react";
import { PanelShell } from "@/components/analytics/PanelShell";
import { EmptyState } from "@/components/ui/States";
import { CHART_HIGHLIGHT, CHART_SERIES, fmtMonthYear, fmtNumber } from "@/lib/format";
import {
  META_REGULATORIO,
  SENTIMENTO_MENSAL,
  TEMAS,
  type PontoSentimento,
  type Tema,
} from "@/lib/data/paineis";
import { ChartErrorBoundary } from "./ChartErrorBoundary";
import { baixarCsv } from "./DownloadCsvButton";
import { DataTable, type ColunaTabela } from "./DataTable";
import { FilterBar } from "./FilterBar";
import { LineChartPanel, type SerieLinha } from "./LineChartPanel";

const TODOS = "todos";
const TRACEJADOS: Array<string | undefined> = [undefined, "6 3", "2 3"];

export function RegulatorioPanel() {
  const [tema, setTema] = useState<string>(TODOS);

  const dados = SENTIMENTO_MENSAL;
  const temasVisiveis: Tema[] = tema === TODOS ? [...TEMAS] : [tema as Tema];

  const series: SerieLinha[] = TEMAS.map((t, i) => {
    const selecionado = tema !== TODOS && t === tema;
    return {
      dataKey: t,
      nome: t,
      cor: selecionado ? CHART_HIGHLIGHT : CHART_SERIES[i % CHART_SERIES.length],
      tracejado: selecionado ? undefined : TRACEJADOS[i % TRACEJADOS.length],
      destaque: selecionado,
    };
  });

  const resumo = useMemo(() => gerarResumo(dados, temasVisiveis), [dados, temasVisiveis]);

  const colunas: ColunaTabela<PontoSentimento>[] = [
    { chave: "competencia", titulo: "Competência", valor: (l) => fmtMonthYear(l.competencia) },
    ...temasVisiveis.map<ColunaTabela<PontoSentimento>>((t) => ({
      chave: t,
      titulo: t,
      numerica: true,
      valor: (l) => fmtNumber(l[t], 2),
    })),
  ];

  const baixar = () =>
    baixarCsv(
      "score-de-sentimento-regulatorio.csv",
      ["Competência", ...temasVisiveis],
      dados.map((l) => [fmtMonthYear(l.competencia), ...temasVisiveis.map((t) => fmtNumber(l[t], 2))]),
    );

  return (
    <PanelShell
      meta={META_REGULATORIO}
      onDownload={baixar}
      filtros={
        <FilterBar
          filtros={[
            {
              id: "tema",
              rotulo: "Tema",
              valor: tema,
              onChange: setTema,
              opcoes: [
                { valor: TODOS, rotulo: "Todos os temas" },
                ...TEMAS.map((t) => ({ valor: t, rotulo: t })),
              ],
            },
          ]}
        />
      }
    >
      {dados.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          <p
            role="note"
            className="max-w-prose2 border border-linha bg-marfim px-4 py-3 text-sm text-carvao-muted"
          >
            O score é produzido por modelo de linguagem e complementa a análise humana; margem de
            erro estimada de ±0,12.
          </p>

          <ChartErrorBoundary>
            <LineChartPanel
              dados={dados}
              xKey="competencia"
              series={series}
              dominioY={[-1, 1]}
              referenciaZero
              formatarValor={(v) => fmtNumber(v, 2)}
              formatarX={(v) => fmtMonthYear(v)}
              ariaLabel={`Gráfico de linhas do Score de Sentimento Regulatório, em escala de -1 a +1, de janeiro de 2022 a junho de 2026, com uma linha por tema (${TEMAS.join(
                ", ",
              )}) e linha de referência em zero. Valores positivos indicam orientação flexibilizadora; negativos, restritiva.${
                tema !== TODOS ? ` A série do tema ${tema} está em destaque.` : ""
              }`}
            />
          </ChartErrorBoundary>

          <p className="max-w-prose2 text-sm text-carvao-muted">{resumo}</p>

          <DataTable
            legenda="Score de Sentimento Regulatório: últimos 8 valores mensais, em escala de -1 a +1, por tema."
            colunas={colunas}
            linhas={dados.slice(-8)}
            chaveLinha={(l) => l.competencia}
          />
        </div>
      )}
    </PanelShell>
  );
}

/** Alternativa textual gerada dos dados da competência mais recente. */
function gerarResumo(dados: PontoSentimento[], temas: Tema[]): string {
  if (dados.length === 0) return "";
  const ultimo = dados[dados.length - 1];
  const partes = temas.map((t) => {
    const v = ultimo[t];
    const leitura = v > 0 ? "flexibilizadora" : v < 0 ? "restritiva" : "neutra";
    return `${t}: ${fmtNumber(v, 2)} (orientação ${leitura})`;
  });
  return `Em ${fmtMonthYear(ultimo.competencia)}, o score por tema foi — ${partes.join(
    "; ",
  )}. Variações menores que a margem de erro (±0,12) não devem ser lidas como mudança de orientação.`;
}
