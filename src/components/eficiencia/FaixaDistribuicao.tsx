"use client";

import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { dominioBonito, escalaLinear } from "@/lib/energia/escalas";
import { COR, dimensoes, useLargura } from "./graficos";

/**
 * Faixa de distribuição das capitais, para o panorama: todas as capitais numa única escala, uma marca por capital, com
 * a mediana rotulada, o menor e o maior valor nomeados e a capital escolhida em cor de seleção. É compacta de propósito:
 * responde "onde está o valor em relação ao grupo" sem pedir que se leia 26 linhas. A identificação de cada marca vem
 * por toque ou ponteiro (a capital mais próxima do toque), por teclado (setas percorrem as capitais em ordem de valor)
 * e pela tabela equivalente; o texto da capital ativa fica numa linha visível sob o gráfico, não numa dica flutuante.
 */

export type PontoFaixa = { chave: string; rotulo: string; valor: number; destacada: boolean };

export function FaixaDistribuicao({
  pontos,
  mediana,
  media,
  faixa,
  formata,
  formataEixo,
  titulo,
  zero = false,
  rotuloMediana = "Mediana",
}: {
  pontos: PontoFaixa[];
  mediana: number | null;
  media: number | null;
  faixa: { q1: number; q3: number } | null;
  formata: (v: number) => string;
  formataEixo: (v: number) => string;
  titulo: string;
  zero?: boolean;
  rotuloMediana?: string;
}) {
  const [ref, w, medido] = useLargura<HTMLDivElement>(640);
  const [ativo, setAtivo] = useState<number | null>(null);
  const estreito = w < 520;
  const r = estreito ? 6.5 : 7.5;
  const passo = 2 * r + 1.5;
  const m = { t: 40, r: 14, b: 62, l: 14 };
  const ordenados = useMemo(() => [...pontos].sort((a, b) => a.valor - b.valor || a.rotulo.localeCompare(b.rotulo, "pt-BR")), [pontos]);
  const todos = [...ordenados.map((p) => p.valor), ...[mediana, media, faixa?.q1 ?? null, faixa?.q3 ?? null].filter((v): v is number => v !== null)];
  const dom = dominioBonito(todos, { zero, n: estreito ? 3 : 5 });
  const x = escalaLinear([dom.min, dom.max], [m.l + r, w - m.r - r]);

  // empilha as marcas em faixas horizontais para que nenhuma cubra outra; a ordem de valor garante determinismo
  const { posicoes, faixas } = useMemo(() => {
    const ocupado: number[][] = [];
    const pos = ordenados.map((p) => {
      const px = x(p.valor);
      let f = 0;
      while (ocupado[f]?.some((ox) => Math.abs(ox - px) < passo)) f++;
      (ocupado[f] ??= []).push(px);
      return { px, f };
    });
    return { posicoes: pos, faixas: Math.max(1, ocupado.length) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordenados, w, dom.min, dom.max]);

  const alturaMarcas = Math.max(faixas * passo, estreito ? 90 : 120);
  const base = m.t + alturaMarcas + 8;
  const H = base + m.b;
  const yMarca = (f: number) => base - 8 - r - f * passo;
  const menor = ordenados[0];
  const maior = ordenados[ordenados.length - 1];
  const iMenor = 0;
  const iMaior = ordenados.length - 1;
  const destacados = ordenados.map((p, i) => ({ p, i })).filter(({ p }) => p.destacada);

  const maisProxima = (e: PointerEvent<SVGRectElement>) => {
    const caixa = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = e.clientX - caixa.left;
    const py = e.clientY - caixa.top;
    let melhor = -1;
    let dist = Infinity;
    posicoes.forEach((q, i) => {
      const d = Math.hypot(q.px - px, yMarca(q.f) - py);
      if (d < dist) {
        dist = d;
        melhor = i;
      }
    });
    setAtivo(melhor >= 0 && dist < 36 ? melhor : null);
  };
  const teclado = (e: KeyboardEvent) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    setAtivo((a) => {
      if (e.key === "Home") return 0;
      if (e.key === "End") return ordenados.length - 1;
      const b = a ?? (e.key === "ArrowRight" ? -1 : ordenados.length);
      return Math.max(0, Math.min(ordenados.length - 1, b + (e.key === "ArrowRight" ? 1 : -1)));
    });
  };
  if (!ordenados.length) return null;
  const ancora = (px: number): "start" | "middle" | "end" => (px < 90 ? "start" : px > w - 90 ? "end" : "middle");

  return (
    <figure ref={ref} className="m-0">
      <div
        tabIndex={0}
        role="group"
        aria-label={`${titulo}. Use as setas para a esquerda e para a direita para percorrer as capitais, do menor ao maior valor; a tabela equivalente traz todos os valores.`}
        onKeyDown={teclado}
        onBlur={() => setAtivo(null)}
        className="outline-offset-4"
      >
        <svg {...dimensoes(medido, w, H)} aria-hidden="true" className="block">
          {faixa && <rect x={x(faixa.q1)} y={m.t - 6} width={Math.max(1, x(faixa.q3) - x(faixa.q1))} height={base - m.t + 6} fill="var(--cor-obee-fundo)" />}
          {dom.ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={base} y2={base + 5} stroke={COR.eixo} strokeWidth={1} />
              <text x={x(t)} y={base + 20} textAnchor={x(t) > w - 34 ? "end" : x(t) < 34 ? "start" : "middle"} fontSize={11.5} fill={COR.eixo}>
                {formataEixo(t)}
              </text>
            </g>
          ))}
          <line x1={m.l} x2={w - m.r} y1={base} y2={base} stroke={COR.eixo} strokeWidth={1} />
          {mediana !== null && (
            <g>
              <line x1={x(mediana)} x2={x(mediana)} y1={m.t - 6} y2={base + 5} stroke="var(--cor-obee-tinta)" strokeWidth={1.75} />
              <text x={x(mediana)} y={base + 44} textAnchor={ancora(x(mediana))} fontSize={12} fontWeight={600} fill="var(--cor-obee-tinta)">
                {rotuloMediana} {formata(mediana)}
              </text>
            </g>
          )}
          {media !== null && <path d={`M${x(media)},${base - 1} l-5,-8 l10,0 z`} fill="var(--cor-obee-tinta)" />}
          {ordenados.map((p, i) => (
            <circle
              key={p.chave}
              cx={posicoes[i].px}
              cy={yMarca(posicoes[i].f)}
              r={p.destacada ? r + 2 : ativo === i ? r + 1.5 : r}
              fill={p.destacada ? COR.selecao : COR.neutro}
              stroke={COR.superficie}
              strokeWidth={2}
            />
          ))}
          {/* extremos nomeados, com valor */}
          <text x={posicoes[iMenor].px} y={m.t - 18} textAnchor={ancora(posicoes[iMenor].px) === "middle" ? "start" : ancora(posicoes[iMenor].px)} fontSize={12} fill="var(--cor-obee-tinta)">
            <tspan fontWeight={600}>{formata(menor.valor)}</tspan> {menor.rotulo}
          </text>
          {ordenados.length > 1 && maior.valor !== menor.valor && (
            <text x={posicoes[iMaior].px} y={m.t - 18} textAnchor={ancora(posicoes[iMaior].px) === "middle" ? "end" : ancora(posicoes[iMaior].px)} fontSize={12} fill="var(--cor-obee-tinta)">
              <tspan fontWeight={600}>{formata(maior.valor)}</tspan> {maior.rotulo}
            </text>
          )}
          {destacados.map(({ p, i }) => (
            <text
              key={`d${p.chave}`}
              x={posicoes[i].px}
              y={yMarca(posicoes[i].f) - r - 6}
              textAnchor={ancora(posicoes[i].px)}
              fontSize={12}
              fontWeight={700}
              fill="var(--cor-obee-tinta)"
              stroke="var(--cor-superficie)"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {p.rotulo}: {formata(p.valor)}
            </text>
          ))}
          <rect x={0} y={0} width={w} height={H} fill="transparent" onPointerMove={(e) => e.pointerType === "mouse" && maisProxima(e)} onPointerDown={maisProxima} onPointerLeave={(e) => e.pointerType === "mouse" && setAtivo(null)} />
        </svg>
      </div>
      <p role="status" aria-live="polite" className="mt-1 min-h-[1.5rem] text-sm text-obee-tinta">
        {ativo !== null ? (
          <>
            <span className="font-semibold">{ordenados[ativo].rotulo}</span>: {formata(ordenados[ativo].valor)}
          </>
        ) : (
          <span className="text-carvao-muted">Toque ou aponte para uma marca para ver a capital e o valor.</span>
        )}
      </p>
      <figcaption className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.8125rem] leading-snug text-carvao-muted">
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="14" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" fill={COR.neutro} />
          </svg>
          Uma marca por capital
        </span>
        {media !== null && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="14" height="14" aria-hidden="true">
              <path d="M7,3 l5,9 l-10,0 z" fill="var(--cor-obee-tinta)" />
            </svg>
            Média simples: {formata(media)}
          </span>
        )}
        {faixa && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="22" height="14" aria-hidden="true">
              <rect x="2" y="2" width="18" height="10" fill="var(--cor-obee-fundo)" stroke={COR.grade} />
            </svg>
            Metade central das capitais: {formata(faixa.q1)} a {formata(faixa.q3)}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
