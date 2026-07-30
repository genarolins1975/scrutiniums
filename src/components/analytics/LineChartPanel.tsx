"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";

export type SerieLinha = {
  dataKey: string;
  nome: string;
  cor: string;
  /** Padrão de tracejado (ex.: "6 3") para distinção que não dependa só de cor. */
  tracejado?: string;
  /** Série em destaque: traço mais espesso. */
  destaque?: boolean;
};

const ESTILO_TICK = { fill: "var(--cor-mineral)", fontSize: 12 } as const;

/**
 * Gráfico de linhas padrão da plataforma: eixos e grade em tom de linha,
 * séries com padrão de tracejado além da cor, tooltip acessível e
 * animações desativadas.
 */
export function LineChartPanel({
  dados,
  xKey,
  series,
  ariaLabel,
  formatarValor,
  formatarX,
  dominioY,
  referenciaZero = false,
  altura = 320,
}: {
  dados: Array<Record<string, string | number>>;
  xKey: string;
  series: SerieLinha[];
  ariaLabel: string;
  formatarValor: (v: number) => string;
  formatarX?: (v: string) => string;
  dominioY?: [number, number];
  referenciaZero?: boolean;
  altura?: number;
}) {
  return (
    <div role="img" aria-label={ariaLabel} className="w-full">
      <ResponsiveContainer width="100%" height={altura}>
        <LineChart data={dados} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--cor-linha)" strokeDasharray="1 3" vertical={false} />
          <XAxis
            dataKey={xKey}
            stroke="var(--cor-linha)"
            tickLine={{ stroke: "var(--cor-linha)" }}
            tick={ESTILO_TICK}
            tickFormatter={formatarX}
            minTickGap={32}
          />
          <YAxis
            domain={dominioY ?? ["auto", "auto"]}
            stroke="var(--cor-linha)"
            tickLine={{ stroke: "var(--cor-linha)" }}
            tick={ESTILO_TICK}
            tickFormatter={(v: number) => formatarValor(v)}
            width={64}
          />
          {referenciaZero && (
            <ReferenceLine y={0} stroke="var(--cor-mineral)" strokeDasharray="4 4" />
          )}
          <Tooltip
            content={<ChartTooltip formatarValor={formatarValor} formatarRotulo={formatarX} />}
            cursor={{ stroke: "var(--cor-linha)" }}
            isAnimationActive={false}
          />
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) => (
              <span style={{ color: "var(--cor-carvao-muted)" }}>{value}</span>
            )}
          />
          {series.map((s) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.nome}
              stroke={s.cor}
              strokeWidth={s.destaque ? 2.5 : 1.5}
              strokeDasharray={s.tracejado}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
