"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { comFolga, lerViewBox, textoViewBox, type Caixa } from "@/lib/energia/geo";
import { num } from "@/lib/energia/formato";
import { COR_RAZAO, CURTO_RAZAO, RAZOES, type PontoUsina } from "@/lib/energia/geracao";
import type { RazaoRestricao } from "@/lib/energia/tipos-geracao";

/**
 * Mapa das usinas e conjuntos com mais energia não gerada por restrição (P023), sobre a
 * malha oficial de UF do IBGE (public/energia/geo/uf.json, Albers cônica equivalente).
 * As coordenadas são as que o ONS publica no conjunto de fator de capacidade (subestação
 * coletora; sem ela, o ponto de conexão), projetadas na mesma grade da malha
 * (projetaPonto em src/lib/energia/geracao.ts, conferida no teste: cada ponto cai numa UF
 * da malha; os poucos fora da UF informada pelo ONS, subestação coletora de conjunto em UF vizinha,
 * são contados e declarados na nota do mapa).
 *
 * Cor e forma dizem a razão com mais energia não gerada (círculo energética, quadrado
 * confiabilidade, losango elétrica, triângulo parecer de acesso): a cor nunca é o único
 * portador. O tamanho é a classe de energia não gerada (tercis das usinas publicadas),
 * marca e não escala de área.
 *
 * Acessibilidade: as marcas não são alvos de Tab (seriam dezenas); o teclado usa a tabela
 * equivalente logo abaixo (busca, ordem, seleção), sincronizada com o mapa pela URL. A
 * usina selecionada fica rotulada no próprio mapa e é anunciada numa região aria-live.
 * Toque ou clique numa marca seleciona; a dica do ponteiro também aparece no toque.
 */
export type MapaUsinasProps = {
  titulo: string;
  ufs: { id: string; uf: string; d: string }[];
  viewBox: string;
  pontos: PontoUsina[];
  rotulosClasse: [string, string, string];
  selecionado: string | null;
  onSelecionar: (id: string | null) => void;
  semCoordenada: number;
  nota?: string;
};

const RAIO_PX = [3.5, 5.5, 8] as const;
const LARGURA_SSR = 640;

/** Caminho da marca de cada razão em torno de (x, y) com raio r (unidades do SVG). */
function marca(razao: RazaoRestricao, x: number, y: number, r: number): string {
  const f = (v: number) => Math.round(v * 10) / 10;
  if (razao === "CNF") return `M${f(x - r * 0.88)},${f(y - r * 0.88)}h${f(r * 1.76)}v${f(r * 1.76)}h${f(-r * 1.76)}Z`;
  if (razao === "REL") return `M${f(x)},${f(y - r * 1.15)}L${f(x + r * 1.15)},${f(y)}L${f(x)},${f(y + r * 1.15)}L${f(x - r * 1.15)},${f(y)}Z`;
  if (razao === "PAR") return `M${f(x)},${f(y - r * 1.2)}L${f(x + r * 1.1)},${f(y + r * 0.8)}L${f(x - r * 1.1)},${f(y + r * 0.8)}Z`;
  // ENE e sem razão informada: círculo (sem razão vai vazado)
  return `M${f(x - r)},${f(y)}a${f(r)},${f(r)} 0 1,0 ${f(2 * r)},0a${f(r)},${f(r)} 0 1,0 ${f(-2 * r)},0Z`;
}

