"use client";

import { useMemo, useState } from "react";
import { PanelShell } from "@/components/analytics/PanelShell";
import { EmptyState } from "@/components/ui/States";
import { CHART_HIGHLIGHT, CHART_SERIES, fmtNumber, fmtPercent } from "@/lib/format";
import {
  INADIMPLENCIA_TRIMESTRAL,
  META_RISCO,
  SETORES,
  type PontoInadimplencia,
  type Setor,
} from "@/lib/data/paineis";
import { BarChartPanel, type SerieBarra } from "./BarChartPanel";
import { ChartErrorBoundary } from "./ChartErrorBoundary";
import { baixarCsv } from "./DownloadCsvButton";
import { DataTable, type ColunaTabela } from "./DataTable";
import { FilterBar } from "./FilterBar";

const TODOS = "todos";
const CHAVE_MEDIA = "Média dos setores";

type LinhaRisco = PontoInadimplencia & { [CHAVE_MEDIA]: number };

export function RiscoPanel() {
  const [setor, setSetor] = useState<string>(TODOS);

  /** Média simples dos cinco setores por trimestre (linha de referência). */
  const dados: LinhaRisco[] = useMemo(
    () =>
      INADIMPLENCIA_TRIMESTRAL.map((p) => ({
        ...p,
        [CHAVE_MEDIA]:
          Math.round((SETORES.reduce((acc, s) => acc + p[s], 0) / SETORES.length) * 100) / 100,
      })),
    [],
  );

  const setoresVisiveis: Setor[] = setor === TODOS ? [...SETORES] : [setor as Setor];

  const barras: SerieBarra[] = setoresVisiveis.map((s) => ({
    dataKey: s,
    nome: s,
    cor:
      setor === TODOS
        ? CHART_SERIES[SETORES.indexOf(s) % CHART_SERIES.length]
        : "var(--serie-1)",
  }));

  const resumo = useMemo(() => gerarResumo(dados, setoresVisiveis), [dados, setoresVisiveis]);

  const colunas: ColunaTabela<LinhaRisco>[] = [
    { chave: "trimestre", titulo: "Trimestre", valor: (l) => l.trimestre },
    ...setoresVisiveis.map<ColunaTabela<LinhaRisco>>((s) => ({
      chave: s,
      titulo: s,
      numerica: true,
      valor: (l) => fmtPercent(l[s], 1),
    })),
    {
      chave: CHAVE_MEDIA,
      titulo: CHAVE_MEDIA,
      numerica: true,
      valor: (l) => fmtPercent(l[CHAVE_MEDIA], 1),
    },
  ];

  const baixar = () =>
    baixarCsv(
      "risco-de-credito-setorial.csv",
      ["Trimestre", ...setoresVisiveis, CHAVE_MEDIA],
      dados.map((l) => [
        l.trimestre,
        ...setoresVisiveis.map((s) => fmtNumber(l[s], 2)),
        fmtNumber(l[CHAVE_MEDIA], 2),
      ]),
    );

  return (
    <PanelShell
      meta={META_RISCO}
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
          ]}
        />
      }
    >
      {dados.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          <ChartErrorBoundary>
            <BarChartPanel
              dados={dados}
              xKey="trimestre"
              barras={barras}
              linhaMedia={{ dataKey: CHAVE_MEDIA, nome: CHAVE_MEDIA, cor: CHART_HIGHLIGHT }}
              formatarValor={(v) => fmtPercent(v, 1)}
              ariaLabel={`Gráfico de barras do Indicador de Risco de Crédito Setorial, em percentual da carteira com atraso acima de 90 dias, por trimestre de 2022 a 2026, ${
                setor === TODOS ? `com barras para os setores ${SETORES.join(", ")}` : `com barras para o setor ${setor}`
              } e uma linha tracejada em bronze com a média dos cinco setores.`}
            />
          </ChartErrorBoundary>

          <p className="max-w-prose2 text-sm text-carvao-muted">{resumo}</p>

          <DataTable
            legenda="Indicador de Risco de Crédito Setorial: últimos 8 trimestres, em percentual da carteira com atraso acima de 90 dias, por setor e média dos setores."
            colunas={colunas}
            linhas={dados.slice(-8)}
            chaveLinha={(l) => l.trimestre}
          />
        </div>
      )}
    </PanelShell>
  );
}

/** Alternativa textual gerada dos dados do trimestre mais recente. */
function gerarResumo(dados: LinhaRisco[], setores: Setor[]): string {
  if (dados.length === 0) return "";
  const ultimo = dados[dados.length - 1];
  const anterior = dados.length > 1 ? dados[dados.length - 2] : undefined;

  if (setores.length === 1) {
    const s = setores[0];
    const diff = anterior ? ultimo[s] - anterior[s] : 0;
    const sentido = diff > 0 ? "alta" : diff < 0 ? "queda" : "estabilidade";
    return `No ${ultimo.trimestre}, a inadimplência do setor ${s} foi de ${fmtPercent(
      ultimo[s],
      1,
    )}, ${sentido} de ${fmtNumber(Math.abs(diff), 2)} ponto percentual em relação ao trimestre anterior. A média dos cinco setores no mesmo trimestre foi de ${fmtPercent(
      ultimo[CHAVE_MEDIA],
      1,
    )}.`;
  }

  const maior = setores.reduce((a, b) => (ultimo[b] > ultimo[a] ? b : a));
  const menor = setores.reduce((a, b) => (ultimo[b] < ultimo[a] ? b : a));
  return `No ${ultimo.trimestre}, a maior inadimplência foi do setor ${maior} (${fmtPercent(
    ultimo[maior],
    1,
  )}) e a menor, do setor ${menor} (${fmtPercent(ultimo[menor], 1)}); a média dos cinco setores foi de ${fmtPercent(
    ultimo[CHAVE_MEDIA],
    1,
  )}.`;
}
