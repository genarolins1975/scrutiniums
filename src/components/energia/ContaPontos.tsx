"use client";

import { useEffect, useRef, useState } from "react";
import { empilharPontos } from "@/lib/energia/conta";
import { dominioBonito, escalaLinear, rotuloTick, ticksQueCabem } from "@/lib/energia/escalas";

/**
 * Faixa de pontos: cada distribuidora é um ponto numa só escala, e a faixa inteira cabe numa linha curta. É a forma de ver as 81 (ou as
 * 102) de uma vez, onde a lista de barras só mostra uma dúzia por vez: o leitor vê a dispersão, a mediana, o 1º e o 3º quartil, o IPCA,
 * os extremos e as distribuidoras que escolheu. Pontos que se encostariam sobem e descem em linhas vizinhas (`empilharPontos`), sem
 * mudar a posição horizontal, que é o valor.
 *
 * O desenho não depende de cor: os pontos escolhidos são losangos com contorno e nome escrito, os extremos são círculos maiores com
 * nome escrito, a mediana e a referência (IPCA) são linhas com o rótulo escrito (a referência é tracejada) e os pontos fora do grupo
 * escolhido ficam vazados. Quem usa teclado ou leitor de tela tem o texto do `descricao`, a lista de barras e a tabela do mesmo painel;
 * o clique no ponto é um atalho do mouse e do toque, não a única via.
 *
 * Só desenha: valores, quartis e rótulos vêm de quem chama (os seletores de conta.ts), e a largura real é medida no navegador (o
 * servidor desenha a 760 px, a mesma altura que o cliente reproduz depois de medir).
 */

export type PontoFaixa = { id: string; valor: number; rotulo: string; apagado?: boolean };

/** Marca da legenda da faixa de pontos (o mesmo desenho que a figura usa para cada elemento). */
export function MarcaDaLegenda({ tipo }: { tipo: "ponto" | "extremo" | "mediana" | "referencia" | "destaque" | "faixa" | "vazado" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false" className="shrink-0">
      {tipo === "ponto" && <circle cx="7" cy="7" r="3.4" fill="var(--cor-energia)" fillOpacity="0.78" />}
      {tipo === "vazado" && <circle cx="7" cy="7" r="3.4" fill="none" stroke="var(--cor-mineral-soft)" strokeWidth="1" />}
      {tipo === "extremo" && <circle cx="7" cy="7" r="5.4" fill="var(--serie-1)" />}
      {tipo === "mediana" && <rect x="5.75" y="0.5" width="2.5" height="13" fill="var(--cor-energia)" />}
      {tipo === "referencia" && <line x1="7" y1="0.5" x2="7" y2="13.5" stroke="var(--cor-carvao-muted)" strokeWidth="1.5" strokeDasharray="3 2" />}
      {tipo === "destaque" && <path d="M7 1.5 12.5 7 7 12.5 1.5 7Z" fill="var(--cor-superficie)" stroke="var(--cor-energia-dark)" strokeWidth="2" />}
      {tipo === "faixa" && <rect x="0.5" y="3.5" width="13" height="7" fill="var(--escala-seq-1)" stroke="var(--escala-seq-3)" />}
    </svg>
  );
}
export type MarcaFaixa = { valor: number; rotulo: string; tipo: "mediana" | "referencia" };

const LARGURA_SSR = 760;
const R = 3.4;
const FOLGA = 1.3;
const PASSO = 2 * R + FOLGA;
const MARGEM = 14;
const PX = 6.7; // largura média de um caractere a 12 px
const LINHA_ROTULO = 16;

/** Menor nível (0, 1, 2 …) em que o rótulo não encosta no anterior do mesmo nível; ao esgotar os níveis, o último. */
function niveis(rotulos: readonly { x: number; w: number }[], max: number): number[] {
  const ordem = rotulos.map((r, i) => ({ ...r, i })).sort((a, b) => a.x - b.x);
  const fim: number[] = Array(max).fill(-Infinity);
  const out: number[] = Array(rotulos.length).fill(0);
  for (const r of ordem) {
    const ini = r.x - r.w / 2;
    let n = fim.findIndex((f) => ini - f >= 8);
    if (n < 0) n = max - 1;
    fim[n] = r.x + r.w / 2;
    out[r.i] = n;
  }
  return out;
}

