"use client";

import { dominioBonito, escalaLinear } from "@/lib/energia/escalas";
import { COR, dimensoes, ticksLog, useLargura } from "./graficos";

/**
 * Gráficos do panorama, os dois enxutos de propósito: o que se lê vem em número, não em desenho a decifrar.
 *
 * FaixaResumo: o menor valor, a mediana e o maior valor das capitais numa escala só, com a faixa central de 50% como fundo.
 * Cada marca traz o valor escrito; empatados nos extremos são nomeados no texto vizinho, nunca escondidos.
 *
 * ComparacaoReferencia: a mediana das capitais ao lado de uma referência (a nacional, quando existe) em linhas separadas,
 * na mesma escala. A referência é um agregado de outro universo e não vem como diferença contra as capitais.
 *
 * Nenhum dos dois depende de hover, nem de cor sozinha: o valor está escrito ao lado de cada marca e a tabela com todas as
 * capitais fica a um clique. A descrição acessível é a frase factual gerada dos dados.
 */

const LARGURA_CARACTERE = 6.6;
const largura = (t: string) => t.length * LARGURA_CARACTERE;
/** Rótulos de eixo (11,5 px) são um pouco mais largos por caractere que os de valor em negrito, e merecem folga maior. */
const larguraEixo = (t: string) => t.length * 7.2;

/** Rótulos do eixo que não colidem entre si nem com os rótulos reservados (os valores da faixa central, sempre escritos). */
function ticksSemColisao(ticks: number[], x: (v: number) => number, fmt: (v: number) => string, reservados: { px: number; texto: string }[], folga = 10): number[] {
  const ocupados = reservados.map((r) => ({ ini: r.px - larguraEixo(r.texto) / 2, fim: r.px + larguraEixo(r.texto) / 2 }));
  const mantidos: number[] = [];
  for (const t of ticks) {
    const px = x(t);
    const meia = larguraEixo(fmt(t)) / 2;
    const ini = px - meia;
    const fim = px + meia;
    if (ocupados.some((o) => ini < o.fim + folga && fim > o.ini - folga)) continue;
    ocupados.push({ ini, fim });
    mantidos.push(t);
  }
  return mantidos;
}

export type MarcaResumo = { valor: number };

