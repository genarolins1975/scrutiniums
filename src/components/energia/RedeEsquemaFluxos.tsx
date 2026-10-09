"use client";

import { useState, type KeyboardEvent } from "react";
import type { Submercado } from "@/lib/energia/tipos";
import type { FronteiraRede, PaisSul } from "@/lib/energia/tipos-rede";
import { CURTO_SM, NOME_PAIS, NOME_SM, PONTAS, curtoFronteira, nomeFronteira } from "@/lib/energia/rede";
import { num, reais } from "@/lib/energia/formato";

/**
 * Esquema de fluxos da Rede (P028): os quatro subsistemas, as quatro fronteiras que o
 * ONS publica e, na escala horária, as conversoras com Argentina e Uruguai ligadas ao
 * Sul. É esquema, não mapa geográfico (seção 8.3): as posições lembram a geografia sem
 * escala, e cada fronteira soma várias linhas de transmissão.
 *
 * Sentido pela seta e pelas siglas escritas (NE → N), magnitude pela espessura e pelo
 * número escrito, unidade e período na legenda. O rótulo de cada fronteira traz o saldo e,
 * logo abaixo, o que passou no sentido contrário (e as trocas de sentido, quando houve), para
 * que o saldo nunca apareça sozinho. A espessura é proporcional ao valor e não indica
 * proximidade de limite: a legenda diz a escala e que os limites operativos não são
 * públicos (achado A06). Ausência é linha tracejada sem seta e com "sem dado"; zero é
 * linha fina sem seta com o número.
 *
 * Seleção sincronizada: clicar, tocar ou usar Enter e Espaço numa fronteira a escolhe
 * (de novo, desmarca); a página passa a escolha para a tabela e o detalhe. No
 * celular, o esquema vira uma lista de botões com o mesmo conteúdo (texto do SVG
 * ficaria com menos de 12 px).
 */

export type FluxoEsquema = {
  par: FronteiraRede;
  valor: number | null;
  rotuloValor: string;
  /** Linhas extras do rótulo no esquema, abaixo do valor (ex.: "contrário: 0 MWh"). */
  linhas?: string[];
  /** Texto completo para o leitor de tela e para a lista do celular. */
  detalhe?: string;
};
export type ExteriorEsquema = { pais: PaisSul; valor: number | null; rotuloValor: string };

const POS: Record<Submercado | PaisSul, { x: number; y: number }> = {
  N: { x: 150, y: 80 },
  NE: { x: 480, y: 130 },
  SE: { x: 330, y: 300 },
  S: { x: 210, y: 420 },
  ARGENTINA: { x: 64, y: 480 },
  URUGUAI: { x: 380, y: 490 },
};
const LARG_NO = 150;
const ALT_NO = 52;
const RECUO = 52;
const LARG_ROTULO = 156;
const ALT_LINHA = 15;

function trecho(a: { x: number; y: number }, b: { x: number; y: number }, recuoA = RECUO, recuoB = RECUO) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x1: a.x + (dx / d) * recuoA, y1: a.y + (dy / d) * recuoA, x2: b.x - (dx / d) * recuoB, y2: b.y - (dy / d) * recuoB };
}

