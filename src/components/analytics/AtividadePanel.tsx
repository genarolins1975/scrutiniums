"use client";

import { useMemo, useState } from "react";
import { PanelShell } from "@/components/analytics/PanelShell";
import { EmptyState } from "@/components/ui/States";
import { CHART_HIGHLIGHT, CHART_SERIES, fmtMonthYear, fmtNumber } from "@/lib/format";
import {
  ATIVIDADE_MENSAL,
  META_ATIVIDADE,
  SETORES,
  type PontoAtividade,
  type Setor,
} from "@/lib/data/paineis";
import { ChartErrorBoundary } from "./ChartErrorBoundary";
import { baixarCsv } from "./DownloadCsvButton";
import { DataTable, type ColunaTabela } from "./DataTable";
import { FilterBar } from "./FilterBar";
import { LineChartPanel, type SerieLinha } from "./LineChartPanel";

const TODOS = "todos";

/** Padrões de tracejado por série: distinção que não depende só de cor. */
const TRACEJADOS: Array<string | undefined> = [undefined, "6 3", "2 3", "9 4 2 4", "4 2"];

const OPCOES_PERIODO = [
  { valor: "12", rotulo: "Últimos 12 meses" },
  { valor: "24", rotulo: "Últimos 24 meses" },
  { valor: "48", rotulo: "Últimos 48 meses" },
];

export function AtividadePanel() {
  const [setor, setSetor] = useState<string>(TODOS);
  const [periodo, setPeriodo] = useState<string>("24");

  const dados = useMemo(() => ATIVIDADE_MENSAL.slice(-Number(periodo)), [periodo]);
  const setoresVisiveis: Setor[] = setor === TODOS ? [...SETORES] : [setor as Setor];

  const series: SerieLinha[] = SETORES.map((s, i) => {
    const selecionado = setor !== TODOS && s === setor;
    return {
      dataKey: s,
      nome: s,
      cor: selecionado ? CHART_HIGHLIGHT : CHART_SERIES[i % CHART_SERIES.length],
      tracejado: selecionado ? undefined : TRACEJADOS[i % TRACEJADOS.length],
      destaque: selecionado,
    };
  });

  const resumo = useMemo(() => gerarResumo(dados, setoresVisiveis), [dados, setoresVisiveis]);

  const colunas: ColunaTabela<PontoAtividade>[] = [
    {
      chave: "competencia",
      titulo: "Competência",
      valor: (l) => fmtMonthYear(l.competencia),
    },
    ...setoresVisiveis.map<ColunaTabela<PontoAtividade>>((s) => ({
      chave: s,
      titulo: s,
      numerica: true,
      valor: (l) => fmtNumber(l[s], 1),
    })),
  ];

  const baixar = () =>
    baixarCsv(
      "atividade-setorial.csv",
      ["Competência", ...setoresVisiveis],
      dados.map((l) => [fmtMonthYear(l.competencia), ...setoresVisiveis.map((s) => fmtNumber(l[s], 1))]),
    );

  return (
    <PanelShell
      meta={META_ATIVIDADE}
      onDownload={baixar}
      filtros={
        <FilterBar
          filtros={[
            {
              id: "setor",
              rotulo: "Setor",
              valor: setor,
              onChange: setSetor,
              opcoes: [
                { valor: TODOS, rotulo: "Todos os setores" },
                ...SETORES.map((s) => ({ valor: s, rotulo: s })),
              ],
            },
            {
              id: "periodo",
              rotulo: "Período",
              valor: periodo,
              onChange: setPeriodo,
              opcoes: OPCOES_PERIODO,
            },
          ]}
        />
      }
    >
      {dados.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          <ChartErrorBoundary>
            <LineChartPanel
              dados={dados}
              xKey="competencia"
              series={series}
              formatarValor={(v) => fmtNumber(v, 1)}
              formatarX={(v) => fmtMonthYear(v)}
              ariaLabel={`Gráfico de linhas do Índice de Atividade Setorial, base 100 igual à média de 2022, nos últimos ${periodo} meses, com uma linha por setor: ${SETORES.join(
                ", ",
              )}.${setor !== TODOS ? ` A série de ${setor} está em destaque.` : ""}`}
            />
          </ChartErrorBoundary>

          <p className="max-w-prose2 text-sm text-carvao-muted">{resumo}</p>

          <DataTable
            legenda={`Índice de Atividade Setorial: últimos 12 valores mensais do período selecionado, por setor. Base 100 = média de 2022.`}
            colunas={colunas}
            linhas={dados.slice(-12)}
            chaveLinha={(l) => l.competencia}
          />
        </div>
      )}
    </PanelShell>
  );
}

/** Alternativa textual gerada dos dados: maior alta e maior queda no período filtrado. */
function gerarResumo(dados: PontoAtividade[], setores: Setor[]): string {
  if (dados.length < 2) return "Período insuficiente para calcular variações.";
  const inicio = dados[0];
  const fim = dados[dados.length - 1];
  const intervalo = `entre ${fmtMonthYear(inicio.competencia)} e ${fmtMonthYear(fim.competencia)}`;

  if (setores.length === 1) {
    const s = setores[0];
    const variacao = fim[s] - inicio[s];
    let maior = dados[0];
    let menor = dados[0];
    for (const p of dados) {
      if (p[s] > maior[s]) maior = p;
      if (p[s] < menor[s]) menor = p;
    }
    const sentido = variacao >= 0 ? "alta" : "queda";
    return `No período selecionado (${intervalo}), o setor ${s} registrou ${sentido} de ${fmtNumber(
      Math.abs(variacao),
      1,
    )} ponto no índice, de ${fmtNumber(inicio[s], 1)} para ${fmtNumber(
      fim[s],
      1,
    )}. O maior valor foi ${fmtNumber(maior[s], 1)}, em ${fmtMonthYear(
      maior.competencia,
    )}, e o menor foi ${fmtNumber(menor[s], 1)}, em ${fmtMonthYear(menor.competencia)}.`;
  }

  const variacoes = setores.map((s) => ({ setor: s, variacao: fim[s] - inicio[s] }));
  const maiorAlta = variacoes.reduce((a, b) => (b.variacao > a.variacao ? b : a));
  const maiorQueda = variacoes.reduce((a, b) => (b.variacao < a.variacao ? b : a));
  const descAlta =
    maiorAlta.variacao >= 0
      ? `a maior alta foi de ${maiorAlta.setor} (${fmtNumber(maiorAlta.variacao, 1)} ponto)`
      : `nenhum setor registrou alta; a menor queda foi de ${maiorAlta.setor} (${fmtNumber(
          maiorAlta.variacao,
          1,
        )} ponto)`;
  const descQueda =
    maiorQueda.variacao < 0
      ? `a maior queda foi de ${maiorQueda.setor} (${fmtNumber(maiorQueda.variacao, 1)} ponto)`
      : `nenhum setor registrou queda; a menor alta foi de ${maiorQueda.setor} (${fmtNumber(
          maiorQueda.variacao,
          1,
        )} ponto)`;
  return `No período selecionado (${intervalo}), ${descAlta} e ${descQueda}, sempre em pontos do índice (base 100 = média de 2022).`;
}
