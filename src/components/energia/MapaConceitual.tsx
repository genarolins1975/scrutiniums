"use client";

import { useState, type ReactNode } from "react";
import type { IdNo, PontaLigacao, TipoLigacao } from "@/lib/energia/mapa";

/**
 * Mapa conceitual da página inicial (seção 6.2 B): sete elos em cartões e as
 * ligações entre eles, cada uma com a forma do seu tipo (fluxo físico, decisão de
 * operação, regra de mercado, componente de custo, associação analítica): o traço, a
 * espessura e a ponta mudam de um tipo para o outro, e a cor nunca é o único sinal. O
 * cartão escolhido por clique, toque ou foco acende as suas ligações e abre a
 * explicação ao lado. Os elos estão em quatro faixas (caminho físico, coordenação
 * da operação, relações econômicas e experiência das pessoas): o nome de cada faixa
 * fica ao lado dos seus elos e no painel do elo escolhido. O desenho é decorativo
 * para leitor de tela (aria-hidden): o conteúdo equivalente está nos botões e no
 * painel de detalhe. As setas, Home e End percorrem os elos na ordem de leitura. No
 * celular a página mostra o mapa vertical (a mesma informação, de cima para baixo);
 * este componente aparece a partir de md.
 */

export type NoDiagrama = { id: IdNo; titulo: string; curto: string; faixa: string; pos: { x: number; y: number }; detalhe: ReactNode };
/** Nome de uma faixa e onde ele fica no diagrama (unidades do viewBox; `alinha` diz de que lado do ponto o texto cresce). */
export type RotuloFaixa = { texto: string; x: number; y: number; alinha: "esq" | "centro" };
export type LigacaoDiagrama = { de: IdNo; para: IdNo; tipo: TipoLigacao };
export type TipoDiagrama = { id: TipoLigacao; rotulo: string; definicao: string; traco: string; espessura: number; ponta: PontaLigacao };

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

/** Ponta de cada tipo de ligação, no viewBox 0 0 10 10 de um marcador: o ponto de ancoragem (refX) é a ponta da forma que toca o cartão. */
function FormaDaPonta({ ponta }: { ponta: PontaLigacao }) {
  if (ponta === "seta") return <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />;
  if (ponta === "seta-aberta") return <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />;
  if (ponta === "losango") return <path d="M 0 5 L 5 0 L 10 5 L 5 10 z" fill="currentColor" />;
  if (ponta === "quadrado") return <rect x="1" y="1" width="8" height="8" fill="currentColor" />;
  return <circle cx="5" cy="5" r="4" fill="currentColor" />;
}

/** A amostra de um tipo na legenda: a linha com o traço e a espessura do tipo e a ponta dele (a associação tem círculo nas duas pontas). */
function Amostra({ t }: { t: TipoDiagrama }) {
  const dupla = t.ponta === "circulo";
  return (
    <svg width="50" height="14" viewBox="0 0 50 14" aria-hidden="true" focusable="false" className="mt-0.5 shrink-0 text-carvao">
      <line x1={dupla ? 8 : 1} y1="7" x2="38" y2="7" stroke="currentColor" strokeWidth={t.espessura} strokeDasharray={t.traco || undefined} strokeLinecap={t.traco && t.ponta === "quadrado" ? "round" : "butt"} />
      {dupla && (
        <svg x="0" y="2" width="10" height="10" viewBox="0 0 10 10">
          <FormaDaPonta ponta="circulo" />
        </svg>
      )}
      <svg x="38" y="1" width="12" height="12" viewBox="0 0 10 10">
        <FormaDaPonta ponta={t.ponta} />
      </svg>
    </svg>
  );
}

const PONTAS: PontaLigacao[] = ["seta", "seta-aberta", "losango", "quadrado", "circulo"];

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
  const formas = new Map(tipos.map((t) => [t.id, t]));
  const ligadas = (l: LigacaoDiagrama) => l.de === atual || l.para === atual;
  const escolhido = porId.get(atual)!;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div
        role="group"
        aria-label={rotulo}
        onKeyDown={(e) => {
          // as setas percorrem os sete elos na ordem de leitura (o foco no elo já o escolhe); Tab continua passando por todos
          const i = nos.findIndex((n) => `mapa-no-${n.id}` === (e.target as HTMLElement).id);
          if (i < 0) return;
          const prox =
            e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % nos.length : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i + nos.length - 1) % nos.length : e.key === "Home" ? 0 : e.key === "End" ? nos.length - 1 : -1;
          if (prox < 0) return;
          e.preventDefault();
          document.getElementById(`mapa-no-${nos[prox].id}`)?.focus();
        }}
      >
        <div className="relative w-full" style={{ aspectRatio: `${LARGURA} / ${ALTURA}` }}>
          <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="absolute inset-0 h-full w-full" aria-hidden="true" focusable="false">
            <defs>
              {/* um marcador por forma de ponta, em tamanho fixo (markerUnits userSpaceOnUse): a espessura da linha muda de um tipo para o outro, o tamanho da ponta não */}
              {PONTAS.map((p) => (
                <marker key={p} id={`mapa-ponta-${p}`} viewBox="0 0 10 10" refX={p === "circulo" ? 5 : 9} refY="5" markerUnits="userSpaceOnUse" markerWidth="15" markerHeight="15" orient="auto-start-reverse" className="text-carvao">
                  <FormaDaPonta ponta={p} />
                </marker>
              ))}
            </defs>
            {ligacoes.map((l) => {
              const ativa = ligadas(l);
              return (
                <path
                  key={`${l.de}-${l.para}`}
                  d={caminho(porId.get(l.de)!.pos, porId.get(l.para)!.pos)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={(formas.get(l.tipo)?.espessura ?? 2) + (ativa ? 0.8 : 0)}
                  strokeDasharray={formas.get(l.tipo)?.traco || undefined}
                  strokeLinecap={formas.get(l.tipo)?.ponta === "quadrado" ? "round" : "butt"}
                  markerEnd={`url(#mapa-ponta-${formas.get(l.tipo)?.ponta ?? "seta"})`}
                  // a associação analítica não tem sentido: círculo nas duas pontas
                  markerStart={formas.get(l.tipo)?.ponta === "circulo" ? "url(#mapa-ponta-circulo)" : undefined}
                  // fora da seleção o traço continua legível (contraste de objeto gráfico, 3:1): o tipo da ligação se lê pelo padrão do traço, e a seleção só o escurece e engrossa
                  className={ativa ? "text-energia-dark" : "text-mineral opacity-90"}
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
                id={`mapa-no-${n.id}`}
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
              <Amostra t={t} />
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
