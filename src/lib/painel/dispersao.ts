/**
 * Lógica pura do gráfico de dispersão do domínio Energia (GraficoDispersao):
 * separação entre pontos desenháveis e pontos sem dado, ordem de leitura por
 * X (a mesma do teclado e da tabela), limite de destaques, projeção da reta
 * publicada pelo pipeline dentro da área do gráfico e afastamento de rótulos
 * diretos. Fica fora do componente para ser testada em node.
 *
 * Regra de ausência: ponto sem X ou sem Y não é desenhado (desenhá-lo em zero
 * inventaria uma observação) e é contado como "sem dado" no rodapé.
 */

export type PontoDispersao = {
  /** Identificador estável (código da entidade). */
  id: string;
  /** Nome da entidade, exibido na dica, no rótulo direto e na tabela. */
  rotulo: string;
  x: number | null | undefined;
  y: number | null | undefined;
};

export type PontoValido = PontoDispersao & { x: number; y: number };

/** Reta com coeficientes calculados no pipeline (a interface não ajusta modelo). */
export type RetaDispersao = {
  inclinacao: number;
  intercepto: number;
  /** Nome do ajuste, exibido junto da reta (ex.: "Reta de mínimos quadrados"). */
  rotulo: string;
  /** Medidas do ajuste já formatadas pelo chamador (ex.: "R² = 0,18; n = 52"). */
  detalhe?: string;
};

export const MAX_DESTAQUES = 4;

const finito = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function temXY(p: PontoDispersao): p is PontoValido {
  return finito(p.x) && finito(p.y);
}

const colador = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/** Compara números com ausência sempre por último (em qualquer direção de leitura). */
function comparaNulosAoFim(a: number | null | undefined, b: number | null | undefined): number {
  const va = finito(a);
  const vb = finito(b);
  if (va && vb) return (a as number) - (b as number);
  if (va) return -1;
  if (vb) return 1;
  return 0;
}

/** Ordem de leitura: X crescente, depois Y, depois nome; ausências ao fim. */
export function comparaPorX(a: PontoDispersao, b: PontoDispersao): number {
  return comparaNulosAoFim(a.x, b.x) || comparaNulosAoFim(a.y, b.y) || colador.compare(a.rotulo, b.rotulo) || colador.compare(a.id, b.id);
}

/** Pontos desenháveis (em ordem de X) e pontos sem X ou Y (em ordem de nome). */
export function separaPontos(pontos: readonly PontoDispersao[]): { validos: PontoValido[]; semDado: PontoDispersao[] } {
  const validos: PontoValido[] = [];
  const semDado: PontoDispersao[] = [];
  for (const p of pontos) {
    if (temXY(p)) validos.push(p);
    else semDado.push(p);
  }
  validos.sort(comparaPorX);
  semDado.sort((a, b) => colador.compare(a.rotulo, b.rotulo));
  return { validos, semDado };
}

/**
 * Todas as linhas da tabela equivalente: primeiro os pontos desenhados, na
 * mesma ordem do teclado; depois os incompletos (inclusive os que têm X mas
 * não Y), que não estão no gráfico e não podem se intercalar com os demais.
 */
export function ordenaParaTabela(pontos: readonly PontoDispersao[]): PontoDispersao[] {
  const validos = pontos.filter(temXY).sort(comparaPorX);
  const resto = pontos.filter((p) => !temXY(p)).sort(comparaPorX);
  return [...validos, ...resto];
}

/** Até quatro destaques, sem repetição, na ordem pedida pelo chamador. */
export function limitaDestaques(ids: readonly string[] | undefined, max = MAX_DESTAQUES): string[] {
  const out: string[] = [];
  for (const id of ids ?? []) {
    if (!out.includes(id)) out.push(id);
    if (out.length === max) break;
  }
  return out;
}

/**
 * Trecho da reta y = intercepto + inclinação · x dentro do intervalo de X
 * observado (sem extrapolar) e recortado ao domínio de Y do gráfico.
 * Null quando a reta não cruza a área visível ou os coeficientes não são finitos.
 */
export function segmentoReta(
  reta: Pick<RetaDispersao, "inclinacao" | "intercepto">,
  [xa, xb]: readonly [number, number],
  [ymin, ymax]: readonly [number, number],
): { x0: number; y0: number; x1: number; y1: number } | null {
  const { inclinacao: b, intercepto: a } = reta;
  if (![a, b, xa, xb, ymin, ymax].every(finito)) return null;
  let x0 = Math.min(xa, xb);
  let x1 = Math.max(xa, xb);
  if (b === 0) {
    if (a < ymin || a > ymax) return null;
  } else {
    const xc = (ymin - a) / b;
    const xd = (ymax - a) / b;
    x0 = Math.max(x0, Math.min(xc, xd));
    x1 = Math.min(x1, Math.max(xc, xd));
    if (x0 > x1) return null;
  }
  return { x0, y0: a + b * x0, x1, y1: a + b * x1 };
}

/**
 * Índice do alvo mais próximo de (px, py) dentro de `raio` (em pixels), ou
 * null. Com raio de 22 px, cada ponto isolado tem alvo de 44 px de diâmetro.
 */
export function maisProximo(alvos: readonly { x: number; y: number }[], px: number, py: number, raio: number): number | null {
  let melhor: number | null = null;
  let dMin = raio * raio;
  alvos.forEach((a, i) => {
    const d = (a.x - px) ** 2 + (a.y - py) ** 2;
    if (d <= dMin) {
      dMin = d;
      melhor = i;
    }
  });
  return melhor;
}

/**
 * Afasta verticalmente rótulos que colidem, preservando a ordem de cima para
 * baixo e mantendo todos entre `topo` e `base`. Devolve as novas posições na
 * mesma ordem de entrada.
 */
export function afastaRotulos(ys: readonly number[], distancia: number, topo: number, base: number): number[] {
  const ordem = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y || a.i - b.i);
  const pos = ordem.map((o) => Math.min(base, Math.max(topo, o.y)));
  for (let k = 1; k < pos.length; k++) if (pos[k] - pos[k - 1] < distancia) pos[k] = pos[k - 1] + distancia;
  // o que passou da base volta para cima, empurrando os anteriores
  if (pos.length && pos[pos.length - 1] > base) {
    pos[pos.length - 1] = base;
    for (let k = pos.length - 2; k >= 0; k--) if (pos[k + 1] - pos[k] < distancia) pos[k] = pos[k + 1] - distancia;
  }
  const out = new Array<number>(ys.length);
  ordem.forEach((o, k) => (out[o.i] = pos[k]));
  return out;
}

/** Largura aproximada de um texto em px (fonte de 11 px), para decidir o lado do rótulo. */
export function larguraTexto(texto: string, tamanho = 11): number {
  return texto.length * tamanho * 0.56;
}
