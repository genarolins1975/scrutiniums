/**
 * Gráficos do painel Educação nos municípios, desenhados no servidor em SVG (sem biblioteca, sem script no navegador).
 * Regras (skills observatorio-layout §6, impeccable e design-taste-frontend, app-screens §6):
 * - o Ideb vai na escala inteira dele, de 0 a 10, com marcas de 2 em 2: a distância entre linhas é a do índice;
 * - linhas em segmentos retos, sem suavizar; ausência parte a linha (2013 sem Ideb não vira zero nem ponte);
 * - no máximo três séries, rótulo direto no fim de cada linha (sem legenda), rótulos afastados para não se tocarem;
 * - a meta do primeiro ciclo aparece como marca vazada, não como linha: é referência, não dado observado;
 * - 2021 leva uma nota (ano da pandemia, como o INEP adverte na nota informativa);
 * - colunas começam no zero; a coluna do município é a única no acento; o texto alternativo descreve o que se vê.
 */
import { ideb as fIdeb, num } from "@/lib/educacao/formato";

const LARGO = 720;
const ESTREITO = 380;
const margens = (L: number) => (L < 500 ? { e: 34, d: 96, t: 34, b: 34 } : { e: 40, d: 120, t: 34, b: 34 });

export type PontoAno = { x: number; y: number | null };
export type SerieLinha = { nome: string; rotulo: string; classe: "edm-linha" | "edm-linha-ref" | "edm-linha-br"; pontos: PontoAno[] };

function caminho(pontos: PontoAno[], fx: (x: number) => number, fy: (y: number) => number): string {
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

/** Afasta rótulos de fim de linha que ficariam a menos de `min` px um do outro, mantendo a ordem vertical. */
export function afastar(ys: number[], min: number, topo: number, base: number): number[] {
  const ordem = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < ordem.length; k++) if (ordem[k].y - ordem[k - 1].y < min) ordem[k].y = ordem[k - 1].y + min;
  const excesso = ordem.length ? ordem[ordem.length - 1].y - base : 0;
  if (excesso > 0) for (const o of ordem) o.y -= excesso;
  for (let k = 0; k < ordem.length; k++) ordem[k].y = Math.max(topo + k * min, ordem[k].y);
  const out = new Array<number>(ys.length);
  for (const o of ordem) out[o.i] = o.y;
  return out;
}

type PropsSerie = {
  compacto?: boolean;
  series: SerieLinha[];
  anos: number[];
  metas?: (PontoAno & { observado?: number | null })[];
  /** Ano com nota no topo do gráfico (2021, pandemia). */
  anoNota?: { ano: number; texto: string };
  descricao: string;
};

export function GraficoIdeb(p: PropsSerie) {
  if (p.compacto) return <SerieIdeb {...p} largura={ESTREITO} />;
  return (
    <>
      <div className="edm-so-largo"><SerieIdeb {...p} largura={LARGO} /></div>
      <div className="edm-so-estreito"><SerieIdeb {...p} largura={ESTREITO} /></div>
    </>
  );
}