export function RedeEsquemaFluxos({
  titulo,
  periodo,
  unidade,
  fluxos,
  exterior,
  precos,
  rotuloPrecos,
  selecionado,
  onSelecionar,
}: {
  titulo: string;
  periodo: string;
  unidade: string;
  fluxos: FluxoEsquema[];
  exterior?: ExteriorEsquema[];
  precos?: Partial<Record<Submercado, number | null>> | null;
  rotuloPrecos?: string;
  selecionado: FronteiraRede | null;
  onSelecionar: (par: FronteiraRede | null) => void;
}) {
  const [foco, setFoco] = useState<FronteiraRede | null>(null);
  const max = Math.max(1, ...fluxos.map((f) => Math.abs(f.valor ?? 0)), ...(exterior ?? []).map((e) => Math.abs(e.valor ?? 0)));
  const largura = (v: number | null) => (v === null || v === 0 ? 1.5 : 2.5 + 13 * (Math.abs(v) / max));
  const alterna = (par: FronteiraRede) => onSelecionar(selecionado === par ? null : par);
  const tecla = (e: KeyboardEvent, par: FronteiraRede) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      alterna(par);
    } else if (e.key === "Escape" && selecionado) {
      e.preventDefault();
      onSelecionar(null);
    }
  };
  const descricao = fluxos
    .map((f) => {
      if (f.valor === null) return `${nomeFronteira(f.par)}: sem dado`;
      const [a, b] = PONTAS[f.par];
      const [o, d] = f.valor >= 0 ? [a, b] : [b, a];
      return `${NOME_SM[o]} para ${NOME_SM[d]}: ${f.rotuloValor}${f.detalhe ? `, ${f.detalhe}` : ""}`;
    })
    .join("; ");
  // o exterior entra na descrição para leitor de tela: no SVG as conversoras ficam só no desenho
  const textoExterior = (exterior ?? [])
    .map((e) => `Sul e ${NOME_PAIS[e.pais]}: ${e.rotuloValor}${e.valor !== null && e.valor !== 0 ? ` (${e.valor > 0 ? "exportação" : "importação"})` : ""}`)
    .join("; ");
  const textoPrecos = precos ? (["N", "NE", "SE", "S"] as Submercado[]).map((s) => `${NOME_SM[s]} ${reais(precos[s] ?? null)}`).join(", ") : "";

  return (
    <figure className="space-y-3">
      <figcaption className="text-sm text-carvao">
        <span className="font-medium">{titulo}</span>
        <span className="block text-xs text-carvao-muted">
          {periodo} · {unidade}. Esquema sem escala geográfica: cada fronteira soma várias linhas de transmissão. A espessura é proporcional ao valor (a mais grossa vale{" "}
          {num(max, 0)} {unidade}) e não indica capacidade nem proximidade de limite, porque os limites operativos não são públicos.
          {precos ? ` ${rotuloPrecos ?? "PLD"} em R$/MWh dentro de cada região.` : ""}
        </span>
      </figcaption>

      {/* celular: lista de botões com o mesmo conteúdo do esquema */}
      <div className="sm:hidden">
        {precos && (
          <ul className="grid grid-cols-2 gap-2" aria-label={`${rotuloPrecos ?? "PLD"}, R$/MWh`}>
            {(["N", "NE", "SE", "S"] as Submercado[]).map((sm) => (
              <li key={sm} className="border border-linha bg-superficie p-3">
                <p className="text-xs text-mineral">{NOME_SM[sm]}</p>
                <p className="mt-1 whitespace-nowrap font-serif text-lg tabular-nums text-carvao">{reais(precos[sm] ?? null)}</p>
              </li>
            ))}
          </ul>
        )}
        <ul className="mt-3 space-y-1.5">
          {fluxos.map((f) => {
            const [a, b] = PONTAS[f.par];
            const [o, d] = (f.valor ?? 0) >= 0 ? [a, b] : [b, a];
            const ativo = selecionado === f.par;
            return (
              <li key={f.par}>
                <button
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => alterna(f.par)}
                  className={`flex min-h-[44px] w-full items-baseline justify-between gap-3 border px-3 py-2 text-left text-sm ${
                    ativo ? "border-energia bg-energia-fundo text-carvao" : "border-linha bg-superficie text-carvao"
                  }`}
                >
                  <span>
                    {f.valor === null || f.valor === 0 ? (
                      nomeFronteira(f.par)
                    ) : (
                      <>
                        {NOME_SM[o]} <span aria-hidden="true">→</span>
                        <span className="sr-only">para</span> {NOME_SM[d]}
                      </>
                    )}
                    {f.detalhe && <span className="block text-xs text-carvao-muted">{f.detalhe}</span>}
                  </span>
                  <span className="whitespace-nowrap tabular-nums">{f.rotuloValor}</span>
                </button>
              </li>
            );
          })}
          {(exterior ?? []).map((e) => (
            <li key={e.pais} className="flex min-h-[44px] items-baseline justify-between gap-3 border-b border-linha px-3 py-2 text-sm text-carvao">
              <span>
                Sul e {NOME_PAIS[e.pais]}
                {e.valor !== null && e.valor !== 0 ? ` (${e.valor > 0 ? "exportação" : "importação"})` : ""}
              </span>
              <span className="whitespace-nowrap tabular-nums">{e.rotuloValor}</span>
            </li>
          ))}
        </ul>
      </div>

      <svg
        viewBox="0 0 560 530"
        className="mx-auto hidden w-full max-w-2xl sm:block"
        role="group"
        aria-label={`${titulo}, ${periodo}: ${descricao}.${textoExterior ? ` ${textoExterior}.` : ""}${textoPrecos ? ` ${rotuloPrecos ?? "PLD"}: ${textoPrecos}.` : ""}`}
      >
        <defs>
          <marker id="rede-seta" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--cor-energia)" />
          </marker>
          <marker id="rede-seta-sel" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--cor-energia-dark)" />
          </marker>
        </defs>

        {(exterior ?? []).map((e) => {
          const t = trecho(POS.S, POS[e.pais], RECUO, 30);
          const exporta = (e.valor ?? 0) > 0;
          const [x1, y1, x2, y2] = exporta || e.valor === null || e.valor === 0 ? [t.x1, t.y1, t.x2, t.y2] : [t.x2, t.y2, t.x1, t.y1];
          return (
            <g key={e.pais} aria-hidden="true">
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="var(--cor-mineral)"
                strokeWidth={largura(e.valor)}
                strokeDasharray={e.valor === null ? "5 4" : undefined}
                markerEnd={e.valor ? "url(#rede-seta)" : undefined}
              />
              <rect x={POS[e.pais].x - 56} y={POS[e.pais].y - 18} width={112} height={36} fill="var(--cor-superficie)" stroke="var(--cor-linha)" />
              <text x={POS[e.pais].x} y={POS[e.pais].y - 3} textAnchor="middle" fontSize="13" fill="var(--cor-carvao)">
                {NOME_PAIS[e.pais]}
              </text>
              <text x={POS[e.pais].x} y={POS[e.pais].y + 12} textAnchor="middle" fontSize="12" fill="var(--cor-carvao-muted)">
                {e.rotuloValor}
              </text>
            </g>
          );
        })}

        {fluxos.map((f) => {
          const [a, b] = PONTAS[f.par];
          const t = trecho(POS[a], POS[b]);
          const positivo = (f.valor ?? 0) >= 0;
          const [x1, y1, x2, y2] = positivo ? [t.x1, t.y1, t.x2, t.y2] : [t.x2, t.y2, t.x1, t.y1];
          const ativo = selecionado === f.par;
          const apagado = selecionado !== null && !ativo;
          const mx = (t.x1 + t.x2) / 2;
          const my = (t.y1 + t.y2) / 2;
          const [o, d] = positivo ? [a, b] : [b, a];
          const rotuloAria =
            f.valor === null
              ? `${nomeFronteira(f.par)}: sem dado`
              : f.valor === 0
                ? `${nomeFronteira(f.par)}: ${f.rotuloValor}`
                : `${NOME_SM[o]} para ${NOME_SM[d]}: ${f.rotuloValor}${f.detalhe ? `; ${f.detalhe}` : ""}`;
          // rótulo: sentido (siglas), valor e as linhas extras; ausência e zero ficam só com o valor
          const sentido = f.valor === null || f.valor === 0 ? null : `${CURTO_SM[o]} → ${CURTO_SM[d]}`;
          const linhasRotulo = [...(sentido ? [sentido] : []), f.rotuloValor, ...(f.linhas ?? [])];
          const altRotulo = 8 + ALT_LINHA * linhasRotulo.length;
          const iValor = sentido ? 1 : 0;
          return (
            <g
              key={f.par}
              role="button"
              tabIndex={0}
              aria-pressed={ativo}
              aria-label={rotuloAria}
              onClick={() => alterna(f.par)}
              onKeyDown={(e) => tecla(e, f.par)}
              onFocus={() => setFoco(f.par)}
              onBlur={() => setFoco((x) => (x === f.par ? null : x))}
              className="cursor-pointer outline-none"
              opacity={apagado ? 0.45 : 1}
            >
              {/* área de toque de 44 px ao longo da fronteira */}
              <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="transparent" strokeWidth={44} />
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={ativo ? "var(--cor-energia-dark)" : "var(--cor-energia)"}
                strokeWidth={largura(f.valor)}
                strokeDasharray={f.valor === null ? "6 5" : undefined}
                markerEnd={f.valor ? (ativo ? "url(#rede-seta-sel)" : "url(#rede-seta)") : undefined}
              />
              <rect
                x={mx - LARG_ROTULO / 2}
                y={my - altRotulo / 2}
                width={LARG_ROTULO}
                height={altRotulo}
                fill="var(--cor-superficie)"
                stroke={foco === f.par ? "var(--cor-energia)" : ativo ? "var(--cor-energia-dark)" : "var(--cor-linha)"}
                strokeWidth={foco === f.par ? 2.5 : 1}
                strokeDasharray={foco === f.par ? "4 2" : undefined}
              />
              {linhasRotulo.map((linha, k) => (
                <text
                  key={`${linha}-${k}`}
                  x={mx}
                  y={my - altRotulo / 2 + 4 + ALT_LINHA * (k + 1) - 3}
                  textAnchor="middle"
                  fontSize={k === iValor ? 14 : 12}
                  fontWeight={k === iValor && ativo ? 700 : k === iValor ? 600 : 400}
                  fill={k === iValor ? "var(--cor-carvao)" : "var(--cor-carvao-muted)"}
                  className="tabular-nums"
                >
                  {linha}
                </text>
              ))}
              <title>{`${curtoFronteira(f.par)}: ${rotuloAria}`}</title>
            </g>
          );
        })}

        {(["N", "NE", "SE", "S"] as Submercado[]).map((sm) => (
          <g key={sm} aria-hidden="true">
            <rect x={POS[sm].x - LARG_NO / 2} y={POS[sm].y - ALT_NO / 2} width={LARG_NO} height={ALT_NO} fill="var(--cor-superficie)" stroke="var(--cor-carvao)" />
            <text x={POS[sm].x} y={POS[sm].y - (precos ? 5 : -4)} textAnchor="middle" fontSize="14" fill="var(--cor-carvao)">
              {NOME_SM[sm]}
            </text>
            {precos && (
              <text x={POS[sm].x} y={POS[sm].y + 14} textAnchor="middle" fontSize="13" fill="var(--cor-carvao-muted)" className="tabular-nums">
                {reais(precos[sm] ?? null)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}
