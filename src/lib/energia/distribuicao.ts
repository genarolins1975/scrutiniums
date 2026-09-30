/**
 * Estatística descritiva de distribuições do domínio Energia, espelho de
 * pipeline/energia/gold/comum.py: quantil tipo 7 (interpolação linear, o
 * padrão de R e NumPy) e posição percentual por rank médio. A interface só
 * recalcula o que a gold não publica pronto (classes de histograma, empates
 * num ponto); quando a gold publica um quantil, vale o da gold, e os dois
 * coincidem porque o método é o mesmo.
 *
 * Ausência (null, undefined, NaN, infinito) nunca entra na conta e é contada à
 * parte como "sem dado": zero é valor observado, ausência não é.
 *
 * Também ficam aqui as marcas de eixo legíveis (passos 1, 2, 2,5 e 5 vezes
 * potência de 10), usadas pelo histograma e pela dispersão.
 */
import { num } from "@/lib/energia/formato";

export type Valor = number | null | undefined;

/** Valores numéricos finitos, na ordem original. */
export function validos(xs: readonly Valor[]): number[] {
  const out: number[] = [];
  for (const x of xs) if (typeof x === "number" && Number.isFinite(x)) out.push(x);
  return out;
}

/** Quantos itens não têm valor (null, undefined ou não finito). */
export function contaSemDado(xs: readonly Valor[]): number {
  return xs.length - validos(xs).length;
}

