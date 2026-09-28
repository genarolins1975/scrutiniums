"use client";

import { useState, type ReactNode } from "react";
import type { Submercado } from "@/lib/energia/tipos";
import { ANCORA, CONTORNO, FRONTEIRAS, NOME_REGIAO, ORDEM_REGIOES, REGIOES, SIGLA_REGIAO, VIEWBOX, arco, caminho, pontaArco, pontoRotuloArco, projetar } from "@/lib/energia/geo";

/**
 * Mapa-base reutilizável do sistema elétrico: o país dividido nos quatro
 * submercados, com uma camada de valores por região (preenchimento com
 * intensidade, número em chip) e, opcionalmente, os fluxos entre as fronteiras
 * monitoradas pelo ONS (espessura = volume; seta proporcional e rótulo "de → para"
 * = sentido, com o tracejado em movimento como reforço que para com movimento reduzido). A região selecionada abre um detalhe. A lista de botões ao lado é
 * a versão acessível e a versão de celular do mesmo conteúdo.
 *
 * Geometria esquemática (src/lib/energia/geo.ts): sem escala, sem precisão de
 * fronteira; a legenda diz isso em todo uso.
 */
export type TomMapa = "preco" | "agua" | "geracao" | "carga" | "rede" | "neutro";
export type ValorRegiao = { valor: string; sub?: string; intensidade?: number | null; descricao?: string };
export type FluxoMapa = { de: Submercado; para: Submercado; valor: number | null };

const COR_TOM: Record<TomMapa, string> = {
  preco: "var(--serie-pld)",
  agua: "var(--serie-hidraulica)",
  geracao: "var(--serie-eolica)",
  carga: "var(--cor-energia)",
  rede: "var(--cor-energia)",
  neutro: "var(--cor-mineral)",
};

const NOTA_PADRAO =
  "Mapa esquemático: contornos simplificados e sem escala. A divisão em submercados segue a leitura usual do setor sobre a composição por estado, não conferida em documento do ONS ou da CCEE nesta fase.";

function fmt(v: number, casas = 0) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Quebra o subtítulo do chip em até duas linhas curtas, no espaço mais próximo do meio. */
function linhasSub(sub: string | undefined, max = 22): string[] {
  if (!sub) return [];
  if (sub.length <= max) return [sub];
  const meio = Math.floor(sub.length / 2);
  let corte = -1;
  for (let i = 0; i < sub.length; i++) if (sub[i] === " " && (corte < 0 || Math.abs(i - meio) < Math.abs(corte - meio))) corte = i;
  return corte < 0 ? [sub] : [sub.slice(0, corte), sub.slice(corte + 1)];
}

