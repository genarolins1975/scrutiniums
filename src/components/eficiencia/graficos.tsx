"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { dominioBonito, escalaLinear } from "@/lib/energia/escalas";
import { ROTULO_STATUS, type PontoSerie } from "@/lib/eficiencia/consulta";

/**
 * Gráficos do OBEE em SVG, medidos na largura real do contêiner (o texto
 * nunca encolhe com o gráfico). Gramática comum: marcas finas, grade sólida e
 * recessiva, cor só para seleção (petróleo) contra o neutro dos pares, nenhum
 * juízo de valor em cor. Dica por ponteiro e por teclado; a tabela equivalente
 * fica sempre ao lado, porque a dica nunca é a única forma de ler um valor.
 */

function useLargura<T extends HTMLElement>(padrao: number) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(padrao);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((es) => {
      const largura = Math.round(es[0].contentRect.width);
      if (largura > 0) setW(largura);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const COR = {
  selecao: "var(--cor-obee)",
  neutro: "var(--cor-obee-neutro)",
  grade: "var(--cor-grade)",
  eixo: "var(--cor-mineral)",
  superficie: "var(--cor-superficie)",
  referencia: "var(--cor-carvao-muted)",
};

/* ------------------------------------------------------------------ série */

export type Anotacao = { ano: number; texto: string };

export function MiniSerie({
  titulo,
  pontos,
  formata,
  formataEixo,
  zero,
  anotacoes = [],
}: {
  titulo: string;
  pontos: PontoSerie[];
  formata: (v: number) => string;
  formataEixo: (v: number) => string;
  zero: boolean;
  anotacoes?: Anotacao[];
}) {
  const [ref, w] = useLargura<HTMLDivElement>(320);
  const [ativo, setAtivo] = useState<number | null>(null);
  const H = 176;
  const m = { t: 14, r: 14, b: 30, l: 62 };
  const valores = pontos.map((p) => p.valor);
  const temValor = valores.some((v) => v !== null);
  const dom = dominioBonito(valores, { zero, n: 4 });
  const y = escalaLinear([dom.min, dom.max], [H - m.b, m.t]);
  const passoX = pontos.length > 1 ? (w - m.l - m.r) / (pontos.length - 1) : 0;
  const x = (i: number) => (pontos.length > 1 ? m.l + i * passoX : (m.l + w - m.r) / 2);
  // segmentos só entre anos consecutivos com valor elegível: ausência é lacuna, nunca ponte; um valor fora
  // das comparações (perímetro distinto ou conferência pendente) fica isolado, sem linha que sugira continuidade
  const segs: string[] = [];
  let atual: string[] = [];
  pontos.forEach((p, i) => {
    if (p.valor === null || !p.elegivel) {
      if (atual.length > 1) segs.push(atual.join(" "));
      atual = [];
    } else atual.push(`${atual.length ? "L" : "M"}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`);
  });
  if (atual.length > 1) segs.push(atual.join(" "));
  const mostrarRotulo = (i: number) => pontos.length <= 6 || i === 0 || i === pontos.length - 1 || i % 2 === 0;
  const anot = new Map(anotacoes.map((a, i) => [a.ano, i + 1]));
  const ultimo = [...pontos].reverse().find((p) => p.valor !== null);
  const iUltimo = ultimo ? pontos.indexOf(ultimo) : -1;

  const teclado = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    setAtivo((a) => {
      if (e.key === "Home") return 0;
      if (e.key === "End") return pontos.length - 1;
      const base = a ?? (e.key === "ArrowRight" ? -1 : pontos.length);
      return Math.max(0, Math.min(pontos.length - 1, base + (e.key === "ArrowRight" ? 1 : -1)));
    });
  };
  const pa = ativo !== null ? pontos[ativo] : null;

  return (
    <div ref={ref} className="relative">
      <div
        tabIndex={0}
        role="group"
        aria-label={`${titulo}. Use as setas para percorrer os anos; a tabela abaixo traz todos os valores.`}
        onKeyDown={teclado}
        onBlur={() => setAtivo(null)}
        className="outline-offset-4"
      >
        <svg width={w} height={H} aria-hidden="true" className="block overflow-visible">
          {dom.ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} stroke={COR.grade} strokeWidth={1} />
              <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={COR.eixo}>
                {formataEixo(t)}
              </text>
            </g>
          ))}
          {pontos.map((p, i) => (
            <g key={p.ano}>
              {mostrarRotulo(i) && (
                <text x={x(i)} y={H - 10} textAnchor="middle" fontSize={11} fill={COR.eixo}>
                  {p.ano}
                </text>
              )}
              {anot.has(p.ano) && (
                <text x={x(i)} y={m.t - 2} textAnchor="middle" fontSize={10} fill={COR.referencia}>
                  {anot.get(p.ano)}
                </text>
              )}
              {p.valor === null && (
                <circle cx={x(i)} cy={H - m.b} r={3.5} fill={COR.superficie} stroke={COR.eixo} strokeWidth={1.2} />
              )}
            </g>
          ))}
          {segs.map((d) => (
            <path key={d} d={d} fill="none" stroke={COR.selecao} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {pontos.map((p, i) =>
            p.valor === null ? null : p.elegivel ? (
              <circle key={p.ano} cx={x(i)} cy={y(p.valor)} r={ativo === i ? 5.5 : 4} fill={COR.selecao} stroke={COR.superficie} strokeWidth={2} />
            ) : (
              <rect
                key={p.ano}
                x={x(i) - 4.5}
                y={y(p.valor) - 4.5}
                width={9}
                height={9}
                transform={`rotate(45 ${x(i)} ${y(p.valor)})`}
                fill={COR.superficie}
                stroke={COR.selecao}
                strokeWidth={2}
              />
            ),
          )}
          {ultimo && ultimo.valor !== null && ativo === null && (
            <text
              x={Math.min(x(iUltimo), w - m.r)}
              y={y(ultimo.valor) - 10}
              textAnchor={iUltimo === pontos.length - 1 ? "end" : "middle"}
              fontSize={11.5}
              fontWeight={600}
              fill="var(--cor-obee-tinta)"
            >
              {formata(ultimo.valor)}
            </text>
          )}
          {ativo !== null && <line x1={x(ativo)} x2={x(ativo)} y1={m.t} y2={H - m.b} stroke={COR.eixo} strokeWidth={1} />}
          <rect
            x={m.l - passoX / 2}
            y={0}
            width={w - m.l - m.r + passoX}
            height={H}
            fill="transparent"
            onPointerMove={(e) => {
              const r = (e.currentTarget as SVGRectElement).ownerSVGElement!.getBoundingClientRect();
              const px = e.clientX - r.left;
              const i = pontos.length > 1 ? Math.round((px - m.l) / passoX) : 0;
              setAtivo(Math.max(0, Math.min(pontos.length - 1, i)));
            }}
            onPointerLeave={() => setAtivo(null)}
          />
        </svg>
        {!temValor && (
          <p className="absolute inset-x-0 top-12 text-center text-sm text-carvao-muted">Nenhum valor publicado para este recorte.</p>
        )}
        {pa && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 max-w-[15rem] border border-linha bg-superficie px-3 py-2 text-xs shadow-sm"
            style={{ left: Math.min(Math.max(0, x(ativo!) - 90), Math.max(0, w - 240)) }}
          >
            <p className="rotulo text-mineral">{pa.ano}</p>
            {pa.valor !== null ? (
              <p className="mt-0.5 text-sm font-semibold text-obee-tinta">{formata(pa.valor)}</p>
            ) : (
              <p className="mt-0.5 text-obee-tinta">
                {ROTULO_STATUS[pa.status]}
                {pa.nota ? `: ${pa.nota}` : ""}
              </p>
            )}
            {pa.valor !== null && !pa.elegivel && <p className="mt-1 font-semibold text-obee-tinta">Fora das comparações: {pa.motivo ?? pa.nota}</p>}
            {pa.valor !== null && pa.elegivel && pa.nota && pa.notaMaterial && <p className="mt-1 text-carvao-muted">{pa.nota}</p>}
          </div>
        )}
      </div>
      {(pontos.some((p) => p.valor === null || !p.elegivel) || anotacoes.length > 0) && (
        <ul className="mt-1 space-y-0.5 text-xs leading-snug text-carvao-muted">
          {pontos
            .filter((p) => p.valor !== null && !p.elegivel)
            .map((p) => (
              <li key={`f${p.ano}`} className="text-obee-tinta">
                <span aria-hidden="true">◇</span> {p.ano}: valor oficial fora das comparações e sem linha com os anos vizinhos. {p.motivo}
              </li>
            ))}
          {pontos.some((p) => p.valor === null) && (
            <li>
              <span aria-hidden="true">○</span> no eixo: ano sem valor (
              {pontos
                .filter((p) => p.valor === null)
                .map((p) => `${p.ano}: ${ROTULO_STATUS[p.status].toLowerCase()}`)
                .join("; ")}
              )
            </li>
          )}
          {anotacoes.map((a, i) => (
            <li key={a.ano}>
              <span className="tabular-nums">{i + 1}</span> {a.ano}: {a.texto}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ comparação em pontos */

export type LinhaPontos = { chave: string; rotulo: string; valor: number; selecionada: boolean };

export function GraficoPontosPares({
  linhas,
  mediana,
  formata,
  formataEixo,
  zero,
  titulo,
}: {
  linhas: LinhaPontos[];
  mediana: number | null;
  formata: (v: number) => string;
  formataEixo: (v: number) => string;
  zero: boolean;
  titulo: string;
}) {
  const [ref, w] = useLargura<HTMLDivElement>(640);
  const [ativo, setAtivo] = useState<number | null>(null);
  const estreito = w < 520;
  const linhaH = 26;
  const fonte = estreito ? 11.5 : 12;
  const m = { t: 30, r: estreito ? 22 : 150, b: 8, l: estreito ? Math.min(150, Math.round(w * 0.42)) : 176 };
  const H = m.t + m.b + linhas.length * linhaH;
  // área útil estreita (320 px): duas marcas no eixo, para os rótulos não se sobreporem
  const util = w - m.l - m.r;
  const dom = dominioBonito(
    linhas.map((l) => l.valor),
    { zero, n: estreito ? 3 : 5 },
  );
  const ticks = util < 200 ? dom.ticks.filter((_, i, a) => i === 0 || i === a.length - 1) : dom.ticks;
  const x = escalaLinear([dom.min, dom.max], [m.l, w - m.r]);
  const yc = (i: number) => m.t + i * linhaH + linhaH / 2;
  const sel = linhas.findIndex((l) => l.selecionada);

  const linhaDoPonteiro = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const i = Math.floor((e.clientY - r.top - m.t) / linhaH);
    setAtivo(i >= 0 && i < linhas.length ? i : null);
  };

  const teclado = (e: KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    setAtivo((a) => {
      if (e.key === "Home") return 0;
      if (e.key === "End") return linhas.length - 1;
      const base = a ?? (e.key === "ArrowDown" ? -1 : linhas.length);
      return Math.max(0, Math.min(linhas.length - 1, base + (e.key === "ArrowDown" ? 1 : -1)));
    });
  };

  return (
    <div ref={ref} className="relative">
      <div
        tabIndex={0}
        role="group"
        aria-label={`${titulo}. Use as setas para cima e para baixo para percorrer as capitais; a tabela equivalente traz todos os valores.`}
        onKeyDown={teclado}
        onBlur={() => setAtivo(null)}
      >
        <svg width={w} height={H} aria-hidden="true" className="block">
          {ticks.map((t, it) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={m.t - 6} y2={H - m.b} stroke={COR.grade} strokeWidth={1} />
              <text x={x(t)} y={m.t - 12} textAnchor={it === ticks.length - 1 && estreito ? "end" : "middle"} fontSize={11} fill={COR.eixo}>
                {formataEixo(t)}
              </text>
            </g>
          ))}
          {mediana !== null && (
            <g>
              <line x1={x(mediana)} x2={x(mediana)} y1={m.t - 4} y2={H - m.b} stroke={COR.referencia} strokeWidth={1.5} />
            </g>
          )}
          {linhas.map((l, i) => (
            <g key={l.chave}>
              {ativo === i && <rect x={0} y={yc(i) - linhaH / 2} width={w} height={linhaH} fill="var(--cor-obee-fundo)" />}
              <line x1={m.l} x2={x(l.valor)} y1={yc(i)} y2={yc(i)} stroke={COR.grade} strokeWidth={1} />
              <text
                x={m.l - 10}
                y={yc(i)}
                dy="0.32em"
                textAnchor="end"
                fontSize={fonte}
                fontWeight={l.selecionada ? 700 : 400}
                fill={l.selecionada ? "var(--cor-obee-tinta)" : "var(--cor-carvao-muted)"}
              >
                {l.rotulo}
              </text>
              <circle
                cx={x(l.valor)}
                cy={yc(i)}
                r={l.selecionada ? 6.5 : 4.5}
                fill={l.selecionada ? COR.selecao : COR.neutro}
                stroke={COR.superficie}
                strokeWidth={2}
              />
              {(l.selecionada || ativo === i) && !estreito && (
                <text x={w - m.r + 10} y={yc(i)} dy="0.32em" fontSize={12} fontWeight={l.selecionada ? 700 : 400} fill="var(--cor-obee-tinta)">
                  {formata(l.valor)}
                </text>
              )}
            </g>
          ))}
          <rect
            x={0}
            y={m.t}
            width={w}
            height={linhas.length * linhaH}
            fill="transparent"
            onPointerMove={(e) => linhaDoPonteiro(e)}
            // toque: o valor da linha tocada fica visível até o próximo toque (o ponteiro de toque sai do elemento ao levantar o dedo)
            onPointerDown={(e) => linhaDoPonteiro(e)}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") setAtivo(null);
            }}
          />
        </svg>
        {ativo !== null && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 border border-linha bg-superficie px-3 py-2 text-xs shadow-sm"
            style={{ top: yc(ativo) + 14, left: Math.min(Math.max(0, x(linhas[ativo].valor) - 70), Math.max(0, w - 200)) }}
          >
            <p className="rotulo text-mineral">{linhas[ativo].rotulo}</p>
            <p className="mt-0.5 text-sm font-semibold text-obee-tinta">{formata(linhas[ativo].valor)}</p>
          </div>
        )}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-carvao-muted">
        {sel >= 0 && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="14" height="14" aria-hidden="true">
              <circle cx="7" cy="7" r="5.5" fill={COR.selecao} />
            </svg>
            Capital selecionada{estreito ? `: ${formata(linhas[sel].valor)}` : ""}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="14" aria-hidden="true">
            <circle cx="7" cy="7" r="4" fill={COR.neutro} />
          </svg>
          Demais capitais na comparação
        </span>
        {mediana !== null && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="14" height="14" aria-hidden="true">
              <line x1="7" x2="7" y1="0" y2="14" stroke={COR.referencia} strokeWidth="1.5" />
            </svg>
            Mediana das {linhas.length} capitais na comparação: {formata(mediana)}
          </span>
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ barras de composição */

export function BarrasComposicao({
  linhas,
}: {
  linhas: { chave: string; rotulo: string; pct: number; detalhe: string }[];
}) {
  return (
    <ul className="space-y-2.5">
      {linhas.map((l) => (
        <li key={l.chave} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 sm:grid-cols-[13rem_minmax(0,1fr)_7.5rem]">
          <span className="text-sm text-obee-tinta">{l.rotulo}</span>
          <span className="order-3 col-span-2 block h-3 bg-obee-fundo sm:order-none sm:col-span-1" aria-hidden="true">
            <span className="block h-3 rounded-r-[4px] bg-obee" style={{ width: `${Math.max(0, Math.min(100, l.pct))}%` }} />
          </span>
          <span className="text-right text-sm tabular-nums text-obee-tinta">
            {l.detalhe}
          </span>
        </li>
      ))}
    </ul>
  );
}
