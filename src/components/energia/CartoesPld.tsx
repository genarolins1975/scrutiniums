import type { PldGold } from "@/lib/energia/tipos";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { dataBR, num, reais, sinal } from "@/lib/energia/formato";
import { ROTULO_FAIXA_PLD } from "@/lib/energia/leituras";

const COR_SM: Record<string, string> = {
  SE: "var(--serie-sm-se)",
  S: "var(--serie-sm-s)",
  NE: "var(--serie-sm-ne)",
  N: "var(--serie-sm-n)",
};

/**
 * Cartões do PLD dos quatro submercados no dia de referência. O número grande é
 * a média do dia (CALCULADO a partir das horas publicadas pela CCEE); a faixa
 * horária é OBSERVADA. Posição histórica só com a regra publicada ao lado.
 */
export function CartoesPld({ pld }: { pld: PldGold }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {pld.cartoes.map((c) => (
        <li key={c.sm} className="relative border border-linha bg-superficie p-5">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px]" style={{ background: COR_SM[c.sm] }} />
          <p className="rotulo text-mineral">{c.nome}</p>
          <p className="mt-3 font-serif text-[2rem] leading-none tabular-nums text-carvao">
            {reais(c.media_dia)}
            <span className="ml-1 font-sans text-sm text-mineral">/MWh</span>
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mineral">
            média de {dataBR(pld.dia_referencia)} <SeloNatureza natureza="CALCULADO" />
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="shrink-0 text-mineral">Faixa horária</dt>
              <dd className="text-right tabular-nums text-carvao">
                {reais(c.min_hora)} a {reais(c.max_hora)}
                <span className="sr-only"> (valores observados)</span>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-mineral">Vs. dia anterior</dt>
              <dd className="text-right tabular-nums text-carvao">
                {c.variacao_dia_anterior ? `${sinal(c.variacao_dia_anterior.abs, 2)} (${sinal(c.variacao_dia_anterior.pct)}%)` : "sem dado"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-mineral">Posição desde 2021</dt>
              <dd className="text-right text-carvao">
                {c.posicao.percentil !== null ? `percentil ${num(c.posicao.percentil, 1)} de ${num(c.posicao.n_dias, 0)} dias` : "sem dado"}
              </dd>
            </div>
          </dl>
          {c.posicao.faixa && (
            <p className="mt-3 border-t border-linha pt-3 text-xs leading-relaxed text-carvao-muted">
              Na {ROTULO_FAIXA_PLD[c.posicao.faixa]} das médias diárias desde 2021.
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
