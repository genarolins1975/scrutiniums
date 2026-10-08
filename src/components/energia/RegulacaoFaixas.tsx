"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { diaSerial, isoDoDia, somarMeses, ticksTempo } from "@/lib/energia/calendario";
import { escalaLinear } from "@/lib/energia/escalas";
import { dataBR } from "@/lib/energia/formato";
import { dominioFaixas, type FaixaTempo, type MarcaTempo, type ReferenciaTempo } from "@/lib/energia/regulacao";

/**
 * Faixas de tempo da Regulação: uma linha por item, com duas datas ligadas por um
 * traço. Serve a dois painéis com a mesma gramática (seção 8.2, cronogramas: datas
 * conhecidas separadas, nada desenhado numa data inventada):
 *
 * - P045, publicação (círculo vazado) até a vigência (círculo cheio) de cada ato: a
 *   distância entre as marcas é a defasagem que a especificação manda não confundir;
 *   vigência conhecida só pelo mês vira um retângulo do mês inteiro;
 * - P046, a janela de contribuições de cada consulta (início e fim; fim calculado do
 *   início e da duração é vazado), com a data de leitura como linha de referência.
 *
 * Marca ausente não é desenhada: a linha diz o que falta. Cor nunca é o único
 * portador: forma da marca, traço (cheio, tracejado, fino) e o texto da dica, do
 * rótulo acessível e da tabela equivalente (montada pela página com as mesmas
 * linhas) dizem a mesma coisa.
 *
 * Teclado: um ponto de Tab (tabindex itinerante); setas percorrem as linhas, Home e
 * End vão aos extremos, Enter ou Espaço selecionam (quando há onSelecionar), Esc
 * fecha a dica. A dica aparece no foco, no toque e no ponteiro. Muitas linhas: a
 * área rola na vertical com o eixo fixo acima. Altura fixa em pixels já no servidor
 * (largura padrão 760), sem salto quando a largura real é medida.
 */
export type RegulacaoFaixasProps = {
  titulo: string;
  faixas: FaixaTempo[];
  referencias?: ReferenciaTempo[];
  /** Domínio do eixo em dias seriais; sem ele, o das faixas e referências. */
  dominio?: { min: number; max: number } | null;
  selecionado?: string | null;
  onSelecionar?: (id: string | null) => void;
  alturaLinha?: number;
  alturaMaxima?: number;
  legenda?: ReactNode;
  vazio?: ReactNode;
};

const LARGURA_SSR = 760;
const PX_CARACTERE = 6.4;
const ALTURA_EIXO = 30;
const r1 = (v: number) => Math.round(v * 10) / 10;

function cabe(texto: string, largura: number): string {
  if (texto.length * PX_CARACTERE <= largura) return texto;
  const n = Math.floor(largura / PX_CARACTERE) - 1;
  return n >= 3 ? `${texto.slice(0, n).trimEnd()}…` : "";
}

/** Último dia do mês de uma data (serial), para a marca de grão mensal. */
function fimDoMes(data: string): number | null {
  const s = diaSerial(somarMeses(data.slice(0, 7), 1));
  return s === null ? null : s - 1;
}

