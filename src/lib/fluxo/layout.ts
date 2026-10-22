/**
 * Layout de um diagrama de fluxo (faixas proporcionais ao valor), sem biblioteca.
 *
 * Cada nó ocupa uma coluna; a altura do nó e a espessura de cada faixa são proporcionais ao valor,
 * na mesma escala para o diagrama inteiro. A ordem dos nós dentro da coluna é a ordem recebida, e as
 * faixas saem e chegam empilhadas na ordem dos nós de destino e de origem, para não se cruzarem à toa.
 * O módulo não decide nada sobre o dado: só desenha o que recebe e confere que cada nó fecha.
 */

export type TipoFluxo = 'entrada' | 'tronco' | 'outro-ente' | 'gasto' | 'resultado' | 'diferenca';

export interface NoFluxo {
  id: string;
  nome: string;
  valor: number;
  coluna: number;
  tipo: TipoFluxo;
  /** Linha curta sob o valor (ex.: "43% do gasto", "dedução do Anexo 03"). */
  nota?: string;
  /** Composição do nó, mostrada no detalhe e na tabela. */
  partes?: [string, number][];
}

export interface EloFluxo {
  de: string;
  para: string;
  valor: number;
}

export interface NoPosicionado extends NoFluxo {
  x: number;
  y: number;
  altura: number;
  /** Posição vertical do rótulo, depois de afastar os rótulos que se sobrepõem. */
  yRotulo: number;
  lado: 'esquerda' | 'direita';
}

export interface EloPosicionado extends EloFluxo {
  tipo: TipoFluxo;
  caminho: string;
  espessura: number;
}

export interface OpcoesLayout {
  largura: number;
  altura: number;
  margemEsquerda: number;
  margemDireita: number;
  larguraNo?: number;
  espaco?: number;
  /** Distância mínima entre rótulos vizinhos de uma mesma coluna. */
  passoRotulo?: number;
  topo?: number;
}

export interface LayoutFluxo {
  largura: number;
  altura: number;
  escala: number;
  larguraNo: number;
  nos: NoPosicionado[];
  elos: EloPosicionado[];
}

const TOLERANCIA_RELATIVA = 1e-6;

/** Confere que cada nó intermediário recebe o mesmo que entrega. Devolve as divergências. */
export function conferirFluxo(nos: NoFluxo[], elos: EloFluxo[]): string[] {
  const problemas: string[] = [];
  const ids = new Set(nos.map(n => n.id));
  for (const e of elos) {
    if (!ids.has(e.de) || !ids.has(e.para)) problemas.push(`Elo com nó inexistente: ${e.de} → ${e.para}`);
    if (!(e.valor >= 0) || !Number.isFinite(e.valor)) problemas.push(`Elo com valor inválido: ${e.de} → ${e.para}`);
  }
  for (const n of nos) {
    const entra = elos.filter(e => e.para === n.id).reduce((s, e) => s + e.valor, 0);
    const sai = elos.filter(e => e.de === n.id).reduce((s, e) => s + e.valor, 0);
    const tol = Math.max(1, Math.abs(n.valor) * TOLERANCIA_RELATIVA);
    if (entra > 0 && Math.abs(entra - n.valor) > tol) problemas.push(`${n.id}: entra ${entra}, vale ${n.valor}`);
    if (sai > 0 && Math.abs(sai - n.valor) > tol) problemas.push(`${n.id}: sai ${sai}, vale ${n.valor}`);
    if (entra === 0 && sai === 0) problemas.push(`${n.id}: nó sem ligação`);
  }
  return problemas;
}

/** Afasta rótulos que se sobrepõem, preservando a ordem e mantendo-os o mais perto possível do nó. */
export function afastarRotulos(centros: number[], passo: number, minimo: number, maximo: number): number[] {
  const y = centros.map(c => Math.max(minimo, c));
  for (let i = 1; i < y.length; i++) if (y[i] < y[i - 1] + passo) y[i] = y[i - 1] + passo;
  // Se a coluna estourou embaixo, sobe o bloco a partir do fim, sem passar do topo.
  if (y.length && y[y.length - 1] > maximo) {
    y[y.length - 1] = maximo;
    for (let i = y.length - 2; i >= 0; i--) if (y[i] > y[i + 1] - passo) y[i] = y[i + 1] - passo;
    if (y[0] < minimo) {
      // Espaço insuficiente: distribui por igual e aceita a aproximação.
      const passoReal = y.length > 1 ? (maximo - minimo) / (y.length - 1) : 0;
      return y.map((_, i) => minimo + i * passoReal);
    }
  }
  return y;
}

