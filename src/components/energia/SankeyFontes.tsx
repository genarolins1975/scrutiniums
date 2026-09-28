"use client";

import { useState } from "react";
import type { FonteGeracao, GeracaoGold, Mix } from "@/lib/energia/tipos";
import { BarrasMix, COR_FONTE, NOME_FONTE, ORDEM_FONTES } from "@/components/energia/BarrasMix";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { umDe, useEstadoUrl } from "@/lib/energia/useEstadoUrl";

/**
 * De onde vem a eletricidade: fluxo das quatro fontes para os quatro
 * subsistemas, na janela escolhida. A largura de cada fita é a geração
 * verificada (MWmed) daquela fonte naquela região; a soma de tudo é o SIN.
 * Duas colunas, sem terceira etapa: o SIN é o total, mostrado no título.
 * No celular, o mesmo conteúdo vira barras de composição por região.
 */
type Janela = "dia" | "7d" | "30d" | "12m";
const JANELAS: { id: Janela; rotulo: string }[] = [
  { id: "dia", rotulo: "Dia" },
  { id: "7d", rotulo: "7 dias" },
  { id: "30d", rotulo: "30 dias" },
  { id: "12m", rotulo: "12 meses" },
];
const REGIOES = ["SE", "S", "NE", "N"] as const;
const NOME_REGIAO: Record<string, string> = { SE: "Sudeste/Centro-Oeste", S: "Sul", NE: "Nordeste", N: "Norte" };