export function ContaPontos({
  descricao,
  pontos,
  faixa = null,
  marcas = [],
  escolhidos = [],
  extremos = true,
  formatar,
  zeroNoEixo = false,
  aoEscolher,
}: {
  /** Leitura da figura em uma frase (nome acessível). */
  descricao: string;
  pontos: PontoFaixa[];
  /** Faixa do 1º ao 3º quartil. */
  faixa?: { de: number; ate: number; rotulo: string } | null;
  /** Linhas verticais: a mediana e, quando há, a referência (IPCA). */
  marcas?: MarcaFaixa[];
  /** Ids dos pontos escolhidos (losango e nome). */
  escolhidos?: string[];
  /** Realça e nomeia o menor e o maior valor. */
  extremos?: boolean;
  formatar: (v: number) => string;
  zeroNoEixo?: boolean;
  aoEscolher?: (id: string) => void;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(LARGURA_SSR);
  useEffect(() => {
    const el = raiz.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => setLargura(Math.max(280, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const valores = [...pontos.map((p) => p.valor), ...marcas.map((m) => m.valor), ...(faixa ? [faixa.de, faixa.ate] : [])];
  const dom = dominioBonito(valores, { zero: zeroNoEixo });
  const x = escalaLinear([dom.min, dom.max], [MARGEM, largura - MARGEM]);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const ticks = ticksQueCabem(dom.ticks, x, (t) => rotuloTick(t, dom.passo).length * PX, 12);

  const posicao = empilharPontos(
    pontos.map((p) => ({ id: p.id, x: r1(x(p.valor)) })),
    R,
    FOLGA,
  );
  const linhas = posicao.map((p) => p.linha);
  const topo = Math.min(0, ...linhas);
  const base = Math.max(0, ...linhas);
  const altura = (base - topo + 1) * PASSO + 10;
  const yDe = (linha: number) => 5 + (linha - topo + 0.5) * PASSO;

  // rótulos das linhas verticais, em cima; nomes dos extremos e dos escolhidos, embaixo (cada grupo em até três níveis, sem encostar)
  const marcasX = marcas.map((m) => ({ x: r1(x(m.valor)), w: `${m.rotulo}`.length * PX }));
  const nivelMarca = niveis(marcasX, 2);
  const altoCima = marcas.length ? (Math.max(...nivelMarca) + 1) * LINHA_ROTULO + 4 : 6;

  const porId = new Map(posicao.map((p) => [p.id, p]));
  const doPonto = new Map(pontos.map((p) => [p.id, p]));
  const menor = extremos && pontos.length ? pontos.reduce((a, b) => (b.valor < a.valor ? b : a)) : null;
  const maior = extremos && pontos.length ? pontos.reduce((a, b) => (b.valor > a.valor ? b : a)) : null;
  const nomeados: { id: string; texto: string; tipo: "menor" | "maior" | "escolhido" }[] = [];
  if (menor) nomeados.push({ id: menor.id, texto: `Menor: ${menor.rotulo}`, tipo: "menor" });
  if (maior && maior.id !== menor?.id) nomeados.push({ id: maior.id, texto: `Maior: ${maior.rotulo}`, tipo: "maior" });
  for (const id of escolhidos) {
    const p = doPonto.get(id);
    if (p && id !== menor?.id && id !== maior?.id) nomeados.push({ id, texto: p.rotulo, tipo: "escolhido" });
  }
  const nomeadosX = nomeados.map((n) => ({ x: r1(x(doPonto.get(n.id)?.valor ?? 0)), w: n.texto.length * PX }));
  const nivelNome = niveis(nomeadosX, 3);
  const altoBaixo = nomeados.length ? (Math.max(...nivelNome) + 1) * LINHA_ROTULO + 6 : 4;

  const yRegiao = altoCima;
  const yEixo = yRegiao + altura + altoBaixo;
  const total = yEixo + 26;
  const escolhidosSet = new Set(escolhidos);
  const limiteX = (cx: number, w: number) => Math.min(largura - MARGEM - w / 2, Math.max(MARGEM + w / 2, cx));

  const ordemDesenho = [...pontos].sort((a, b) => Number(!!b.apagado) - Number(!!a.apagado));

  return (
    <div ref={raiz} data-grafico="pontos" className="w-full">
      <svg width="100%" height={total} viewBox={`0 0 ${largura} ${total}`} role="img" aria-label={descricao} className="block overflow-visible">
        {faixa && (
          <rect x={r1(x(faixa.de))} y={yRegiao} width={r1(x(faixa.ate) - x(faixa.de))} height={altura} fill="var(--escala-seq-1)" stroke="var(--escala-seq-3)" strokeWidth="1">
            <title>{faixa.rotulo}</title>
          </rect>
        )}
        {marcas.map((m, i) => (
          <g key={`${m.tipo}-${m.valor}`}>
            <line
              x1={marcasX[i].x}
              x2={marcasX[i].x}
              y1={yRegiao - 4}
              y2={yRegiao + altura + 2}
              stroke={m.tipo === "mediana" ? "var(--cor-energia)" : "var(--cor-carvao-muted)"}
              strokeWidth={m.tipo === "mediana" ? 2.5 : 1.5}
              strokeDasharray={m.tipo === "referencia" ? "5 3" : undefined}
            />
            <text x={limiteX(marcasX[i].x, marcasX[i].w)} y={yRegiao - 8 - nivelMarca[i] * LINHA_ROTULO} textAnchor="middle" fontSize="12" fill="var(--cor-carvao)" fontWeight={m.tipo === "mediana" ? 600 : 400}>
              {m.rotulo}
            </text>
          </g>
        ))}
        {ordemDesenho.map((pt) => {
          const p = porId.get(pt.id);
          if (!p) return null;
          const ehEscolhido = escolhidosSet.has(pt.id);
          const ehExtremo = pt.id === menor?.id || pt.id === maior?.id;
          const cx = p.x;
          const cy = r1(yRegiao + yDe(p.linha));
          const tipo = ehEscolhido ? "losango" : ehExtremo ? "extremo" : "ponto";
          return (
            <g key={pt.id} data-id={pt.id} data-ponto={tipo} onClick={aoEscolher ? () => aoEscolher(pt.id) : undefined} style={aoEscolher ? { cursor: "pointer" } : undefined}>
              <title>{`${pt.rotulo}: ${formatar(pt.valor)}`}</title>
              {ehEscolhido ? (
                <path d={`M${cx},${cy - 8}L${cx + 8},${cy}L${cx},${cy + 8}L${cx - 8},${cy}Z`} fill="var(--cor-superficie)" stroke="var(--cor-energia-dark)" strokeWidth="2.5" />
              ) : ehExtremo ? (
                <circle cx={cx} cy={cy} r={R + 2} fill="var(--serie-1)" />
              ) : pt.apagado ? (
                <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--cor-mineral-soft)" strokeWidth="1" />
              ) : (
                <circle cx={cx} cy={cy} r={R} fill="var(--cor-energia)" fillOpacity="0.78" />
              )}
              {/* alvo de toque maior que o ponto, invisível */}
              {aoEscolher && <circle cx={cx} cy={cy} r={Math.max(R + 3, 8)} fill="transparent" />}
            </g>
          );
        })}
        {nomeados.map((n, i) => {
          const cx = nomeadosX[i].x;
          const lx = limiteX(cx, nomeadosX[i].w);
          const p = porId.get(n.id);
          const py = p ? yRegiao + yDe(p.linha) : yRegiao + altura / 2;
          const yTexto = yRegiao + altura + 12 + nivelNome[i] * LINHA_ROTULO;
          return (
            <g key={`nome-${n.id}`} aria-hidden="true">
              <line x1={cx} x2={cx} y1={py + (n.tipo === "escolhido" ? 9 : R + 3)} y2={yTexto - 11} stroke="var(--cor-mineral-soft)" strokeWidth="1" />
              <text x={lx} y={yTexto} textAnchor="middle" fontSize="12" fill="var(--cor-carvao)" fontWeight={n.tipo === "escolhido" ? 600 : 400}>
                {n.texto}
              </text>
            </g>
          );
        })}
        <line x1={MARGEM} x2={largura - MARGEM} y1={yEixo} y2={yEixo} stroke="var(--cor-carvao-muted)" strokeWidth="1" />
        {ticks.map((t) => (
          <g key={t} aria-hidden="true">
            <line x1={r1(x(t))} x2={r1(x(t))} y1={yEixo} y2={yEixo + 4} stroke="var(--cor-carvao-muted)" strokeWidth="1" />
            <text x={r1(x(t))} y={yEixo + 18} textAnchor={t === dom.min ? "start" : "middle"} fontSize="12" fill="var(--cor-mineral)" className="tabular-nums">
              {rotuloTick(t, dom.passo)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