export function MapaBrasil({
  titulo,
  valores,
  tom = "neutro",
  fluxos,
  unidadeFluxo = "MWmed",
  selecionado,
  onSelecionar,
  detalhes,
  legenda,
  nota = NOTA_PADRAO,
  animar = true,
  lista = "lado",
  sobreposicao,
}: {
  titulo: string;
  valores: Partial<Record<Submercado, ValorRegiao>>;
  tom?: TomMapa;
  fluxos?: FluxoMapa[];
  unidadeFluxo?: string;
  selecionado?: Submercado | null;
  onSelecionar?: (sm: Submercado | null) => void;
  /** Conteúdo do detalhe de cada região (abaixo do botão dela quando selecionada), já renderizado. */
  detalhes?: Partial<Record<Submercado, ReactNode>>;
  legenda?: ReactNode;
  nota?: string | null;
  animar?: boolean;
  /** Posição da lista acessível de regiões: ao lado (desktop) ou só abaixo. */
  lista?: "lado" | "abaixo" | "nenhuma";
  /** Camada extra desenhada sobre o mapa, em coordenadas do viewBox (use `projetar` de geo.ts). */
  sobreposicao?: ReactNode;
}) {
  const [interno, setInterno] = useState<Submercado | null>(null);
  const sel = selecionado === undefined ? interno : selecionado;
  const escolher = (sm: Submercado | null) => {
    if (selecionado === undefined) setInterno(sm);
    onSelecionar?.(sm);
  };
  const cor = COR_TOM[tom];
  const fill = (sm: Submercado) => {
    const i = valores[sm]?.intensidade;
    if (i === null || i === undefined || !Number.isFinite(i)) return "var(--cor-mapa-terra)";
    const p = Math.round(10 + 62 * Math.max(0, Math.min(1, i)));
    return `color-mix(in srgb, ${cor} ${p}%, var(--cor-mapa-terra))`;
  };
  const maxF = Math.max(1, ...(fluxos ?? []).map((f) => Math.abs(f.valor ?? 0)));

  const resumoValores = ORDEM_REGIOES.map((sm) => {
    const v = valores[sm];
    return v ? `${NOME_REGIAO[sm]}: ${v.valor}${v.sub ? ` (${v.sub})` : ""}` : `${NOME_REGIAO[sm]}: sem dado`;
  }).join("; ");
  const resumoFluxos = (fluxos ?? [])
    .map((f) => {
      if (f.valor === null) return `${NOME_REGIAO[f.de]} e ${NOME_REGIAO[f.para]}: sem dado`;
      const [o, d] = f.valor >= 0 ? [f.de, f.para] : [f.para, f.de];
      return `${NOME_REGIAO[o]} para ${NOME_REGIAO[d]}: ${fmt(Math.abs(f.valor))} ${unidadeFluxo}`;
    })
    .join("; ");

  const mapa = (
    <svg
      viewBox={VIEWBOX}
      className="block h-auto w-full max-w-[36rem]"
      role="img"
      aria-label={`${titulo}. ${resumoValores}.${resumoFluxos ? ` Fluxos: ${resumoFluxos}.` : ""}`}
    >
      {ORDEM_REGIOES.map((sm) => (
        <path
          key={sm}
          d={caminho(REGIOES[sm])}
          fill={fill(sm)}
          stroke="var(--cor-superficie)"
          strokeWidth={1.6}
          strokeLinejoin="round"
          className="cursor-pointer transition-opacity hover:opacity-90"
          onClick={() => escolher(sel === sm ? null : sm)}
        />
      ))}
      <path d={caminho(CONTORNO)} fill="none" stroke="var(--cor-mapa-borda)" strokeWidth={1.2} strokeLinejoin="round" pointerEvents="none" />
      {sel && <path d={caminho(REGIOES[sel])} fill="none" stroke="var(--cor-carvao)" strokeWidth={2.2} strokeLinejoin="round" pointerEvents="none" />}

      {(fluxos ?? []).map((f) => {
        const fr = FRONTEIRAS.find((x) => x.de === f.de && x.para === f.para);
        if (!fr) return null;
        const v = f.valor;
        const [a, b] = v === null || v >= 0 ? [fr.a, fr.b] : [fr.b, fr.a];
        const w = v === null ? 2 : 2.5 + 11 * (Math.abs(v) / maxF);
        const [mx, my] = pontoRotuloArco(a, b, 18);
        const ponta = pontaArco(a, b);
        const rad = (ponta.angulo * Math.PI) / 180;
        // a seta é um triângulo proporcional à espessura, com a ponta meio traço à frente do fim do arco,
        // para cobrir a terminação arredondada; ela carrega o sentido mesmo sem a animação do tracejado
        const seta = Math.max(9, w * 2);
        const [oSm, dSm] = v === null || v >= 0 ? [f.de, f.para] : [f.para, f.de];
        return (
          <g key={fr.par} pointerEvents="none">
            <path d={arco(a, b)} fill="none" stroke="var(--cor-energia)" strokeWidth={w} strokeLinecap="round" opacity={v === null ? 0.25 : 0.85} />
            {v !== null && animar && (
              <path d={arco(a, b)} fill="none" stroke="var(--cor-superficie)" strokeWidth={Math.max(1, w * 0.3)} strokeDasharray="5 9" strokeLinecap="round" className="fluxo-animado" opacity={0.9} />
            )}
            {v !== null && (
              <path
                d="M0,0 L-1,-0.55 L-1,0.55 Z"
                transform={`translate(${(ponta.x + Math.cos(rad) * (w / 2)).toFixed(1)},${(ponta.y + Math.sin(rad) * (w / 2)).toFixed(1)}) rotate(${ponta.angulo.toFixed(1)}) scale(${seta.toFixed(1)})`}
                fill="var(--cor-energia-dark)"
              />
            )}
            <g className="hidden sm:block">
              <rect x={mx - 42} y={my - 15} width={84} height={30} rx={2} fill="var(--cor-superficie)" stroke="var(--cor-linha)" />
              <text x={mx} y={my - 3} textAnchor="middle" fontSize="10" fill="var(--cor-mineral)" style={{ letterSpacing: "0.06em" }}>
                {SIGLA_REGIAO[oSm]} → {SIGLA_REGIAO[dSm]}
              </text>
              <text x={mx} y={my + 10} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--cor-carvao)" className="tabular-nums">
                {v === null ? "sem dado" : `${fmt(Math.abs(v))} ${unidadeFluxo}`}
              </text>
            </g>
          </g>
        );
      })}

      {ORDEM_REGIOES.map((sm) => {
        const [x, y] = projetar(ANCORA[sm]);
        const v = valores[sm];
        const sub = linhasSub(v?.sub);
        // a caixa mede o maior dos textos que carrega: valor (15 px) e subtítulo (10,5 px, até duas linhas)
        const largo = v ? Math.max(104, Math.round(v.valor.length * 9 + 24), ...sub.map((l) => Math.round(l.length * 5.9 + 20))) : 104;
        const alto = 28 + sub.length * 13;
        return (
          <g key={sm} pointerEvents="none">
            <text x={x} y={y - 6} textAnchor="middle" fontSize="18" fontWeight="600" fill="var(--cor-carvao)" style={{ letterSpacing: "0.04em" }}>
              {SIGLA_REGIAO[sm]}
            </text>
            {v && (
              <g className="hidden sm:block">
                <rect x={x - largo / 2} y={y + 4} width={largo} height={alto} rx={2} fill="var(--cor-superficie)" stroke="var(--cor-carvao)" strokeWidth={0.8} />
                <text x={x} y={y + 23} textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--cor-carvao)" className="tabular-nums">
                  {v.valor}
                </text>
                {sub.map((l, k) => (
                  <text key={k} x={x} y={y + 37 + k * 13} textAnchor="middle" fontSize="10.5" fill="var(--cor-mineral)">
                    {l}
                  </text>
                ))}
              </g>
            )}
          </g>
        );
      })}
      {sobreposicao}
    </svg>
  );

  const listaRegioes = lista !== "nenhuma" && (
    <ul className={`grid gap-2 ${lista === "lado" ? "grid-cols-2 lg:grid-cols-1" : "grid-cols-2 md:grid-cols-4"}`} aria-label="Regiões">
      {ORDEM_REGIOES.map((sm) => {
        const v = valores[sm];
        const ativo = sel === sm;
        return (
          <li key={sm}>
            <button
              type="button"
              aria-pressed={ativo}
              onClick={() => escolher(ativo ? null : sm)}
              className={`flex min-h-[44px] w-full flex-col items-start border px-3 py-2 text-left transition-colors ${
                ativo ? "border-energia bg-energia-fundo" : "border-linha bg-superficie hover:border-energia"
              }`}
            >
              <span className={`rotulo ${ativo ? "text-carvao-muted" : "text-mineral"}`}>{NOME_REGIAO[sm]}</span>
              <span className="mt-0.5 font-serif text-lg leading-tight tabular-nums text-carvao">{v?.valor ?? "sem dado"}</span>
              {v?.sub && <span className="text-xs text-carvao-muted">{v.sub}</span>}
            </button>
            {ativo && detalhes?.[sm] && (
              <div aria-live="polite" className="border border-t-0 border-linha bg-superficie px-3 py-3 text-sm leading-relaxed text-carvao">
                {detalhes[sm]}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <figure>
      <div className={lista === "lado" ? "grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start" : "space-y-4"}>
        <div className="min-w-0">
          {mapa}
          {fluxos && fluxos.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-carvao sm:hidden" aria-label="Fluxos entre regiões">
              {fluxos.map((f) => {
                const [o, d] = f.valor === null || f.valor >= 0 ? [f.de, f.para] : [f.para, f.de];
                return (
                  <li key={`${f.de}${f.para}`} className="flex items-baseline justify-between gap-3 border-b border-linha pb-1">
                    <span>
                      {NOME_REGIAO[o]} <span aria-hidden="true">→</span>
                      <span className="sr-only">para</span> {NOME_REGIAO[d]}
                    </span>
                    <span className="whitespace-nowrap tabular-nums">{f.valor === null ? "sem dado" : `${fmt(Math.abs(f.valor))} ${unidadeFluxo}`}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {listaRegioes}
      </div>
      {(legenda || nota) && (
        <figcaption className="mt-3 space-y-1 text-xs leading-relaxed text-mineral">
          {legenda && <div>{legenda}</div>}
          {nota && <p>{nota}</p>}
        </figcaption>
      )}
    </figure>
  );
}
