"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { dominioBonito, escalaLinear } from "@/lib/energia/escalas";
import { COR, ticksLog, useLargura } from "./graficos";

/**
 * Distribuição das capitais numa escala comum: um ponto por capital, em linhas alfabéticas (ou por valor, a pedido de
 * quem lê). A comparação principal é o conjunto: a mediana é a única linha do desenho e vem rotulada no próprio gráfico;
 * os extremos têm nome e valor visíveis; capitais destacadas ficam em cor de seleção sem retirar o contexto do grupo.
 * Média simples, faixa central e referência externa aparecem como marcas discretas e na legenda, nunca como várias linhas
 * concorrentes. Nada depende de hover: o valor de cada linha está no rótulo dos extremos, na tabela equivalente, no toque
 * e no teclado (setas).
 */

export type LinhaDistribuicao = { chave: string; rotulo: string; valor: number; destacada: boolean };

export type ReferenciasDistribuicao = {
  mediana: number | null;
  media: number | null;
  faixa: { q1: number; q3: number } | null;
  externa?: { rotulo: string; valor: number } | null;
};

export function DistribuicaoCapitais({
  linhas,
  referencias,
  formata,
  formataEixo,
  zero,
  titulo,
  escala = "linear",
  rotuloGrupo = "capitais na comparação",
  rotuloMediana = "Mediana",
}: {
  linhas: LinhaDistribuicao[];
  referencias: ReferenciasDistribuicao;
  formata: (v: number) => string;
  formataEixo: (v: number) => string;
  zero: boolean;
  titulo: string;
  escala?: "linear" | "log";
  rotuloGrupo?: string;
  rotuloMediana?: string;
}) {
  const [ref, w] = useLargura<HTMLDivElement>(640);
  const [ativo, setAtivo] = useState<number | null>(null);
  const estreito = w < 520;
  const linhaH = 28;
  const fonte = estreito ? 11.5 : 12.5;
  const m = { t: 30, r: estreito ? 58 : 84, b: referencias.externa ? 52 : 34, l: estreito ? Math.min(124, Math.round(w * 0.4)) : 184 };
  const H = m.t + m.b + linhas.length * linhaH;
  const { mediana, media, faixa, externa = null } = referencias;
  const todos = [...linhas.map((l) => l.valor), ...[mediana, media, faixa?.q1 ?? null, faixa?.q3 ?? null, externa?.valor ?? null].filter((v): v is number => v !== null)];
  const log = escala === "log" && todos.every((v) => v > 0);
  const dom = log
    ? { min: Math.min(...todos) * 0.85, max: Math.max(...todos) * 1.15, ticks: ticksLog(Math.min(...todos) * 0.85, Math.max(...todos) * 1.15) }
    : dominioBonito(todos, { zero, n: estreito ? 3 : 5 });
  const util = w - m.l - m.r;
  const ticks = util < 150 ? dom.ticks.filter((_, i, a) => i === 0 || i === a.length - 1) : dom.ticks;
  const lin = escalaLinear([dom.min, dom.max], [m.l, w - m.r]);
  const x = (v: number) => (log ? m.l + ((Math.log10(v) - Math.log10(dom.min)) / (Math.log10(dom.max) - Math.log10(dom.min))) * (w - m.r - m.l) : lin(v));
  const yc = (i: number) => m.t + i * linhaH + linhaH / 2;
  const base = m.t + linhas.length * linhaH;
  const min = Math.min(...linhas.map((l) => l.valor));
  const max = Math.max(...linhas.map((l) => l.valor));
  // valor visível na própria linha: extremos (todos os empatados), capitais destacadas e a linha ativa
  const comRotulo = (l: LinhaDistribuicao, i: number) => l.valor === min || l.valor === max || l.destacada || ativo === i;
  const destacadas = linhas.filter((l) => l.destacada);

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
      const b = a ?? (e.key === "ArrowDown" ? -1 : linhas.length);
      return Math.max(0, Math.min(linhas.length - 1, b + (e.key === "ArrowDown" ? 1 : -1)));
    });
  };

  return (
    <figure ref={ref} className="relative m-0">
      <div
        tabIndex={0}
        role="group"
        aria-label={`${titulo}. Use as setas para cima e para baixo para percorrer as capitais; a tabela equivalente traz todos os valores.`}
        onKeyDown={teclado}
        onBlur={() => setAtivo(null)}
        className="outline-offset-4"
      >
        <svg width={w} height={H} aria-hidden="true" className="block">
          {faixa && <rect x={x(faixa.q1)} y={m.t - 2} width={Math.max(1, x(faixa.q3) - x(faixa.q1))} height={base - m.t + 2} fill="var(--cor-obee-fundo)" />}
          {ticks.map((t, it) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={m.t - 2} y2={base} stroke={COR.grade} strokeWidth={1} />
              <text x={x(t)} y={base + 16} textAnchor={it === ticks.length - 1 && estreito ? "end" : it === 0 && estreito ? "start" : "middle"} fontSize={11.5} fill={COR.eixo}>
                {formataEixo(t)}
              </text>
            </g>
          ))}
          {mediana !== null && (
            <g>
              <line x1={x(mediana)} x2={x(mediana)} y1={m.t - 8} y2={base} stroke="var(--cor-obee-tinta)" strokeWidth={1.75} />
              <text
                x={x(mediana)}
                y={m.t - 14}
                textAnchor={x(mediana) > w - m.r - 90 ? "end" : x(mediana) < m.l + 60 ? "start" : "middle"}
                fontSize={12}
                fontWeight={600}
                fill="var(--cor-obee-tinta)"
              >
                {rotuloMediana} {formata(mediana)}
              </text>
            </g>
          )}
          {media !== null && <path d={`M${x(media)},${base - 1} l-5,-8 l10,0 z`} fill="var(--cor-obee-tinta)" />}
          {externa && (
            <g>
              <line x1={x(externa.valor)} x2={x(externa.valor)} y1={m.t - 2} y2={base + 22} stroke={COR.referencia} strokeWidth={1.5} strokeDasharray="2 3" strokeLinecap="round" />
              <text x={x(externa.valor)} y={base + 38} textAnchor={x(externa.valor) > w - m.r - 90 ? "end" : "middle"} fontSize={11.5} fill={COR.referencia}>
                {externa.rotulo} {formata(externa.valor)}
              </text>
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
                fontWeight={l.destacada ? 700 : 400}
                fill={l.destacada ? "var(--cor-obee-tinta)" : "var(--cor-carvao-muted)"}
              >
                {l.rotulo}
              </text>
              <circle cx={x(l.valor)} cy={yc(i)} r={l.destacada ? 6.5 : 4.5} fill={l.destacada ? COR.selecao : COR.neutro} stroke={COR.superficie} strokeWidth={2} />
              {comRotulo(l, i) && (
                <text x={w - m.r + 8} y={yc(i)} dy="0.32em" fontSize={fonte} fontWeight={l.destacada || l.valor === min || l.valor === max ? 700 : 400} fill="var(--cor-obee-tinta)">
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
            // toque: o valor da linha tocada fica visível até o próximo toque
            onPointerDown={(e) => linhaDoPonteiro(e)}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") setAtivo(null);
            }}
          />
        </svg>
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.8125rem] leading-snug text-carvao-muted">
        {destacadas.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="14" height="14" aria-hidden="true">
              <circle cx="7" cy="7" r="5.5" fill={COR.selecao} />
            </svg>
            Capital destacada
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="14" aria-hidden="true">
            <circle cx="7" cy="7" r="4" fill={COR.neutro} />
          </svg>
          {destacadas.length > 0 ? "Demais " : ""}
          {rotuloGrupo}
        </span>
        {mediana !== null && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="22" height="14" aria-hidden="true">
              <line x1="2" x2="20" y1="7" y2="7" stroke="var(--cor-obee-tinta)" strokeWidth="1.75" />
            </svg>
            {rotuloMediana}
          </span>
        )}
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
      {ativo !== null && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 border border-linha bg-superficie px-3 py-2 text-xs"
          style={{ top: yc(ativo) + 14, left: Math.min(Math.max(0, x(linhas[ativo].valor) - 70), Math.max(0, w - 200)) }}
        >
          <p className="rotulo text-mineral">{linhas[ativo].rotulo}</p>
          <p className="mt-0.5 text-sm font-semibold text-obee-tinta">{formata(linhas[ativo].valor)}</p>
        </div>
      )}
      {log && (
        <p className="mt-2 text-xs leading-snug text-carvao-muted">
          Escala logarítmica: distâncias iguais representam razões iguais, não diferenças iguais. A escala linear mostra a diferença real em reais.
        </p>
      )}
    </figure>
  );
}
