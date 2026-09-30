"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { num, plural } from "@/lib/energia/formato";
import { casasMarcas, dominioLegivel, textoValor } from "@/lib/energia/distribuicao";
import {
  afastaRotulos,
  larguraTexto,
  limitaDestaques,
  maisProximo,
  ordenaParaTabela,
  segmentoReta,
  separaPontos,
  type PontoDispersao,
  type RetaDispersao,
} from "@/lib/energia/dispersao";

export type { PontoDispersao, RetaDispersao } from "@/lib/energia/dispersao";

/**
 * Dispersão entre duas medidas de um mesmo conjunto de entidades (ex.: perdas
 * e tarifa por distribuidora). Relação não é causalidade: por isso o rodapé
 * com amostra (n), período e aviso é obrigatório no tipo, e não há linha de
 * tendência por padrão. Se o pipeline publicar uma reta ajustada, ela é
 * desenhada só no intervalo de X observado, com o nome do ajuste ao lado.
 *
 * Leitura: setas percorrem os pontos em ordem crescente de X (a mesma da
 * tabela equivalente); o ponteiro e o toque escolhem o ponto mais próximo num
 * raio de 22 px (alvo de 44 px). Até quatro entidades recebem destaque com
 * rótulo direto. Ponto sem X ou sem Y não é desenhado (nunca vira zero) e
 * entra no rodapé como "sem dado"; na tabela, aparece ao fim.
 */
export type EixoDispersao = {
  /** Nome da medida (ex.: "Perdas não técnicas"). */
  rotulo: string;
  /** Unidade exibida no eixo, na dica e na tabela (ex.: "% do mercado BT"). */
  unidade: string;
  casas?: number;
  /** Estende o eixo até zero (útil quando a escala absoluta importa). */
  incluirZero?: boolean;
};

export type RodapeDispersao = {
  /** Período das observações, já escrito (ex.: "2024" ou "jan/2023 a dez/2024"). */
  periodo: string;
  /** Aviso de que associação não é causalidade, no texto do painel que usa o gráfico. */
  avisoCausalidade: string;
  /** Nota adicional sobre universo ou exclusões. */
  nota?: string;
};

export type GraficoDispersaoProps = {
  titulo: string;
  pontos: PontoDispersao[];
  eixoX: EixoDispersao;
  eixoY: EixoDispersao;
  rodape: RodapeDispersao;
  /** Como chamar cada ponto no rodapé e na tabela (padrão: ponto/pontos). */
  entidade?: { singular: string; plural: string };
  /** Ids destacados com rótulo direto (no máximo quatro; os demais são ignorados). */
  destacados?: string[];
  /** Reta com coeficientes do pipeline; sem ela, nenhuma tendência é desenhada. */
  reta?: RetaDispersao;
  altura?: number;
  /** Cor dos pontos comuns e dos destacados, por variável CSS. */
  corPontos?: string;
  corDestaque?: string;
};

const RAIO_ALVO = 22;

