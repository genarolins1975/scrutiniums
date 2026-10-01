"use client";

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as PE, type ReactNode } from "react";
import { num } from "@/lib/energia/formato";
import { aplicarZoom, caixaDoZoom, comFolga, lerViewBox, limitarZoom, textoViewBox, zoomInicial, type CamadaGeo, type Caixa, type ContornoGeo, type FeatureGeo, type Ponto, type Zoom } from "@/lib/energia/geo";

/**
 * Mapa da página Minha região (P002) sobre a malha oficial do IBGE já projetada
 * (public/energia/geo/uf.json e municipios.json, Albers cônica equivalente, y para
 * baixo). Desenha uma camada de polígonos com o preenchimento que a página decide
 * (categoria do submercado, situação do vínculo, classe da medida municipal), marcas
 * sobrepostas de outra malha (municípios fora do SIN por cima das UFs), contornos de
 * destaque e pontos (usinas do SIGA, já na grade da malha).
 *
 * Por que um mapa próprio e não o MapaCoropletico: as camadas daqui são categóricas
 * (submercado, situação do vínculo) e precisam de pontos e de destaque de um conjunto de
 * municípios (a área de uma distribuidora). As regras de tela são as mesmas: sem dado é
 * hachura, cor nunca é o único portador (legenda escrita, tabela equivalente e ficha),
 * alvos de 44 px nos botões, dica por ponteiro e por toque, zoom por botões com arrasto.
 *
 * Teclado: os polígonos não são paradas de Tab (seriam milhares); a busca da página
 * escolhe qualquer entidade e a tabela equivalente abaixo seleciona linha a linha,
 * sincronizadas com o mapa pela URL.
 */

export type PoligonoDestaque = { id: string; d: string; estilo: "selecao" | "area" | "contorno" | "tracejado" };
export type SobreposicaoMapa = { id: string; features: readonly FeatureGeo[]; fill: string; tracejado?: boolean };
export type GrupoPontosMapa = { id: string; cor: string; ponta: "round" | "square"; espessura: number; d: string; vazado?: boolean };
export type DicaMapa = { titulo: string; linhas: string[] };

/** Preenchimento especial: hachura de "sem dado" desenhada pelo próprio mapa. */
export type PreenchimentoMapa = string;

const LARGURA_SSR = 760;
const ESCALA_MAXIMA = 24;

const BOTAO =
  "inline-flex h-11 min-w-[44px] items-center justify-center border border-linha bg-superficie px-3 text-sm text-carvao hover:border-energia disabled:cursor-not-allowed disabled:text-mineral focus:outline-none focus-visible:ring-2 focus-visible:ring-energia";

