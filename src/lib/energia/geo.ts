/**
 * Geometria esquemática do Brasil e dos quatro submercados para o mapa-base
 * do Setor Elétrico. É um desenho simplificado (cerca de 130 vértices para o
 * contorno do país, traçados à mão em longitude e latitude aproximadas):
 * serve para localizar e comparar as regiões, não para medir. A divisão em
 * submercados segue a leitura usual do setor sobre quais estados compõem cada
 * um; a composição oficial por estado não foi conferida em documento do ONS
 * ou da CCEE nesta fase, e a legenda de todo mapa diz isso.
 *
 * Projeção: equirretangular simples, 15 unidades por grau, viewBox 0 0 600 600
 * (longitude de −74 a −34, latitude de 5,5 a −34,5).
 */
import type { Submercado } from "./tipos";

export type LonLat = [number, number];

export const VIEWBOX = "0 0 600 600";
export const LARGURA = 600;
export const ALTURA = 600;

export function projetar([lon, lat]: LonLat): [number, number] {
  return [Math.round((lon + 74) * 15 * 10) / 10, Math.round((5.5 - lat) * 15 * 10) / 10];
}

/** Contorno do país, no sentido horário a partir do extremo norte. */
export const CONTORNO: LonLat[] = [
  [-60.2, 5.2], [-59.7, 4.4], [-59.9, 3.0], [-59.5, 1.8], [-58.4, 1.5], [-57.2, 1.9], [-56.1, 1.9], [-55.9, 2.5], [-54.5, 2.3],
  [-53.5, 2.3], [-52.6, 2.4], [-51.6, 4.2],
  // litoral, do Amapá ao Chuí
  [-51.2, 3.3], [-50.9, 2.0], [-50.3, 1.0], [-50.5, 0.0], [-50.0, -0.5], [-48.6, -0.5], [-48.4, -1.3], [-47.0, -0.9],
  [-45.8, -1.4], [-44.4, -2.4], [-43.3, -2.4], [-42.0, -2.8], [-40.5, -2.9], [-38.5, -3.7], [-37.2, -4.8], [-35.6, -5.1],
  [-35.0, -6.3], [-34.8, -7.2], [-34.9, -8.2], [-35.5, -9.6], [-36.5, -10.5], [-37.2, -11.2], [-38.2, -12.6], [-38.6, -13.2],
  [-39.0, -14.6], [-39.0, -16.4], [-39.3, -17.6], [-39.6, -18.1], [-39.7, -18.6], [-40.0, -19.6], [-40.4, -20.6],
  [-41.0, -21.6], [-41.9, -22.4], [-43.2, -23.0], [-44.6, -23.4], [-45.6, -23.8], [-46.4, -24.1], [-47.4, -24.8],
  [-48.0, -25.1], [-48.3, -25.4], [-48.6, -26.4], [-48.6, -27.6], [-49.2, -28.6], [-49.8, -29.4], [-50.4, -30.5],
  [-51.3, -31.8], [-52.3, -32.7], [-53.4, -33.7],
  // fronteira sul e oeste, do Chuí ao Acre
  [-53.2, -32.9], [-53.6, -32.2], [-55.0, -31.2], [-55.7, -30.9], [-56.4, -30.3], [-57.6, -30.2], [-57.2, -29.4],
  [-56.5, -28.8], [-55.7, -28.1], [-55.0, -27.6], [-54.2, -27.3], [-53.7, -27.1], [-53.8, -26.0], [-54.0, -25.6],
  [-54.6, -25.5], [-54.3, -24.4], [-54.2, -23.9], [-55.1, -23.5], [-55.6, -22.5], [-56.5, -22.1], [-57.6, -22.1],
  [-57.9, -21.2], [-57.8, -20.0], [-58.1, -19.4], [-57.8, -18.5], [-57.7, -17.5], [-58.1, -16.3], [-60.1, -16.3],
  [-60.4, -15.1], [-60.2, -13.7], [-61.0, -13.5], [-62.2, -12.8], [-63.5, -12.4], [-64.4, -11.9], [-65.3, -10.8],
  [-65.3, -9.8], [-66.5, -9.9], [-67.6, -10.6], [-68.7, -11.1], [-69.7, -10.9], [-70.6, -11.0], [-70.6, -9.6],
  [-71.5, -9.9], [-72.3, -9.5], [-73.2, -9.4], [-73.9, -7.5],
  // fronteira norte, do Acre a Roraima
  [-73.5, -6.5], [-72.9, -5.1], [-71.8, -4.5], [-70.1, -4.2], [-69.9, -3.0], [-69.5, -1.5], [-69.9, -0.6], [-69.4, 0.6],
  [-68.2, 1.2], [-67.1, 1.4], [-66.9, 1.1], [-66.3, 0.8], [-65.6, 1.3], [-64.8, 2.0], [-64.1, 3.4], [-63.4, 3.9],
  [-62.7, 3.7], [-62.0, 4.0], [-61.0, 4.5], [-60.6, 5.1],
];

