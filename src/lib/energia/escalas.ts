/**
 * Escalas, classes e ordenação dos gráficos e mapas do Setor Elétrico.
 *
 * Lógica pura (sem React, testável em node) compartilhada por GraficoBarras,
 * GraficoPontos e pelos mapas coropléticos:
 *
 * - ticks "bonitos" (a mesma regra de passo 1, 2, 2,5, 5 e 10 de GraficoLinhas,
 *   agora exportada) com rótulo que respeita as casas do passo: 2,5 não vira "3";
 * - domínio de barras com zero obrigatório: barra que não parte de zero
 *   exagera a diferença entre categorias (gramática de gráficos, seção 8.2);
 * - empilhamento divergente (positivos para cima, negativos para baixo) que
 *   marca a pilha como incompleta quando falta uma parte, em vez de somar zero;
 * - quebras de classe para mapas (quantis, intervalos iguais, quebras fixas do
 *   chamador) com rótulos pt-BR e a classe de um valor;
 * - ordenação com nulos sempre no fim, em qualquer direção, e nomes comparados
 *   na collation pt-BR ("Águas" antes de "Cemig", não depois de "Z").
 *
 * Três estados distintos, nunca confundidos: número (inclusive zero), ausência
 * (null ou undefined, "sem dado") e "não se aplica" (NAO_SE_APLICA).
 */
import { num, pct, sinal, unidadeConcordante } from "@/lib/energia/formato";

/* ---------- números ---------- */

/** Número utilizável: finito e não nulo. Ausência nunca vira zero. */
export function valido(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Remove resíduo de ponto flutuante (0,1 + 0,2) e o zero negativo. */
function limpa(v: number): number {
  const r = Number(v.toFixed(10));
  return r === 0 ? 0 : r;
}

function arredonda(v: number, casas: number): number {
  const f = Math.pow(10, casas);
  return limpa(Math.round(v * f) / f);
}

/* ---------- ticks e domínio ---------- */

/** Passo "bonito" (1, 2, 2,5, 5 ou 10 vezes uma potência de dez) para cerca de n intervalos. */
export function passoBonito(amplitude: number, n = 4): number {
  const s = Math.abs(amplitude) || 1;
  const bruto = s / n;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => s / p <= n + 0.5) ?? mag * 10;
}

/** Ticks múltiplos de um passo dado, de min a max (inclusive, com tolerância de arredondamento). */
export function ticksComPasso(min: number, max: number, passo: number): number[] {
  if (!valido(min) || !valido(max) || !valido(passo) || passo <= 0) return [];
  const [a, b] = min <= max ? [min, max] : [max, min];
  const ini = Math.ceil(a / passo - 1e-9);
  const out: number[] = [];
  for (let k = ini; k * passo <= b + passo * 1e-9 && out.length < 1000; k++) out.push(limpa(k * passo));
  return out;
}

/** Ticks "bonitos" entre min e max, a mesma regra de GraficoLinhas. */
export function ticksBonitos(min: number, max: number, n = 4): number[] {
  return ticksComPasso(min, max, passoBonito(max - min, n));
}

/** Casas decimais necessárias para escrever o passo sem arredondar (2,5 → 1; 0,25 → 2; 5 → 0). */
export function casasDoPasso(passo: number): number {
  for (let c = 0; c <= 8; c++) {
    const x = passo * Math.pow(10, c);
    if (Math.abs(x - Math.round(x)) < 1e-6 * Math.max(1, Math.abs(x))) return c;
  }
  return 8;
}

/** Rótulo de tick em pt-BR com as casas do passo e sinal de menos tipográfico. */
export function rotuloTick(v: number, passo: number): string {
  return num(limpa(v), casasDoPasso(passo));
}

/**
 * Marcas de eixo que cabem na largura: o menor passo inteiro (de 1 em 1, de 2 em 2, de 3 em 3...) que deixa `folga` px entre os
 * rótulos vizinhos. Parte do zero (ou da primeira marca), de modo que o que fica continua sendo múltiplo regular do passo:
 * "0, 50.000, 100.000" e não "0, 25.000, 75.000". `tamanho` é a extensão do rótulo no sentido do eixo, em px (largura do texto no
 * eixo horizontal, altura da linha no vertical). Nunca devolve menos de uma marca.
 */
