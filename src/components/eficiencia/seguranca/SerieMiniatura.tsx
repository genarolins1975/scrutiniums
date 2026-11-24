import type { SerieNacional } from "@/lib/eficiencia/seguranca/dados";

const L = 240, A = 72, M = 6;

/**
 * Miniatura da série nacional de um indicador (pequenos múltiplos dos exploradores): linha cheia e ponto cheio nos anos com as 27 UFs
 * (e dado final), traço e ponto vazados nos anos com UFs de fora ou preliminares, lacuna onde não há valor. Eixo do zero à maior
 * marca da própria série, dito no rótulo do cartão; sem texto dentro do SVG, que só escala (os rótulos ficam no HTML, a 12 px ou mais).
 * Decorativa para leitor de tela: os valores estão na tabela "Série completa" da mesma página.
 */
export function SerieMiniatura({ serie, cor = "var(--cor-obee)" }: { serie: SerieNacional; cor?: string }) {
  const vals = serie.valor;
  const max = Math.max(...vals.filter((v): v is number => v !== null), 0) || 1;
  const x = (k: number) => M + (k / Math.max(1, vals.length - 1)) * (L - 2 * M);
  const y = (v: number) => A - M - (v / max) * (A - 2 * M);
  const segmentos: { d: string; tracejado: boolean }[] = [];
  for (let k = 1; k < vals.length; k++) {
    const a = vals[k - 1], b = vals[k];
    if (a === null || b === null) continue;
    segmentos.push({ d: `M${x(k - 1)},${y(a)}L${x(k)},${y(b)}`, tracejado: serie.incompleto[k - 1] || serie.incompleto[k] });
  }
  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="block h-auto w-full" aria-hidden="true" focusable="false">
      <line x1={M} x2={L - M} y1={A - M} y2={A - M} stroke="var(--cor-linha)" strokeWidth="1" />
      {segmentos.map((s, i) => (
        <path key={i} d={s.d} fill="none" stroke={cor} strokeWidth="2" strokeDasharray={s.tracejado ? "4 3" : undefined} strokeOpacity={s.tracejado ? 0.7 : 1} />
      ))}
      {vals.map((v, k) =>
        v === null ? null : (
          <circle key={k} cx={x(k)} cy={y(v)} r="3" fill={serie.incompleto[k] ? "var(--cor-superficie)" : cor} stroke={cor} strokeWidth="1.5" />
        ),
      )}
    </svg>
  );
}