/* Divisas interiores entre submercados (leitura usual: Norte = AM, PA, TO, MA, AP
   e RR; Nordeste = PI, CE, RN, PB, PE, AL, SE e BA; Sudeste/Centro-Oeste = MG, ES,
   RJ, SP, GO, DF, MT, MS, AC e RO; Sul = PR, SC e RS). */
const DIVISA_N_NE: LonLat[] = [[-42.0, -2.8], [-42.4, -3.6], [-42.9, -4.7], [-43.5, -6.3], [-44.4, -8.0], [-45.4, -9.6], [-46.0, -10.3], [-46.2, -11.5], [-46.3, -13.2]];
const DIVISA_NE_SE: LonLat[] = [[-39.6, -18.1], [-40.2, -17.8], [-40.9, -16.6], [-41.0, -15.7], [-42.3, -15.3], [-43.6, -14.8], [-44.6, -14.4], [-45.4, -14.9], [-46.0, -15.2], [-46.2, -14.2], [-46.3, -13.2]];
const DIVISA_N_SE: LonLat[] = [
  [-46.3, -13.2], [-47.4, -13.0], [-48.5, -12.9], [-49.6, -12.9], [-50.3, -12.9], [-50.6, -12.0], [-50.7, -10.8], [-50.6, -9.9],
  [-51.5, -9.4], [-52.5, -8.9], [-53.5, -8.6], [-54.6, -8.4], [-55.5, -8.0], [-56.6, -7.9], [-57.5, -8.0], [-58.5, -8.0],
  [-59.5, -8.0], [-60.5, -8.3], [-61.6, -8.6], [-62.3, -8.0], [-63.4, -7.9], [-64.5, -8.5], [-65.5, -8.7], [-66.6, -9.3],
  [-67.5, -9.4], [-68.5, -9.3], [-69.5, -9.1], [-70.5, -8.9], [-71.5, -8.7], [-72.5, -8.2], [-73.4, -7.7], [-73.9, -7.5],
];
const DIVISA_S_SE: LonLat[] = [[-48.0, -25.1], [-49.0, -24.8], [-49.4, -24.3], [-49.8, -23.6], [-50.6, -22.95], [-51.6, -22.7], [-52.7, -22.65], [-53.3, -23.3], [-54.2, -23.9]];

function idx(p: LonLat): number {
  const i = CONTORNO.findIndex(([a, b]) => a === p[0] && b === p[1]);
  if (i < 0) throw new Error(`vértice fora do contorno: ${p}`);
  return i;
}

/** Trecho do contorno de `a` até `b`, inclusive, no sentido horário (com volta ao início). */
function trecho(a: LonLat, b: LonLat): LonLat[] {
  const i = idx(a);
  const j = idx(b);
  if (j >= i) return CONTORNO.slice(i, j + 1);
  return [...CONTORNO.slice(i), ...CONTORNO.slice(0, j + 1)];
}

const inverso = (xs: LonLat[]) => [...xs].reverse();

export const REGIOES: Record<Submercado, LonLat[]> = {
  N: [...trecho([-73.9, -7.5], [-42.0, -2.8]), ...DIVISA_N_NE.slice(1), ...DIVISA_N_SE.slice(1, -1)],
  NE: [...trecho([-42.0, -2.8], [-39.6, -18.1]), ...DIVISA_NE_SE.slice(1, -1), ...inverso(DIVISA_N_NE).slice(0, -1)],
  SE: [
    ...trecho([-39.6, -18.1], [-48.0, -25.1]),
    ...DIVISA_S_SE.slice(1),
    ...trecho([-54.2, -23.9], [-73.9, -7.5]).slice(1),
    ...inverso(DIVISA_N_SE).slice(1),
    ...inverso(DIVISA_NE_SE).slice(1, -1),
  ],
  S: [...trecho([-48.0, -25.1], [-54.2, -23.9]), ...inverso(DIVISA_S_SE).slice(1, -1)],
};