export function RegulacaoFaixas({
  titulo,
  faixas,
  referencias = [],
  dominio,
  selecionado = null,
  onSelecionar,
  alturaLinha = 44,
  alturaMaxima = 528,
  legenda,
  vazio = "Nenhum item no recorte atual.",
}: RegulacaoFaixasProps) {
  const uid = useId().replace(/:/g, "");
  const [largura, setLargura] = useState(LARGURA_SSR);
  const [cursor, setCursor] = useState<string | null>(null);
  const [ativo, setAtivo] = useState<string | null>(null);
  const [focoVisivel, setFocoVisivel] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const raiz = useRef<HTMLDivElement>(null);
  const alvos = useRef<Map<string, SVGGElement>>(new Map());

  useEffect(() => {
    const el = raiz.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setLargura(Math.max(280, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // no toque, a dica fica aberta até um toque fora do gráfico
  useEffect(() => {
    if (ativo === null) return;
    const fora = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAtivo(null);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [ativo]);

  const dom = dominio ?? dominioFaixas(faixas, referencias);
  const w = largura;
  const colRotulo = Math.round(Math.min(184, Math.max(88, w * 0.26)));
  const x0 = colRotulo + 10;
  const x1 = w - 12;
  const x = escalaLinear(dom ? [dom.min, dom.max] : [0, 1], [x0, x1]);
  const ticks = dom ? ticksTempo(dom.min, dom.max, w < 520 ? 3 : 6) : [];
  const h = faixas.length * alturaLinha;
  const ids = faixas.map((f) => f.id);
  const idCursor = cursor !== null && ids.includes(cursor) ? cursor : selecionado !== null && ids.includes(selecionado) ? selecionado : ids[0];
  const refs = referencias.map((r) => ({ ...r, s: diaSerial(r.data) })).filter((r): r is ReferenciaTempo & { s: number } => r.s !== null && !!dom && r.s >= dom.min && r.s <= dom.max);

  function irPara(i: number) {
    const alvo = ids[Math.max(0, Math.min(ids.length - 1, i))];
    if (!alvo) return;
    setCursor(alvo);
    alvos.current.get(alvo)?.focus();
  }

  function selecionar(f: FaixaTempo) {
    if (!onSelecionar) {
      setAtivo(f.id);
      setAnuncio(f.leitura);
      return;
    }
    const novo = selecionado === f.id ? null : f.id;
    onSelecionar(novo);
    setAnuncio(novo ? `Selecionado: ${f.leitura}` : `Seleção removida: ${f.rotulo}.`);
  }

  function teclado(ev: KeyboardEvent<SVGGElement>, i: number, f: FaixaTempo) {
    const t = ev.key;
    if (t === "ArrowDown" || t === "ArrowRight") irPara(i + 1);
    else if (t === "ArrowUp" || t === "ArrowLeft") irPara(i - 1);
    else if (t === "Home") irPara(0);
    else if (t === "End") irPara(ids.length - 1);
    else if (t === "Escape") setAtivo(null);
    else if (t === "Enter" || t === " ") selecionar(f);
    else return;
    ev.preventDefault();
  }

  const marca = (m: MarcaTempo, cy: number, cor: string, chave: string) => {
    const s = diaSerial(m.data);
    if (s === null) return null;
    if (m.mes) {
      const fim = fimDoMes(m.data) ?? s;
      const xa = x(s);
      const largMes = Math.max(6, x(fim + 1) - xa);
      return <rect key={chave} data-forma="mes" x={r1(xa)} y={r1(cy - 6)} width={r1(largMes)} height="12" fill={cor} stroke="var(--cor-superficie)" strokeWidth="1" />;
    }
    return m.forma === "vazado" ? (
      <circle key={chave} data-forma="vazado" cx={r1(x(s))} cy={r1(cy)} r="5.5" fill="var(--cor-superficie)" stroke={cor} strokeWidth="2.25" />
    ) : (
      <circle key={chave} data-forma="cheio" cx={r1(x(s))} cy={r1(cy)} r="5.5" fill={cor} stroke="var(--cor-superficie)" strokeWidth="1.5" />
    );
  };

  const ativa = faixas.find((f) => f.id === ativo) ?? null;
  const iAtiva = ativa ? faixas.indexOf(ativa) : -1;

  return (
    <div ref={raiz} className="relative w-full" data-grafico="faixas-tempo">
      <p id={`${uid}-instr`} className="sr-only">
        {`${faixas.length} ${faixas.length === 1 ? "linha" : "linhas"}. Use Tab para entrar no gráfico, as setas para percorrer, Home e End para ir ao início e ao fim${onSelecionar ? " e Enter ou Espaço para selecionar" : ""}. A tabela com os mesmos dados está logo abaixo.`}
      </p>
      {legenda && <div className="mb-2 text-xs text-carvao-muted">{legenda}</div>}
      {!faixas.length || !dom ? (
        <p className="border border-dashed border-linha px-4 py-6 text-sm text-carvao-muted">{vazio}</p>
      ) : (
        <>
          <svg width={w} height={ALTURA_EIXO} role="presentation" aria-hidden="true" className="block max-w-full">
            {ticks.map((t) => (
              <g key={t.iso}>
                <line x1={r1(x(t.serial))} x2={r1(x(t.serial))} y1={ALTURA_EIXO - 6} y2={ALTURA_EIXO} stroke="var(--cor-mineral-soft)" />
                <text x={r1(x(t.serial))} y={ALTURA_EIXO - 10} textAnchor="middle" fontSize="11" fill="var(--cor-mineral)" className="tabular-nums">
                  {t.rotulo}
                </text>
              </g>
            ))}
            <line x1={x0} x2={x1} y1={ALTURA_EIXO - 0.5} y2={ALTURA_EIXO - 0.5} stroke="var(--cor-linha)" />
          </svg>
          <div className="relative overflow-y-auto overscroll-contain" style={{ maxHeight: alturaMaxima }}>
            <svg width={w} height={h} role="group" aria-label={titulo} aria-describedby={`${uid}-instr`} className="block max-w-full">
              {ticks.map((t) => (
                <line key={t.iso} x1={r1(x(t.serial))} x2={r1(x(t.serial))} y1="0" y2={h} stroke="var(--cor-grade)" />
              ))}
              {faixas.map((f, i) => {
                const y0 = i * alturaLinha;
                const cy = y0 + alturaLinha / 2;
                const sA = f.inicio ? diaSerial(f.inicio.data) : null;
                const sB = f.fim ? diaSerial(f.fim.data) : null;
                const sel = selecionado === f.id;
                const espessura = f.traco === "fino" ? 2 : 6;
                return (
                  <g
                    key={f.id}
                    ref={(el) => {
                      if (el) alvos.current.set(f.id, el);
                      else alvos.current.delete(f.id);
                    }}
                    role={onSelecionar ? "button" : "img"}
                    aria-pressed={onSelecionar ? sel : undefined}
                    aria-label={f.leitura}
                    tabIndex={f.id === idCursor ? 0 : -1}
                    data-faixa={f.id}
                    data-selecionado={sel ? "sim" : undefined}
                    className="cursor-pointer outline-none focus:outline-none"
                    onKeyDown={(e) => teclado(e, i, f)}
                    onFocus={(e) => {
                      setCursor(f.id);
                      setAtivo(f.id);
                      let visivel = true;
                      try {
                        visivel = e.currentTarget.matches(":focus-visible");
                      } catch {
                        /* navegador sem :focus-visible: mostra o anel */
                      }
                      setFocoVisivel(visivel ? f.id : null);
                    }}
                    onBlur={() => {
                      setFocoVisivel(null);
                      setAtivo((a) => (a === f.id ? null : a));
                    }}
                    onPointerEnter={(e) => {
                      if (e.pointerType === "mouse") setAtivo(f.id);
                    }}
                    onPointerLeave={(e) => {
                      if (e.pointerType === "mouse") setAtivo((a) => (a === f.id ? null : a));
                    }}
                    onClick={() => {
                      setCursor(f.id);
                      setAtivo(f.id);
                      selecionar(f);
                    }}
                  >
                    <rect x="0" y={y0} width={w} height={alturaLinha} fill={sel ? "var(--cor-selecao)" : "transparent"} />
                    <line x1="0" x2={w} y1={y0 + alturaLinha - 0.5} y2={y0 + alturaLinha - 0.5} stroke="var(--cor-grade)" />
                    <text x="6" y={r1(cy + 4)} fontSize="12" fontWeight={sel ? 600 : 400} fill="var(--cor-carvao)">
                      {cabe(f.rotulo, colRotulo - 10)}
                    </text>
                    {f.traco !== "nenhum" && sA !== null && sB !== null && (
                      <line
                        data-traco={f.traco}
                        x1={r1(x(sA))}
                        x2={r1(x(f.fim?.mes ? (fimDoMes(f.fim.data) ?? sB) + 1 : sB))}
                        y1={r1(cy)}
                        y2={r1(cy)}
                        stroke={f.cor}
                        strokeOpacity={f.traco === "fino" ? 0.9 : 0.45}
                        strokeWidth={espessura}
                        strokeDasharray={f.traco === "tracejado" ? "6 4" : undefined}
                        strokeLinecap="butt"
                      />
                    )}
                    {f.inicio && marca(f.inicio, cy, f.cor, "a")}
                    {f.fim && marca(f.fim, cy, f.cor, "b")}
                    {!f.inicio && !f.fim && (
                      <text data-estado="sem-data" x={x0} y={r1(cy + 4)} fontSize="11" fontStyle="italic" fill="var(--cor-carvao-muted)">
                        {cabe(`sem datas: ${f.ausencia ?? "não informadas"}`, x1 - x0)}
                      </text>
                    )}
                    {focoVisivel === f.id && <rect x="1" y={y0 + 1} width={Math.max(0, w - 2)} height={alturaLinha - 2} fill="none" stroke="var(--cor-energia)" strokeWidth="2" rx="2" />}
                  </g>
                );
              })}
              {refs.map((r) => (
                <line key={r.data} data-referencia={r.data} x1={r1(x(r.s))} x2={r1(x(r.s))} y1="0" y2={h} stroke="var(--cor-carvao)" strokeWidth="1.5" strokeDasharray="3 3" pointerEvents="none" />
              ))}
            </svg>
            {ativa && (
              // sem w-max: a largura da dica se ajusta ao espaço entre left e a borda do gráfico, então ela nunca cria rolagem horizontal na página
              <div
                aria-hidden="true"
                className="pointer-events-none absolute z-20 min-w-[12rem] max-w-[22rem] border border-linha bg-superficie px-3 py-2 text-xs leading-relaxed text-carvao shadow-[0_6px_20px_rgba(26,29,33,0.12)]"
                style={{
                  top: (iAtiva + 1) * alturaLinha + 120 > h && iAtiva * alturaLinha - 120 >= 0 ? iAtiva * alturaLinha : (iAtiva + 1) * alturaLinha,
                  transform: (iAtiva + 1) * alturaLinha + 120 > h && iAtiva * alturaLinha - 120 >= 0 ? "translateY(-100%)" : undefined,
                  left: `min(${colRotulo}px, calc(100% - 13rem))`,
                }}
              >
                {ativa.leitura}
              </div>
            )}
          </div>
          {h > alturaMaxima && (
            <p className="mt-1 text-xs text-carvao-muted" data-aviso-rolagem="true">
              O gráfico mostra {Math.floor(alturaMaxima / alturaLinha)} das {faixas.length} linhas por vez; role dentro dele para ver as demais.
            </p>
          )}
          {refs.length > 0 && (
            <p className="mt-1 text-xs text-carvao-muted">
              Linha tracejada vertical: {refs.map((r) => `${r.rotulo} (${dataBR(r.data)})`).join("; ")}.
            </p>
          )}
          <p className="mt-0.5 text-xs text-mineral">
            Eixo de {dataBR(isoDoDia(dom.min))} a {dataBR(isoDoDia(dom.max))}, ajustado às linhas mostradas.
          </p>
        </>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {anuncio}
      </p>
    </div>
  );
}
