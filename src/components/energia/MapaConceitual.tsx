"use client";

import { useState, type ReactNode } from "react";
import type { IdNo, TipoLigacao } from "@/lib/energia/mapa";

/**
 * Mapa conceitual da página inicial (seção 6.2 B): sete elos em cartões e as
 * ligações entre eles, cada uma com o traço do seu tipo (fluxo físico, decisão de
 * operação, regra de mercado, componente de custo, associação analítica). O
 * cartão escolhido por clique, toque ou foco acende as suas ligações e abre a
 * explicação ao lado. Os elos estão em quatro faixas (caminho físico, coordenação
 * da operação, relações econômicas e experiência das pessoas): o nome de cada faixa
 * fica ao lado dos seus elos e no painel do elo escolhido. O desenho é decorativo
 * para leitor de tela (aria-hidden): o conteúdo equivalente está nos botões, no
 * painel de detalhe e na versão em texto que a página publica junto. No celular a
 * página mostra só a versão em texto; este componente aparece a partir de md.
 */

export type NoDiagrama = { id: IdNo; titulo: string; curto: string; faixa: string; pos: { x: number; y: number }; detalhe: ReactNode };
/** Nome de uma faixa e onde ele fica no diagrama (unidades do viewBox; `alinha` diz de que lado do ponto o texto cresce). */
export type RotuloFaixa = { texto: string; x: number; y: number; alinha: "esq" | "centro" };
export type LigacaoDiagrama = { de: IdNo; para: IdNo; tipo: TipoLigacao };
export type TipoDiagrama = { id: TipoLigacao; rotulo: string; definicao: string; traco: string };

const LARGURA = 1000;
const ALTURA = 680;
/** Meia largura e meia altura do cartão, em unidades do viewBox. */
const MW = 98;
const MH = 56;
const FOLGA = 7;

/** Ponto onde o segmento entre os centros sai do retângulo do cartão (com folga para a seta). */
function borda(cx: number, cy: number, dx: number, dy: number): [number, number] {
  const tx = dx === 0 ? Infinity : (MW + FOLGA) / Math.abs(dx);
  const ty = dy === 0 ? Infinity : (MH + FOLGA) / Math.abs(dy);
  const t = Math.min(tx, ty);
  return [cx + dx * t, cy + dy * t];
}

function caminho(a: { x: number; y: number }, b: { x: number; y: number }): string {
  // ligação entre cartões da mesma linha que não são vizinhos: arco por cima da fileira
  if (a.y === b.y && Math.abs(a.x - b.x) > 300) {
    const x1 = a.x + Math.sign(b.x - a.x) * (MW - 40);
    const x2 = b.x - Math.sign(b.x - a.x) * (MW - 40);
    const y = a.y - MH - FOLGA;
    return `M ${x1} ${y} Q ${(x1 + x2) / 2} ${y - 120} ${x2} ${y}`;
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const n = Math.hypot(dx, dy);
  const [x1, y1] = borda(a.x, a.y, dx / n, dy / n);
  const [x2, y2] = borda(b.x, b.y, -dx / n, -dy / n);
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

const pct = (v: number, total: number) => `${(100 * v) / total}%`;

export function MapaConceitual({
  nos,
  ligacoes,
  tipos,
  inicial,
  rotulo,
  faixas = [],
}: {
  nos: NoDiagrama[];
  ligacoes: LigacaoDiagrama[];
  tipos: TipoDiagrama[];
  inicial: IdNo;
  rotulo: string;
  faixas?: RotuloFaixa[];
}) {
  const [atual, setAtual] = useState<IdNo>(inicial);
  const porId = new Map(nos.map((n) => [n.id, n]));
  const tracos = new Map(tipos.map((t) => [t.id, t.traco]));
  const ligadas = (l: LigacaoDiagrama) => l.de === atual || l.para === atual;
  const escolhido = porId.get(atual)!;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div role="group" aria-label={rotulo}>
        <div className="relative w-full" style={{ aspectRatio: `${LARGURA} / ${ALTURA}` }}>
          <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="absolute inset-0 h-full w-full" aria-hidden="true" focusable="false">
            <defs>
              <marker id="mapa-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            {ligacoes.map((l) => {
              const ativa = ligadas(l);
              return (
                <path
                  key={`${l.de}-${l.para}`}
                  d={caminho(porId.get(l.de)!.pos, porId.get(l.para)!.pos)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={ativa ? 2.6 : 1.6}
                  strokeDasharray={tracos.get(l.tipo) || undefined}
                  markerEnd="url(#mapa-seta)"
                  className={ativa ? "text-energia-dark" : "text-mineral opacity-40"}
                />
              );
            })}
          </svg>
          {faixas.map((f) => (
            <span
              key={f.texto}
              aria-hidden="true"
              className="rotulo pointer-events-none absolute whitespace-nowrap text-mineral"
              style={{ left: pct(f.x, LARGURA), top: pct(f.y, ALTURA), transform: f.alinha === "centro" ? "translateX(-50%)" : undefined }}
            >
              {f.texto}
            </span>
          ))}
          {nos.map((n) => {
            const sel = n.id === atual;
            return (
              <button
                key={n.id}
                type="button"
                aria-pressed={sel}
                aria-controls="mapa-conceitual-detalhe"
                onClick={() => setAtual(n.id)}
                onFocus={() => setAtual(n.id)}
                className={`absolute flex flex-col items-start justify-center overflow-hidden border px-2.5 py-1 text-left leading-tight transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-energia-dark ${
                  sel ? "border-energia bg-energia-fundo" : "border-linha bg-superficie hover:border-energia"
                }`}
                style={{
                  left: pct(n.pos.x - MW, LARGURA),
                  top: pct(n.pos.y - MH, ALTURA),
                  width: pct(2 * MW, LARGURA),
                  height: pct(2 * MH, ALTURA),
                }}
              >
                <span className="font-serif text-[0.8125rem] text-carvao xl:text-sm">{n.titulo}</span>
                <span className="sr-only">: {n.curto}</span>
              </button>
            );
          })}
        </div>
        <ul aria-label="Tipos de ligação" className="mt-4 grid gap-x-6 gap-y-2 text-xs text-carvao-muted sm:grid-cols-2">
          {tipos.map((t) => (
            <li key={t.id} className="flex items-start gap-2">
              <svg width="38" height="10" viewBox="0 0 38 10" aria-hidden="true" focusable="false" className="mt-1 shrink-0 text-carvao">
                <line x1="1" y1="5" x2="37" y2="5" stroke="currentColor" strokeWidth="2" strokeDasharray={t.traco || undefined} />
              </svg>
              <span>
                <strong className="font-medium text-carvao">{t.rotulo}:</strong> {t.definicao}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div id="mapa-conceitual-detalhe" aria-live="polite" className="border border-linha bg-superficie p-5">
        <p className="rotulo text-mineral">
          Elo escolhido <span aria-hidden="true">·</span> <span className="sr-only">na faixa </span>
          {escolhido.faixa}
        </p>
        <h3 className="mt-1 font-serif text-xl leading-snug text-carvao">{escolhido.titulo}</h3>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-carvao-muted">{escolhido.detalhe}</div>
      </div>
    </div>
  );
}
