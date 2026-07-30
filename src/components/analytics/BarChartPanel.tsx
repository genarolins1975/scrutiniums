"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";

export type SerieBarra = { dataKey: string; nome: string; cor: string };
export type LinhaReferenciaMedia = { dataKey: string; nome: string; cor: string };

const ESTILO_TICK = { fill: "var(--cor-mineral)", fontSize: 12 } as const;

/**
 * Gráfico de barras (com linha de média opcional) no padrão da plataforma:
 * eixos e grade em tom de linha, tooltip acessível, animações desativadas.
 */
export function BarChartPanel({
  dados,
  xKey,
  barras,
  linhaMedia,
  ariaLabel,
  formatarValor,
  formatarX,
  dominioY,
  altura = 320,
}: {
  dados: Array<Record<string, string | number>>;
  xKey: string;
  barras: SerieBarra[];
  linhaMedia?: LinhaReferenciaMedia;
  ariaLabel: string;
  formatarValor: (v: number) => string;
  formatarX?: (v: string) => string;
  dominioY?: [number, number];
  altura?: number;
}) {
  return (
    <div role="img" aria-label={ariaLabel} className="w-full">
      <ResponsiveContainer width="100%" height={altura}>
        <ComposedChart data={dados} margin={{ top: 8, right: 16, bottom: 4, left: 0 }} barGap={1}>
          <CartesianGrid stroke="var(--cor-linha)" strokeDasharray="1 3" vertical={false} />
          <XAxis
            dataKey={xKey}
            stroke="var(--cor-linha)"
            tickLine={{ stroke: "var(--cor-linha)" }}
            tick={ESTILO_TICK}
            tickFormatter={formatarX}
            minTickGap={24}
          />
          <YAxis
            domain={dominioY}
            stroke="var(--cor-linha)"
            tickLine={{ stroke: "var(--cor-linha)" }}
            tick={ESTILO_TICK}
            tickFormatter={(v: number) => formatarValor(v)}
            width={64}
          />
          <Tooltip
            content={<ChartTooltip formatarValor={formatarValor} formatarRotulo={formatarX} />}
            cursor={{ fill: "var(--cor-linha)", opacity: 0.35 }}
            isAnimationActive={false}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) => (
              <span style={{ color: "var(--cor-carvao-muted)" }}>{value}</span>
            )}
          />
          {barras.map((b) => (
            <Bar
              key={b.dataKey}
              dataKey={b.dataKey}
              name={b.nome}
              fill={b.cor}
              isAnimationActive={false}
            />
          ))}
          {linhaMedia && (
            <Line
              type="monotone"
              dataKey={linhaMedia.dataKey}
              name={linhaMedia.nome}
              stroke={linhaMedia.cor}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