export function ticksQueCabem(ticks: readonly number[], pos: (v: number) => number, tamanho: (v: number) => number, folga = 8): number[] {
  if (ticks.length <= 2) return [...ticks];
  const base = Math.max(0, ticks.indexOf(0));
  for (let s = 1; s < ticks.length; s++) {
    const ficam = ticks.filter((_, i) => (((i - base) % s) + s) % s === 0);
    let cabe = true;
    for (let k = 1; k < ficam.length && cabe; k++) {
      const distancia = Math.abs(pos(ficam[k]) - pos(ficam[k - 1]));
      cabe = distancia >= (tamanho(ficam[k]) + tamanho(ficam[k - 1])) / 2 + folga;
    }
    if (cabe) return ficam;
  }
  return [ticks[base]];
}

/**
 * Largura média de um caractere do rótulo de categoria a 12 px, em px, para decidir onde cortar o nome: 6,9 para texto comum e 8,2 quando
 * o nome é quase todo em maiúsculas ("MATRINCHA TRANSMISSORA DE ENERGIA", "NEOENERGIA BRASÍLIA"), que é mais largo e passava da borda.
 */
export function pxCaractere12(texto: string): number {
  const letras = texto.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (!letras.length) return 6.9;
  const maiusculas = letras.replace(/[^A-ZÀ-Þ]/g, "").length;
  return maiusculas / letras.length > 0.6 ? 8.2 : 6.9;
}

export type Dominio = { min: number; max: number; passo: number; ticks: number[] };

/**
 * Domínio "bonito" que contém todos os valores válidos, estendido até
 * múltiplos do passo. Com `zero`, o zero entra obrigatoriamente (barras).
 * Nulos são ignorados; sem nenhum valor válido, o domínio é 0 a 1.
 */
