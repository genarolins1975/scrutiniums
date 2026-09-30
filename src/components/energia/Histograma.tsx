"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { num, plural } from "@/lib/energia/formato";
import {
  CHAVES_QUANTIS,
  ROTULO_QUANTIL,
  alturaClasse,
  casasMarcas,
  dominioLegivel,
  textoFracao,
  textoValor,
  type ChaveQuantil,
  type Classe,
  type DistribuicaoHistograma,
  type MassaPontual,
} from "@/lib/energia/distribuicao";
import { larguraTexto } from "@/lib/energia/dispersao";

/**
 * Histograma de uma distribuição (ex.: PLD horário em 12 meses) com
 * marcadores de quantis, marcador do valor atual e barra própria para massa
 * num ponto. Quando muitas observações são idênticas (horas no piso ou no
 * teto do PLD), juntá-las à classe vizinha esconderia o fenômeno e deformaria
 * a classe: elas são contadas à parte por montaHistograma, desenhadas numa
 * barra estreita hachurada no valor exato e explicadas no rodapé. Se essa
 * barra achataria as demais, ela é cortada no topo com marca de corte e a
 * contagem exata fica no rótulo.
 *
 * As classes chegam prontas (`dados`, calculado no servidor com
 * montaHistograma ou publicado pela gold): o navegador não recebe a série
 * bruta. Com larguras diferentes, a altura é densidade, não contagem. Setas
 * percorrem as barras da esquerda para a direita; ponteiro e toque mostram a
 * mesma dica; a tabela equivalente traz cada classe e cada barra própria.
 */
export type HistogramaProps = {
  titulo: string;
  dados: DistribuicaoHistograma;
  /** Nome da medida no eixo horizontal (ex.: "PLD horário"). */
  rotuloX: string;
  unidade: string;
  casas?: number;
  /** O que cada observação é (padrão: observação/observações). */
  contagem?: { singular: string; plural: string };
  /** Período da amostra, já escrito (ex.: "out/2025 a set/2026"). */
  periodo: string;
  /** Quantis marcados no gráfico (padrão: P10, P25, mediana, P75, P90). */
  marcadores?: ChaveQuantil[];
  /** Valor atual e, se calculada no servidor, sua posição (percentilDe). */
  valorAtual?: { valor: number | null | undefined; rotulo: string; percentil?: number | null };
  altura?: number;
  /** Cores por variável CSS: barras comuns e barra própria de massa. */
  cor?: string;
  corMassa?: string;
  nota?: string;
};

type Item = { tipo: "classe"; c: Classe; k: number } | { tipo: "massa"; m: MassaPontual; k: number };

const TEXTO_MASSA_PADRAO =
  "Valores idênticos neste ponto são contados à parte, fora das classes, para que o acúmulo num único valor não se confunda com a classe vizinha.";

function faixa(c: Classe, casas: number, unidade: string): string {
  return c.fechadaDireita
    ? `${num(c.inicio, casas)} a ${textoValor(c.fim, casas, unidade)}, inclusive`
    : `${num(c.inicio, casas)} a menos de ${textoValor(c.fim, casas, unidade)}`;
}