function faixa(x0: number, y0: number, x1: number, y1: number, h: number): string {
  const xm = (x0 + x1) / 2;
  const f = (n: number) => Math.round(n * 100) / 100;
  return `M${f(x0)},${f(y0)}C${f(xm)},${f(y0)} ${f(xm)},${f(y1)} ${f(x1)},${f(y1)}`
    + `L${f(x1)},${f(y1 + h)}C${f(xm)},${f(y1 + h)} ${f(xm)},${f(y0 + h)} ${f(x0)},${f(y0 + h)}Z`;
}

export function layoutFluxo(nos: NoFluxo[], elos: EloFluxo[], o: OpcoesLayout): LayoutFluxo {
  const larguraNo = o.larguraNo ?? 12;
  const espaco = o.espaco ?? 12;
  const passoRotulo = o.passoRotulo ?? 34;
  const topo = o.topo ?? 8;
  const colunas = Math.max(...nos.map(n => n.coluna)) + 1;
  const porColuna = Array.from({ length: colunas }, (_, c) => nos.filter(n => n.coluna === c));
  const util = o.altura - topo * 2;
  // Mesma escala para o diagrama inteiro: a coluna mais cheia (com os espaços) cabe na altura útil.
  const escala = Math.min(...porColuna.filter(c => c.length).map(c => {
    const soma = c.reduce((s, n) => s + n.valor, 0);
    return (util - espaco * (c.length - 1)) / soma;
  }));
  const larguraUtil = o.largura - o.margemEsquerda - o.margemDireita - larguraNo;
  const xColuna = (c: number) => o.margemEsquerda + (colunas > 1 ? (c * larguraUtil) / (colunas - 1) : 0);

  const pos = new Map<string, NoPosicionado>();
  porColuna.forEach((coluna, c) => {
    const alturas = coluna.map(n => Math.max(n.valor * escala, 1.5));
    const total = alturas.reduce((s, h) => s + h, 0) + espaco * (coluna.length - 1);
    let y = topo + (util - total) / 2;
    const centros: number[] = [];
    coluna.forEach((n, i) => {
      pos.set(n.id, { ...n, x: xColuna(c), y, altura: alturas[i], yRotulo: 0, lado: c === 0 ? 'esquerda' : 'direita' });
      centros.push(y + alturas[i] / 2);
      y += alturas[i] + espaco;
    });
    // Só a primeira e a última coluna têm rótulos empilhados ao lado; nas do meio o rótulo fica no nó.
    const ajustados = c === 0 || c === colunas - 1
      ? afastarRotulos(centros, passoRotulo, topo + passoRotulo / 2 - 4, o.altura - passoRotulo / 2)
      : centros;
    coluna.forEach((n, i) => { pos.get(n.id)!.yRotulo = ajustados[i]; });
  });

  const ordem = new Map(nos.map((n, i) => [n.id, i]));
  const saida = new Map<string, number>();
  const chegada = new Map<string, number>();
  const ordenados = [...elos].sort((a, b) =>
    ordem.get(a.de)! - ordem.get(b.de)! || ordem.get(a.para)! - ordem.get(b.para)!);
  const offsetSaida = new Map<EloFluxo, number>();
  for (const e of ordenados) {
    const h = e.valor * escala;
    offsetSaida.set(e, saida.get(e.de) ?? 0);
    saida.set(e.de, (saida.get(e.de) ?? 0) + h);
  }
  const offsetChegada = new Map<EloFluxo, number>();
  for (const e of [...elos].sort((a, b) => ordem.get(a.para)! - ordem.get(b.para)! || ordem.get(a.de)! - ordem.get(b.de)!)) {
    const h = e.valor * escala;
    offsetChegada.set(e, chegada.get(e.para) ?? 0);
    chegada.set(e.para, (chegada.get(e.para) ?? 0) + h);
  }

  const posicionados: EloPosicionado[] = ordenados.map(e => {
    const a = pos.get(e.de)!, b = pos.get(e.para)!;
    const h = e.valor * escala;
    // A cor da faixa segue o destino, exceto o que sai de uma fonte de entrada.
    const tipo: TipoFluxo = a.tipo === 'entrada' || a.tipo === 'resultado' || a.tipo === 'diferenca' ? a.tipo : b.tipo;
    return { ...e, tipo, espessura: h, caminho: faixa(a.x + larguraNo, a.y + offsetSaida.get(e)!, b.x, b.y + offsetChegada.get(e)!, h) };
  });

  return { largura: o.largura, altura: o.altura, escala, larguraNo, nos: nos.map(n => pos.get(n.id)!), elos: posicionados };
}