function quantilOrdenado(v: readonly number[], q: number): number | null {
  if (!v.length) return null;
  if (v.length === 1) return v[0];
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

function confereQ(q: number): void {
  if (!(q >= 0 && q <= 1)) throw new RangeError(`quantil fora de [0, 1]: ${q}`);
}

/** Quantil tipo 7 (igual a `quantil` de comum.py). Sem valores válidos, null. */
export function quantil(xs: readonly Valor[], q: number): number | null {
  confereQ(q);
  return quantilOrdenado(validos(xs).sort((a, b) => a - b), q);
}

/** Vários quantis com uma única ordenação. */
export function quantis(xs: readonly Valor[], qs: readonly number[]): (number | null)[] {
  qs.forEach(confereQ);
  const v = validos(xs).sort((a, b) => a - b);
  return qs.map((q) => quantilOrdenado(v, q));
}

export type Resumo = {
  /** Observações com valor. */
  n: number;
  /** Observações sem valor (não entram em nenhuma estatística). */
  semDado: number;
  min: number | null;
  p10: number | null;
  p25: number | null;
  mediana: number | null;
  p75: number | null;
  p90: number | null;
  max: number | null;
};

export const CHAVES_QUANTIS = ["p10", "p25", "mediana", "p75", "p90"] as const;
export type ChaveQuantil = (typeof CHAVES_QUANTIS)[number];
export const Q_DE: Record<ChaveQuantil, number> = { p10: 0.1, p25: 0.25, mediana: 0.5, p75: 0.75, p90: 0.9 };
export const ROTULO_QUANTIL: Record<ChaveQuantil, string> = { p10: "P10", p25: "P25", mediana: "Mediana", p75: "P75", p90: "P90" };

export function resumo(xs: readonly Valor[]): Resumo {
  const v = validos(xs).sort((a, b) => a - b);
  const q = (p: number) => quantilOrdenado(v, p);
  return {
    n: v.length,
    semDado: xs.length - v.length,
    min: v.length ? v[0] : null,
    p10: q(0.1),
    p25: q(0.25),
    mediana: q(0.5),
    p75: q(0.75),
    p90: q(0.9),
    max: v.length ? v[v.length - 1] : null,
  };
}

/**
 * Posição percentual de `valor` na distribuição (0 a 100): fração de valores
 * menores mais metade dos empates, como `percentil_de` de comum.py.
 */
export function percentilDe(valor: Valor, xs: readonly Valor[]): number | null {
  const v = validos(xs);
  if (typeof valor !== "number" || !Number.isFinite(valor) || !v.length) return null;
  let menores = 0;
  let iguais = 0;
  for (const x of v) {
    if (x < valor) menores++;
    else if (x === valor) iguais++;
  }
  return (100 * (menores + 0.5 * iguais)) / v.length;
}

/** Quantas observações caem exatamente em `alvo` (ou a até `tolerancia` dele). */
export function contaEmpates(xs: readonly Valor[], alvo: number, tolerancia = 0): number {
  let k = 0;
  for (const x of validos(xs)) if (Math.abs(x - alvo) <= tolerancia) k++;
  return k;
}

/**
 * Valores repetidos com frequência suficiente para formar massa num ponto
 * (ex.: PLD no piso regulatório). Serve para descobrir o ponto; a barra
 * própria do histograma é pedida explicitamente pelo chamador, com rótulo.
 */
export function massasPontuais(
  xs: readonly Valor[],
  fracaoMinima = 0.05,
  contagemMinima = 2,
): { valor: number; contagem: number; fracao: number }[] {
  const v = validos(xs);
  if (!v.length) return [];
  const freq = new Map<number, number>();
  for (const x of v) freq.set(x, (freq.get(x) ?? 0) + 1);
  return Array.from(freq.entries())
    .filter(([, c]) => c >= contagemMinima && c / v.length >= fracaoMinima)
    .map(([valor, contagem]) => ({ valor, contagem, fracao: contagem / v.length }))
    .sort((a, b) => b.contagem - a.contagem || a.valor - b.valor);
}

/* ---------- Marcas de eixo ---------- */

/** Arredonda em 12 algarismos significativos: 3 × 0,1 vira 0,3 e não 0,30000000000000004. */
function limpa(v: number): number {
  return v === 0 ? 0 : Number(v.toPrecision(12));
}

/** Passo legível (1, 2, 2,5 ou 5 vezes potência de 10) para cerca de `alvo` intervalos. */
export function passoLegivel(amplitude: number, alvo = 5): number {
  const span = Math.abs(amplitude) || 1;
  const bruto = span / Math.max(1, alvo);
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  return limpa([1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => span / p <= alvo + 0.5) ?? mag * 10);
}

/** Marcas legíveis dentro de [min, max]. */
export function marcasEixo(min: number, max: number, alvo = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (max < min) [min, max] = [max, min];
  const passo = passoLegivel(max - min, alvo);
  const out: number[] = [];
  for (let k = Math.ceil(min / passo - 1e-9); k * passo <= max + passo * 1e-9; k++) out.push(limpa(k * passo));
  return out;
}

/** Menor número de casas decimais que escreve todas as marcas sem arredondar (até 4). */
export function casasMarcas(marcas: readonly number[]): number {
  for (let k = 0; k < 4; k++) {
    const f = Math.pow(10, k);
    if (marcas.every((v) => Math.abs(v * f - Math.round(v * f)) < 1e-6)) return k;
  }
  return 4;
}

/**
 * Domínio de eixo que começa e termina numa marca legível e contém todos os
 * valores. `incluirZero` estende até zero (barras e grandezas que partem do zero).
 * Amplitude nula (todos iguais) ganha folga simétrica.
 */
export function dominioLegivel(
  valores: readonly number[],
  { incluirZero = false, alvo = 5 }: { incluirZero?: boolean; alvo?: number } = {},
): { min: number; max: number; marcas: number[] } {
  const v = valores.filter((x) => Number.isFinite(x));
  if (!v.length) return { min: 0, max: 1, marcas: marcasEixo(0, 1, alvo) };
  let mn = Math.min(...v);
  let mx = Math.max(...v);
  if (incluirZero) {
    mn = Math.min(0, mn);
    mx = Math.max(0, mx);
  }
  if (mn === mx) {
    const folga = Math.abs(mn) * 0.1 || 1;
    mn -= folga;
    mx += folga;
    if (incluirZero && valores.every((x) => x >= 0)) mn = Math.max(0, mn);
  }
  const passo = passoLegivel(mx - mn, alvo);
  const min = limpa(Math.floor(mn / passo + 1e-9) * passo);
  const max = limpa(Math.ceil(mx / passo - 1e-9) * passo);
  return { min, max, marcas: marcasEixo(min, max, alvo) };
}

/* ---------- Histograma ---------- */

export type Classe = {
  inicio: number;
  fim: number;
  contagem: number;
  /** Só a última classe inclui o limite superior; as demais são [início, fim). */
  fechadaDireita: boolean;
};

export type MassaPontual = {
  valor: number;
  rotulo: string;
  explicacao?: string;
  contagem: number;
  /** Fração das observações com valor (0 a 1). */
  fracao: number;
};

export type DistribuicaoHistograma = {
  classes: Classe[];
  /** Empates num ponto contados à parte, fora das classes. */
  massas: MassaPontual[];
  /** Estatísticas sobre todas as observações com valor, massas incluídas. */
  resumo: Resumo;
  /** Observações fora das bordas definidas pelo chamador (nunca descartadas em silêncio). */
  foraDasClasses: { abaixo: number; acima: number };
  /** Menor largura de classe: com larguras diferentes, a altura é densidade por essa largura. */
  larguraReferencia: number;
  larguraUniforme: boolean;
};

export type OpcoesHistograma = {
  /** Classes de largura fixa, alinhadas em múltiplos da largura. */
  largura?: number;
  /** Bordas definidas, crescentes (n bordas = n − 1 classes). Tem prioridade sobre `largura`. */
  limites?: number[];
  /** Pontos com massa (piso, teto) contados à parte, com rótulo e explicação. */
  massas?: { valor: number; rotulo: string; explicacao?: string; tolerancia?: number }[];
  /** Proteção contra largura pequena demais para a amplitude (padrão 200). */
  maxClasses?: number;
};

/** Índice da classe que contém `v` (bordas crescentes; a última classe é fechada à direita). */
export function indiceClasse(bordas: readonly number[], v: number): number | null {
  const n = bordas.length - 1;
  if (n < 1 || v < bordas[0] || v > bordas[n]) return null;
  if (v === bordas[n]) return n - 1;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (bordas[m] <= v) lo = m;
    else hi = m - 1;
  }
  return lo;
}