export function Histograma({
  titulo,
  dados,
  rotuloX,
  unidade,
  casas = 1,
  contagem = { singular: "observação", plural: "observações" },
  periodo,
  marcadores = [...CHAVES_QUANTIS],
  valorAtual,
  altura = 280,
  cor = "var(--cor-energia-soft)",
  corMassa = "var(--cor-energia-dark)",
  nota,
}: HistogramaProps) {
  const uid = useId().replace(/:/g, "");
  const [largura, setLargura] = useState(760);
  const [ativo, setAtivo] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setLargura(Math.max(300, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { classes, massas, resumo: res, foraDasClasses: fora, larguraReferencia: lref, larguraUniforme } = dados;
  const n = res.n;
  const atual = typeof valorAtual?.valor === "number" && Number.isFinite(valorAtual.valor) ? valorAtual.valor : null;

  // itens na ordem de leitura (teclado e tabela): massa antes da classe que começa no mesmo valor
  const itens: Item[] = useMemo(() => {
    const t: Item[] = [...classes.map((c, k) => ({ tipo: "classe" as const, c, k })), ...massas.map((m, k) => ({ tipo: "massa" as const, m, k }))];
    const pos = (i: Item) => (i.tipo === "classe" ? i.c.inicio : i.m.valor);
    return t.sort((a, b) => pos(a) - pos(b) || (a.tipo === "massa" ? -1 : 1));
  }, [classes, massas]);

  const estreito = largura < 520;
  const L = estreito ? 44 : 52;
  const R = 16;
  const B = 44;
  const P = 10; // folga interna: barra própria na borda não sai da área
  const w = largura;
  const h = altura;

  // domínio horizontal: bordas das classes, massas, valor atual e extremos observados
  const xs: number[] = [];
  if (classes.length) xs.push(classes[0].inicio, classes[classes.length - 1].fim);
  for (const m of massas) xs.push(m.valor);
  for (const v of [res.min, res.max, atual]) if (typeof v === "number") xs.push(v);
  let xMin = xs.length ? Math.min(...xs) : 0;
  let xMax = xs.length ? Math.max(...xs) : 1;
  if (xMin === xMax) {
    xMin -= Math.abs(xMin) * 0.1 || 1;
    xMax += Math.abs(xMax) * 0.1 || 1;
  }
  const sx = (v: number) => L + P + ((v - xMin) / (xMax - xMin)) * (w - L - R - 2 * P);

  // marcadores (valor atual e quantis) com rótulos em fileiras para não colidir; quantis
  // iguais (comum com massa no piso: P10 = P25 = mediana) viram uma linha com rótulo conjunto
  const quantisIguais: { v: number; chaves: ChaveQuantil[] }[] = [];
  for (const k of CHAVES_QUANTIS) {
    const v = res[k];
    if (!marcadores.includes(k) || typeof v !== "number") continue;
    const g = quantisIguais.find((q) => q.v === v);
    if (g) g.chaves.push(k);
    else quantisIguais.push({ v, chaves: [k] });
  }
  const marcas = [
    ...(atual !== null && valorAtual ? [{ id: "atual", x: sx(atual), texto: `${valorAtual.rotulo}: ${textoValor(atual, casas, unidade)}`, atual: true }] : []),
    ...quantisIguais.map((q) => ({ id: q.chaves.join("-"), x: sx(q.v), texto: q.chaves.map((k) => ROTULO_QUANTIL[k]).join(", "), atual: false })),
  ];
  // rótulo à direita da linha; perto da borda direita, à esquerda
  const esquerda = marcas.map((m) => m.x + 4 + larguraTexto(m.texto) > w - 2);
  const extensao = marcas.map((m, k) => (esquerda[k] ? [m.x - 4 - larguraTexto(m.texto), m.x] : [m.x - 2, m.x + 4 + larguraTexto(m.texto)]));
  const fileiras: number[] = [];
  const fimFileira: number[] = [];
  for (const k of marcas.map((_, i) => i).sort((a, b) => extensao[a][0] - extensao[b][0])) {
    let f = fimFileira.findIndex((fim) => fim < extensao[k][0]);
    if (f < 0) f = fimFileira.length;
    fimFileira[f] = extensao[k][1] + 4;
    fileiras[k] = f;
  }
  const nFileiras = Math.max(1, fimFileira.length);
  const T = 12 + (nFileiras - 1) * 13 + 10;
  const base = h - B;

  // escala vertical: a barra própria que achataria as classes é cortada no topo
  const alturas = classes.map((c) => alturaClasse(c, lref));
  const maxReg = alturas.length ? Math.max(...alturas) : 0;
  const maxMassa = massas.length ? Math.max(...massas.map((m) => m.contagem)) : 0;
  const cortar = maxReg > 0 && maxMassa > 2 * maxReg;
  const dy = dominioLegivel([0, cortar ? maxReg * 1.2 : Math.max(maxReg, maxMassa, 1)], { incluirZero: true, alvo: 4 });
  const sy = (v: number) => base - (Math.min(v, dy.max) / dy.max) * (base - T);
  const casasY = casasMarcas(dy.marcas);

  // marcas do eixo X nas bordas das classes, rareadas para caber
  const bordas = classes.length ? [...classes.map((c) => c.inicio), classes[classes.length - 1].fim] : massas.map((m) => m.valor).sort((a, b) => a - b);
  const casasX = casasMarcas(bordas);
  const cabeRotulos = Math.max(2, Math.floor((w - L - R) / (estreito ? 48 : 60)));
  const salto = Math.max(1, Math.ceil(bordas.length / cabeRotulos));
  const bordasVisiveis = bordas.filter((_, i) => i % salto === 0);

  const MEIA_MASSA = 5;
  const geo = itens.map((it) => {
    if (it.tipo === "classe") {
      const x0 = sx(it.c.inicio) + 1;
      const x1 = sx(it.c.fim) - 1;
      const y = sy(alturas[it.k]);
      return { x0, x1, y, cortada: false };
    }
    const cx = sx(it.m.valor);
    const cortada = cortar && it.m.contagem > dy.max;
    return { x0: cx - MEIA_MASSA, x1: cx + MEIA_MASSA, y: cortada ? T : sy(it.m.contagem), cortada };
  });

  function apontar(ev: React.PointerEvent<SVGRectElement>) {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    const esc = w / r.width;
    const px = (ev.clientX - r.left) * esc;
    // barra própria primeiro (alvo de 44 px em volta da barra estreita), depois a classe sob o ponteiro
    let achado: number | null = null;
    let dMin = 22 * esc;
    itens.forEach((it, i) => {
      if (it.tipo !== "massa") return;
      const d = Math.abs(px - (geo[i].x0 + MEIA_MASSA));
      if (d <= dMin) {
        dMin = d;
        achado = i;
      }
    });
    if (achado === null) {
      const i = itens.findIndex((it, j) => it.tipo === "classe" && px >= geo[j].x0 - 1 && px <= geo[j].x1 + 1);
      achado = i >= 0 ? i : null;
    }
    if (achado !== null) setAtivo(achado);
    else if (ev.type === "pointerdown" || ev.pointerType === "mouse") setAtivo(null);
  }

  function teclado(ev: React.KeyboardEvent<SVGSVGElement>) {
    const t = itens.length;
    if (!t) return;
    if (ev.key === "Home" || ev.key === "End") {
      ev.preventDefault();
      setAtivo(ev.key === "Home" ? 0 : t - 1);
    } else if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
      ev.preventDefault();
      const d = ev.key === "ArrowRight" ? 1 : -1;
      setAtivo((a) => (a === null ? (d > 0 ? 0 : t - 1) : Math.max(0, Math.min(t - 1, a + d))));
    } else if (ev.key === "Escape") setAtivo(null);
  }

  const contar = (k: number) => plural(k, contagem.singular, contagem.plural);
  const doTotal = (k: number) => (n ? `${textoFracao(k / n)} do total` : "");
  function descreve(it: Item): { titulo: string; linhas: string[] } {
    if (it.tipo === "massa") {
      return {
        titulo: `Exatamente ${textoValor(it.m.valor, casas, unidade)} (${it.m.rotulo})`,
        linhas: [contar(it.m.contagem), doTotal(it.m.contagem), "Barra própria, fora das classes"],
      };
    }
    const dentro = massas.filter((m) => m.valor >= it.c.inicio && (m.valor < it.c.fim || (it.c.fechadaDireita && m.valor === it.c.fim)));
    return {
      titulo: faixa(it.c, casas, unidade),
      linhas: [
        contar(it.c.contagem),
        doTotal(it.c.contagem),
        ...dentro.map((m) => `Sem as ${num(m.contagem, 0)} exatamente em ${textoValor(m.valor, casas, unidade)}, contadas à parte`),
      ],
    };
  }

  const ia = ativo !== null && ativo < itens.length ? ativo : null;
  const desc = ia !== null ? descreve(itens[ia]) : null;
  const ga = ia !== null ? geo[ia] : null;
  const leitura = desc ? `${desc.titulo}: ${desc.linhas.filter(Boolean).join("; ")}.` : "";
  const nomeX = `${rotuloX} (${unidade})`;
  const legendaBarras = larguraUniforme
    ? `${contagem.plural} em cada classe de ${textoValor(lref, casasMarcas([lref]), unidade)}`
    : `${contagem.plural} por ${textoValor(lref, casasMarcas([lref]), unidade)} (classes de larguras diferentes: altura é densidade)`;

  return (
    <div ref={ref} className="relative w-full">
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <defs>
          <pattern id={`${uid}-hachura`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="5" height="5" fill="var(--cor-superficie)" />
            <line x1="0" y1="0" x2="0" y2="5" stroke={corMassa} strokeWidth="2.5" />
          </pattern>
        </defs>
      </svg>
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 px-1 text-xs text-carvao-muted" aria-label="Legenda">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-3" style={{ background: cor }} />
          {legendaBarras.charAt(0).toUpperCase() + legendaBarras.slice(1)}
        </li>
        {massas.map((m) => (
          <li key={`m${m.valor}`} className="flex items-center gap-1.5">
            <svg width="12" height="12" aria-hidden="true">
              <rect x="1" y="1" width="10" height="10" fill={`url(#${uid}-hachura)`} stroke={corMassa} strokeWidth="1.5" />
            </svg>
            Barra própria: {m.rotulo} ({textoValor(m.valor, casas, unidade)})
          </li>
        ))}
        {marcadores.length > 0 && (
          <li className="flex items-center gap-1.5">
            <svg width="16" height="10" aria-hidden="true">
              <line x1="8" y1="0" x2="8" y2="10" stroke="var(--cor-carvao-muted)" strokeWidth="1" strokeDasharray="2 2" />
            </svg>
            Quantis ({marcadores.map((k) => ROTULO_QUANTIL[k]).join(", ")})
          </li>
        )}
        {atual !== null && valorAtual && (
          <li className="flex items-center gap-1.5">
            <svg width="16" height="10" aria-hidden="true">
              <line x1="8" y1="0" x2="8" y2="10" stroke="var(--cor-carvao)" strokeWidth="2" />
            </svg>
            {valorAtual.rotulo}
          </li>
        )}
      </ul>
      <div className="relative">
        <svg
          ref={svgRef}
          width="100%"
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-labelledby={`${uid}-t`}
          aria-describedby={`${uid}-r`}
          tabIndex={0}
          onKeyDown={teclado}
          onBlur={() => setAtivo(null)}
          className="block overflow-visible focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
        >
          <title id={`${uid}-t`}>
            {`${titulo}. Histograma de ${contar(n)} com valor: ${nomeX}. Use as setas para percorrer as barras da esquerda para a direita.`}
          </title>
          {dy.marcas.map((v) => (
            <g key={`y${v}`}>
              <line x1={L} x2={w - R} y1={sy(v)} y2={sy(v)} stroke="var(--cor-grade)" strokeWidth="1" />
              <text x={L - 8} y={sy(v) + 4} textAnchor="end" fontSize="11" fill="var(--cor-mineral)">
                {num(v, casasY)}
              </text>
            </g>
          ))}
          {bordasVisiveis.map((v) => (
            <text key={`x${v}`} x={sx(v)} y={base + 16} textAnchor="middle" fontSize="11" fill="var(--cor-mineral)">
              {num(v, casasX)}
            </text>
          ))}
          <text x={L + (w - L - R) / 2} y={h - 8} textAnchor="middle" fontSize="12" fill="var(--cor-carvao-muted)">
            {`${nomeX} →`}
          </text>

          {n === 0 && (
            <text x={L + (w - L - R) / 2} y={T + (base - T) / 2} textAnchor="middle" fontSize="12" fill="var(--cor-mineral)">
              Sem observações com valor no período
            </text>
          )}

          {/* classes: zero é barra vazia (não houve observação), nunca ausência */}
          {itens.map((it, i) =>
            it.tipo === "classe" && it.c.contagem > 0 ? (
              <rect key={`c${it.k}`} data-classe={it.k} x={geo[i].x0} y={geo[i].y} width={Math.max(1, geo[i].x1 - geo[i].x0)} height={Math.max(0, base - geo[i].y)} fill={cor} />
            ) : null,
          )}
          <line x1={L} x2={w - R} y1={base} y2={base} stroke="var(--cor-carvao-muted)" strokeWidth="1" />

          {marcas.map((m, k) => (
            <g key={m.id}>
              <line
                x1={m.x}
                x2={m.x}
                y1={12 + fileiras[k] * 13 + 3}
                y2={base}
                stroke={m.atual ? "var(--cor-carvao)" : "var(--cor-carvao-muted)"}
                strokeWidth={m.atual ? 2 : 1}
                strokeDasharray={m.atual ? undefined : "3 3"}
              />
              <text
                x={esquerda[k] ? m.x - 4 : m.x + 4}
                y={12 + fileiras[k] * 13}
                textAnchor={esquerda[k] ? "end" : "start"}
                fontSize="11"
                fill="var(--cor-carvao)"
                stroke="var(--cor-superficie)"
                strokeWidth="3"
                paintOrder="stroke"
                fontWeight={m.atual ? 600 : undefined}
              >
                {m.texto}
              </text>
            </g>
          ))}

          {/* barras próprias por cima: hachura e contorno, nunca só a cor */}
          {itens.map((it, i) => {
            if (it.tipo !== "massa") return null;
            const g = geo[i];
            const cx = g.x0 + MEIA_MASSA;
            const texto = `${it.m.rotulo}: ${num(it.m.contagem, 0)}`;
            const direita = cx + 8 + larguraTexto(texto) <= w - R;
            return (
              <g key={`m${it.k}`} data-massa={it.m.valor}>
                <rect x={g.x0} y={g.y} width={MEIA_MASSA * 2} height={Math.max(0, base - g.y)} fill={`url(#${uid}-hachura)`} stroke={corMassa} strokeWidth="1.5" />
                {g.cortada && (
                  // marca de corte: a barra continua acima da escala
                  <path
                    d={`M${g.x0 - 3},${T + 12} l${MEIA_MASSA * 2 + 6},-4 M${g.x0 - 3},${T + 17} l${MEIA_MASSA * 2 + 6},-4`}
                    stroke="var(--cor-superficie)"
                    strokeWidth="3"
                  />
                )}
                <text
                  x={direita ? cx + 8 : cx - 8}
                  y={g.y + 10}
                  textAnchor={direita ? "start" : "end"}
                  fontSize="11"
                  fill="var(--cor-carvao)"
                  stroke="var(--cor-superficie)"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  {texto}
                  {g.cortada ? " (barra cortada)" : ""}
                </text>
              </g>
            );
          })}

          {ga && (
            <rect
              pointerEvents="none"
              x={ga.x0 - 2}
              y={Math.min(ga.y, base - 2) - 2}
              width={ga.x1 - ga.x0 + 4}
              height={Math.max(2, base - ga.y) + 4}
              fill="none"
              stroke="var(--cor-carvao)"
              strokeWidth="2"
            />
          )}
          <rect
            x={L}
            y={T}
            width={Math.max(1, w - L - R)}
            height={Math.max(1, base - T)}
            fill="transparent"
            onPointerMove={apontar}
            onPointerDown={apontar}
            onPointerLeave={(ev) => {
              if (ev.pointerType === "mouse") setAtivo(null);
            }}
          />
        </svg>
        {desc && ga && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-20 min-w-[12rem] max-w-[17rem] border border-linha bg-superficie px-3 py-2 text-xs shadow-[0_6px_20px_rgba(26,29,33,0.12)]"
            style={{
              left: `min(max(0px, calc(${(((ga.x0 + ga.x1) / 2) / w) * 100}% - 6rem)), calc(100% - 12rem))`,
              top: Math.max(0, Math.min(ga.y, base) - 12),
              transform: "translateY(-100%)",
            }}
          >
            <p className="font-medium text-carvao">{desc.titulo}</p>
            <ul className="mt-1 space-y-0.5 tabular-nums text-carvao-muted">
              {desc.linhas.filter(Boolean).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {leitura}
      </p>

      <div id={`${uid}-r`} className="mt-3 space-y-1.5 border-t border-linha pt-2 text-xs leading-relaxed text-carvao-muted">
        <p>
          <span className="rotulo mr-2 text-mineral">Amostra</span>
          <span className="tabular-nums">n = {num(n, 0)}</span> {n === 1 ? contagem.singular : contagem.plural} com valor
          {res.semDado > 0 && (
            <span data-sem-dado={res.semDado}>; {contar(res.semDado)} sem dado, fora da distribuição (ausência não é zero)</span>
          )}
          .
        </p>
        <p>
          <span className="rotulo mr-2 text-mineral">Período</span>
          {periodo}
        </p>
        {n > 0 && (
          <dl className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
            {(
              [
                ["Mínimo", res.min],
                ["P10", res.p10],
                ["P25", res.p25],
                ["Mediana", res.mediana],
                ["P75", res.p75],
                ["P90", res.p90],
                ["Máximo", res.max],
              ] as const
            ).map(([r, v]) => (
              <div key={r} className="flex gap-1">
                <dt className="text-mineral">{r}</dt>
                <dd className="text-carvao">{textoValor(v, casas, unidade)}</dd>
              </div>
            ))}
          </dl>
        )}
        {valorAtual && (
          <p>
            <span className="rotulo mr-2 text-mineral">{valorAtual.rotulo}</span>
            {textoValor(valorAtual.valor, casas, unidade)}
            {atual !== null && typeof valorAtual.percentil === "number" && ` (percentil ${num(valorAtual.percentil, 0)} da distribuição)`}
            {atual === null && " (sem marcador no gráfico)"}.
          </p>
        )}
        {massas.map((m) => (
          <p key={`e${m.valor}`} data-explica-massa={m.valor}>
            <span className="rotulo mr-2 text-mineral">Barra própria</span>
            {m.rotulo}: {contar(m.contagem)} ({doTotal(m.contagem)}) exatamente em {textoValor(m.valor, casas, unidade)}. {m.explicacao ?? TEXTO_MASSA_PADRAO}
            {cortar && m.contagem > dy.max && " A barra foi cortada no topo para não achatar as demais; a contagem exata está no rótulo."}
          </p>
        ))}
        {fora.abaixo + fora.acima > 0 && classes.length > 0 && (
          <p>
            Fora das classes definidas (entram no n e nos quantis, não nas barras):{" "}
            {[
              fora.abaixo ? `${contar(fora.abaixo)} abaixo de ${textoValor(classes[0].inicio, casas, unidade)}` : "",
              fora.acima ? `${contar(fora.acima)} acima de ${textoValor(classes[classes.length - 1].fim, casas, unidade)}` : "",
            ]
              .filter(Boolean)
              .join("; ")}
            .
          </p>
        )}
        {nota && <p>{nota}</p>}
      </div>

      <details className="mt-3 text-xs">
        <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
          Dados do gráfico em tabela ({plural(itens.length, "linha", "linhas")})
        </summary>
        <div className="tabela-scroll mt-2 max-h-80 overflow-y-auto" tabIndex={0} role="region" aria-label={`${titulo}: dados em tabela (rolável)`}>
          <table className="w-full border-collapse tabular-nums">
            <caption className="sr-only">{`${titulo}: ${contagem.plural} por faixa de ${nomeX}`}</caption>
            <thead className="sticky top-0 bg-superficie">
              <tr className="text-left text-mineral">
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">Faixa ({unidade})</th>
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">{contagem.plural.charAt(0).toUpperCase() + contagem.plural.slice(1)}</th>
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">% do total</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it) => {
                const k = it.tipo === "classe" ? it.c.contagem : it.m.contagem;
                return (
                  <tr key={`${it.tipo}${it.k}`} className="border-b border-linha">
                    <th scope="row" className="px-2 py-1 text-left font-normal text-carvao">
                      {it.tipo === "classe" ? faixa(it.c, casas, "") : `Exatamente ${num(it.m.valor, casas)} (${it.m.rotulo}; barra própria)`}
                    </th>
                    <td className="px-2 py-1 text-carvao">{num(k, 0)}</td>
                    <td className="px-2 py-1 text-carvao">{n ? textoFracao(k / n) : "sem dado"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