function SerieIdeb({ series, anos, metas = [], anoNota, descricao, largura: L }: PropsSerie & { largura: number }) {
  const M = margens(L);
  const altura = 270;
  const x0 = anos[0];
  const x1 = anos[anos.length - 1];
  const fx = (x: number) => M.e + ((x - x0) / Math.max(1, x1 - x0)) * (L - M.e - M.d);
  const fy = (y: number) => M.t + (1 - y / 10) * (altura - M.t - M.b);
  const passo = L < 500 ? 4 : 2;
  const marcasX = anos.filter((a, i) => i % (passo / 2) === 0 || a === x1);
  const fins = series.map((s) => [...s.pontos].reverse().find((q) => q.y !== null) ?? null);
  const ysRot = afastar(fins.map((f) => (f && f.y !== null ? fy(f.y) + 4 : altura)), 17, M.t, altura - M.b);
  return (
    <svg viewBox={`0 0 ${L} ${altura}`} className="edm-svg" role="img" aria-label={descricao}>
      {[0, 2, 4, 6, 8, 10].map((t) => (
        <g key={t}>
          <line x1={M.e} x2={L - M.d} y1={fy(t)} y2={fy(t)} className={t === 0 ? "edm-base" : "edm-grade"} />
          <text x={M.e - 8} y={fy(t) + 4} textAnchor="end">{num(t)}</text>
        </g>
      ))}
      <text x={M.e} y={14}>Ideb, de 0 a 10</text>
      {anoNota && anoNota.ano >= x0 && anoNota.ano <= x1 && (
        <g>
          <line x1={fx(anoNota.ano)} x2={fx(anoNota.ano)} y1={M.t - 4} y2={altura - M.b} className="edm-nota-linha" />
          <text x={fx(anoNota.ano)} y={M.t - 8} textAnchor="middle" className="edm-nota-texto">{anoNota.texto}</text>
        </g>
      )}
      {marcasX.map((a) => (
        <text key={a} x={fx(a)} y={altura - 10} textAnchor="middle">{a}</text>
      ))}
      {metas.filter((m) => m.y !== null && m.observado != null).map((m) => (
        <circle key={`meta-${m.x}`} cx={fx(m.x)} cy={fy(m.y as number)} r={4} className={m.observado! >= m.y! ? "edm-meta edm-meta-cheia" : "edm-meta"} />
      ))}
      {series.map((s) => (
        <path key={s.nome} d={caminho(s.pontos, fx, fy)} className={s.classe} />
      ))}
      {series.map((s) =>
        s.pontos.map((q) => {
          // ponto isolado (sem vizinho com dado) aparece como ponto, para não sumir
          const i = s.pontos.indexOf(q);
          const isolado = q.y !== null && (s.pontos[i - 1]?.y ?? null) === null && (s.pontos[i + 1]?.y ?? null) === null;
          return isolado ? <circle key={`${s.nome}-${q.x}`} cx={fx(q.x)} cy={fy(q.y as number)} r={3.5} className={`${s.classe}-ponto`} /> : null;
        }),
      )}
      {series.map((s, i) => {
        const f = fins[i];
        if (!f || f.y === null) return null;
        return (
          <g key={`${s.nome}-fim`}>
            <circle cx={fx(f.x)} cy={fy(f.y)} r={3.5} className={`${s.classe}-ponto`} />
            <text x={fx(f.x) + 9} y={ysRot[i]} className={s.classe === "edm-linha" ? "edm-rotulo-forte" : "edm-rotulo"}>
              {s.rotulo} {fIdeb(f.y)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Distribuição do Ideb em faixas de meio ponto; a faixa do município no acento e a mediana marcada. */
export function GraficoDistribuicao(p: PropsDistribuicao) {
  if (p.compacto) return <Distribuicao {...p} largura={ESTREITO} />;
  return (
    <>
      <div className="edm-so-largo"><Distribuicao {...p} largura={LARGO} /></div>
      <div className="edm-so-estreito"><Distribuicao {...p} largura={ESTREITO} /></div>
    </>
  );
}

type PropsDistribuicao = { compacto?: boolean; escalaCompleta?: boolean; faixas: number[]; destaque: number | null; mediana: number; descricao: string; unidade: string };

function Distribuicao({ faixas, destaque, mediana, descricao, unidade, escalaCompleta = false, largura: L }: PropsDistribuicao & { largura: number }) {
  const M = { e: 44, d: 16, t: 46, b: 34 };
  const altura = 230;
  const primeira = Math.max(0, Math.min(faixas.findIndex((n) => n > 0), destaque === null ? 99 : Math.floor(destaque * 2)));
  const ultima = Math.min(19, Math.max(19 - [...faixas].reverse().findIndex((n) => n > 0), destaque === null ? 0 : Math.floor(destaque * 2)));
  const i0 = escalaCompleta ? 0 : Math.max(0, primeira - (primeira % 2));
  const i1 = escalaCompleta ? 19 : Math.min(19, ultima + ((ultima + 1) % 2));
  const vis = faixas.slice(i0, i1 + 1);
  const max = Math.max(1, ...vis);
  const topoY = (() => {
    const p = 10 ** Math.floor(Math.log10(max));
    for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= max) return m * p;
    return 10 * p;
  })();
  const w = (L - M.e - M.d) / vis.length;
  const fx = (valor: number) => M.e + (valor * 2 - i0) * w;
  const fy = (n: number) => M.t + (1 - n / topoY) * (altura - M.t - M.b);
  const iDestaque = destaque === null ? null : Math.min(19, Math.floor(destaque * 2 + 1e-9));
  const marcas = [0, 0.5, 1].map((f) => Math.round(f * topoY));
  const inteiros = Array.from({ length: 11 }, (_, k) => k).filter((v) => v * 2 >= i0 && v * 2 <= i1 + 1);
  return (
    <svg viewBox={`0 0 ${L} ${altura}`} className="edm-svg" role="img" aria-label={descricao}>
      {[...new Set(marcas)].map((t) => (
        <g key={t}>
          <line x1={M.e} x2={L - M.d} y1={fy(t)} y2={fy(t)} className={t === 0 ? "edm-base" : "edm-grade"} />
          <text x={M.e - 8} y={fy(t) + 4} textAnchor="end">{num(t)}</text>
        </g>
      ))}
      <text x={M.e} y={14}>{unidade}</text>
      {vis.map((n, k) => {
        const i = i0 + k;
        if (n === 0) return null;
        return <rect key={i} x={M.e + k * w + 1} width={Math.max(1, w - 2)} y={fy(n)} height={fy(0) - fy(n)} className={i === iDestaque ? "edm-coluna-destaque" : "edm-coluna"} />;
      })}
      <line x1={fx(mediana)} x2={fx(mediana)} y1={M.t - 6} y2={fy(0)} className="edm-mediana" />
      <text x={fx(mediana)} y={M.t - 12} textAnchor={fx(mediana) > L - 120 ? "end" : "middle"} className="edm-rotulo">Mediana {fIdeb(mediana)}</text>
      {inteiros.map((v) => (
        <text key={v} x={fx(v)} y={altura - 10} textAnchor="middle">{num(v)}</text>
      ))}
    </svg>
  );
}

/** Pequenos múltiplos: a mesma escala em ambas as etapas, sem unir edições ausentes. */
export function GraficoComponente({ anos, valores, max, unidade, descricao }: { anos: number[]; valores: (number | null)[]; max: number; unidade: string; descricao: string }) {
  const L = 380, H = 210, e = 44, d = 22, t = 40, b = 30;
  const fx = (a: number) => e + (a - anos[0]) / Math.max(1, anos[anos.length - 1] - anos[0]) * (L - e - d);
  const fy = (v: number) => t + (1 - v / max) * (H - t - b);
  const pontos = anos.map((x, i) => ({ x, y: valores[i] }));
  return <svg viewBox={`0 0 ${L} ${H}`} className="edm-svg" role="img" aria-label={descricao}>
    <title>{descricao}</title>
    {[0, max / 2, max].map((v) => <g key={v}><line x1={e} x2={L-d} y1={fy(v)} y2={fy(v)} className="edm-grade"/><text x={e-8} y={fy(v)+4} textAnchor="end">{num(v, max === 1 ? 1 : 0)}</text></g>)}
    {anos.includes(2021) && <g><line x1={fx(2021)} x2={fx(2021)} y1={t} y2={H-b} className="edm-nota-linha"/><text x={fx(2021)} y={t-12} textAnchor="middle">2021</text></g>}
    <path d={caminho(pontos, fx, fy)} className="edm-linha"/>
    {pontos.filter(p => p.y !== null).map(p => <circle key={p.x} cx={fx(p.x)} cy={fy(p.y!)} r={2.5} className="edm-linha-ponto"/>)}
    {anos.filter((_, i) => i % 2 === 0).map(a => <text key={a} x={fx(a)} y={H-8} textAnchor="middle">{a}</text>)}
    <desc>{unidade}</desc>
  </svg>;
}
