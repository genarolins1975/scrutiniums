"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { dominioBonito, escalaLinear } from "@/lib/energia/escalas";
import { COR, dimensoes, ticksLog, useLargura } from "./graficos";

/**
 * Distribuição das capitais numa escala comum: um ponto por capital, em linhas alfabéticas (ou por valor, a pedido de
 * quem lê). A comparação principal é o conjunto: a mediana é a única linha do desenho e vem rotulada no próprio gráfico;
 * os extremos têm nome e valor visíveis; capitais destacadas ficam em cor de seleção sem retirar o contexto do grupo.
 * Média simples, faixa central e referência externa aparecem como marcas discretas e na legenda, nunca como várias linhas
 * concorrentes. Nada depende de hover: o valor de cada linha está no rótulo dos extremos, na tabela equivalente, no toque
 * e no teclado (setas).
 */

export type LinhaDistribuicao = { chave: string; rotulo: string; valor: number; destacada: boolean };

/** Capital fora da comparação: aparece no gráfico, sem entrar nas estatísticas, com o motivo curto ao lado (o completo vem logo abaixo). */
export type LinhaForaDaComparacao = { chave: string; rotulo: string; valor: number | null; texto: string; destacada: boolean };

export type ReferenciasDistribuicao = {
  mediana: number | null;
  media: number | null;
  faixa: { q1: number; q3: number } | null;
  externa?: { rotulo: string; valor: number; nota?: string } | null;
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
  fora = [],
  alturaLinha = 28,
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
  fora?: LinhaForaDaComparacao[];
  /** altura de cada linha em px; o texto não encolhe com ela */
  alturaLinha?: number;
}) {
  const [ref, w, medido] = useLargura<HTMLDivElement>(640);
  const [ativo, setAtivo] = useState<number | null>(null);
  const estreito = w < 520;
  const linhaH = alturaLinha;
  const fonte = estreito ? 11.5 : 12.5;
  const larg = (t: string, f: number) => t.length * f * 0.56;
  const maiorValor = Math.max(...linhas.map((l) => formata(l.valor).length), 1);
  const margemDireita = Math.max(w < 360 ? 50 : estreito ? 58 : 84, Math.ceil(maiorValor * fonte * 0.6) + 16);
  const m = { t: 30, r: margemDireita, b: referencias.externa ? 52 : 34, l: w < 360 ? 100 : estreito ? Math.min(124, Math.round(w * 0.4)) : 184 };
  const nLinhas = linhas.length + fora.length;
  const H = m.t + m.b + nLinhas * linhaH;
  const { mediana, media, faixa, externa = null } = referencias;
  const todos = [...linhas.map((l) => l.valor), ...[mediana, media, faixa?.q1 ?? null, faixa?.q3 ?? null, externa?.valor ?? null].filter((v): v is number => v !== null)];
  const log = escala === "log" && todos.every((v) => v > 0);
  const dom = log
    ? { min: Math.min(...todos) * 0.85, max: Math.max(...todos) * 1.15, ticks: ticksLog(Math.min(...todos) * 0.85, Math.max(...todos) * 1.15) }
    : dominioBonito(todos, { zero, n: estreito ? 3 : 5 });
  const lin = escalaLinear([dom.min, dom.max], [m.l, w - m.r]);
  const x = (v: number) => (log ? m.l + ((Math.log10(v) - Math.log10(dom.min)) / (Math.log10(dom.max) - Math.log10(dom.min))) * (w - m.r - m.l) : lin(v));
  const yc = (i: number) => m.t + i * linhaH + linhaH / 2;
  const base = m.t + nLinhas * linhaH;
  // faixa central e mediana cobrem só as capitais da comparação; as linhas fora dela ficam abaixo, sem atravessá-las
  const baseComparadas = m.t + linhas.length * linhaH;
  const min = Math.min(...linhas.map((l) => l.valor));
  const max = Math.max(...linhas.map((l) => l.valor));
  // valor visível na própria linha: extremos (todos os empatados), capitais destacadas e a linha ativa
  const comRotulo = (l: LinhaDistribuicao, i: number) => l.valor === min || l.valor === max || l.destacada || ativo === i;
  const destacadas = linhas.filter((l) => l.destacada);
  // nome e UF em duas linhas quando não cabem na margem, em vez de cortar o nome
  const capacidade = m.l - 14;
  const partes = (rotulo: string): [string, string | null] => {
    if (larg(rotulo, fonte) <= capacidade) return [rotulo, null];
    const i = rotulo.lastIndexOf(" (");
    return i > 0 ? [rotulo.slice(0, i), rotulo.slice(i + 1)] : [rotulo, null];
  };
  // marcas do eixo sem sobreposição: cada rótulo é ancorado para caber na figura e a marca que encosta na anterior é descartada
  const larguraMarca = (t: number) => formataEixo(t).length * 6.8;
  const caixaMarca = (t: number) => {
    const l = larguraMarca(t);
    const ancora: "start" | "middle" | "end" = x(t) - l / 2 < 2 ? "start" : x(t) + l / 2 > w - 2 ? "end" : "middle";
    const ini = ancora === "start" ? x(t) : ancora === "end" ? x(t) - l : x(t) - l / 2;
    return { ancora, ini, fim: ini + l };
  };
  const ticks: { t: number; ancora: "start" | "middle" | "end" }[] = [];
  let fimAnterior = -Infinity;
  dom.ticks.forEach((t) => {
    const c = caixaMarca(t);
    if (c.ini < fimAnterior + 8) return;
    ticks.push({ t, ancora: c.ancora });
    fimAnterior = c.fim;
  });

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
        <svg {...dimensoes(medido, w, H)} aria-hidden="true" className="block">
          {faixa && <rect x={x(faixa.q1)} y={m.t - 2} width={Math.max(1, x(faixa.q3) - x(faixa.q1))} height={baseComparadas - m.t + 2} fill="var(--cor-obee-fundo)" />}
          {ticks.map(({ t, ancora }) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={m.t - 2} y2={base} stroke={COR.grade} strokeWidth={1} />
              <text x={x(t)} y={base + 16} textAnchor={ancora} fontSize={11.5} fill={COR.eixo}>
                {formataEixo(t)}
              </text>
            </g>
          ))}
          {mediana !== null && (
            <g>
              <line x1={x(mediana)} x2={x(mediana)} y1={m.t - 8} y2={baseComparadas} stroke="var(--cor-obee-tinta)" strokeWidth={1.75} />
              <text
                x={x(mediana)}
                y={m.t - 14}
                textAnchor={x(mediana) + larg(`${rotuloMediana} ${formata(mediana)}`, 12) / 2 > w - 2 ? "end" : x(mediana) - larg(`${rotuloMediana} ${formata(mediana)}`, 12) / 2 < 2 ? "start" : "middle"}
                fontSize={12}
                fontWeight={600}
                fill="var(--cor-obee-tinta)"
              >
                {rotuloMediana} {formata(mediana)}
              </text>
            </g>
          )}
          {media !== null && <path d={`M${x(media)},${baseComparadas - 1} l-5,-8 l10,0 z`} fill="var(--cor-obee-tinta)" />}
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
                dy={partes(l.rotulo)[1] ? "-0.1em" : "0.32em"}
                textAnchor="end"
                fontSize={fonte}
                fontWeight={l.destacada ? 700 : 400}
                fill={l.destacada ? "var(--cor-obee-tinta)" : "var(--cor-carvao-muted)"}
              >
                {partes(l.rotulo)[0]}
                {partes(l.rotulo)[1] && (
                  <tspan x={m.l - 10} dy="1.15em">
                    {partes(l.rotulo)[1]}
                  </tspan>
                )}
              </text>
              <circle cx={x(l.valor)} cy={yc(i)} r={l.destacada ? 6.5 : 4.5} fill={l.destacada ? COR.selecao : COR.neutro} stroke={COR.superficie} strokeWidth={2} />
              {comRotulo(l, i) && (
                <text x={w - m.r + 8} y={yc(i)} dy="0.32em" fontSize={fonte} fontWeight={l.destacada || l.valor === min || l.valor === max ? 700 : 400} fill="var(--cor-obee-tinta)">
                  {formata(l.valor)}
                </text>
              )}
            </g>
          ))}
          {fora.map((l, k) => {
            const i = linhas.length + k;
            const [n1, n2] = partes(l.rotulo);
            return (
              <g key={l.chave} data-fora-da-comparacao={l.chave}>
                <line x1={m.l} x2={w - m.r} y1={yc(i)} y2={yc(i)} stroke={COR.grade} strokeWidth={1} strokeDasharray="2 4" />
                <text x={m.l - 10} y={yc(i)} dy={n2 ? "-0.1em" : "0.32em"} textAnchor="end" fontSize={fonte} fontWeight={l.destacada ? 700 : 400} fill={l.destacada ? "var(--cor-obee-tinta)" : "var(--cor-carvao-muted)"}>
                  {n1}
                  {n2 && (
                    <tspan x={m.l - 10} dy="1.15em">
                      {n2}
                    </tspan>
                  )}
                </text>
                <text x={m.l + 8} y={yc(i)} dy="0.32em" fontSize={fonte - 0.5} fontStyle="italic" fill="var(--cor-carvao-muted)">
                  {larg(l.texto, fonte - 0.5) <= w - m.l - 14 ? l.texto : l.texto.replace(/ \(.*\)$/, "")}
                </text>
              </g>
            );
          })}
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
        {externa && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="22" height="14" aria-hidden="true">
              <line x1="2" x2="20" y1="7" y2="7" stroke={COR.referencia} strokeWidth="1.5" strokeDasharray="2 3" strokeLinecap="round" />
            </svg>
            {externa.rotulo}: {formata(externa.valor)}
            {externa.nota ? ` (${externa.nota})` : ""}
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
      {!log && !zero && dom.min > 0 && (
        <p className="mt-2 text-xs leading-snug text-carvao-muted" role="note">
          O eixo não parte de zero (começa em {formataEixo(dom.min)}): compare a posição das capitais, não o comprimento das hastes.
        </p>
      )}
      {log && (
        <p className="mt-2 text-xs leading-snug text-carvao-muted">
          Escala logarítmica: distâncias iguais representam razões iguais, não diferenças iguais. A escala linear mostra a diferença real em reais.
        </p>
      )}
    </figure>
  );
}