function capitaliza(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function cabe(texto: string, largura: number): string {
  const max = Math.floor(largura / larguraTexto("m"));
  return texto.length <= max ? texto : `${texto.slice(0, Math.max(1, max - 1))}…`;
}

export function GraficoDispersao({
  titulo,
  pontos,
  eixoX,
  eixoY,
  rodape,
  entidade = { singular: "ponto", plural: "pontos" },
  destacados,
  reta,
  altura = 340,
  corPontos = "var(--cor-mineral)",
  corDestaque = "var(--cor-energia)",
}: GraficoDispersaoProps) {
  const uid = useId().replace(/:/g, "");
  const [largura, setLargura] = useState(760);
  const [ativo, setAtivo] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setLargura(Math.max(300, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const casasX = eixoX.casas ?? 1;
  const casasY = eixoY.casas ?? 1;
  const { validos, semDado } = useMemo(() => separaPontos(pontos), [pontos]);
  const linhasTabela = useMemo(() => ordenaParaTabela(pontos), [pontos]);
  const ids = useMemo(() => limitaDestaques(destacados), [destacados]);
  const n = validos.length;

  const estreito = largura < 520;
  const L = estreito ? 46 : 58;
  const R = 16;
  const T = 30;
  const B = 50;
  const w = largura;
  const h = altura;

  const dx = useMemo(() => dominioLegivel(validos.map((p) => p.x), { incluirZero: eixoX.incluirZero, alvo: estreito ? 4 : 6 }), [validos, eixoX.incluirZero, estreito]);
  const dy = useMemo(() => dominioLegivel(validos.map((p) => p.y), { incluirZero: eixoY.incluirZero, alvo: 5 }), [validos, eixoY.incluirZero]);
  const sx = (v: number) => L + ((v - dx.min) / (dx.max - dx.min)) * (w - L - R);
  const sy = (v: number) => T + (1 - (v - dy.min) / (dy.max - dy.min)) * (h - T - B);
  const tela = validos.map((p) => ({ x: sx(p.x), y: sy(p.y) }));
  const casasTickX = casasMarcas(dx.marcas);
  const casasTickY = casasMarcas(dy.marcas);

  const destaqueIdx = ids.map((id) => validos.findIndex((p) => p.id === id)).filter((i) => i >= 0);
  const destaqueSemDado = ids.filter((id) => !validos.some((p) => p.id === id)).map((id) => pontos.find((p) => p.id === id)?.rotulo ?? id);
  const ehDestaque = new Set(destaqueIdx);

  // rótulos diretos: lado com mais espaço, afastados na vertical sem sair da área
  const ysRotulo = afastaRotulos(
    destaqueIdx.map((i) => tela[i].y + 4),
    13,
    T + 10,
    h - B - 4,
  );
  const rotulos = destaqueIdx.map((i, k) => {
    const p = tela[i];
    const direita = w - R - (p.x + 9);
    const esquerda = p.x - 9 - 2;
    const lado = direita >= larguraTexto(validos[i].rotulo) || direita >= esquerda ? "direita" : "esquerda";
    const texto = cabe(validos[i].rotulo, lado === "direita" ? direita : esquerda);
    return { i, lado, texto, y: ysRotulo[k], deslocado: Math.abs(ysRotulo[k] - (p.y + 4)) > 5 };
  });

  const seg = reta && n >= 2 ? segmentoReta(reta, [validos[0].x, validos[n - 1].x], [dy.min, dy.max]) : null;

  function paraViewBox(ev: React.PointerEvent) {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width) return null;
    const esc = w / r.width;
    return { x: (ev.clientX - r.left) * esc, y: (ev.clientY - r.top) * (h / r.height), raio: RAIO_ALVO * esc };
  }

  function apontar(ev: React.PointerEvent<SVGRectElement>) {
    const v = paraViewBox(ev);
    if (!v) return;
    const i = maisProximo(tela, v.x, v.y, v.raio);
    // longe de qualquer ponto: o mouse limpa a dica; no toque, só um novo toque fora limpa
    if (i !== null) setAtivo(i);
    else if (ev.type === "pointerdown" || ev.pointerType === "mouse") setAtivo(null);
  }

  function teclado(ev: React.KeyboardEvent<SVGSVGElement>) {
    if (!n) return;
    const passo: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, PageDown: 10, PageUp: -10 };
    if (ev.key === "Home" || ev.key === "End") {
      ev.preventDefault();
      setAtivo(ev.key === "Home" ? 0 : n - 1);
    } else if (ev.key in passo) {
      ev.preventDefault();
      const d = passo[ev.key];
      setAtivo((a) => (a === null ? (d > 0 ? 0 : n - 1) : Math.max(0, Math.min(n - 1, a + d))));
    } else if (ev.key === "Escape") setAtivo(null);
  }

  const pa = ativo !== null && ativo < n ? validos[ativo] : null;
  const ta = ativo !== null && ativo < n ? tela[ativo] : null;
  const leitura = pa
    ? `${pa.rotulo}: ${eixoX.rotulo} ${textoValor(pa.x, casasX, eixoX.unidade)}; ${eixoY.rotulo} ${textoValor(pa.y, casasY, eixoY.unidade)}. Ponto ${ativo! + 1} de ${n} em ordem de ${eixoX.rotulo}.${
        ehDestaque.has(ativo!) ? " Destacado." : ""
      }`
    : "";
  const acima = ta ? ta.y > 120 : false;
  const nomeX = `${eixoX.rotulo} (${eixoX.unidade})`;
  const nomeY = `${eixoY.rotulo} (${eixoY.unidade})`;

  return (
    <div ref={ref} className="relative w-full">
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 px-1 text-xs text-carvao-muted" aria-label="Legenda">
        <li className="flex items-center gap-1.5">
          <svg width="12" height="12" aria-hidden="true">
            <circle cx="6" cy="6" r="4" fill={corPontos} fillOpacity="0.45" stroke={corPontos} strokeWidth="1" />
          </svg>
          {capitaliza(entidade.plural)}
        </li>
        {destaqueIdx.length > 0 && (
          <li className="flex items-center gap-1.5">
            <svg width="14" height="14" aria-hidden="true">
              <circle cx="7" cy="7" r="5.5" fill={corDestaque} stroke="var(--cor-superficie)" strokeWidth="1.5" />
            </svg>
            Destaque, com nome no gráfico
          </li>
        )}
        {reta && (
          <li className="flex items-center gap-1.5">
            <svg width="20" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="20" y2="4" stroke="var(--cor-carvao-muted)" strokeWidth="1.5" strokeDasharray="5 3" />
            </svg>
            {reta.rotulo}
          </li>
        )}
      </ul>
      <div className="relative">
        {/* altura fixa em pixels: o HTML do servidor já reserva a altura final */}
        <svg
          ref={svgRef}
          width="100%"
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-labelledby={`${uid}-t`}
          aria-describedby={`${uid}-r`}
          tabIndex={0}
          onKeyDown={teclado}
          onBlur={() => setAtivo(null)}
          className="block overflow-visible focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
        >
          <title id={`${uid}-t`}>
            {`${titulo}. Dispersão de ${plural(n, entidade.singular, entidade.plural)}: ${nomeX} no eixo horizontal e ${nomeY} no vertical. Use as setas para percorrer os pontos em ordem crescente de ${eixoX.rotulo}.`}
          </title>
          {dy.marcas.map((v) => (
            <g key={`y${v}`}>
              <line x1={L} x2={w - R} y1={sy(v)} y2={sy(v)} stroke="var(--cor-grade)" strokeWidth="1" />
              <text x={L - 8} y={sy(v) + 4} textAnchor="end" fontSize="11" fill="var(--cor-mineral)">
                {num(v, casasTickY)}
              </text>
            </g>
          ))}
          {dx.marcas.map((v) => (
            <g key={`x${v}`}>
              <line x1={sx(v)} x2={sx(v)} y1={T} y2={h - B} stroke="var(--cor-grade)" strokeWidth="1" />
              <text x={sx(v)} y={h - B + 16} textAnchor="middle" fontSize="11" fill="var(--cor-mineral)">
                {num(v, casasTickX)}
              </text>
            </g>
          ))}
          {dx.min < 0 && dx.max > 0 && <line x1={sx(0)} x2={sx(0)} y1={T} y2={h - B} stroke="var(--cor-carvao-muted)" strokeWidth="1" />}
          {dy.min < 0 && dy.max > 0 && <line x1={L} x2={w - R} y1={sy(0)} y2={sy(0)} stroke="var(--cor-carvao-muted)" strokeWidth="1" />}
          <text x={2} y={14} fontSize="12" fill="var(--cor-carvao-muted)">
            {cabe(`↑ ${nomeY}`, w - 4)}
          </text>
          <text x={L + (w - L - R) / 2} y={h - 10} textAnchor="middle" fontSize="12" fill="var(--cor-carvao-muted)">
            {cabe(`${nomeX} →`, w - 4)}
          </text>

          {seg && reta && (
            <g>
              <line x1={sx(seg.x0)} y1={sy(seg.y0)} x2={sx(seg.x1)} y2={sy(seg.y1)} stroke="var(--cor-carvao-muted)" strokeWidth="1.5" strokeDasharray="5 3" />
              {(() => {
                const ex = sx(seg.x1);
                const ey = sy(seg.y1);
                const texto = cabe(reta.rotulo, w - L - R - 4);
                const cabeAntes = ex - 4 - larguraTexto(texto) >= L;
                return (
                  <text
                    x={cabeAntes ? ex - 4 : L + 4}
                    y={ey - 8 > T + 10 ? ey - 8 : ey + 16}
                    textAnchor={cabeAntes ? "end" : "start"}
                    fontSize="11"
                    fill="var(--cor-carvao)"
                    stroke="var(--cor-superficie)"
                    strokeWidth="3"
                    paintOrder="stroke"
                  >
                    {texto}
                  </text>
                );
              })()}
            </g>
          )}

          {n === 0 && (
            <text x={L + (w - L - R) / 2} y={T + (h - T - B) / 2} textAnchor="middle" fontSize="12" fill="var(--cor-mineral)">
              Sem {entidade.plural} com os dois valores no período
            </text>
          )}

          {/* pontos comuns primeiro; destaques por cima, com anel da superfície */}
          {tela.map((p, i) =>
            ehDestaque.has(i) ? null : (
              <circle key={validos[i].id} data-ponto={validos[i].id} cx={p.x} cy={p.y} r="4" fill={corPontos} fillOpacity="0.45" stroke={corPontos} strokeWidth="1" />
            ),
          )}
          {destaqueIdx.map((i) => (
            <circle
              key={validos[i].id}
              data-ponto={validos[i].id}
              data-destaque="true"
              cx={tela[i].x}
              cy={tela[i].y}
              r="5.5"
              fill={corDestaque}
              stroke="var(--cor-superficie)"
              strokeWidth="2"
            />
          ))}
          {rotulos.map((r) => {
            const p = tela[r.i];
            const tx = r.lado === "direita" ? p.x + 9 : p.x - 9;
            return (
              <g key={`r${r.i}`}>
                {r.deslocado && <line x1={p.x} y1={p.y} x2={tx} y2={r.y - 4} stroke="var(--cor-mineral)" strokeWidth="1" />}
                <text
                  x={tx}
                  y={r.y}
                  textAnchor={r.lado === "direita" ? "start" : "end"}
                  fontSize="11"
                  fill="var(--cor-carvao)"
                  stroke="var(--cor-superficie)"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  {r.texto}
                </text>
              </g>
            );
          })}

          {ta && (
            <g pointerEvents="none">
              <line x1={ta.x} x2={ta.x} y1={ta.y} y2={h - B} stroke="var(--cor-mineral)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1={L} x2={ta.x} y1={ta.y} y2={ta.y} stroke="var(--cor-mineral)" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={ta.x} cy={ta.y} r="9" fill="none" stroke="var(--cor-carvao)" strokeWidth="2" />
            </g>
          )}
          <rect
            x={L - RAIO_ALVO}
            y={T - RAIO_ALVO}
            width={Math.max(1, w - L - R + 2 * RAIO_ALVO)}
            height={Math.max(1, h - T - B + 2 * RAIO_ALVO)}
            fill="transparent"
            onPointerMove={apontar}
            onPointerDown={apontar}
            onPointerLeave={(ev) => {
              // no toque o ponteiro "sai" ao levantar o dedo: a dica fica até o próximo toque
              if (ev.pointerType === "mouse") setAtivo(null);
            }}
          />
        </svg>
        {pa && ta && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-20 min-w-[12rem] max-w-[16rem] border border-linha bg-superficie px-3 py-2 text-xs shadow-[0_6px_20px_rgba(26,29,33,0.12)]"
            style={{
              left: `min(max(0px, calc(${(ta.x / w) * 100}% - 6rem)), calc(100% - 12rem))`,
              top: acima ? ta.y - 14 : ta.y + 14,
              transform: acima ? "translateY(-100%)" : undefined,
            }}
          >
            <p className="font-medium text-carvao">{pa.rotulo}</p>
            <dl className="mt-1 space-y-0.5">
              <div className="flex justify-between gap-3">
                <dt className="text-mineral">{eixoX.rotulo}</dt>
                <dd className="tabular-nums text-carvao">{textoValor(pa.x, casasX, eixoX.unidade)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-mineral">{eixoY.rotulo}</dt>
                <dd className="tabular-nums text-carvao">{textoValor(pa.y, casasY, eixoY.unidade)}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
      {/* leitura do ponto ativo para leitor de tela: região persistente, anunciada a cada mudança */}
      <p className="sr-only" aria-live="polite">
        {leitura}
      </p>

      <div id={`${uid}-r`} className="mt-3 space-y-1 border-t border-linha pt-2 text-xs leading-relaxed text-carvao-muted">
        <p>
          <span className="rotulo mr-2 text-mineral">Amostra</span>
          <span className="tabular-nums">n = {num(n, 0)}</span> {n === 1 ? entidade.singular : entidade.plural} com os dois valores
          {semDado.length > 0 && (
            <>
              {"; "}
              <span data-sem-dado={semDado.length}>
                sem dado em {eixoX.rotulo} ou em {eixoY.rotulo}: {plural(semDado.length, entidade.singular, entidade.plural)}
              </span>{" "}
              (ficam fora do gráfico e constam da tabela)
            </>
          )}
          .
        </p>
        <p>
          <span className="rotulo mr-2 text-mineral">Período</span>
          {rodape.periodo}
        </p>
        {reta && (
          <p>
            <span className="rotulo mr-2 text-mineral">Reta</span>
            {reta.rotulo}, com coeficientes calculados no pipeline{reta.detalhe ? ` (${reta.detalhe})` : ""}.
            {!seg && " A reta não cruza a área do gráfico e não foi desenhada."}
          </p>
        )}
        {destaqueSemDado.length > 0 && <p>Destaque sem dado (não desenhado): {destaqueSemDado.join(", ")}.</p>}
        <p className="text-carvao">{rodape.avisoCausalidade}</p>
        {rodape.nota && <p>{rodape.nota}</p>}
      </div>

      <details className="mt-3 text-xs">
        <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
          Dados do gráfico em tabela ({plural(linhasTabela.length, "linha", "linhas")})
        </summary>
        <div className="tabela-scroll mt-2 max-h-80 overflow-y-auto" tabIndex={0} role="region" aria-label={`${titulo}: dados em tabela (rolável)`}>
          <table className="w-full border-collapse tabular-nums">
            <caption className="sr-only">{`${titulo}: ${nomeX} e ${nomeY}, em ordem crescente de ${eixoX.rotulo}; sem dado ao fim`}</caption>
            <thead className="sticky top-0 bg-superficie">
              <tr className="text-left text-mineral">
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">{capitaliza(entidade.singular)}</th>
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">{nomeX}</th>
                <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">{nomeY}</th>
                {ids.length > 0 && <th scope="col" className="border-b border-linha px-2 py-1.5 font-medium">Destaque</th>}
              </tr>
            </thead>
            <tbody>
              {linhasTabela.map((p) => (
                <tr key={p.id} className="border-b border-linha">
                  <th scope="row" className="px-2 py-1 text-left font-normal text-carvao">{p.rotulo}</th>
                  <td className={`px-2 py-1 ${typeof p.x === "number" && Number.isFinite(p.x) ? "text-carvao" : "text-mineral"}`}>{textoValor(p.x, casasX, "")}</td>
                  <td className={`px-2 py-1 ${typeof p.y === "number" && Number.isFinite(p.y) ? "text-carvao" : "text-mineral"}`}>{textoValor(p.y, casasY, "")}</td>
                  {ids.length > 0 && <td className="px-2 py-1 text-carvao">{ids.includes(p.id) ? "sim" : ""}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
