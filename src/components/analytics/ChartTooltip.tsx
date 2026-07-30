"use client";

/**
 * Tooltip customizado dos gráficos Recharts, no padrão editorial:
 * fundo papel, borda linha, texto carvão, valores formatados pelos
 * helpers de @/lib/format (passados via prop formatarValor).
 */
type ItemTooltip = {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
};

export function ChartTooltip({
  active,
  payload,
  label,
  formatarValor,
  formatarRotulo,
}: {
  active?: boolean;
  payload?: ReadonlyArray<ItemTooltip>;
  label?: string | number;
  formatarValor: (v: number) => string;
  formatarRotulo?: (l: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const rotulo = label === undefined ? "" : String(label);
  return (
    <div role="status" className="border border-linha bg-papel px-3 py-2 text-sm text-carvao">
      <p className="rotulo mb-1.5 text-mineral">{formatarRotulo ? formatarRotulo(rotulo) : rotulo}</p>
      <ul className="space-y-0.5">
        {payload.map((item) => (
          <li
            key={String(item.dataKey ?? item.name)}
            className="flex items-baseline justify-between gap-6"
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-4"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-carvao-muted">{String(item.name)}</span>
            </span>
            <span className="tabular-nums text-carvao">
              {typeof item.value === "number" ? formatarValor(item.value) : String(item.value ?? "—")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