export function FaixaResumo({
  menor,
  mediana,
  maior,
  faixa,
  destaque,
  formata,
  formataCurto,
  formataEixo,
  escala = "linear",
  zero = false,
  tituloEixo,
  descricao,
}: {
  menor: number;
  mediana: number;
  maior: number;
  faixa: { q1: number; q3: number } | null;
  destaque: { rotulo: string; valor: number } | null;
  formata: (v: number) => string;
  formataCurto: (v: number) => string;
  formataEixo: (v: number) => string;
  escala?: "linear" | "log";
  zero?: boolean;
  tituloEixo: string;
  descricao: string;
}) {
  const [ref, w, medido] = useLargura<HTMLDivElement>(640);
  const estreito = w < 520;
  const rot = estreito ? formataCurto : formata;
  const mb = { l: 14, r: 14 };
  const valores = [menor, mediana, maior, faixa?.q1 ?? null, faixa?.q3 ?? null, destaque?.valor ?? null].filter((v): v is number => v !== null);
  const log = escala === "log" && valores.every((v) => v > 0);
  const dom = log
    ? { min: Math.min(...valores) * 0.8, max: Math.max(...valores) * 1.25, ticks: [] as number[] }
    : dominioBonito(valores, { zero, n: estreito ? 3 : 5 });
  const lin = escalaLinear([dom.min, dom.max], [mb.l, w - mb.r]);
  const x = (v: number) => (log ? mb.l + ((Math.log10(v) - Math.log10(dom.min)) / (Math.log10(dom.max) - Math.log10(dom.min))) * (w - mb.l - mb.r) : lin(v));
  const ticksBase = log ? ticksLog(dom.min, dom.max) : dom.ticks;

  // rótulos de valor sobre as marcas, em linhas que sobem quando um colide com o vizinho
  type Rotulo = { chave: string; px: number; texto: string; negrito: boolean; cor: string };
  const rotulos: Rotulo[] = [
    { chave: "menor", px: x(menor), texto: rot(menor), negrito: true, cor: "var(--cor-obee-tinta)" },
    { chave: "mediana", px: x(mediana), texto: rot(mediana), negrito: true, cor: "var(--cor-obee-dark)" },
    { chave: "maior", px: x(maior), texto: rot(maior), negrito: true, cor: "var(--cor-obee-tinta)" },
  ];
  if (destaque) rotulos.push({ chave: "destaque", px: x(destaque.valor), texto: `${destaque.rotulo} ${rot(destaque.valor)}`, negrito: true, cor: "var(--cor-obee-tinta)" });
  const caixa = (r: Rotulo) => {
    const l = largura(r.texto);
    const ancora: "start" | "middle" | "end" = r.px - l / 2 < 2 ? "start" : r.px + l / 2 > w - 2 ? "end" : "middle";
    const ini = ancora === "start" ? r.px : ancora === "end" ? r.px - l : r.px - l / 2;
    return { ancora, ini, fim: ini + l };
  };
  const linhas: { ini: number; fim: number }[][] = [];
  const posicao = rotulos.map((r) => {
    const c = caixa(r);
    let n = 0;
    while (linhas[n]?.some((o) => c.ini < o.fim + 10 && c.fim > o.ini - 10)) n++;
    (linhas[n] ??= []).push({ ini: c.ini, fim: c.fim });
    return { ...c, linha: n };
  });
  const nLinhas = Math.max(1, linhas.length);
  const passoLinha = 17;
  const yLinha = (n: number) => 14 + (nLinhas - 1 - n) * passoLinha; // linha 0 fica junto das marcas
  const yMarca = 14 + (nLinhas - 1) * passoLinha + 28;
  const yEixo = yMarca + 56;
  const H = yEixo + 62;

  const reservados = faixa ? [{ px: x(faixa.q1), texto: formataEixo(faixa.q1) }, { px: x(faixa.q3), texto: formataEixo(faixa.q3) }] : [];
  const ticks = ticksSemColisao(ticksBase, x, formataEixo, reservados);
  const afastados = faixa ? x(faixa.q3) - x(faixa.q1) > larguraEixo(formataEixo(faixa.q1)) / 2 + larguraEixo(formataEixo(faixa.q3)) / 2 + 8 : true;

  return (
    <figure ref={ref} className="m-0">
      <div role="img" aria-label={descricao}>
        <svg {...dimensoes(medido, w, H)} aria-hidden="true" className="block">
          {faixa && (
            <g>
              <rect x={x(faixa.q1)} y={yMarca} width={Math.max(1, x(faixa.q3) - x(faixa.q1))} height={yEixo - yMarca} fill="var(--cor-obee-fundo)" />
              <line x1={x(faixa.q1)} x2={x(faixa.q1)} y1={yMarca} y2={yEixo} stroke="var(--cor-obee)" strokeWidth={1} strokeDasharray="3 3" />
              <line x1={x(faixa.q3)} x2={x(faixa.q3)} y1={yMarca} y2={yEixo} stroke="var(--cor-obee)" strokeWidth={1} strokeDasharray="3 3" />
            </g>
          )}
          <line x1={mb.l} x2={w - mb.r} y1={yEixo} y2={yEixo} stroke={COR.eixo} strokeWidth={1} />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={yEixo} y2={yEixo + 5} stroke={COR.eixo} strokeWidth={1} />
              <text x={x(t)} y={yEixo + 20} textAnchor={x(t) < 24 ? "start" : x(t) > w - 24 ? "end" : "middle"} fontSize={11.5} fill={COR.eixo}>
                {formataEixo(t)}
              </text>
            </g>
          ))}
          {faixa && (
            <g>
              <text x={x(faixa.q1)} y={yEixo + 20} textAnchor={afastados ? "middle" : "end"} fontSize={11.5} fill="var(--cor-obee-dark)">
                {formataEixo(faixa.q1)}
              </text>
              <text x={x(faixa.q3)} y={yEixo + 20} textAnchor={afastados ? "middle" : "start"} fontSize={11.5} fill="var(--cor-obee-dark)">
                {formataEixo(faixa.q3)}
              </text>
            </g>
          )}
          {/* hastes das marcas até o eixo: tracejadas nos extremos, cheia na mediana */}
          <line x1={x(menor)} x2={x(menor)} y1={yMarca} y2={yEixo} stroke="var(--cor-obee-tinta)" strokeWidth={1} strokeDasharray="3 3" />
          <line x1={x(maior)} x2={x(maior)} y1={yMarca} y2={yEixo} stroke="var(--cor-obee-tinta)" strokeWidth={1} strokeDasharray="3 3" />
          <line x1={x(mediana)} x2={x(mediana)} y1={yMarca} y2={yEixo} stroke={COR.selecao} strokeWidth={1.5} />
          {rotulos.map((r, i) => (
            <line key={`h${r.chave}`} x1={r.px} x2={r.px} y1={yLinha(posicao[i].linha) + 4} y2={yMarca - 8} stroke={COR.grade} strokeWidth={1} opacity={posicao[i].linha === 0 ? 0 : 1} />
          ))}
          <circle cx={x(menor)} cy={yMarca} r={5} fill="var(--cor-obee-tinta)" />
          <circle cx={x(maior)} cy={yMarca} r={5} fill="var(--cor-obee-tinta)" />
          <circle cx={x(mediana)} cy={yMarca} r={7} fill={COR.selecao} stroke={COR.superficie} strokeWidth={2} />
          {destaque && <circle cx={x(destaque.valor)} cy={yMarca} r={6.5} fill={COR.superficie} stroke="var(--cor-obee-tinta)" strokeWidth={2.5} />}
          {rotulos.map((r, i) => (
            <text key={r.chave} x={posicao[i].ancora === "start" ? posicao[i].ini : posicao[i].ancora === "end" ? posicao[i].fim : r.px} y={yLinha(posicao[i].linha)} textAnchor={posicao[i].ancora} fontSize={12} fontWeight={600} fill={r.cor}>
              {r.texto}
            </text>
          ))}
          <text x={w / 2} y={yEixo + 46} textAnchor="middle" fontSize={11.5} fill={COR.referencia}>
            {tituloEixo}
          </text>
        </svg>
      </div>
    </figure>
  );
}