/** Camada de polígonos memoizada: não re-renderiza com a dica nem com o zoom. */
const CamadaPoligonos = memo(function CamadaPoligonos({ features, fills, hachura, traco }: { features: readonly FeatureGeo[]; fills: readonly string[]; hachura: string; traco: number }) {
  return (
    <g fillRule="evenodd" stroke="var(--cor-superficie)" strokeWidth={traco} strokeLinejoin="round">
      {features.map((f, i) => (
        <path key={f.id} d={f.d} fill={fills[i] === "sem-dado" ? `url(#${hachura})` : fills[i] ?? "var(--cor-superficie)"} data-id={f.id} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
});

const CamadaContornos = memo(function CamadaContornos({ contornos }: { contornos: readonly ContornoGeo[] }) {
  return (
    <g fill="none" stroke="var(--cor-carvao-muted)" strokeWidth={0.9} strokeLinejoin="round" pointerEvents="none" aria-hidden="true">
      {contornos.map((c) => (
        <path key={c.id} d={c.d} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
});

const CamadaPontos = memo(function CamadaPontos({ grupos, upx }: { grupos: readonly GrupoPontosMapa[]; upx: number }) {
  return (
    <g pointerEvents="none" aria-hidden="true">
      {grupos.map((g) =>
        g.vazado ? (
          <g key={g.id}>
            <path d={g.d} stroke={g.cor} strokeWidth={g.espessura * upx} strokeLinecap={g.ponta} fill="none" />
            <path d={g.d} stroke="var(--cor-superficie)" strokeWidth={Math.max(0, g.espessura - 3) * upx} strokeLinecap={g.ponta} fill="none" />
          </g>
        ) : (
          <path key={g.id} d={g.d} stroke={g.cor} strokeWidth={g.espessura * upx} strokeLinecap={g.ponta} fill="none" />
        ),
      )}
    </g>
  );
});

export function TerritorioMapa({
  titulo,
  descricao,
  geo,
  fills,
  contornos,
  sobreposicoes = [],
  destaques = [],
  pontos = [],
  pontoSelecionado = null,
  foco = null,
  onClique,
  dica,
  altura = 540,
  alturaCelular = 380,
  ajuda,
}: {
  titulo: string;
  descricao: string;
  geo: CamadaGeo;
  /** Um preenchimento por feature da malha, na ordem de `geo.features` ("sem-dado" = hachura). */
  fills: readonly PreenchimentoMapa[];
  contornos?: readonly ContornoGeo[] | null;
  sobreposicoes?: readonly SobreposicaoMapa[];
  destaques?: readonly PoligonoDestaque[];
  pontos?: readonly GrupoPontosMapa[];
  pontoSelecionado?: Ponto | null;
  /** Ponto que o "Aproximar" centraliza (a seleção atual). */
  foco?: Ponto | null;
  /** Clique ou toque: id do polígono sob o ponteiro (ou null), ponto na malha e tolerância de 12 px em unidades da malha. */
  onClique: (alvo: { id: string | null; ponto: Ponto; tolerancia: number }) => void;
  dica: (id: string) => DicaMapa | null;
  altura?: number;
  alturaCelular?: number;
  ajuda?: ReactNode;
}) {
  const uid = useId().replace(/:/g, "");
  const hachura = `${uid}-sem-dado`;
  const base = useMemo<Caixa>(() => comFolga(lerViewBox(geo.viewBox) ?? { x: 0, y: 0, largura: 1, altura: 1 }, 0.015), [geo.viewBox]);
  const [zoom, setZoom] = useState<Zoom>(() => zoomInicial(base));
  useEffect(() => setZoom(zoomInicial(base)), [base]);
  const z = limitarZoom(base, zoom, ESCALA_MAXIMA);
  const vb = caixaDoZoom(base, z);

  const caixa = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [tam, setTam] = useState({ w: LARGURA_SSR, h: altura });
  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => {
      const r = e[0].contentRect;
      if (r.width > 0 && r.height > 0) setTam({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // pixels por unidade da malha (ajuste "meet")
  const px = Math.min(tam.w / vb.largura, tam.h / vb.altura) || 1;
  const upx = 1 / px;

  const [aDica, setADica] = useState<{ id: string; x: number; y: number; toque: boolean } | null>(null);
  const [leitura, setLeitura] = useState("");
  const arrasto = useRef<{ x: number; y: number; centro: Ponto; moveu: boolean } | null>(null);
  const tipoPonteiro = useRef("mouse");

  const paraMalha = useCallback((cx: number, cy: number): Ponto | null => {
    const el = svg.current;
    const m = el?.getScreenCTM?.();
    if (!el || !m) return null;
    const p = el.createSVGPoint();
    p.x = cx;
    p.y = cy;
    const q = p.matrixTransform(m.inverse());
    return [q.x, q.y];
  }, []);
  const relativo = (ev: { clientX: number; clientY: number }): Ponto | null => {
    const r = caixa.current?.getBoundingClientRect();
    return r ? [ev.clientX - r.left, ev.clientY - r.top] : null;
  };
  const idDoAlvo = (t: EventTarget | null): string | null => {
    const el = t as Element | null;
    return el && typeof el.getAttribute === "function" ? el.getAttribute("data-id") : null;
  };

  function mudar(fator: number) {
    setZoom((atual) => aplicarZoom(base, limitarZoom(base, atual, ESCALA_MAXIMA), fator, ESCALA_MAXIMA, fator > 1 ? foco : null));
    setADica(null);
  }

  function aoPressionar(ev: PE<SVGSVGElement>) {
    tipoPonteiro.current = ev.pointerType;
    arrasto.current = { x: ev.clientX, y: ev.clientY, centro: z.centro, moveu: false };
  }
  function aoMover(ev: PE<SVGSVGElement>) {
    const a = arrasto.current;
    if (a && z.escala > 1) {
      const dx = ev.clientX - a.x;
      const dy = ev.clientY - a.y;
      if (!a.moveu && Math.hypot(dx, dy) < 6) return;
      if (!a.moveu) ev.currentTarget.setPointerCapture?.(ev.pointerId);
      a.moveu = true;
      setADica(null);
      setZoom(limitarZoom(base, { escala: z.escala, centro: [a.centro[0] - dx / px, a.centro[1] - dy / px] }, ESCALA_MAXIMA));
      return;
    }
    if (ev.pointerType !== "mouse") return;
    const id = idDoAlvo(ev.target);
    const pos = relativo(ev);
    if (!id || !pos) {
      if (aDica && !aDica.toque) setADica(null);
      return;
    }
    if (aDica?.id !== id) {
      const d = dica(id);
      if (d) setLeitura(`${d.titulo}: ${d.linhas.join("; ")}`);
    }
    setADica({ id, x: pos[0], y: pos[1], toque: false });
  }
  function aoSoltar(ev: PE<SVGSVGElement>) {
    const a = arrasto.current;
    arrasto.current = null;
    if (a?.moveu) return;
    const p = paraMalha(ev.clientX, ev.clientY);
    if (!p) return;
    const id = idDoAlvo(ev.target);
    onClique({ id, ponto: p, tolerancia: 12 / px });
    const pos = relativo(ev);
    // no toque não há hover: a dica aparece no ponto tocado e fica até outro toque
    if (tipoPonteiro.current !== "mouse" && id && pos) setADica({ id, x: pos[0], y: pos[1], toque: true });
  }

  const d = aDica ? dica(aDica.id) : null;
  const noZoom = z.escala > 1;

  return (
    <figure className="min-w-0 space-y-2">
      <figcaption className="text-sm font-medium text-carvao">{titulo}</figcaption>
      <div role="group" aria-label="Zoom do mapa" className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" className={BOTAO} onClick={() => mudar(2)} disabled={z.escala >= ESCALA_MAXIMA} aria-label="Aproximar o mapa">
          +
        </button>
        <button type="button" className={BOTAO} onClick={() => mudar(0.5)} disabled={!noZoom} aria-label="Afastar o mapa">
          −
        </button>
        <button type="button" className={`${BOTAO} rotulo`} onClick={() => setZoom(zoomInicial(base))} disabled={!noZoom}>
          Restaurar
        </button>
        <span className="text-xs text-carvao-muted">{noZoom ? `Aproximação de ${num(z.escala, 0)} vezes; arraste para mover.` : "Clique ou toque para escolher; o + aproxima na seleção."}</span>
      </div>
      <div
        ref={caixa}
        className="relative h-[var(--mapa-h)] overflow-hidden border border-linha bg-papel sm:h-[var(--mapa-h-sm)]"
        style={{ "--mapa-h": `${alturaCelular}px`, "--mapa-h-sm": `${altura}px` } as React.CSSProperties}
      >
        <svg
          ref={svg}
          role="img"
          aria-labelledby={`${uid}-t`}
          aria-describedby={`${uid}-d`}
          viewBox={textoViewBox(vb)}
          preserveAspectRatio="xMidYMid meet"
          className={`block h-full w-full select-none ${noZoom ? "cursor-grab touch-none" : "cursor-pointer touch-pan-y"}`}
          onPointerDown={aoPressionar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={() => (arrasto.current = null)}
          onPointerLeave={(ev) => {
            arrasto.current = null;
            if (ev.pointerType === "mouse" && aDica && !aDica.toque) setADica(null);
          }}
        >
          <title id={`${uid}-t`}>{titulo}</title>
          <desc id={`${uid}-d`}>{descricao}</desc>
          <defs>
            <pattern id={hachura} patternUnits="userSpaceOnUse" width={6 * upx} height={6 * upx} patternTransform="rotate(45)">
              <rect width={6 * upx} height={6 * upx} fill="var(--cor-superficie)" />
              <rect width={1.2 * upx} height={6 * upx} fill="var(--cor-mineral)" />
            </pattern>
          </defs>
          <CamadaPoligonos features={geo.features} fills={fills} hachura={hachura} traco={geo.features.length > 500 ? 0.35 : 1} />
          {contornos && contornos.length > 0 && <CamadaContornos contornos={contornos} />}
          {sobreposicoes.map((s) => (
            <g key={s.id} fillRule="evenodd" stroke="var(--cor-carvao)" strokeWidth={0.8} strokeDasharray={s.tracejado ? "3 2" : undefined}>
              {s.features.map((f) => (
                <path key={f.id} d={f.d} fill={s.fill === "sem-dado" ? `url(#${hachura})` : s.fill} data-id={f.id} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          ))}
          {destaques.map((x) =>
            x.estilo === "area" ? (
              <path key={`a-${x.id}`} d={x.d} fill="none" stroke="var(--cor-energia-dark)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" pointerEvents="none" />
            ) : x.estilo === "tracejado" ? (
              <path key={`t-${x.id}`} d={x.d} fill="none" stroke="var(--cor-carvao)" strokeWidth={1.4} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" pointerEvents="none" />
            ) : x.estilo === "contorno" ? (
              <path key={`c-${x.id}`} d={x.d} fill="none" stroke="var(--cor-carvao)" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />
            ) : (
              <g key={`s-${x.id}`} fill="none" pointerEvents="none" data-selecionado={x.id}>
                <path d={x.d} stroke="var(--cor-superficie)" strokeWidth={5} vectorEffect="non-scaling-stroke" />
                <path d={x.d} stroke="var(--cor-carvao)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
              </g>
            ),
          )}
          {pontos.length > 0 && <CamadaPontos grupos={pontos} upx={upx} />}
          {pontoSelecionado && (
            <g pointerEvents="none" aria-hidden="true">
              <circle cx={pontoSelecionado[0]} cy={pontoSelecionado[1]} r={9 * upx} fill="none" stroke="var(--cor-superficie)" strokeWidth={5 * upx} />
              <circle cx={pontoSelecionado[0]} cy={pontoSelecionado[1]} r={9 * upx} fill="none" stroke="var(--cor-carvao)" strokeWidth={2.5 * upx} />
            </g>
          )}
        </svg>
        {aDica && d && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-20 w-[14rem] max-w-full border border-linha bg-superficie px-3 py-2 text-xs shadow-[0_6px_20px_rgba(26,29,33,0.12)]"
            style={{
              left: `clamp(0px, ${aDica.x}px - 7rem, 100% - 14rem)`,
              top: aDica.y,
              transform: aDica.y > 110 ? "translateY(calc(-100% - 12px))" : "translateY(16px)",
            }}
          >
            <p className="rotulo text-mineral">{d.titulo}</p>
            {d.linhas.map((l, i) => (
              <p key={i} className="mt-0.5 tabular-nums text-carvao">
                {l}
              </p>
            ))}
          </div>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {leitura}
      </p>
      {ajuda && <div className="text-xs leading-relaxed text-carvao-muted">{ajuda}</div>}
    </figure>
  );
}