export function GeracaoMapaUsinas({ titulo, ufs, viewBox, pontos, rotulosClasse, selecionado, onSelecionar, semCoordenada, nota }: MapaUsinasProps) {
  const uid = useId().replace(/:/g, "");
  const raiz = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(LARGURA_SSR);
  const [ampliado, setAmpliado] = useState(true);
  const [sobre, setSobre] = useState<string | null>(null);

  useEffect(() => {
    const el = raiz.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setLargura(Math.max(260, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const base = useMemo(() => lerViewBox(viewBox), [viewBox]);
  // janela ampliada: a caixa dos pontos com folga, na proporção da malha (o desenho não distorce)
  const janela: Caixa | null = useMemo(() => {
    if (!base) return null;
    if (!ampliado || pontos.length < 2) return base;
    const xs = pontos.map((p) => p.x);
    const ys = pontos.map((p) => p.y);
    const c = comFolga({ x: Math.min(...xs), y: Math.min(...ys), largura: Math.max(...xs) - Math.min(...xs), altura: Math.max(...ys) - Math.min(...ys) }, 0.12);
    const prop = base.altura / base.largura;
    const larg = Math.max(c.largura, c.altura / prop, base.largura / 6);
    const alt = larg * prop;
    return { x: c.x + c.largura / 2 - larg / 2, y: c.y + c.altura / 2 - alt / 2, largura: larg, altura: alt };
  }, [base, ampliado, pontos]);

  if (!base || !janela) {
    return <p className="border-l-2 border-aviso pl-3 text-sm text-carvao">A malha de UF publicada não tem enquadramento válido; o mapa não é desenhado e a tabela abaixo traz as mesmas usinas.</p>;
  }
  const unidadesPorPx = janela.largura / largura;
  const altura = Math.round(largura * (janela.altura / janela.largura));
  const escolhido = pontos.find((p) => p.id === selecionado) ?? null;
  const emFoco = pontos.find((p) => p.id === sobre) ?? escolhido;
  const ordenados = [...pontos].sort((a, b) => (a.id === selecionado ? 1 : b.id === selecionado ? -1 : b.classe - a.classe));
  const razoesPresentes = RAZOES.filter((z) => pontos.some((p) => p.razao === z));
  const tela = (x: number, y: number) => [((x - janela.x) / janela.largura) * largura, ((y - janela.y) / janela.altura) * altura] as const;

  return (
    <figure className="space-y-2" aria-labelledby={`${uid}-t`}>
      <figcaption id={`${uid}-t`} className="text-sm font-medium text-carvao">
        {titulo}
      </figcaption>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          aria-pressed={ampliado}
          onClick={() => setAmpliado(true)}
          className={`inline-flex min-h-[44px] items-center border px-3 ${ampliado ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted"}`}
        >
          Ampliar nas usinas
        </button>
        <button
          type="button"
          aria-pressed={!ampliado}
          onClick={() => setAmpliado(false)}
          className={`inline-flex min-h-[44px] items-center border px-3 ${!ampliado ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao-muted"}`}
        >
          Brasil inteiro
        </button>
        {selecionado && (
          <button type="button" onClick={() => onSelecionar(null)} className="inline-flex min-h-[44px] items-center px-2 text-carvao-muted underline underline-offset-4 hover:text-carvao">
            Limpar seleção
          </button>
        )}
      </div>
      <div ref={raiz} className="relative w-full max-w-2xl">
        <svg
          viewBox={textoViewBox(janela)}
          width="100%"
          height={altura}
          role="img"
          aria-label={`${titulo}. ${pontos.length} usinas e conjuntos com coordenada; a tabela equivalente abaixo traz os mesmos dados e permite selecionar pelo teclado.`}
          className="block border border-linha bg-superficie"
          onPointerLeave={() => setSobre(null)}
        >
          <g>
            {ufs.map((u) => (
              <path key={u.id} d={u.d} fill="var(--cor-papel)" stroke="var(--cor-linha)" strokeWidth={1} vectorEffect="non-scaling-stroke">
                <title>{u.uf}</title>
              </path>
            ))}
          </g>
          <g>
            {ordenados.map((p) => {
              const r = RAIO_PX[p.classe] * unidadesPorPx;
              const sel = p.id === selecionado;
              const vazado = p.razao === "SEM";
              return (
                <path
                  key={p.id}
                  d={marca(p.razao, p.x, p.y, r)}
                  fill={vazado ? "var(--cor-superficie)" : COR_RAZAO[p.razao]}
                  fillOpacity={vazado ? 1 : 0.85}
                  stroke={sel ? "var(--cor-carvao)" : vazado ? COR_RAZAO[p.razao] : "var(--cor-superficie)"}
                  strokeWidth={sel ? 2.5 : 1}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: "pointer" }}
                  onPointerEnter={() => setSobre(p.id)}
                  onClick={() => onSelecionar(sel ? null : p.id)}
                >
                  <title>{`${p.nome}${p.uf ? ` (${p.uf})` : ""}: ${num(p.nao_gerada_gwh, 1)} GWh não gerados, taxa ${num(p.taxa_pct, 1)}%, ${CURTO_RAZAO[p.razao]}`}</title>
                </path>
              );
            })}
          </g>
        </svg>
        {emFoco &&
          (() => {
            const [px, py] = tela(emFoco.x, emFoco.y);
            const esquerda = px > largura / 2;
            return (
              <div
                className="pointer-events-none absolute z-10 max-w-[min(18rem,calc(100%-1rem))] border border-linha bg-superficie px-2 py-1 text-xs text-carvao shadow-sm"
                style={{ top: Math.min(Math.max(0, py + 10), Math.max(0, altura - 64)), ...(esquerda ? { right: Math.max(0, largura - px + 10) } : { left: Math.max(0, px + 10) }) }}
              >
                <span className="font-medium">{emFoco.nome}</span>
                {emFoco.uf ? ` (${emFoco.uf})` : ""}: {num(emFoco.nao_gerada_gwh, 1)} GWh não gerados; taxa {num(emFoco.taxa_pct, 1)}%; {CURTO_RAZAO[emFoco.razao]}
              </div>
            );
          })()}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {escolhido ? `Selecionada: ${escolhido.nome}, ${num(escolhido.nao_gerada_gwh, 1)} GWh não gerados, taxa ${num(escolhido.taxa_pct, 1)}%.` : ""}
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-carvao-muted">
        <div>
          <p className="rotulo text-mineral">Razão com mais energia não gerada</p>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {razoesPresentes.map((z) => (
              <li key={z} className="inline-flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d={marca(z, 7, 7, 4.5)} fill={z === "SEM" ? "var(--cor-superficie)" : COR_RAZAO[z]} stroke={COR_RAZAO[z]} />
                </svg>
                {CURTO_RAZAO[z]}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="rotulo text-mineral">Energia não gerada em 12 meses (tamanho da marca)</p>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {rotulosClasse.map((r, k) => (
              <li key={r} className="inline-flex items-center gap-1">
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <circle cx="9" cy="9" r={RAIO_PX[k]} fill="var(--cor-mineral-soft)" />
                </svg>
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-xs text-carvao-muted">
        Malha de UF do IBGE (Albers cônica equivalente); coordenadas publicadas pelo ONS.
        {semCoordenada > 0 ? ` ${semCoordenada} usinas sem coordenada ficam só na tabela.` : ""} {nota}
      </p>
    </figure>
  );
}
