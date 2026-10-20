/**
 * Gráficos do painel Previdência e INSS, desenhados no servidor em SVG (sem biblioteca, sem script no navegador).
 * Regras: escala com marcas redondas e o topo acima do máximo; barras começam no zero; linhas em segmentos retos, sem
 * suavizar; ausência parte a linha (nunca vira zero); no máximo duas séries por gráfico, na mesma unidade, com rótulo
 * direto no fim da linha em vez de legenda; o texto alternativo descreve o primeiro e o último valor.
 */
import { num } from "@/lib/previdencia/formato";

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

/** Topo redondo da escala, acima do máximo (1, 2, 2,5 ou 5 vezes uma potência de dez). */
export function topo(max: number): number {
  if (!(max > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p > max) return m * p;
  return 10 * p;
}

export type Ponto = { x: number; y: number | null };
export type Serie = { nome: string; classe: "pv-linha" | "pv-linha-ref" | "pv-linha-rural"; pontos: Ponto[]; rotuloFim?: string };

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
type PropsColunas = Parameters<typeof Colunas>[0];

/** Duas versões do mesmo gráfico, trocadas por CSS: a larga e a estreita (celular), com o mesmo dado e o mesmo texto alternativo. */
export function GraficoLinhas(p: Omit<PropsLinhas, "largura">) {
  return (
    <>
      <div className="pv-so-largo"><Linhas {...p} largura={LARGO} /></div>
      <div className="pv-so-estreito"><Linhas {...p} largura={ESTREITO} marcasX={poucasMarcas(p.marcasX)} /></div>
    </>
  );
}

export function GraficoColunas(p: Omit<PropsColunas, "largura">) {
  return (
    <>
      <div className="pv-so-largo"><Colunas {...p} largura={LARGO} /></div>
      <div className="pv-so-estreito"><Colunas {...p} largura={ESTREITO} marcasX={poucasMarcas(p.marcasX)} /></div>
    </>
  );
}

function Linhas({
  series,
  marcasX,
  unidade,
  casas = 0,
  divisor = 1,
  altura = 260,
  descricao,
  minimoZero = true,
  largura: L,
}: {
  series: Serie[];
  marcasX: { x: number; rotulo: string }[];
  unidade: string;
  casas?: number;
  /** Divide os valores do eixo y para o rótulo (ex.: 1e6 para milhões). */
  divisor?: number;
  altura?: number;
  descricao: string;
  minimoZero?: boolean;
  largura: number;
}) {
  const M = margens(L);
  const xs = series.flatMap((s) => s.pontos.map((p) => p.x));
  const ys = series.flatMap((s) => s.pontos.map((p) => p.y).filter((y): y is number => y !== null));
  const xmin = Math.min(...xs);
  const xmax = Math.max(...xs);
  const ymax = topo(Math.max(...ys));
  const ymin = minimoZero ? 0 : Math.min(0, ...ys);
  const fx = (x: number) => M.e + ((x - xmin) / Math.max(1e-9, xmax - xmin)) * (L - M.e - M.d);
  const fy = (y: number) => M.t + (1 - (y - ymin) / (ymax - ymin)) * (altura - M.t - M.b);
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => ymin + f * (ymax - ymin));
  return (
    <svg viewBox={`0 0 ${L} ${altura}`} className="pv-svg" role="img" aria-label={descricao}>
      {marcas.map((t) => (
        <g key={t}>
          <line x1={M.e} x2={L - M.d} y1={fy(t)} y2={fy(t)} className={t === 0 ? "pv-base" : "pv-grade"} />
          <text x={M.e - 8} y={fy(t) + 4} textAnchor="end">{num(t / divisor, casas)}</text>
        </g>
      ))}
      <text x={M.e} y={16}>{unidade}</text>
      {marcasX.map((m) => (
        <text key={m.x} x={fx(m.x)} y={altura - 8} textAnchor="middle">{m.rotulo}</text>
      ))}
      {series.map((s) => (
        <path key={s.nome} d={caminho(s.pontos, fx, fy)} className={s.classe} />
      ))}
      {series.map((s) => {
        const ultimo = [...s.pontos].reverse().find((p) => p.y !== null);
        if (!ultimo || ultimo.y === null) return null;
        return (
          <g key={`${s.nome}-fim`}>
            <circle cx={fx(ultimo.x)} cy={fy(ultimo.y)} r={3.5} className={s.classe === "pv-linha" ? "pv-ponto" : "pv-ponto-ref"} />
            <text x={fx(ultimo.x) + 8} y={fy(ultimo.y) + 4} className="pv-rotulo-forte">{s.rotuloFim ?? s.nome}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Colunas com sinal a partir de uma linha de zero (necessidade de financiamento negativa fica abaixo do zero). */
function Colunas({
  pontos,
  marcasX,
  unidade,
  casas = 1,
  altura = 220,
  descricao,
  largura: L,
}: {
  pontos: { x: number; y: number | null; destaque?: boolean }[];
  marcasX: { x: number; rotulo: string }[];
  unidade: string;
  casas?: number;
  altura?: number;
  descricao: string;
  largura: number;
}) {
  const M = margens(L);
  const ys = pontos.map((p) => p.y).filter((y): y is number => y !== null);
  const max = Math.max(0, ...ys);
  const min = Math.min(0, ...ys);
  const ymax = max > 0 ? topo(max) : 0;
  const ymin = min < 0 ? -topo(-min) : 0;
  const xs = pontos.map((p) => p.x);
  const xmin = Math.min(...xs);
  const xmax = Math.max(...xs);
  const passo = (L - M.e - M.d) / Math.max(1, pontos.length);
  const fx = (x: number) => M.e + passo / 2 + ((x - xmin) / Math.max(1e-9, xmax - xmin)) * (L - M.e - M.d - passo);
  const fy = (y: number) => M.t + ((ymax - y) / Math.max(1e-9, ymax - ymin)) * (altura - M.t - M.b);
  const largura = passo * 0.68;
  const marcas = [ymin, ymin / 2, 0, ymax / 2, ymax].filter((v, i, a) => a.indexOf(v) === i);
  const ultimo = [...pontos].reverse().find((p) => p.y !== null);
  return (
    <svg viewBox={`0 0 ${L} ${altura}`} className="pv-svg" role="img" aria-label={descricao}>
      {marcas.map((t) => (
        <g key={t}>
          <line x1={M.e} x2={L - M.d} y1={fy(t)} y2={fy(t)} className={t === 0 ? "pv-base" : "pv-grade"} />
          <text x={M.e - 8} y={fy(t) + 4} textAnchor="end">{num(t, casas)}</text>
        </g>
      ))}
      <text x={M.e} y={16}>{unidade}</text>
      {marcasX.map((m) => (
        <text key={m.x} x={fx(m.x)} y={altura - 8} textAnchor="middle">{m.rotulo}</text>
      ))}
      {pontos.map((p) =>
        p.y === null ? null : (
          <rect
            key={p.x}
            x={fx(p.x) - largura / 2}
            width={largura}
            y={Math.min(fy(p.y), fy(0))}
            height={Math.max(0.5, Math.abs(fy(p.y) - fy(0)))}
            className={p.destaque ? "pv-coluna-neg" : "pv-coluna"}
          />
        ),
      )}
      {ultimo && ultimo.y !== null && (
        <text x={fx(ultimo.x) + largura / 2 + 6} y={fy(ultimo.y) + 4} className="pv-rotulo-forte">{num(ultimo.y, casas)}</text>
      )}
    </svg>
  );
}

/** Marcas do eixo x de anos: o primeiro, o último e os múltiplos de cinco que não encostam neles. */
export function marcasAnos(anos: number[]): { x: number; rotulo: string }[] {
  const a0 = anos[0];
  const a1 = anos[anos.length - 1];
  return anos.filter((a) => a === a0 || a === a1 || (a % 5 === 0 && a - a0 >= 3 && a1 - a >= 3)).map((a) => ({ x: a, rotulo: String(a) }));
}