export function montaHistograma(xs: readonly Valor[], opcoes: OpcoesHistograma): DistribuicaoHistograma {
  const todos = validos(xs);
  const res = resumo(xs);
  const pedidas = opcoes.massas ?? [];
  const massas: MassaPontual[] = pedidas.map((m) => ({ valor: m.valor, rotulo: m.rotulo, explicacao: m.explicacao, contagem: 0, fracao: 0 }));
  const resto: number[] = [];
  for (const x of todos) {
    const k = pedidas.findIndex((m) => Math.abs(x - m.valor) <= (m.tolerancia ?? 0));
    if (k >= 0) massas[k].contagem++;
    else resto.push(x);
  }
  for (const m of massas) m.fracao = todos.length ? m.contagem / todos.length : 0;

  let bordas: number[];
  if (opcoes.limites) {
    bordas = [...opcoes.limites];
    if (bordas.length < 2) throw new Error("limites do histograma: são necessárias ao menos duas bordas");
    for (let i = 1; i < bordas.length; i++) {
      if (!(bordas[i] > bordas[i - 1])) throw new Error("limites do histograma: bordas precisam ser estritamente crescentes");
    }
  } else if (opcoes.largura !== undefined) {
    const w = opcoes.largura;
    if (!(w > 0) || !Number.isFinite(w)) throw new Error("largura de classe precisa ser positiva");
    if (!resto.length) bordas = [];
    else {
      const mn = Math.min(...resto);
      const mx = Math.max(...resto);
      // tolerância relativa: 0,3 / 0,1 = 2,9999999999999996 no ponto flutuante e não pode virar classe 2
      let k0 = Math.floor(mn / w + 1e-9);
      if (limpa(k0 * w) > mn) k0 -= 1; // a tolerância nunca pode deixar o mínimo abaixo da primeira borda
      let k1 = Math.floor(mx / w + 1e-9) + 1;
      if (limpa(k1 * w) < mx) k1 += 1;
      if (k1 - k0 > (opcoes.maxClasses ?? 200)) {
        throw new Error(`largura ${w} gera ${k1 - k0} classes (limite ${opcoes.maxClasses ?? 200})`);
      }
      // o máximo cai na última classe, fechada à direita: se ele é exatamente uma borda, não sobra classe vazia
      if (k1 - 1 > k0 && limpa((k1 - 1) * w) === mx) k1 -= 1;
      bordas = [];
      for (let k = k0; k <= k1; k++) bordas.push(limpa(k * w));
    }
  } else {
    throw new Error("histograma: informe `largura` ou `limites`");
  }

  const classes: Classe[] = [];
  for (let i = 0; i + 1 < bordas.length; i++) {
    classes.push({ inicio: bordas[i], fim: bordas[i + 1], contagem: 0, fechadaDireita: i + 2 === bordas.length });
  }
  const fora = { abaixo: 0, acima: 0 };
  for (const x of resto) {
    const k = indiceClasse(bordas, x);
    if (k === null) {
      if (x < bordas[0]) fora.abaixo++;
      else fora.acima++;
    } else classes[k].contagem++;
  }
  const larguras = classes.map((c) => c.fim - c.inicio);
  const ref = larguras.length ? Math.min(...larguras) : opcoes.largura ?? 1;
  const uniforme = larguras.every((l) => Math.abs(l - ref) <= ref * 1e-9);
  return { classes, massas, resumo: res, foraDasClasses: fora, larguraReferencia: limpa(ref), larguraUniforme: uniforme };
}

/**
 * Altura da barra: contagem quando as larguras são iguais; com larguras
 * diferentes, contagem por largura de referência (densidade). Sem isso uma
 * classe larga parece ter mais observações só por ser larga.
 */
export function alturaClasse(c: Classe, larguraReferencia: number): number {
  const w = c.fim - c.inicio;
  return w > 0 ? (c.contagem * larguraReferencia) / w : 0;
}

/* ---------- Texto ---------- */

/** Valor com unidade, ou "sem dado". "%" cola no número; demais unidades vêm após espaço. */
export function textoValor(v: Valor, casas: number, unidade: string): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "sem dado";
  const n = num(v, casas);
  if (!unidade) return n;
  if (unidade === "%") return `${n}%`;
  if (unidade === "R$") return `R$ ${n}`;
  return `${n} ${unidade}`;
}

/** Percentual de uma fração 0 a 1, com casas adaptadas (0,4% não vira 0%). */
export function textoFracao(f: number): string {
  const p = f * 100;
  if (p > 0 && p < 1) return `${num(p, 2)}%`;
  return `${num(p, 1)}%`;
}
