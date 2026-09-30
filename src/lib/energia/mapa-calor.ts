/**
 * Lógica pura do mapa de calor do domínio Energia (MapaCalor): classificação
 * de valores em classes de cor definidas pelo chamador, validação da escala
 * (sequencial ou divergente), rótulos de classe, estados de célula e
 * navegação por setas na matriz. Fica fora do componente para ser testada em
 * node.
 *
 * Três estados de célula, nunca confundidos: valor (inclusive zero, que é
 * observação), sem dado (null/undefined: a célula existe e o valor falta) e
 * não se aplica (a combinação não existe, como 30 de fevereiro ou mês futuro).
 */
import { num } from "@/lib/energia/formato";
import { quantis, validos } from "@/lib/energia/distribuicao";

export const NAO_SE_APLICA = "nao_se_aplica" as const;
export type ValorCelula = number | null | undefined | typeof NAO_SE_APLICA;
export type EstadoCelula = "valor" | "sem-dado" | "nao-se-aplica";

export type EscalaCores = {
  /** Sequencial: um matiz, do claro ao escuro. Divergente: dois matizes e centro neutro. */
  tipo: "sequencial" | "divergente";
  /** Limites entre classes, crescentes (n limites = n + 1 classes). Cada classe inclui o limite inferior. */
  limites: number[];
  /** Uma cor por classe, sempre por variável CSS (var(--...)) ou color-mix sobre variáveis. */
  cores: string[];
  /** Rótulo de cada classe; sem ele, a faixa numérica é gerada. */
  rotulos?: string[];
  /** Divergente: valor de referência no centro da escala (ex.: 0 ou 100% da MLT). */
  centro?: number;
};

export function estadoCelula(v: ValorCelula): EstadoCelula {
  if (v === NAO_SE_APLICA) return "nao-se-aplica";
  return typeof v === "number" && Number.isFinite(v) ? "valor" : "sem-dado";
}

const COR_TOKEN = /^(var\(--[a-z0-9-]+\)|color-mix\(.*var\(--[a-z0-9-]+\).*\))$/i;

/** Problemas da escala; lista vazia quando está consistente. */
export function validaEscala(e: EscalaCores): string[] {
  const erros: string[] = [];
  const { limites, cores } = e;
  if (!limites.every((l) => Number.isFinite(l))) erros.push("limites precisam ser números finitos");
  for (let i = 1; i < limites.length; i++) {
    if (!(limites[i] > limites[i - 1])) {
      erros.push("limites precisam ser estritamente crescentes");
      break;
    }
  }
  if (cores.length !== limites.length + 1) erros.push(`são ${limites.length + 1} classes e ${cores.length} cores`);
  if (cores.length < 2) erros.push("a escala precisa de ao menos duas classes");
  const soltas = cores.filter((c) => !COR_TOKEN.test(c.trim()));
  if (soltas.length) erros.push(`cor fora dos tokens (use var(--...)): ${soltas.join(", ")}`);
  if (e.rotulos && e.rotulos.length !== cores.length) erros.push(`são ${cores.length} classes e ${e.rotulos.length} rótulos`);
  if (e.tipo === "divergente") {
    const c = e.centro;
    if (typeof c !== "number" || !Number.isFinite(c)) erros.push("escala divergente precisa de `centro`");
    else if (cores.length % 2 === 0) {
      // número par de classes: o centro é o limite do meio
      if (limites[cores.length / 2 - 1] !== c) erros.push("com número par de classes, o centro precisa ser o limite do meio");
    } else {
      // número ímpar: a classe do meio (neutra) contém o centro
      const m = (cores.length - 1) / 2;
      if (!(limites[m - 1] <= c && c < limites[m])) erros.push("com número ímpar de classes, a classe do meio precisa conter o centro");
    }
  }
  return erros;
}

/** Classe (0 a n) de um valor; null para sem dado e não se aplica. */
export function classeDe(v: ValorCelula, limites: readonly number[]): number | null {
  if (estadoCelula(v) !== "valor") return null;
  const x = v as number;
  let k = 0;
  while (k < limites.length && x >= limites[k]) k++;
  return k;
}

/** Rótulos das classes: os do chamador ou faixas geradas ("abaixo de 10", "10 a 20", "20 ou mais"). */
export function rotulosClasses(e: EscalaCores, casas: number): string[] {
  if (e.rotulos) return e.rotulos;
  const l = e.limites;
  return e.cores.map((_, i) => {
    if (i === 0) return `abaixo de ${num(l[0], casas)}`;
    if (i === l.length) return `${num(l[l.length - 1], casas)} ou mais`;
    return `${num(l[i - 1], casas)} a ${num(l[i], casas)}`;
  });
}