export const NOME_REGIAO: Record<Submercado, string> = { N: "Norte", NE: "Nordeste", SE: "Sudeste/Centro-Oeste", S: "Sul" };
export const SIGLA_REGIAO: Record<Submercado, string> = { N: "N", NE: "NE", SE: "SE/CO", S: "S" };
export const ORDEM_REGIOES: Submercado[] = ["N", "NE", "SE", "S"];

/** Ponto de ancoragem do rótulo e do valor de cada submercado. */
export const ANCORA: Record<Submercado, LonLat> = { N: [-57.5, -4.5], NE: [-40.6, -9.8], SE: [-51.5, -18.5], S: [-52.2, -28.6] };

/** Pares monitorados pelo ONS: sentido canônico da primeira para a segunda ponta, com os pontos de partida e chegada da seta. */
export const FRONTEIRAS: { par: string; de: Submercado; para: Submercado; a: LonLat; b: LonLat }[] = [
  { par: "N_NE", de: "N", para: "NE", a: [-48.0, -5.2], b: [-41.2, -7.2] },
  { par: "N_SE", de: "N", para: "SE", a: [-50.2, -9.6], b: [-50.0, -16.4] },
  { par: "NE_SE", de: "NE", para: "SE", a: [-42.6, -12.6], b: [-45.4, -18.4] },
  { par: "S_SE", de: "S", para: "SE", a: [-51.6, -26.6], b: [-49.2, -21.4] },
];

export function caminho(pontos: LonLat[]): string {
  return pontos.map((p, i) => `${i ? "L" : "M"}${projetar(p).join(",")}`).join("") + "Z";
}

function controle(a: LonLat, b: LonLat, curvatura: number): { x1: number; y1: number; x2: number; y2: number; cx: number; cy: number } {
  const [x1, y1] = projetar(a);
  const [x2, y2] = projetar(b);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  return { x1, y1, x2, y2, cx: mx - dy * curvatura, cy: my + dx * curvatura };
}

/** Curva suave entre dois pontos geográficos, levemente arqueada para a seta não cruzar rótulos. */
export function arco(a: LonLat, b: LonLat, curvatura = 0.18): string {
  const c = controle(a, b, curvatura);
  return `M${c.x1},${c.y1} Q${c.cx.toFixed(1)},${c.cy.toFixed(1)} ${c.x2},${c.y2}`;
}

/** Ponto médio (t = 0,5) do arco, para ancorar o rótulo do fluxo. */
export function pontoMedioArco(a: LonLat, b: LonLat, curvatura = 0.18): [number, number] {
  const c = controle(a, b, curvatura);
  return [0.25 * c.x1 + 0.5 * c.cx + 0.25 * c.x2, 0.25 * c.y1 + 0.5 * c.cy + 0.25 * c.y2];
}

/** Ponta do arco (t = 1) com o ângulo da tangente em graus, para desenhar a seta do fluxo. */
export function pontaArco(a: LonLat, b: LonLat, curvatura = 0.18): { x: number; y: number; angulo: number } {
  const c = controle(a, b, curvatura);
  return { x: c.x2, y: c.y2, angulo: (Math.atan2(c.y2 - c.cy, c.x2 - c.cx) * 180) / Math.PI };
}

/** Ponto do rótulo do fluxo: o meio do arco deslocado para fora da curva, longe da corda e dos chips das regiões. */
export function pontoRotuloArco(a: LonLat, b: LonLat, afastamento = 16, curvatura = 0.18): [number, number] {
  const c = controle(a, b, curvatura);
  const [mx, my] = pontoMedioArco(a, b, curvatura);
  const dx = mx - (c.x1 + c.x2) / 2;
  const dy = my - (c.y1 + c.y2) / 2;
  const n = Math.hypot(dx, dy) || 1;
  return [mx + (dx / n) * afastamento, my + (dy / n) * afastamento];
}

/**
 * Intensidade discreta pela faixa do percentil, a mesma regra publicada das
 * faixas: baixa (abaixo do 25º), central (25º a 75º) e alta (acima do 75º).
 * Três tons distinguíveis em vez de uma gradação contínua ilegível.
 */
export function intensidadeFaixa(percentil: number | null | undefined): number | null {
  if (percentil === null || percentil === undefined || !Number.isFinite(percentil)) return null;
  return percentil < 25 ? 0.12 : percentil > 75 ? 0.95 : 0.5;
}