export function dominioBonito(valores: readonly (number | null | undefined)[], { zero = false, n = 4 }: { zero?: boolean; n?: number } = {}): Dominio {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of valores) {
    if (!valido(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === Infinity) {
    lo = 0;
    hi = 1;
  }
  if (zero) {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
  }
  if (lo === hi) {
    // valor único: abre uma faixa em volta sem inventar sinal (0 vira 0 a 1)
    const folga = Math.abs(lo) * 0.1 || 1;
    if (zero || lo === 0) {
      if (lo >= 0) hi = lo + folga;
      else lo = lo - folga;
    } else {
      lo -= folga;
      hi += folga;
    }
  }
  const passo = passoBonito(hi - lo, n);
  const min = limpa(Math.floor(lo / passo + 1e-9) * passo);
  const max = limpa(Math.ceil(hi / passo - 1e-9) * passo);
  return { min, max, passo, ticks: ticksComPasso(min, max, passo) };
}

/** Domínio de barras: zero sempre presente, negativos suportados. */
export function dominioComZero(valores: readonly (number | null | undefined)[], n = 4): Dominio {
  return dominioBonito(valores, { zero: true, n });
}

export type EscalaLinear = ((v: number) => number) & {
  dominio: [number, number];
  faixa: [number, number];
  inversa: (p: number) => number;
};

/** Escala linear do domínio para a faixa em pixels (a faixa pode ser invertida, como no eixo Y do SVG). */
export function escalaLinear(dominio: [number, number], faixa: [number, number]): EscalaLinear {
  const [d0, d1] = dominio;
  const [r0, r1] = faixa;
  const span = d1 - d0 || 1;
  const f = ((v: number) => r0 + ((v - d0) / span) * (r1 - r0)) as EscalaLinear;
  f.dominio = [d0, d1];
  f.faixa = [r0, r1];
  f.inversa = (p: number) => d0 + ((p - r0) / (r1 - r0 || 1)) * span;
  return f;
}

/* ---------- empilhamento ---------- */

export type Segmento = { inicio: number; fim: number } | null;
export type Pilha = {
  /** Um segmento por componente, na ordem recebida; null quando a parte não tem dado. */
  segmentos: Segmento[];
  /** Soma das partes positivas presentes. */
  positivo: number;
  /** Soma das partes negativas presentes (≤ 0). */
  negativo: number;
  /** Total das partes presentes; só é o total verdadeiro quando `completo`. */
  total: number;
  /** Falso quando falta alguma parte: o total não deve ser exibido como se fosse o real. */
  completo: boolean;
};

/**
 * Empilhamento divergente de uma composição aditiva: positivos se acumulam a
 * partir de zero para cima, negativos para baixo. Parte ausente não vira
 * segmento de tamanho zero: fica null e a pilha é marcada como incompleta.
 */
export function empilhar(valores: readonly (number | null | undefined)[]): Pilha {
  let pos = 0;
  let neg = 0;
  let completo = true;
  const segmentos = valores.map((v): Segmento => {
    if (!valido(v)) {
      completo = false;
      return null;
    }
    if (v >= 0) {
      const s = { inicio: pos, fim: limpa(pos + v) };
      pos = s.fim;
      return s;
    }
    const s = { inicio: neg, fim: limpa(neg + v) };
    neg = s.fim;
    return s;
  });
  return { segmentos, positivo: pos, negativo: neg, total: limpa(pos + neg), completo };
}

/* ---------- formatação de valores de gráfico ---------- */

export const SEM_DADO_TEXTO = "sem dado";

/**
 * Valor com unidade em pt-BR. Ausência vira "sem dado"; o arredondamento
 * acontece antes do sinal, para que −0,04 com uma casa apareça como "0,0" e
 * não como "−0,0". Percentual cola o símbolo ("12,3%"); demais unidades usam
 * espaço não separável.
 */
export function formatarValor(v: number | null | undefined, casas = 1, unidade = ""): string {
  if (!valido(v)) return SEM_DADO_TEXTO;
  const r = arredonda(v, casas);
  if (unidade === "%") return pct(r, casas);
  return unidade ? `${num(r, casas)} ${unidadeConcordante(r, unidade)}` : num(r, casas);
}

/** Diferença com sinal explícito (+ ou −, tipográfico) e unidade; zero após arredondar não leva sinal. */
export function formatarDiferenca(v: number | null | undefined, casas = 1, unidade = ""): string {
  if (!valido(v)) return SEM_DADO_TEXTO;
  const r = arredonda(v, casas);
  return sinal(r, casas, unidade ? ` ${unidade}` : "");
}

/** Diferença entre valor e referência; null quando qualquer um dos dois falta. */
export function diferencaPar(valor: number | null | undefined, referencia: number | null | undefined): number | null {
  return valido(valor) && valido(referencia) ? limpa(valor - referencia) : null;
}

/** Sentido da diferença na precisão exibida: o texto nunca contradiz o número mostrado. */
export function sentidoDiferenca(dif: number | null | undefined, casas = 1): "acima" | "abaixo" | "igual" | null {
  if (!valido(dif)) return null;
  const r = arredonda(dif, casas);
  return r > 0 ? "acima" : r < 0 ? "abaixo" : "igual";
}

/* ---------- ordenação ---------- */

export type Direcao = "asc" | "desc";

const COLLATOR = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/**
 * Ordena uma cópia dos itens pela chave. Ausência (null, undefined, NaN) vai
 * sempre para o fim, nas duas direções: inverter a ordem nunca põe "sem dado"
 * no topo como se fosse o maior ou o menor valor. Empates mantêm a ordem
 * original (ou seguem o desempate, se informado). Texto usa collation pt-BR.
 */
export function ordenarComNulos<T>(
  itens: readonly T[],
  chave: (t: T) => number | string | null | undefined,
  direcao: Direcao = "asc",
  desempate?: (t: T) => string,
): T[] {
  const s = direcao === "desc" ? -1 : 1;
  const ausente = (k: number | string | null | undefined) => k === null || k === undefined || (typeof k === "number" && !Number.isFinite(k));
  return itens
    .map((t, i) => ({ t, i, k: chave(t) }))
    .sort((a, b) => {
      const na = ausente(a.k);
      const nb = ausente(b.k);
      if (na !== nb) return na ? 1 : -1;
      if (!na && !nb) {
        const c =
          typeof a.k === "number" && typeof b.k === "number" ? a.k - b.k : COLLATOR.compare(String(a.k), String(b.k));
        if (c !== 0) return s * c;
      }
      if (desempate) {
        const d = COLLATOR.compare(desempate(a.t), desempate(b.t));
        if (d !== 0) return d;
      }
      return a.i - b.i;
    })
    .map((x) => x.t);
}

export type CriterioPares = "valor" | "referencia" | "diferenca" | "nome";
export type ParBase = { rotulo: string; valor: number | null | undefined; referencia: number | null | undefined };

/** Ordena pares realizado × referência por valor, referência, diferença ou nome (nulos no fim). */
export function ordenarPares<T extends ParBase>(itens: readonly T[], por: CriterioPares, direcao: Direcao): T[] {
  const chave =
    por === "nome"
      ? (t: T) => t.rotulo
      : por === "diferenca"
        ? (t: T) => diferencaPar(t.valor, t.referencia)
        : por === "referencia"
          ? (t: T) => t.referencia
          : (t: T) => t.valor;
  return ordenarComNulos(itens, chave, direcao, por === "nome" ? undefined : (t) => t.rotulo);
}

/* ---------- classes de mapa ---------- */

export const SEM_DADO = "sem-dado" as const;
export const NAO_SE_APLICA = "nao-se-aplica" as const;

/** Valor de mapa: número (zero inclusive), ausência ou "não se aplica" (ex.: área sem a atividade). */
export type ValorClassificavel = number | null | undefined | typeof NAO_SE_APLICA;
export type MetodoClasses = "quantis" | "intervalos-iguais" | "fixas";

export const ROTULO_METODO: Record<MetodoClasses, string> = {
  quantis: "Quantis: classes com número parecido de entidades",
  "intervalos-iguais": "Intervalos iguais: classes com a mesma largura",
  fixas: "Quebras fixas definidas pela metodologia",
};

export type Classe = {
  indice: number;
  /** Limite inferior (inclusive); null quando a classe é aberta para baixo. */
  inferior: number | null;
  /** Limite superior (exclusive); null quando a classe é aberta para cima. */
  superior: number | null;
  rotulo: string;
  /** Quantos valores válidos caem na classe (quantos elementos do mapa ela pinta). */
  contagem: number;
};

export type Classificacao = {
  metodo: MetodoClasses;
  /** Limites internos em ordem estritamente crescente: a classe i vai de cortes[i−1] (inclusive) a cortes[i] (exclusive). */
  cortes: number[];
  classes: Classe[];
  minimo: number | null;
  maximo: number | null;
  validos: number;
  semDado: number;
  naoSeAplica: number;
};

export type OpcoesClasses = {
  /** Casas dos rótulos; os cortes de quantis e intervalos iguais são arredondados a elas, para que rótulo e classificação digam o mesmo. */
  casas?: number;
  /** Formatação do limite no rótulo (ex.: v => pct(v, 1)); padrão num(v, casas). */
  formatar?: (v: number) => string;
};

/** Quantil tipo 7 (interpolação linear, o padrão do R e do numpy) de valores já ordenados. */
export function quantil(ordenados: readonly number[], p: number): number {
  const n = ordenados.length;
  if (!n) return NaN;
  const pos = (n - 1) * Math.min(1, Math.max(0, p));
  const i = Math.floor(pos);
  const f = pos - i;
  return i + 1 < n ? ordenados[i] + f * (ordenados[i + 1] - ordenados[i]) : ordenados[i];
}

function resumo(valores: readonly ValorClassificavel[]) {
  const nums: number[] = [];
  let semDado = 0;
  let naoSeAplica = 0;
  for (const v of valores) {
    if (v === NAO_SE_APLICA) naoSeAplica++;
    else if (valido(v)) nums.push(v);
    else semDado++;
  }
  nums.sort((a, b) => a - b);
  return { nums, semDado, naoSeAplica };
}

function montar(
  metodo: MetodoClasses,
  cortes: number[],
  r: ReturnType<typeof resumo>,
  { casas = 1, formatar }: OpcoesClasses,
): Classificacao {
  const f = formatar ?? ((v: number) => num(v, casas));
  const minimo = r.nums.length ? r.nums[0] : null;
  const maximo = r.nums.length ? r.nums[r.nums.length - 1] : null;
  let classes: Classe[];
  if (!cortes.length) {
    classes =
      minimo === null || maximo === null
        ? []
        : [{ indice: 0, inferior: null, superior: null, rotulo: minimo === maximo ? f(minimo) : `${f(minimo)} a ${f(maximo)}`, contagem: 0 }];
  } else {
    // extremos abertos ("menos de", "ou mais"): a mesma classificação continua
    // honesta quando reaplicada a outro ano com valores fora da faixa original
    classes = Array.from({ length: cortes.length + 1 }, (_, i) => {
      const inferior = i === 0 ? null : cortes[i - 1];
      const superior = i === cortes.length ? null : cortes[i];
      const rotulo =
        inferior === null ? `menos de ${f(superior as number)}` : superior === null ? `${f(inferior)} ou mais` : `${f(inferior)} a menos de ${f(superior)}`;
      return { indice: i, inferior, superior, rotulo, contagem: 0 };
    });
  }
  const c: Classificacao = { metodo, cortes, classes, minimo, maximo, validos: r.nums.length, semDado: r.semDado, naoSeAplica: r.naoSeAplica };
  for (const v of r.nums) {
    const k = classeDe(v, c);
    if (typeof k === "number") classes[k].contagem++;
  }
  return c;
}

/** Mantém só cortes estritamente crescentes que separam de fato os valores (acima do mínimo, até o máximo). */
function cortesUteis(brutos: number[], min: number, max: number): number[] {
  const out: number[] = [];
  for (const c of brutos) {
    if (!valido(c) || c <= min || c > max) continue;
    if (out.length && c <= out[out.length - 1]) continue;
    out.push(c);
  }
  return out;
}

/**
 * Quebras por quantis. Com empates (muitas áreas com o mesmo valor), cortes
 * repetidos são descartados e o mapa fica com menos classes do que o pedido,
 * em vez de ter classe vazia ou o mesmo valor em duas classes.
 */
export function quebrasQuantis(valores: readonly ValorClassificavel[], classes = 5, opcoes: OpcoesClasses = {}): Classificacao {
  const r = resumo(valores);
  const casas = opcoes.casas ?? 1;
  if (r.nums.length < 2 || classes < 2) return montar("quantis", [], r, opcoes);
  const brutos = Array.from({ length: classes - 1 }, (_, i) => arredonda(quantil(r.nums, (i + 1) / classes), casas));
  return montar("quantis", cortesUteis(brutos, r.nums[0], r.nums[r.nums.length - 1]), r, opcoes);
}

/** Quebras em intervalos de mesma largura entre o mínimo e o máximo observados. */
export function quebrasIntervalosIguais(valores: readonly ValorClassificavel[], classes = 5, opcoes: OpcoesClasses = {}): Classificacao {
  const r = resumo(valores);
  const casas = opcoes.casas ?? 1;
  if (r.nums.length < 2 || classes < 2) return montar("intervalos-iguais", [], r, opcoes);
  const min = r.nums[0];
  const max = r.nums[r.nums.length - 1];
  const largura = (max - min) / classes;
  const brutos = Array.from({ length: classes - 1 }, (_, i) => arredonda(min + (i + 1) * largura, casas));
  return montar("intervalos-iguais", cortesUteis(brutos, min, max), r, opcoes);
}

/**
 * Quebras fixas definidas pelo chamador (ex.: faixas regulatórias, escala fixa
 * entre anos). Não são arredondadas nem descartadas: classe vazia também é
 * informação ("nenhuma distribuidora nesta faixa"). Cortes fora de ordem são
 * erro de programação e lançam exceção.
 */
export function quebrasFixas(cortes: readonly number[], valores: readonly ValorClassificavel[] = [], opcoes: OpcoesClasses = {}): Classificacao {
  for (let i = 0; i < cortes.length; i++) {
    if (!valido(cortes[i]) || (i > 0 && cortes[i] <= cortes[i - 1])) throw new Error(`quebrasFixas: cortes devem ser finitos e estritamente crescentes (${cortes.join(", ")})`);
  }
  if (!cortes.length) throw new Error("quebrasFixas: informe ao menos um corte");
  return montar("fixas", [...cortes], resumo(valores), opcoes);
}

/** Atalho: classifica pelo método pedido. */
export function classificar(
  valores: readonly ValorClassificavel[],
  metodo: { metodo: "quantis" | "intervalos-iguais"; classes: number } | { metodo: "fixas"; cortes: readonly number[] },
  opcoes: OpcoesClasses = {},
): Classificacao {
  if (metodo.metodo === "fixas") return quebrasFixas(metodo.cortes, valores, opcoes);
  return metodo.metodo === "quantis" ? quebrasQuantis(valores, metodo.classes, opcoes) : quebrasIntervalosIguais(valores, metodo.classes, opcoes);
}

/**
 * Classe de um valor: índice da classe, SEM_DADO para ausência (null,
 * undefined, NaN, infinito) e NAO_SE_APLICA para o terceiro estado. Zero é
 * dado e recebe classe normalmente. Sem classes (nenhum valor válido na
 * classificação), não há classe possível e o valor fica como SEM_DADO.
 */
export function classeDe(v: ValorClassificavel, c: Pick<Classificacao, "cortes" | "classes">): number | typeof SEM_DADO | typeof NAO_SE_APLICA {
  if (v === NAO_SE_APLICA) return NAO_SE_APLICA;
  if (!valido(v) || !c.classes.length) return SEM_DADO;
  let i = 0;
  while (i < c.cortes.length && v >= c.cortes[i]) i++;
  return i;
}
