"use client";

import Link from "next/link";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtNumber, fmtPercent } from "@/lib/format";
import { ChartTooltip } from "./ChartTooltip";

/**
 * Painel-resumo compacto da visão geral: mini gráfico de linha
 * (série única em var(--serie-1)), valor mais recente em destaque
 * serifado, variação com sinal e seta textual (nunca só cor) e link
 * para o painel completo.
 */
export type FormatoValor = "indice" | "percentual" | "score" | "inteiro";

export type VariacaoResumo = {
  direcao: "alta" | "queda" | "estavel";
  /** Texto completo, ex.: "alta de 0,4 ponto em relação ao mês anterior". */
  texto: string;
};

const FORMATADORES: Record<FormatoValor, (v: number) => string> = {
  indice: (v) => fmtNumber(v, 1),
  percentual: (v) => fmtPercent(v, 1),
  score: (v) => fmtNumber(v, 2),
  inteiro: (v) => fmtNumber(v, 0),
};

export function SummaryCard({
  titulo,
  unidade,
  periodo,
  serie,
  formato,
  variacao,
  href,
  hrefRotulo,
  ariaLabelGrafico,
}: {
  titulo: string;
  unidade: string;
  periodo: string;
  serie: Array<{ rotulo: string; valor: number }>;
  formato: FormatoValor;
  variacao: VariacaoResumo;
  href: string;
  hrefRotulo: string;
  ariaLabelGrafico: string;
}) {
  const formatar = FORMATADORES[formato];
  const atual = serie[serie.length - 1];
  const seta = variacao.direcao === "alta" ? "▲" : variacao.direcao === "queda" ? "▼" : "–";

  return (
    <article className="flex flex-col border border-linha bg-papel p-6">
      <h2 className="font-serif text-xl text-carvao">{titulo}</h2>
      <p className="mt-1 text-xs text-mineral">
        <span className="rotulo">Unidade:</span> {unidade} · <span className="rotulo">Período:</span>{" "}
        {periodo}
      </p>

      <div role="img" aria-label={ariaLabelGrafico} className="mt-4">
        <ResponsiveContainer width="100%" height={72}>
          <LineChart data={serie} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="rotulo" hide />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              content={<ChartTooltip formatarValor={formatar} />}
              cursor={{ stroke: "var(--cor-linha)" }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="valor"
              name={titulo}
              stroke="var(--serie-1)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 font-serif text-4xl text-carvao">{atual ? formatar(atual.valor) : "—"}</p>
      <p className="mt-1 text-sm text-carvao-muted">
        <span aria-hidden="true">{seta}</span> {variacao.texto}
      </p>

      <p className="mt-5 border-t border-linha pt-4">
        <Link
          href={href}
          className="rotulo text-bronze underline underline-offset-4 hover:text-bronze-dark"
        >
          {hrefRotulo}
        </Link>
      </p>
    </article>
  );
}
