/**
 * Gráficos do painel Conectividade, desenhados no servidor em SVG (sem biblioteca, sem script no navegador).
 * Regras: escala com marcas redondas e o topo acima do máximo; linhas em segmentos retos, sem suavizar; ausência parte a
 * linha (nunca vira zero); no máximo três séries por gráfico, na mesma unidade, com rótulo direto no fim da linha em
 * vez de legenda; o texto alternativo descreve o primeiro e o último valor.
 */
import { num } from "@/lib/conectividade/formato";

/** Margens do desenho: a versão estreita (celular) desenha em 380 unidades para o texto não encolher demais. */
const margens = (L: number) => (L < 500 ? { e: 58, d: 104, t: 30, b: 34 } : { e: 72, d: 116, t: 30, b: 34 });
const LARGO = 720;
const ESTREITO = 380;

/** No celular, no máximo quatro marcas no eixo x: a primeira, a última e duas no meio, sem encostar. */
function poucasMarcas(m: { x: number; rotulo: string }[]): { x: number; rotulo: string }[] {
  if (m.length <= 4) return m;
  const idx = new Set([0, Math.round((m.length - 1) / 3), Math.round((2 * (m.length - 1)) / 3), m.length - 1]);
  return m.filter((_x, i) => idx.has(i));
}

/** Topo redondo da escala, acima do máximo (1, 1,5, 2, 2,5, 3, 4, 5, 6, 8 ou 10 vezes uma potência de dez). */
export function topo(max: number): number {
  if (!(max > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p > max) return m * p;
  return 10 * p;
}

export type Ponto = { x: number; y: number | null };
export type Serie = { nome: string; classe: "cn-linha" | "cn-linha-ref" | "cn-linha-suave"; pontos: Ponto[]; rotuloFim?: string };

/** Caminho com quebra em cada ausência. */
function caminho(pontos: Ponto[], fx: (x: number) => number, fy: (y: number) => number): string {
  let novo = true;
  return pontos
    .map((p) => {
      if (p.y === null) {
        novo = true;
        return "";
      }
      const c = `${novo ? "M" : "L"}${fx(p.x).toFixed(1)},${fy(p.y).toFixed(1)}`;
      novo = false;
      return c;
    })
    .filter(Boolean)
    .join(" ");
}

type PropsLinhas = Parameters<typeof Linhas>[0];

/** Duas versões do mesmo gráfico, trocadas por CSS: a larga e a estreita (celular), com o mesmo dado e o mesmo texto alternativo. */
export function GraficoLinhas(p: Omit<PropsLinhas, "largura">) {
  return (
    <>
      <div className="cn-so-largo"><Linhas {...p} largura={LARGO} /></div>
      <div className="cn-so-estreito"><Linhas {...p} largura={ESTREITO} marcasX={poucasMarcas(p.marcasX)} /></div>
    </>
  );
}

function Linhas({
  series,
  marcasX,
  unidade,
  casas = 0,
  altura = 240,
  maximo,
  descricao,
  largura: L,
}: {
  series: Serie[];
  marcasX: { x: number; rotulo: string }[];
  unidade: string;
  casas?: number;
  altura?: number;
  /** Teto fixo da escala (100 para porcentagens); sem ele, o topo redondo acima do máximo. */
  maximo?: number;
  descricao: string;
  largura: number;
}) {
  const M = margens(L);
  const todos = series.flatMap((s) => s.pontos);
  const ys = todos.map((p) => p.y).filter((y): y is number => y !== null);
  const xs = todos.map((p) => p.x);
  const ymax = maximo ?? topo(Math.max(0, ...ys));
  const xmin = Math.min(...xs);
  const xmax = Math.max(...xs);
  const fx = (x: number) => M.e + ((x - xmin) / Math.max(1e-9, xmax - xmin)) * (L - M.e - M.d);
  const fy = (y: number) => M.t + ((ymax - y) / ymax) * (altura - M.t - M.b);
  const marcas = [0, ymax / 4, ymax / 2, (3 * ymax) / 4, ymax];
  // rótulos no fim das linhas, afastados quando os valores finais são próximos
  const fins = series
    .map((s) => {
      const u = [...s.pontos].reverse().find((p) => p.y !== null);
      return u && u.y !== null ? { s, x: fx(u.x), y: fy(u.y) } : null;
    })
    .filter((f): f is { s: Serie; x: number; y: number } => f !== null)
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < fins.length; i++) if (fins[i].y - fins[i - 1].y < 18) fins[i].y = fins[i - 1].y + 18;
  return (
    <svg viewBox={`0 0 ${L} ${altura}`} className="cn-svg" role="img" aria-label={descricao}>
      {marcas.map((t) => (
        <g key={t}>
          <line x1={M.e} x2={L - M.d} y1={fy(t)} y2={fy(t)} className={t === 0 ? "cn-base" : "cn-grade"} />
          <text x={M.e - 8} y={fy(t) + 4} textAnchor="end">{num(t, casas)}</text>
        </g>
      ))}
      <text x={M.e} y={16}>{unidade}</text>
      {marcasX.map((m) => (
        <text key={m.x} x={fx(m.x)} y={altura - 8} textAnchor="middle">{m.rotulo}</text>
      ))}
      {series.map((s) => (
        <path key={s.nome} d={caminho(s.pontos, fx, fy)} className={s.classe} />
      ))}
      {/* valor isolado entre ausências (o primeiro trimestre da cobertura, 2021-11, seguido de dois vazios): o caminho só
          tem um "M" e não desenha nada, então o ponto ganha uma marca própria */}
      {series.flatMap((s) =>
        s.pontos
          .map((p, i) => ({ p, i }))
          .filter(({ p, i }) => p.y !== null && (s.pontos[i - 1]?.y ?? null) === null && (s.pontos[i + 1]?.y ?? null) === null)
          .map(({ p }) => <circle key={`${s.nome}-${p.x}`} cx={fx(p.x)} cy={fy(p.y as number)} r={3.5} className={`cn-ponto-${s.classe}`} />),
      )}
      {fins.map((f) => (
        <text key={f.s.nome} x={f.x + 8} y={f.y + 4} className="cn-rotulo-forte">{f.s.rotuloFim ?? f.s.nome}</text>
      ))}
    </svg>
  );
}

/** Marcas do eixo x de anos: o primeiro, o último e os múltiplos de cinco que não encostam neles. */
export function marcasAnos(anos: number[]): { x: number; rotulo: string }[] {
  const a0 = anos[0];
  const a1 = anos[anos.length - 1];
  return anos.filter((a) => a === a0 || a === a1 || (a % 5 === 0 && a - a0 >= 3 && a1 - a >= 3)).map((a) => ({ x: a, rotulo: String(a) }));
}

/** Um mês "AAAA-MM" como número contínuo de anos (2026-08 = 2026,58) para o eixo x. */
export const anoDecimal = (mes: string) => Number(mes.slice(0, 4)) + (Number(mes.slice(5, 7)) - 1) / 12;