export type LinhaReferencia = { chave: string; rotulo: string; rotuloEstreito: [string, string]; valor: number; tom: "capitais" | "referencia" | "destaque" };

export function ComparacaoReferencia({
  linhas,
  formata,
  formataEixo,
  dominioFixo,
  descricao,
  extremos,
}: {
  linhas: LinhaReferencia[];
  formata: (v: number) => string;
  formataEixo: (v: number) => string;
  dominioFixo: [number, number] | null;
  descricao: string;
  /** menor e maior valor do grupo: só definem o alcance do eixo, para que se veja onde os valores ficam dentro dele */
  extremos: [number, number];
}) {
  const [ref, w, medido] = useLargura<HTMLDivElement>(640);
  const estreito = w < 400;
  const mb = { t: 8, r: 20, b: 30, l: estreito ? 84 : 128 };
  const passo = 38;
  const todos = [...linhas.map((l) => l.valor), ...extremos];
  const dom = dominioFixo ? { min: dominioFixo[0], max: dominioFixo[1], ticks: [0, 2, 4, 6, 8, 10] } : dominioBonito(todos, { n: estreito ? 3 : 5 });
  const x = escalaLinear([dom.min, dom.max], [mb.l, w - mb.r]);
  const yBase = mb.t + linhas.length * passo;
  const H = yBase + mb.b;
  const yc = (i: number) => mb.t + i * passo + passo / 2 + 6;
  const corDe = (t: LinhaReferencia["tom"]) => (t === "capitais" ? COR.selecao : t === "destaque" ? "var(--cor-obee-tinta)" : COR.neutro);
  return (
    <figure ref={ref} className="m-0">
      <div role="img" aria-label={descricao}>
        <svg {...dimensoes(medido, w, H)} aria-hidden="true" className="block">
          {dom.ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={yBase} y2={yBase + 5} stroke={COR.eixo} strokeWidth={1} />
              <text x={x(t)} y={yBase + 20} textAnchor={x(t) < mb.l + 4 ? "start" : x(t) > w - 24 ? "end" : "middle"} fontSize={11.5} fill={COR.eixo}>
                {formataEixo(t)}
              </text>
            </g>
          ))}
          <line x1={mb.l} x2={w - mb.r} y1={yBase} y2={yBase} stroke={COR.eixo} strokeWidth={1} />
          {linhas.map((l, i) => {
            const px = x(l.valor);
            const texto = formata(l.valor);
            const ancora: "start" | "middle" | "end" = px - largura(texto) / 2 < mb.l ? "start" : px + largura(texto) / 2 > w - 2 ? "end" : "middle";
            return (
              <g key={l.chave}>
                <line x1={mb.l} x2={w - mb.r} y1={yc(i)} y2={yc(i)} stroke={COR.grade} strokeWidth={1} />
                <text x={mb.l - 10} y={yc(i)} textAnchor="end" fontSize={estreito ? 11.5 : 12} fill="var(--cor-carvao-muted)">
                  {estreito ? (
                    <>
                      <tspan x={mb.l - 10} dy="-0.15em">
                        {l.rotuloEstreito[0]}
                      </tspan>
                      <tspan x={mb.l - 10} dy="1.2em">
                        {l.rotuloEstreito[1]}
                      </tspan>
                    </>
                  ) : (
                    <tspan dy="0.32em">{l.rotulo}</tspan>
                  )}
                </text>
                <circle cx={px} cy={yc(i)} r={6.5} fill={corDe(l.tom)} stroke={COR.superficie} strokeWidth={2} />
                <text x={ancora === "start" ? px - 6 : px} y={yc(i) - 13} textAnchor={ancora} fontSize={12} fontWeight={600} fill={l.tom === "referencia" ? "var(--cor-carvao-muted)" : l.tom === "capitais" ? "var(--cor-obee-dark)" : "var(--cor-obee-tinta)"}>
                  {texto}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}