const fmt = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export function SankeyFontes({ regioes, diaReferencia }: { regioes: GeracaoGold["regioes"]; diaReferencia: string }) {
  const [janela, setJanela] = useEstadoUrl<Janela>("janela", "7d", umDe(JANELAS.map((j) => j.id)));
  const [ativo, setAtivo] = useState<{ f: FonteGeracao; r: string } | null>(null);
  const mixDe = (r: string): Mix => regioes.find((x) => x.rg === r)?.[janela] ?? null;
  const celulas: { f: FonteGeracao; r: string; v: number }[] = [];
  for (const r of REGIOES) {
    const m = mixDe(r);
    if (!m) continue;
    for (const f of ORDEM_FONTES) celulas.push({ f, r, v: m.mwmed[f] });
  }
  const total = celulas.reduce((s, c) => s + c.v, 0);
  const porFonte = Object.fromEntries(ORDEM_FONTES.map((f) => [f, celulas.filter((c) => c.f === f).reduce((s, c) => s + c.v, 0)])) as Record<FonteGeracao, number>;
  const porRegiao = Object.fromEntries(REGIOES.map((r) => [r, celulas.filter((c) => c.r === r).reduce((s, c) => s + c.v, 0)])) as Record<string, number>;
  const periodo = mixDe("SE");

  // layout
  const W = 760;
  const H = 400;
  const T = 24;
  const B = 12;
  const NW = 16;
  const X0 = 150;
  const X1 = W - 150 - NW;
  const GAP = 16;
  const util = H - T - B - GAP * 3;
  const esc = total > 0 ? util / total : 0;
  const yF: Record<string, number> = {};
  let cursor = T;
  for (const f of ORDEM_FONTES) {
    yF[f] = cursor;
    cursor += porFonte[f] * esc + GAP;
  }
  const yR: Record<string, number> = {};
  cursor = T;
  for (const r of REGIOES) {
    yR[r] = cursor;
    cursor += porRegiao[r] * esc + GAP;
  }
  const offF: Record<string, number> = Object.fromEntries(ORDEM_FONTES.map((f) => [f, 0]));
  const offR: Record<string, number> = Object.fromEntries(REGIOES.map((r) => [r, 0]));
  const fitas = celulas.map((c) => {
    const h = c.v * esc;
    const y0 = yF[c.f] + offF[c.f];
    const y1 = yR[c.r] + offR[c.r];
    offF[c.f] += h;
    offR[c.r] += h;
    const xa = X0 + NW;
    const xb = X1;
    const xm = (xa + xb) / 2;
    const d = `M${xa},${y0} C${xm},${y0} ${xm},${y1} ${xb},${y1} L${xb},${y1 + h} C${xm},${y1 + h} ${xm},${y0 + h} ${xa},${y0 + h} Z`;
    return { ...c, d, h };
  });

  const descricao = (c: { f: FonteGeracao; r: string; v: number }) =>
    `${NOME_FONTE[c.f]} → ${NOME_REGIAO[c.r]}: ${fmt(c.v)} MWmed (${fmt((100 * c.v) / (porRegiao[c.r] || 1), 1)}% da geração da região; ${fmt((100 * c.v) / (porFonte[c.f] || 1), 1)}% da ${NOME_FONTE[c.f].toLowerCase()} do SIN)`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div role="tablist" aria-label="Janela" className="flex flex-wrap gap-1 border-b border-linha">
          {JANELAS.map((j) => (
            <button
              key={j.id}
              type="button"
              role="tab"
              aria-selected={janela === j.id}
              onClick={() => setJanela(j.id)}
              className={`rotulo min-h-[44px] border-b-2 px-3 ${janela === j.id ? "border-energia text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"}`}
            >
              {j.rotulo}
            </button>
          ))}
        </div>
        <p className="text-sm text-carvao">
          <span className="rotulo mr-2 text-mineral">SIN</span>
          <span className="font-serif text-xl tabular-nums">{fmt(total)}</span> <span className="text-xs text-mineral">MWmed</span>
          {periodo && (
            <span className="ml-2 text-xs text-mineral">
              {periodo.inicio === periodo.fim ? `dia ${periodo.fim.slice(8, 10)}/${periodo.fim.slice(5, 7)}/${periodo.fim.slice(0, 4)}` : `${periodo.inicio.slice(8, 10)}/${periodo.inicio.slice(5, 7)} a ${periodo.fim.slice(8, 10)}/${periodo.fim.slice(5, 7)}/${periodo.fim.slice(0, 4)}`}
            </span>
          )}
        </p>
      </div>

      {total > 0 ? (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 hidden h-auto w-full md:block" role="img" aria-label={`Geração verificada por fonte e subsistema, ${JANELAS.find((j) => j.id === janela)?.rotulo}: ${celulas.map(descricao).join("; ")}.`}>
            {fitas.map((c) => {
              const dim = ativo && !(ativo.f === c.f && ativo.r === c.r);
              return (
                <path
                  key={`${c.f}-${c.r}`}
                  d={c.d}
                  fill={COR_FONTE[c.f]}
                  opacity={dim ? 0.18 : ativo ? 0.85 : 0.55}
                  className="cursor-pointer transition-opacity"
                  onMouseEnter={() => setAtivo({ f: c.f, r: c.r })}
                  onMouseLeave={() => setAtivo(null)}
                  onFocus={() => setAtivo({ f: c.f, r: c.r })}
                  onBlur={() => setAtivo(null)}
                  tabIndex={0}
                >
                  <title>{descricao(c)}</title>
                </path>
              );
            })}
            {ORDEM_FONTES.map((f) => (
              <g key={f}>
                <rect x={X0} y={yF[f]} width={NW} height={Math.max(1, porFonte[f] * esc)} fill={COR_FONTE[f]} />
                <text x={X0 - 8} y={yF[f] + Math.max(1, porFonte[f] * esc) / 2 + 4} textAnchor="end" fontSize="12" fill="var(--cor-carvao)" fontWeight="600">
                  {NOME_FONTE[f]}
                </text>
                <text x={X0 - 8} y={yF[f] + Math.max(1, porFonte[f] * esc) / 2 + 18} textAnchor="end" fontSize="10.5" fill="var(--cor-mineral)" className="tabular-nums">
                  {fmt(porFonte[f])} MWmed · {fmt((100 * porFonte[f]) / total, 1)}%
                </text>
              </g>
            ))}
            {REGIOES.map((r) => (
              <g key={r}>
                <rect x={X1} y={yR[r]} width={NW} height={Math.max(1, porRegiao[r] * esc)} fill="var(--cor-carvao-muted)" />
                <text x={X1 + NW + 8} y={yR[r] + Math.max(1, porRegiao[r] * esc) / 2 + 4} fontSize="12" fill="var(--cor-carvao)" fontWeight="600">
                  {NOME_REGIAO[r]}
                </text>
                <text x={X1 + NW + 8} y={yR[r] + Math.max(1, porRegiao[r] * esc) / 2 + 18} fontSize="10.5" fill="var(--cor-mineral)" className="tabular-nums">
                  {fmt(porRegiao[r])} MWmed · {fmt((100 * porRegiao[r]) / total, 1)}%
                </text>
              </g>
            ))}
            <text x={X0 + NW / 2} y={12} textAnchor="middle" fontSize="10" fill="var(--cor-mineral)">
              FONTE
            </text>
            <text x={X1 + NW / 2} y={12} textAnchor="middle" fontSize="10" fill="var(--cor-mineral)">
              SUBSISTEMA
            </text>
          </svg>
          <p className="mt-1 hidden min-h-[1.5rem] text-xs text-carvao-muted md:block" aria-live="polite">
            {ativo ? descricao(celulas.find((c) => c.f === ativo.f && c.r === ativo.r)!) : "Passe o ponteiro ou use Tab sobre uma fita para ler o valor."}
          </p>
          <div className="mt-4 md:hidden">
            <BarrasMix linhas={REGIOES.map((r) => ({ rotulo: NOME_REGIAO[r], detalhe: `${fmt(porRegiao[r])} MWmed`, mix: mixDe(r) }))} />
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-mineral">Sem dado para esta janela nesta publicação.</p>
      )}
      <TabelaDados
        titulo={`Geração verificada por fonte e subsistema (${JANELAS.find((j) => j.id === janela)?.rotulo}), MWmed`}
        colunas={["Subsistema", ...ORDEM_FONTES.map((f) => `${NOME_FONTE[f]} (MWmed)`), "Total (MWmed)"]}
        linhas={[...REGIOES.map((r) => [NOME_REGIAO[r], ...ORDEM_FONTES.map((f) => mixDe(r)?.mwmed[f] ?? null), mixDe(r)?.total_mwmed ?? null]), ["SIN (soma)", ...ORDEM_FONTES.map((f) => porFonte[f]), total]]}
        casas={[null, 0, 0, 0, 0, 0]}
      />
      <p className="mt-2 text-xs text-mineral">
        Largura da fita: geração verificada da fonte na região, em MWmed, no Balanço de Energia nos Subsistemas do ONS; dia de referência {diaReferencia.slice(8, 10)}/{diaReferencia.slice(5, 7)}/{diaReferencia.slice(0, 4)}. O balanço não separa a térmica por combustível.
      </p>
    </div>
  );
}
