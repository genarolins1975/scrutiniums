"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { dominioBonito, escalaLinear } from "@/lib/energia/escalas";
import { ROTULO_STATUS, type PontoSerie } from "@/lib/eficiencia/consulta";

/**
 * Gráficos do OBEE em SVG, medidos na largura real do contêiner (o texto
 * nunca encolhe com o gráfico). Gramática comum: marcas finas, grade sólida e
 * recessiva, cor só para seleção (petróleo) contra o neutro dos pares, nenhum
 * juízo de valor em cor. Dica por ponteiro e por teclado; a tabela equivalente
 * fica sempre ao lado, porque a dica nunca é a única forma de ler um valor.
 */

export function useLargura<T extends HTMLElement>(padrao: number) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(padrao);
  // antes da primeira medida (HTML do servidor e hidratação), o desenho escala à largura do contêiner por viewBox: a página
  // nunca ganha rolagem horizontal por causa de um gráfico ainda não medido
  const [medido, setMedido] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((es) => {
      const largura = Math.round(es[0].contentRect.width);
      if (largura > 0) {
        setW(largura);
        setMedido(true);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w, medido] as const;
}

/** Dimensões do desenho: em pixels depois de medido; antes, a largura do contêiner, com viewBox para escalar sem estourar. */
export function dimensoes(medido: boolean, w: number, H: number) {
  return medido ? { width: w, height: H } : { width: "100%", viewBox: `0 0 ${w} ${H}`, style: { height: "auto" } };
}

export const COR = {
  selecao: "var(--cor-obee)",
  neutro: "var(--cor-obee-neutro)",
  grade: "var(--cor-grade)",
  eixo: "var(--cor-mineral)",
  superficie: "var(--cor-superficie)",
  referencia: "var(--cor-carvao-muted)",
};

/* ------------------------------------------------------------------ série */

export type Anotacao = { ano: number; texto: string };

/** Mediana do grupo em cada ano, com o número de capitais na comparação: o grupo pode mudar de um ano para outro. */
export type ReferenciaAnual = { ano: number; valor: number | null; n: number };

export function MiniSerie({
  titulo,
  pontos,
  formata,
  formataEixo,
  zero,
  anotacoes = [],
  referencia,
  rotuloReferencia = "Mediana das capitais",
  altura = 176,
}: {
  titulo: string;
  pontos: PontoSerie[];
  formata: (v: number) => string;
  formataEixo: (v: number) => string;
  zero: boolean;
  anotacoes?: Anotacao[];
  referencia?: ReferenciaAnual[];
  rotuloReferencia?: string;
  /** altura do desenho em px; o texto não encolhe com ela */
  altura?: number;
}) {
  const [ref, w, medido] = useLargura<HTMLDivElement>(320);
  const [ativo, setAtivo] = useState<number | null>(null);
  const H = altura;
  const m = { t: 14, r: 14, b: 30, l: 62 };
  const valores = pontos.map((p) => p.valor);
  const temValor = valores.some((v) => v !== null);
  const refPorAno = new Map((referencia ?? []).map((r) => [r.ano, r]));
  const refValores = pontos.map((p) => refPorAno.get(p.ano)?.valor ?? null);
  const dom = dominioBonito([...valores, ...refValores], { zero, n: 4 });
  const y = escalaLinear([dom.min, dom.max], [H - m.b, m.t]);
  const passoX = pontos.length > 1 ? (w - m.l - m.r) / (pontos.length - 1) : 0;
  const x = (i: number) => (pontos.length > 1 ? m.l + i * passoX : (m.l + w - m.r) / 2);
  // segmentos só entre anos consecutivos com valor elegível: ausência é lacuna, nunca ponte; um valor fora
  // das comparações (perímetro distinto ou conferência pendente) fica isolado, sem linha que sugira continuidade
  // mudança de base entre dois anos consecutivos com valor elegível (ex.: população de referência): a linha se interrompe ali e
  // o ponto de mudança é marcado, porque os valores dos dois lados não são diretamente comparáveis
  const segs: string[] = [];
  const rupturas: number[] = [];
  let atual: string[] = [];
  let anterior = -1;
  pontos.forEach((p, i) => {
    if (p.valor === null || !p.elegivel) {
      if (atual.length > 1) segs.push(atual.join(" "));
      atual = [];
      anterior = -1;
    } else {
      if (anterior >= 0 && pontos[anterior].quebraSerie !== p.quebraSerie) {
        if (atual.length > 1) segs.push(atual.join(" "));
        atual = [];
        rupturas.push(i);
      }
      atual.push(`${atual.length ? "L" : "M"}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`);
      anterior = i;
    }
  });
  if (atual.length > 1) segs.push(atual.join(" "));
  // referência: linha tracejada só entre anos consecutivos que têm mediana
  const segsRef: string[] = [];
  let atualRef: string[] = [];
  pontos.forEach((p, i) => {
    const v = refPorAno.get(p.ano)?.valor ?? null;
    if (v === null) {
      if (atualRef.length > 1) segsRef.push(atualRef.join(" "));
      atualRef = [];
    } else atualRef.push(`${atualRef.length ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  });
  if (atualRef.length > 1) segsRef.push(atualRef.join(" "));
  const mostrarRotulo = (i: number) => pontos.length <= 6 || i === 0 || i === pontos.length - 1 || i % 2 === 0;
  const anot = new Map(anotacoes.map((a, i) => [a.ano, i + 1]));
  const ultimo = [...pontos].reverse().find((p) => p.valor !== null);
  const iUltimo = ultimo ? pontos.indexOf(ultimo) : -1;
  // valor escrito em cada ponto quando cabe sem colidir com o vizinho (séries curtas); senão, só o último
  const larguraMaior = Math.max(0, ...pontos.map((p) => (p.valor === null ? 0 : formata(p.valor).length * 6.8)));
  const rotularTodos = pontos.length > 1 && pontos.length <= 8 && passoX >= larguraMaior + 8;

  const teclado = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    setAtivo((a) => {
      if (e.key === "Home") return 0;
      if (e.key === "End") return pontos.length - 1;
      const base = a ?? (e.key === "ArrowRight" ? -1 : pontos.length);
      return Math.max(0, Math.min(pontos.length - 1, base + (e.key === "ArrowRight" ? 1 : -1)));
    });
  };
  const pa = ativo !== null ? pontos[ativo] : null;

  return (
    <div ref={ref} className="relative">
      <div
        tabIndex={0}
        role="group"
        aria-label={`${titulo}. Use as setas para percorrer os anos; a tabela abaixo traz todos os valores.`}
        onKeyDown={teclado}
        onBlur={() => setAtivo(null)}
        className="outline-offset-4"
      >
        <svg {...dimensoes(medido, w, H)} aria-hidden="true" className="block overflow-visible">
          {dom.ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} stroke={COR.grade} strokeWidth={1} />
              <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={COR.eixo}>
                {formataEixo(t)}
              </text>
            </g>
          ))}
          {pontos.map((p, i) => (
            <g key={p.ano}>
              {mostrarRotulo(i) && (
                <text x={x(i)} y={H - 10} textAnchor="middle" fontSize={11} fill={COR.eixo}>
                  {p.ano}
                </text>
              )}
              {anot.has(p.ano) && (
                <text x={x(i)} y={m.t - 2} textAnchor="middle" fontSize={10} fill={COR.referencia}>
                  {anot.get(p.ano)}
                </text>
              )}
              {p.valor === null && (
                <circle cx={x(i)} cy={H - m.b} r={3.5} fill={COR.superficie} stroke={COR.eixo} strokeWidth={1.2} />
              )}
            </g>
          ))}
          {rupturas.map((i, n) => (
            <g key={`rp${pontos[i].ano}`}>
              <line x1={(x(i - 1) + x(i)) / 2} x2={(x(i - 1) + x(i)) / 2} y1={m.t} y2={H - m.b} stroke={COR.referencia} strokeWidth={1.25} strokeDasharray="2 3" />
              {n === 0 && (
                <text x={(x(i - 1) + x(i)) / 2} y={m.t - 3} textAnchor="middle" fontSize={10} fill={COR.referencia}>
                  mudança de base
                </text>
              )}
            </g>
          ))}
          {segsRef.map((d) => (
            <path key={`r${d}`} d={d} fill="none" stroke={COR.referencia} strokeWidth={1.5} strokeDasharray="5 4" strokeLinecap="round" />
          ))}
          {pontos.map((p, i) => {
            const r = refPorAno.get(p.ano);
            return r && r.valor !== null ? <circle key={`rp${p.ano}`} cx={x(i)} cy={y(r.valor)} r={2.5} fill={COR.superficie} stroke={COR.referencia} strokeWidth={1.4} /> : null;
          })}
          {segs.map((d) => (
            <path key={d} d={d} fill="none" stroke={COR.selecao} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {pontos.map((p, i) =>
            p.valor === null ? null : p.elegivel ? (
              <circle key={p.ano} cx={x(i)} cy={y(p.valor)} r={ativo === i ? 5.5 : 4} fill={COR.selecao} stroke={COR.superficie} strokeWidth={2} />
            ) : (
              <rect
                key={p.ano}
                x={x(i) - 4.5}
                y={y(p.valor) - 4.5}
                width={9}
                height={9}
                transform={`rotate(45 ${x(i)} ${y(p.valor)})`}
                fill={COR.superficie}
                stroke={COR.selecao}
                strokeWidth={2}
              />
            ),
          )}
          {rotularTodos &&
            pontos.map((p, i) =>
              p.valor === null ? null : (
                <text
                  key={`v${p.ano}`}
                  x={x(i)}
                  y={y(p.valor) - 10}
                  textAnchor={i === 0 && x(i) - larguraMaior / 2 < 0 ? "start" : i === pontos.length - 1 && x(i) + larguraMaior / 2 > w ? "end" : "middle"}
                  fontSize={11.5}
                  fontWeight={i === iUltimo ? 600 : 400}
                  fill="var(--cor-obee-tinta)"
                >
                  {formata(p.valor)}
                </text>
              ),
            )}
          {!rotularTodos && ultimo && ultimo.valor !== null && ativo === null && (
            <text
              x={Math.min(x(iUltimo), w - m.r)}
              y={y(ultimo.valor) - 10}
              textAnchor={iUltimo === pontos.length - 1 ? "end" : "middle"}
              fontSize={11.5}
              fontWeight={600}
              fill="var(--cor-obee-tinta)"
            >
              {formata(ultimo.valor)}
            </text>
          )}
          {ativo !== null && <line x1={x(ativo)} x2={x(ativo)} y1={m.t} y2={H - m.b} stroke={COR.eixo} strokeWidth={1} />}
          <rect
            x={m.l - passoX / 2}
            y={0}
            width={w - m.l - m.r + passoX}
            height={H}
            fill="transparent"
            onPointerMove={(e) => {
              const r = (e.currentTarget as SVGRectElement).ownerSVGElement!.getBoundingClientRect();
              const px = e.clientX - r.left;
              const i = pontos.length > 1 ? Math.round((px - m.l) / passoX) : 0;
              setAtivo(Math.max(0, Math.min(pontos.length - 1, i)));
            }}
            onPointerLeave={() => setAtivo(null)}
          />
        </svg>
        {!temValor && (
          <p className="absolute inset-x-0 top-12 text-center text-sm text-carvao-muted">Nenhum valor publicado para este recorte.</p>
        )}
        {pa && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 max-w-[15rem] border border-linha bg-superficie px-3 py-2 text-xs shadow-sm"
            style={{ left: Math.min(Math.max(0, x(ativo!) - 90), Math.max(0, w - 240)) }}
          >
            <p className="rotulo text-mineral">{pa.ano}</p>
            {pa.valor !== null ? (
              <p className="mt-0.5 text-sm font-semibold text-obee-tinta">{formata(pa.valor)}</p>
            ) : (
              <p className="mt-0.5 text-obee-tinta">
                {ROTULO_STATUS[pa.status]}
                {pa.nota ? `: ${pa.nota}` : ""}
              </p>
            )}
            {refPorAno.get(pa.ano)?.valor != null && (
              <p className="mt-1 text-carvao-muted">
                {rotuloReferencia}: {formata(refPorAno.get(pa.ano)!.valor as number)} ({refPorAno.get(pa.ano)!.n} capitais)
              </p>
            )}
            {pa.valor !== null && !pa.elegivel && <p className="mt-1 font-semibold text-obee-tinta">Fora das comparações: {pa.motivo ?? pa.nota}</p>}
            {pa.valor !== null && pa.elegivel && pa.nota && pa.notaMaterial && <p className="mt-1 text-carvao-muted">{pa.nota}</p>}
          </div>
        )}
      </div>
      {(pontos.some((p) => p.valor === null || !p.elegivel) || anotacoes.length > 0 || segsRef.length > 0 || rupturas.length > 0) && (
        <ul className="mt-1 space-y-0.5 text-xs leading-snug text-carvao-muted">
          {rupturas.map((i) => (
            <li key={`mb${pontos[i].ano}`} className="text-obee-tinta">
              <span aria-hidden="true">┆</span> Mudança de base entre {pontos[i - 1].ano} e {pontos[i].ano}: a linha se interrompe, porque os valores dos dois lados não são diretamente comparáveis.
            </li>
          ))}
          {segsRef.length > 0 && (
            <li>
              <span aria-hidden="true">┄</span> Linha tracejada: {rotuloReferencia.toLowerCase()} em cada ano. O número de capitais na comparação pode mudar de um ano para outro (de{" "}
              {Math.min(...(referencia ?? []).filter((r) => r.valor !== null).map((r) => r.n))} a {Math.max(...(referencia ?? []).filter((r) => r.valor !== null).map((r) => r.n))}); a variação da linha
              não é a evolução de um grupo constante.
            </li>
          )}
          {pontos
            .filter((p) => p.valor !== null && !p.elegivel)
            .map((p) => (
              <li key={`f${p.ano}`} className="text-obee-tinta">
                <span aria-hidden="true">◇</span> {p.ano}: valor oficial fora das comparações e sem linha com os anos vizinhos. {p.motivo}
              </li>
            ))}
          {pontos.some((p) => p.valor === null) && (
            <li>
              <span aria-hidden="true">○</span> no eixo: ano sem valor (
              {pontos
                .filter((p) => p.valor === null)
                .map((p) => `${p.ano}: ${ROTULO_STATUS[p.status].toLowerCase()}`)
                .join("; ")}
              )
            </li>
          )}
          {anotacoes.map((a, i) => (
            <li key={a.ano}>
              <span className="tabular-nums">{i + 1}</span> {a.ano}: {a.texto}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Marcas 1, 2 e 5 de cada potência de dez dentro do domínio, para o eixo logarítmico. */
export function ticksLog(min: number, max: number): number[] {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
    for (const k of [1, 2, 5]) {
      const v = k * 10 ** e;
      if (v >= min * 0.999 && v <= max * 1.001) out.push(v);
    }
  }
  return out.length > 6 ? out.filter((v) => String(v)[0] === "1" || String(v)[0] === "5").slice(0, 6) : out;
}

/* ------------------------------------------------------------------ barras de composição */

export function BarrasComposicao({
  linhas,
}: {
  linhas: { chave: string; rotulo: string; pct: number; detalhe: string }[];
}) {
  return (
    <ul className="space-y-2.5">
      {linhas.map((l) => (
        <li key={l.chave} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 sm:grid-cols-[13rem_minmax(0,1fr)_7.5rem]">
          <span className="text-sm text-obee-tinta">{l.rotulo}</span>
          <span className="order-3 col-span-2 block h-3 bg-obee-fundo sm:order-none sm:col-span-1" aria-hidden="true">
            <span className="block h-3 rounded-r-[4px] bg-obee" style={{ width: `${Math.max(0, Math.min(100, l.pct))}%` }} />
          </span>
          <span className="text-right text-sm tabular-nums text-obee-tinta">
            {l.detalhe}
          </span>
        </li>
      ))}
    </ul>
  );
}