/** Confere que a matriz tem uma linha por rótulo de linha e uma coluna por rótulo de coluna. */
export function validaMatriz(valores: readonly (readonly ValorCelula[])[], nLinhas: number, nColunas: number): string[] {
  const erros: string[] = [];
  if (valores.length !== nLinhas) erros.push(`${valores.length} linhas de valores para ${nLinhas} rótulos de linha`);
  valores.forEach((l, i) => {
    if (l.length !== nColunas) erros.push(`linha ${i + 1}: ${l.length} valores para ${nColunas} colunas`);
  });
  return erros;
}

export type Posicao = { l: number; c: number };

/**
 * Próxima célula para uma tecla (padrão de grade da WAI-ARIA): setas nas duas
 * dimensões, Home e End na linha, Ctrl+Home e Ctrl+End nos cantos, Page Up e
 * Page Down saltam `salto` linhas. Null quando a tecla não é de navegação.
 */
export function moveNaGrade(p: Posicao, tecla: string, nLinhas: number, nColunas: number, ctrl = false, salto = 7): Posicao | null {
  if (nLinhas < 1 || nColunas < 1) return null;
  const lim = (v: number, n: number) => Math.max(0, Math.min(n - 1, v));
  switch (tecla) {
    case "ArrowRight":
      return { l: p.l, c: lim(p.c + 1, nColunas) };
    case "ArrowLeft":
      return { l: p.l, c: lim(p.c - 1, nColunas) };
    case "ArrowDown":
      return { l: lim(p.l + 1, nLinhas), c: p.c };
    case "ArrowUp":
      return { l: lim(p.l - 1, nLinhas), c: p.c };
    case "Home":
      return ctrl ? { l: 0, c: 0 } : { l: p.l, c: 0 };
    case "End":
      return ctrl ? { l: nLinhas - 1, c: nColunas - 1 } : { l: p.l, c: nColunas - 1 };
    case "PageDown":
      return { l: lim(p.l + salto, nLinhas), c: p.c };
    case "PageUp":
      return { l: lim(p.l - salto, nLinhas), c: p.c };
    default:
      return null;
  }
}

export type ResumoGrade = {
  celulas: number;
  comValor: number;
  semDado: number;
  naoSeAplica: number;
  min: number | null;
  max: number | null;
  /** Valores fora do intervalo coberto pelos limites extremos caem nas classes abertas das pontas. */
  porClasse: number[];
};

export function resumoGrade(valores: readonly (readonly ValorCelula[])[], limites: readonly number[]): ResumoGrade {
  const r: ResumoGrade = { celulas: 0, comValor: 0, semDado: 0, naoSeAplica: 0, min: null, max: null, porClasse: new Array(limites.length + 1).fill(0) };
  for (const linha of valores) {
    for (const v of linha) {
      r.celulas++;
      const e = estadoCelula(v);
      if (e === "nao-se-aplica") r.naoSeAplica++;
      else if (e === "sem-dado") r.semDado++;
      else {
        const x = v as number;
        r.comValor++;
        r.min = r.min === null ? x : Math.min(r.min, x);
        r.max = r.max === null ? x : Math.max(r.max, x);
        r.porClasse[classeDe(x, limites) as number]++;
      }
    }
  }
  return r;
}

/**
 * Limites por quantis (classes com contagens parecidas), para quando o
 * chamador não tem limites de referência. Limites repetidos (muitos empates)
 * são fundidos, então pode haver menos classes que o pedido: o chamador
 * precisa passar uma cor por classe resultante.
 */
export function limitesPorQuantis(valores: readonly (readonly ValorCelula[])[], nClasses: number): number[] {
  const nums = validos(valores.flat().map((v) => (v === NAO_SE_APLICA ? null : v)));
  if (nClasses < 2 || !nums.length) return [];
  const qs = quantis(nums, Array.from({ length: nClasses - 1 }, (_, i) => (i + 1) / nClasses));
  const out: number[] = [];
  for (const q of qs) if (q !== null && (out.length === 0 || q > out[out.length - 1])) out.push(q);
  return out;
}

/** Hachura de célula sem dado: padrão próprio, nunca a cor de uma classe. */
export const FUNDO_SEM_DADO = "repeating-linear-gradient(135deg, var(--cor-mineral) 0 1px, var(--cor-superficie) 1px 5px)";
