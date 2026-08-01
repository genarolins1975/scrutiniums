import type { PontoSerie } from "@/lib/dadosPublicos";

/**
 * Gráficos SVG renderizados no servidor (build time): zero JavaScript no
 * cliente, essenciais para as páginas públicas leves. Cores da identidade
 * (bronze sobre marfim) em valores literais porque o SVG não herda tokens
 * do Tailwind em atributos.
 */

const BRONZE = "#966b48";
const MINERAL = "#8a8578";

function escala(pts: PontoSerie[], w: number, h: number, pad: number) {
  const vs = pts.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / Math.max(pts.length - 1, 1)) * (w - 2 * pad);
  const y = (v: number) => h - pad - ((v - min) / span) * (h - 2 * pad);
  return { min, max, x, y };
}

function caminho(pts: PontoSerie[], x: (i: number) => number, y: (v: number) => number): string {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
}

/** Sparkline compacta para os cartões da página /dados. */
export function Sparkline({ serie, titulo }: { serie: PontoSerie[]; titulo: string }) {
  const pts = serie.slice(-36);
  if (pts.length < 2) return null;
  const w = 220;
  const h = 44;
  const { x, y } = escala(pts, w, h, 3);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-4 h-11 w-full"
      role="img"
      aria-label={`Evolução recente: ${titulo}, últimos ${pts.length} meses`}
    >
      <path d={caminho(pts, x, y)} fill="none" stroke={BRONZE} strokeWidth="1.6" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1].v)} r="2.6" fill={BRONZE} />
    </svg>
  );
}

/**
 * Gráfico completo da página do indicador: série longa com grade mínima,
 * extremos anotados e último valor destacado.
 */
export function GraficoLinha({
  serie,
  titulo,
  fmt,
}: {
  serie: PontoSerie[];
  titulo: string;
  fmt: (v: number) => string;
}) {
  const pts = serie.slice(-144);
  if (pts.length < 2) return null;
  const w = 720;
  const h = 240;
  const pad = 14;
  const { min, max, x, y } = escala(pts, w, h, pad);
  const ult = pts[pts.length - 1];
  const anos = pts
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.ref.slice(5, 7) === "01")
    .filter((_, k, arr) => arr.length <= 8 || k % 2 === 0);
  return (
    <svg
      viewBox={`0 0 ${w} ${h + 22}`}
      className="mt-2 w-full"
      role="img"
      aria-label={`Série histórica: ${titulo}, de ${pts[0].ref.slice(0, 4)} a ${ult.ref.slice(0, 4)}. Mínimo ${fmt(min)}, máximo ${fmt(max)}, valor atual ${fmt(ult.v)}.`}
    >
      <line x1={pad} y1={y(max)} x2={w - pad} y2={y(max)} stroke={MINERAL} strokeWidth="0.5" strokeDasharray="2,4" />
      <line x1={pad} y1={y(min)} x2={w - pad} y2={y(min)} stroke={MINERAL} strokeWidth="0.5" strokeDasharray="2,4" />
      <text x={pad} y={y(max) - 5} fontSize="11" fill={MINERAL}>{fmt(max)}</text>
      <text x={pad} y={y(min) + 14} fontSize="11" fill={MINERAL}>{fmt(min)}</text>
      {anos.map(({ p, i }) => (
        <g key={p.ref}>
          <line x1={x(i)} y1={h - pad} x2={x(i)} y2={h - pad + 4} stroke={MINERAL} strokeWidth="0.7" />
          <text x={x(i)} y={h + 14} fontSize="11" fill={MINERAL} textAnchor="middle">{p.ref.slice(0, 4)}</text>
        </g>
      ))}
      <path d={caminho(pts, x, y)} fill="none" stroke={BRONZE} strokeWidth="2" />
      <circle cx={x(pts.length - 1)} cy={y(ult.v)} r="3.4" fill={BRONZE} />
    </svg>
  );
}
