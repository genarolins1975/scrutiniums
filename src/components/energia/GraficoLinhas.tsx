"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * Gráfico de linhas SVG com camada de leitura: cruz + dica no hover, setas do
 * teclado percorrem os pontos (Home e End vão ao início e ao fim), rótulo
 * direto no fim de cada linha quando não colide, legenda sempre presente e
 * tabela equivalente recolhida (montada só ao abrir, para não pesar o HTML).
 * Ausência é lacuna na linha (nunca zero). Um único eixo Y.
 */
export type SerieLinha = {
  id: string;
  rotulo: string;
  /** Rótulo curto (SE/CO, S, NE, N): usado no celular e quando linhas terminam juntas. */
  sigla?: string;
  cor: string;
  tracejada?: boolean;
  espessura?: number;
};

type Ponto = Record<string, string | number | null | undefined>;

export type GraficoLinhasProps = {
  titulo: string;
  dados: Ponto[];
  chaveX: string;
  series: SerieLinha[];
  unidade: string;
  casas?: number;
  formatoX?: "data" | "hora" | "mes" | "md" | "texto";
  zeroNoEixo?: boolean;
  banda?: { inferior: string; superior: string; rotulo: string; cor?: string };
  /** Eventos documentados marcados na série; a descrição aparece na dica ao passar pelo ponto. */
  marcos?: { x: string; rotulo: string; descricao?: string }[];
  altura?: number;
  rotulosDiretos?: boolean;
  /** Domínio fixo do eixo Y, para small multiples com a mesma régua. */
  yDominio?: [number, number];
  /** Faixas de fundo discretas no eixo X (madrugada, manhã, tarde, noite). */
  faixasX?: { de: string; ate: string; rotulo: string }[];
  /** A dica ensina: o que o gráfico mede, a fonte e o caminho para o verbete. */
  ensina?: { texto: string; fonte?: string; href?: string; hrefRotulo?: string };
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function fmtX(v: string, f: GraficoLinhasProps["formatoX"], longo = false): string {
  if (!v) return "";
  if (f === "hora") return longo && v.length > 5 ? `${v.slice(8, 10)}/${v.slice(5, 7)} ${v.slice(11, 13)}h` : v.length > 5 ? `${v.slice(11, 13)}h` : `${v.slice(0, 2)}h`;
  if (f === "mes") return `${MESES[Number(v.slice(5, 7)) - 1]}/${v.slice(2, 4)}`;
  if (f === "md") return longo ? `${v.slice(3, 5)}/${v.slice(0, 2)}` : (MESES[Number(v.slice(0, 2)) - 1] ?? v);
  if (f === "data") return longo ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : `${MESES[Number(v.slice(5, 7)) - 1]}/${v.slice(2, 4)}`;
  return v;
}

function fmtV(v: number | null | undefined, casas: number, unidade: string): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "sem dado";
  // sinal de menos tipográfico, como no resto do portal
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).replace(/^-/, "\u2212")} ${unidade}`.trim();
}

function ticks(min: number, max: number, n = 4): number[] {
  const span = max - min || 1;
  const bruto = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => span / p <= n + 0.5) ?? mag * 10;
  const ini = Math.ceil(min / passo) * passo;
  const out: number[] = [];
  for (let v = ini; v <= max + 1e-9; v += passo) out.push(Number(v.toFixed(10)));
  // amplitude pequena para o passo escolhido: refina até ter ao menos três marcas
  if (out.length < 3 && n < 16) return ticks(min, max, n * 2);
  return out;
}

export function GraficoLinhas({
  titulo,
  dados,
  chaveX,
  series,
  unidade,
  casas = 1,
  formatoX = "data",
  zeroNoEixo = false,
  banda,
  marcos = [],
  altura = 300,
  rotulosDiretos = true,
  yDominio,
  faixasX = [],
  ensina,
}: GraficoLinhasProps) {
  const uid = useId();
  const [largura, setLargura] = useState(760);
  const [ativo, setAtivo] = useState<number | null>(null);
  const [tabelaAberta, setTabelaAberta] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setLargura(Math.max(300, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const L = largura < 520 ? 44 : 56;
  const R = rotulosDiretos ? (largura < 520 ? 92 : 124) : 16;
  const T = 14;
  const B = 30;
  const w = largura;
  const h = altura;

  const { yMin, yMax } = useMemo(() => {
    if (yDominio) return { yMin: yDominio[0], yMax: yDominio[1] };
    const vals: number[] = [];
    for (const d of dados) {
      for (const s of series) {
        const v = d[s.id];
        if (typeof v === "number" && Number.isFinite(v)) vals.push(v);
      }
      if (banda) {
        for (const k of [banda.inferior, banda.superior]) {
          const v = d[k];
          if (typeof v === "number" && Number.isFinite(v)) vals.push(v);
        }
      }
    }
    if (!vals.length) return { yMin: 0, yMax: 1 };
    let mn = Math.min(...vals);
    const mx = Math.max(...vals);
    if (zeroNoEixo) mn = Math.min(0, mn);
    const pad = (mx - mn) * 0.06 || 1;
    return { yMin: zeroNoEixo && mn >= 0 ? 0 : mn - pad, yMax: mx + pad };
  }, [dados, series, banda, zeroNoEixo, yDominio]);

  const n = dados.length;
  const x = (i: number) => L + (n <= 1 ? 0 : (i / (n - 1)) * (w - L - R));
  const y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin || 1)) * (h - T - B);

  const caminhos = series.map((s) => {
    let d = "";
    let aberto = false;
    dados.forEach((p, i) => {
      const v = p[s.id];
      if (typeof v === "number" && Number.isFinite(v)) {
        d += `${aberto ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        aberto = true;
      } else {
        aberto = false; // lacuna: ausência não é zero
      }
    });
    return d;
  });

  let bandaPath = "";
  if (banda) {
    const sup: string[] = [];
    const inf: string[] = [];
    dados.forEach((p, i) => {
      const a = p[banda.superior];
      const b = p[banda.inferior];
      if (typeof a === "number" && typeof b === "number") {
        sup.push(`${x(i).toFixed(1)},${y(a).toFixed(1)}`);
        inf.unshift(`${x(i).toFixed(1)},${y(b).toFixed(1)}`);
      }
    });
    if (sup.length) bandaPath = `M${sup.join("L")}L${inf.join("L")}Z`;
  }

  // rótulos diretos no último ponto válido, afastados para não colidir
  const finais = series
    .map((s) => {
      for (let i = n - 1; i >= 0; i--) {
        const v = dados[i][s.id];
        if (typeof v === "number" && Number.isFinite(v)) return { s, i, v, yy: y(v) };
      }
      return null;
    })
    .filter((f): f is { s: SerieLinha; i: number; v: number; yy: number } => !!f)
    .sort((a, b) => a.yy - b.yy);
  // linhas que terminam no mesmo ponto viram um só rótulo com as siglas ("SE/CO · NE · N"):
  // diz quais linhas se encontram no último ponto, sem afirmar que são iguais no resto do período
  const grupos: { itens: typeof finais; yy: number }[] = [];
  for (const f of finais) {
    const g = grupos.at(-1);
    if (g && Math.abs(g.itens[0].yy - f.yy) < 3 && g.itens[0].i === f.i) g.itens.push(f);
    else grupos.push({ itens: [f], yy: f.yy });
  }
  const rotulos = grupos.map((g) => ({ ...g, alvo: g.yy }));
  for (let k = 1; k < rotulos.length; k++) {
    if (rotulos[k].yy - rotulos[k - 1].yy < 14) rotulos[k].yy = rotulos[k - 1].yy + 14;
  }
  // rótulo direto seletivo: só onde cabe perto do próprio ponto e dentro da área
  // do gráfico; o que não cabe fica identificado pela legenda
  const finaisVisiveis = rotulos.filter((r) => Math.abs(r.yy - r.alvo) <= 10 && r.yy <= h - B - 4 && r.yy >= T + 4);

  // marcos só dentro do intervalo exibido; rótulos próximos são desempilhados
  const x0 = String(dados[0]?.[chaveX] ?? "");
  const x1 = String(dados[n - 1]?.[chaveX] ?? "");
  const marcosVisiveis: { m: { x: string; rotulo: string; descricao?: string }; i: number; linha: number }[] = [];
  for (const m of marcos) {
    if (!n || m.x < x0 || m.x > x1) continue;
    const i = dados.findIndex((d) => String(d[chaveX]) >= m.x);
    if (i < 0) continue;
    const anterior = marcosVisiveis.at(-1);
    const linha = anterior && x(i) - x(anterior.i) < 110 ? anterior.linha + 1 : 0;
    marcosVisiveis.push({ m, i, linha });
  }

  const yt = ticks(yMin, yMax);
  const nx = Math.min(largura < 520 ? 4 : 7, n);
  const horaDe = (v: string) => Number(v.length > 5 ? v.slice(11, 13) : v.slice(0, 2));
  const xtHora = formatoX === "hora" ? dados.map((d, i) => (horaDe(String(d[chaveX] ?? "")) % 6 === 0 || i === n - 1 ? i : -1)).filter((i) => i >= 0) : [];
  // séries horárias: marcas fixas em 00h, 06h, 12h, 18h e na última hora; demais: índices equidistantes
  const xt = n <= 1 ? [0] : xtHora.length >= 3 ? xtHora : Array.from({ length: nx }, (_, k) => Math.round((k / Math.max(nx - 1, 1)) * (n - 1)));
  // janela curta (menos de 130 dias): rótulos em dia/mês, para não repetir o mesmo mês nas marcas
  const xCurto = formatoX === "data" && dados.length > 1 && (Date.parse(String(dados[dados.length - 1][chaveX])) - Date.parse(String(dados[0][chaveX]))) / 86400000 < 130;
  const rotuloX = (v: string) => (xCurto && v.length >= 10 ? `${v.slice(8, 10)}/${v.slice(5, 7)}` : fmtX(v, formatoX));

  function mover(ev: React.PointerEvent<SVGRectElement>) {
    const r = (ev.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * (w - L - R);
    const i = Math.round((px / (w - L - R)) * (n - 1));
    setAtivo(Math.max(0, Math.min(n - 1, i)));
  }

  function teclado(ev: React.KeyboardEvent<SVGSVGElement>) {
    if (ev.key === "Home" || ev.key === "End") {
      ev.preventDefault();
      setAtivo(ev.key === "Home" ? 0 : n - 1);
    } else if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
      ev.preventDefault();
      setAtivo((a) => {
        const base = a ?? n - 1;
        return Math.max(0, Math.min(n - 1, base + (ev.key === "ArrowRight" ? 1 : -1)));
      });
    } else if (ev.key === "Escape") setAtivo(null);
  }

  const pa = ativo !== null ? dados[ativo] : null;
  const tipX = ativo !== null ? x(ativo) : 0;

  return (
    <div ref={ref} className="relative w-full">
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 px-1 text-xs text-carvao-muted" aria-label="Legenda">
        {series.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <svg width="18" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="18" y2="4" stroke={s.cor} strokeWidth="2.5" strokeDasharray={s.tracejada ? "4 3" : undefined} />
            </svg>
            {s.rotulo}
          </li>
        ))}
        {banda && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-4" style={{ background: banda.cor ?? "color-mix(in srgb, var(--serie-referencia) 22%, transparent)" }} />
            {banda.rotulo}
          </li>
        )}
      </ul>
      {/* altura fixa em pixels: o HTML do servidor já reserva a altura final, e âncoras abaixo
          do gráfico não se deslocam quando a largura real é medida no cliente */}
      <svg
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-labelledby={`${uid}-t`}
        tabIndex={0}
        onKeyDown={teclado}
        onBlur={() => setAtivo(null)}
        className="block overflow-visible focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
      >
        <title id={`${uid}-t`}>{`${titulo}. Use as setas para percorrer os pontos.`}</title>
        {yt.map((v) => (
          <g key={v}>
            <line x1={L} x2={w - R} y1={y(v)} y2={y(v)} stroke="var(--cor-grade)" strokeWidth="1" />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--cor-mineral)">
              {v.toLocaleString("pt-BR", { maximumFractionDigits: Math.abs(yMax - yMin) < 5 ? 1 : 0 }).replace(/^-/, "\u2212")}
            </text>
          </g>
        ))}
        {xt.map((i) => (
          <text key={i} x={x(i)} y={h - 8} textAnchor="middle" fontSize="11" fill="var(--cor-mineral)">
            {rotuloX(String(dados[i]?.[chaveX] ?? ""))}
          </text>
        ))}
        {faixasX.map((fx) => {
          const i0 = dados.findIndex((d) => String(d[chaveX]) >= fx.de);
          let i1 = -1;
          for (let k = n - 1; k >= 0; k--) {
            if (String(dados[k][chaveX]) <= fx.ate) {
              i1 = k;
              break;
            }
          }
          if (i0 < 0 || i1 < i0) return null;
          return (
            <g key={fx.rotulo} pointerEvents="none">
              <rect x={x(i0)} y={T} width={Math.max(1, x(i1) - x(i0))} height={h - T - B} fill="var(--cor-carvao)" opacity={0.035} />
              <text x={(x(i0) + x(i1)) / 2} y={T + 11} textAnchor="middle" fontSize="10.5" fill="var(--cor-mineral)" className={x(i1) - x(i0) < 62 ? "hidden" : undefined}>
                {fx.rotulo}
              </text>
            </g>
          );
        })}
        {bandaPath && <path d={bandaPath} fill={banda?.cor ?? "color-mix(in srgb, var(--serie-referencia) 22%, transparent)"} stroke="none" />}
        {marcosVisiveis.map(({ m, i, linha }) => (
          <g key={m.x}>
            <line x1={x(i)} x2={x(i)} y1={T} y2={h - B} stroke="var(--cor-mineral)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={x(i) + 4} y={T + 10 + linha * 13} fontSize="10" fill="var(--cor-mineral)">
              {m.rotulo}
            </text>
          </g>
        ))}
        {series.map((s, k) => (
          <path
            key={s.id}
            d={caminhos[k]}
            fill="none"
            stroke={s.cor}
            strokeWidth={s.espessura ?? 2}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={s.tracejada ? "5 4" : undefined}
          />
        ))}
        {rotulosDiretos &&
          finaisVisiveis.map((r) => {
            const f = r.itens[0];
            const curto = (s: SerieLinha) => s.sigla ?? s.rotulo;
            const texto =
              r.itens.length > 1 ? r.itens.map((i) => curto(i.s)).join(largura < 520 ? "·" : " · ") : largura < 520 || f.s.rotulo.length > 18 ? curto(f.s) : f.s.rotulo;
            // rótulo que não cabe na margem direita é omitido: a legenda identifica a série
            if (x(f.i) + 8 + texto.length * 6.2 > w - 2) return null;
            return (
              <g key={f.s.id}>
                <circle cx={x(f.i)} cy={y(f.v)} r="3.5" fill={f.s.cor} stroke="var(--cor-superficie)" strokeWidth="1.5" />
                <text x={x(f.i) + 8} y={r.yy + 4} fontSize="11" fill="var(--cor-carvao)">
                  {texto}
                </text>
              </g>
            );
          })}
        {ativo !== null && (
          <g pointerEvents="none">
            <line x1={tipX} x2={tipX} y1={T} y2={h - B} stroke="var(--cor-carvao)" strokeWidth="1" opacity="0.5" />
            {series.map((s) => {
              const v = pa?.[s.id];
              return typeof v === "number" && Number.isFinite(v) ? (
                <circle key={s.id} cx={tipX} cy={y(v)} r="4.5" fill={s.cor} stroke="var(--cor-superficie)" strokeWidth="2" />
              ) : null;
            })}
          </g>
        )}
        <rect
          x={L}
          y={T}
          width={Math.max(1, w - L - R)}
          height={Math.max(1, h - T - B)}
          fill="transparent"
          onPointerMove={mover}
          onPointerDown={mover}
          onPointerLeave={() => setAtivo(null)}
        />
      </svg>
      {/* leitura do ponto ativo para leitor de tela: região persistente, anunciada a cada mudança */}
      <p className="sr-only" aria-live="polite">
        {pa
          ? `${fmtX(String(pa[chaveX]), formatoX, true)}: ${series.map((s) => `${s.rotulo} ${fmtV(pa[s.id] as number | null, casas, unidade)}`).join("; ")}`
          : ""}
      </p>
      {pa && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-6 z-20 min-w-[11rem] border border-linha bg-superficie px-3 py-2 text-xs shadow-[0_6px_20px_rgba(26,29,33,0.12)]"
          style={{ left: `min(max(0px, calc(${(tipX / w) * 100}% - 5.5rem)), calc(100% - 12rem))` }}
        >
          <p className="rotulo text-mineral">{fmtX(String(pa[chaveX]), formatoX, true)}</p>
          <ul className="mt-1 space-y-0.5">
            {series.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 text-carvao">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="inline-block h-2 w-2" style={{ background: s.cor }} />
                  {s.rotulo}
                </span>
                <span className="tabular-nums">{fmtV(pa[s.id] as number | null, casas, unidade)}</span>
              </li>
            ))}
            {banda && typeof pa[banda.inferior] === "number" && (
              <li className="flex justify-between gap-3 text-mineral">
                <span>{banda.rotulo}</span>
                <span className="tabular-nums">
                  {fmtV(pa[banda.inferior] as number, casas, "")} a {fmtV(pa[banda.superior] as number, casas, unidade)}
                </span>
              </li>
            )}
            {marcosVisiveis
              .filter((mv) => mv.i === ativo)
              .map(({ m }) => (
                <li key={m.x} className="mt-1 max-w-[16rem] border-t border-linha pt-1 leading-snug text-carvao-muted">
                  {m.rotulo}
                  {m.descricao ? `: ${m.descricao}` : ""}
                </li>
              ))}
            {ensina && <li className="mt-1 max-w-[16rem] border-t border-linha pt-1 leading-snug text-mineral">{ensina.texto}</li>}
          </ul>
        </div>
      )}
      {ensina && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-relaxed text-mineral">
          <span aria-hidden="true">ⓘ</span>
          <span>
            {ensina.texto}
            {ensina.fonte ? ` Fonte: ${ensina.fonte}.` : ""}
          </span>
          {ensina.href && (
            <a href={ensina.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
              {ensina.hrefRotulo ?? "Entenda"} <span aria-hidden="true">→</span>
            </a>
          )}
        </p>
      )}
      <details className="mt-3 text-xs" onToggle={(e) => setTabelaAberta((e.currentTarget as HTMLDetailsElement).open)}>
        <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
          Dados do gráfico em tabela ({n.toLocaleString("pt-BR")} {n === 1 ? "linha" : "linhas"})
        </summary>
        {tabelaAberta && (
          <div className="tabela-scroll mt-2 max-h-80 overflow-y-auto" tabIndex={0} role="region" aria-label={`${titulo}: dados em tabela (rolável)`}>
            <table className="w-full border-collapse tabular-nums">
              <caption className="sr-only">{`${titulo}, em ${unidade}`}</caption>
              <thead className="sticky top-0 bg-superficie">
                <tr className="text-left text-mineral">
                  <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">
                    {formatoX === "hora" ? "Hora" : formatoX === "mes" ? "Mês" : formatoX === "texto" ? "Item" : "Data"}
                  </th>
                  {series.map((s) => (
                    <th key={s.id} scope="col" className="border-b border-linha px-2 py-1.5 font-medium">{s.rotulo} ({unidade})</th>
                  ))}
                  {banda && <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">{banda.rotulo} ({unidade})</th>}
                </tr>
              </thead>
              <tbody>
                {dados.map((p, i) => (
                  <tr key={i} className="border-b border-linha">
                    <th scope="row" className="px-2 py-1 text-left font-normal text-carvao">{fmtX(String(p[chaveX] ?? ""), formatoX, true)}</th>
                    {series.map((s) => (
                      <td key={s.id} className="px-2 py-1 text-carvao">{fmtV(p[s.id] as number | null, casas, "")}</td>
                    ))}
                    {banda && (
                      <td className="px-2 py-1 text-mineral">
                        {typeof p[banda.inferior] === "number" ? `${fmtV(p[banda.inferior] as number, casas, "")} a ${fmtV(p[banda.superior] as number, casas, "")}` : "sem dado"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </div>
  );
}
