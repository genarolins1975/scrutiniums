/**
 * Lógica pura das séries temporais do Setor Elétrico (sem React, testável em
 * node), usada por GraficoLinhas, PequenosMultiplos e CursorSincronizado:
 *
 * - rótulo do eixo X (dia, hora, mês, dia do ano, texto), o mesmo que
 *   GraficoLinhas sempre usou, agora compartilhado;
 * - intervalo de zoom guardado como valores de X (não como índices): cabe na
 *   URL, sobrevive a uma gold nova com mais pontos e é o mesmo entre gráficos
 *   que dividem o eixo. Intervalo inválido ou com menos de dois pontos volta à
 *   série completa, em vez de desenhar um gráfico vazio;
 * - períodos prontos ("30 dias", "12 meses") por calendário, não por contagem
 *   de linhas: série com dia faltando não encurta o período;
 * - domínio vertical com a mesma regra de GraficoLinhas, calculado sobre as
 *   séries e o trecho exibidos, e a comparação que decide quando a escala
 *   mudou (a interface avisa; escala nunca muda em silêncio);
 * - domínio dos pequenos múltiplos: compartilhado por padrão, livre por opção;
 * - a loja do cursor sincronizado: um valor de X por grupo, com origem, sem
 *   notificar quem assina quando nada mudou.
 *
 * Ausência (null, undefined, NaN) nunca entra em domínio nem vira zero.
 */
import { somarDias, somarHoras, somarMeses } from "@/lib/energia/calendario";
import { dominioBonito, valido, type Dominio } from "@/lib/energia/escalas";

export type FormatoX = "data" | "hora" | "mes" | "md" | "texto";
export type PontoSerie = Record<string, string | number | null | undefined>;

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Rótulo do valor de X: curto no eixo, longo (data completa) na dica, na tabela e no leitor de tela. */
export function formatarX(v: string, f: FormatoX | undefined, longo = false): string {
  if (!v) return "";
  if (f === "hora") return longo && v.length > 5 ? `${v.slice(8, 10)}/${v.slice(5, 7)} ${v.slice(11, 13)}h` : v.length > 5 ? `${v.slice(11, 13)}h` : `${v.slice(0, 2)}h`;
  if (f === "mes") return `${MESES[Number(v.slice(5, 7)) - 1]}/${v.slice(2, 4)}`;
  if (f === "md") return `${v.slice(3, 5)}/${v.slice(0, 2)}`;
  if (f === "data") return longo ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : `${MESES[Number(v.slice(5, 7)) - 1]}/${v.slice(2, 4)}`;
  return v;
}

/**
 * Rótulos do eixo X de uma lista de valores. No formato "data", o rótulo curto é mês/ano, que se
 * repete quando o intervalo exibido cabe em poucas semanas ("set/26" seis vezes). Nesse caso o eixo
 * passa para dia/mês e, se ainda repetir (anos diferentes), para dia/mês/ano.
 */
export function rotulosDoEixoX(valores: readonly string[], f: FormatoX | undefined): string[] {
  const curto = valores.map((v) => formatarX(v, f));
  if (f !== "data") return curto;
  const unico = (l: string[]) => new Set(l).size === l.length;
  if (unico(curto)) return curto;
  const diaMes = valores.map((v) => (v ? `${v.slice(8, 10)}/${v.slice(5, 7)}` : ""));
  if (unico(diaMes)) return diaMes;
  return valores.map((v) => formatarX(v, f, true));
}

/* ---------- intervalo (zoom) ---------- */

/** Intervalo fechado de valores de X (inclusive nas duas pontas). */
export type IntervaloX = { inicio: string; fim: string };

function crescente(xs: readonly string[]): boolean {
  for (let i = 1; i < xs.length; i++) if (xs[i] < xs[i - 1]) return false;
  return true;
}

/**
 * Índices [i0, i1] (inclusive) do intervalo na série. Em série ordenada, as
 * pontas não precisam existir: vale o primeiro X ≥ início e o último X ≤ fim
 * (um intervalo "2024-01-01 a 2024-12-31" funciona em série que começa em
 * 2024-01-02). Em série fora de ordem (formato texto), só pontas exatas. Sem
 * intervalo, intervalo invertido, fora da série ou com menos de `minimo`
 * pontos: a série completa.
 */
export function indicesDoIntervalo(xs: readonly string[], iv: IntervaloX | null | undefined, minimo = 2): [number, number] {
  const n = xs.length;
  const tudo: [number, number] = [0, n - 1];
  if (!iv || n === 0) return tudo;
  let i0: number;
  let i1: number;
  if (crescente(xs)) {
    i0 = xs.findIndex((x) => x >= iv.inicio);
    i1 = -1;
    for (let i = n - 1; i >= 0; i--) {
      if (xs[i] <= iv.fim) {
        i1 = i;
        break;
      }
    }
  } else {
    i0 = xs.indexOf(iv.inicio);
    i1 = xs.lastIndexOf(iv.fim);
  }
  if (i0 < 0 || i1 < 0 || i1 - i0 + 1 < Math.max(1, minimo)) return tudo;
  return [i0, i1];
}

/**
 * Intervalo a partir de índices (arrasto, controles de início e fim). Aceita
 * pontas trocadas, limita à série e alarga até `minimo` pontos. Devolve null
 * quando o resultado cobre a série inteira: "sem zoom" tem uma só forma.
 */
export function intervaloDosIndices(xs: readonly string[], a: number, b: number, minimo = 2): IntervaloX | null {
  const n = xs.length;
  if (n === 0 || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  let i0 = Math.max(0, Math.min(n - 1, Math.round(Math.min(a, b))));
  let i1 = Math.max(0, Math.min(n - 1, Math.round(Math.max(a, b))));
  const m = Math.min(Math.max(1, minimo), n);
  while (i1 - i0 + 1 < m) {
    if (i1 < n - 1) i1++;
    else i0--;
  }
  if (i0 <= 0 && i1 >= n - 1) return null;
  return { inicio: xs[i0], fim: xs[i1] };
}

export type PeriodoPronto = { id: string; rotulo: string; inicio: string; fim: string; pontos: number };

type Regra = { id: string; rotulo: string; inicio: (fim: string) => string | null };

const REGRAS: Partial<Record<FormatoX, Regra[]>> = {
  data: [
    { id: "30d", rotulo: "30 dias", inicio: (f) => somarDias(f, -29) },
    { id: "90d", rotulo: "90 dias", inicio: (f) => somarDias(f, -89) },
    { id: "1a", rotulo: "1 ano", inicio: (f) => (somarMeses(f, -12) ? somarDias(somarMeses(f, -12) as string, 1) : null) },
    { id: "5a", rotulo: "5 anos", inicio: (f) => (somarMeses(f, -60) ? somarDias(somarMeses(f, -60) as string, 1) : null) },
  ],
  mes: [
    { id: "12m", rotulo: "12 meses", inicio: (f) => somarMeses(f, -11) },
    { id: "5a", rotulo: "5 anos", inicio: (f) => somarMeses(f, -59) },
    { id: "10a", rotulo: "10 anos", inicio: (f) => somarMeses(f, -119) },
  ],
  hora: [
    { id: "24h", rotulo: "24 horas", inicio: (f) => somarHoras(f, -23) },
    { id: "7d", rotulo: "7 dias", inicio: (f) => somarHoras(f, -(7 * 24 - 1)) },
    { id: "30d", rotulo: "30 dias", inicio: (f) => somarHoras(f, -(30 * 24 - 1)) },
  ],
};

/**
 * Períodos prontos que terminam no último ponto, contados no calendário
 * ("30 dias" = do 29º dia antes do último até ele). Só entram os que são
 * mais curtos que a série e têm ao menos dois pontos; períodos que dariam o
 * mesmo recorte aparecem uma vez. Formatos sem calendário (dia do ano,
 * texto) não têm períodos prontos.
 */
export function periodosProntos(xs: readonly string[], formato: FormatoX | undefined): PeriodoPronto[] {
  const regras = REGRAS[formato ?? "data"];
  const n = xs.length;
  if (!regras || n < 3 || !crescente(xs)) return [];
  const fim = xs[n - 1];
  const out: PeriodoPronto[] = [];
  for (const r of regras) {
    const ini = r.inicio(fim);
    if (!ini) continue;
    const i0 = xs.findIndex((x) => x >= ini);
    if (i0 <= 0 || n - i0 < 2) continue;
    if (out.some((p) => p.inicio === xs[i0])) continue;
    out.push({ id: r.id, rotulo: r.rotulo, inicio: xs[i0], fim, pontos: n - i0 });
  }
  return out;
}

/** Posição exata de um valor de X; −1 quando o gráfico não tem esse ponto. */
export function indiceDoValorX(xs: readonly string[], valor: string | null | undefined): number {
  return valor === null || valor === undefined ? -1 : xs.indexOf(valor);
}

/* ---------- domínio vertical ---------- */

export type DominioY = { yMin: number; yMax: number };

/**
 * Domínio vertical de GraficoLinhas: mínimo e máximo dos valores válidos das
 * colunas pedidas, com folga de 6% (ou zero na base, com zeroNoEixo). Sem
 * valor válido, 0 a 1. Laço em vez de Math.min(...valores): série horária
 * longa estouraria a pilha de argumentos.
 */
export function dominioLinhas(dados: readonly PontoSerie[], chaves: readonly string[], zeroNoEixo = false): DominioY {
  let mn = Infinity;
  let mx = -Infinity;
  for (const d of dados) {
    for (const k of chaves) {
      const v = d[k];
      if (typeof v === "number" && Number.isFinite(v)) {
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
    }
  }
  if (mn === Infinity) return { yMin: 0, yMax: 1 };
  if (zeroNoEixo) mn = Math.min(0, mn);
  const pad = (mx - mn) * 0.06 || 1;
  return { yMin: zeroNoEixo && mn >= 0 ? 0 : mn - pad, yMax: mx + pad };
}

/** Dois domínios desenham a mesma régua (tolerância relativa à amplitude). */
export function mesmaEscala(a: DominioY, b: DominioY): boolean {
  const tol = Math.max(Math.abs(a.yMax - a.yMin), Math.abs(b.yMax - b.yMin), 1e-12) * 1e-9;
  return Math.abs(a.yMin - b.yMin) <= tol && Math.abs(a.yMax - b.yMax) <= tol;
}

export type EscalaPaineis = "compartilhada" | "livre";

/**
 * Domínio de cada painel de pequenos múltiplos. Compartilhada (padrão): uma
 * régua para todos, calculada sobre todos os painéis, para que alturas iguais
 * signifiquem valores iguais. Livre: cada painel com a própria régua (a
 * interface avisa que a altura deixa de ser comparável entre painéis).
 */
export function dominiosPaineis(
  dados: readonly PontoSerie[],
  colunasPorPainel: readonly (readonly string[])[],
  { escala = "compartilhada", zero = false, n = 3 }: { escala?: EscalaPaineis; zero?: boolean; n?: number } = {},
): Dominio[] {
  const valores = (colunas: readonly string[]) => {
    const out: number[] = [];
    for (const d of dados) for (const c of colunas) if (valido(d[c])) out.push(d[c] as number);
    return out;
  };
  if (escala === "compartilhada") {
    const dom = dominioBonito(valores(colunasPorPainel.flat()), { zero, n });
    return colunasPorPainel.map(() => dom);
  }
  return colunasPorPainel.map((c) => dominioBonito(valores(c), { zero, n }));
}

/** Painel sem nenhum valor válido em nenhuma das colunas: o painel diz "sem dado", não desenha linha em zero. */
export function painelSemDado(dados: readonly PontoSerie[], colunas: readonly string[]): boolean {
  return !dados.some((d) => colunas.some((c) => valido(d[c])));
}

/* ---------- cursor sincronizado ---------- */

/** Posição do cursor compartilhado: um valor de X num grupo (em geral a chaveX), com o gráfico de origem. */
export type CursorCompartilhado = { grupo: string; valor: string; origem: string } | null;

export type LojaCursor = {
  ler: () => CursorCompartilhado;
  publicar: (grupo: string, valor: string, origem: string) => void;
  /** Limpa só se o cursor atual veio desta origem: um gráfico que perde o foco não apaga o cursor de outro. */
  limpar: (origem: string) => void;
  assinar: (ouvinte: () => void) => () => void;
};

export function criarLojaCursor(inicial: CursorCompartilhado = null): LojaCursor {
  let atual: CursorCompartilhado = inicial;
  const ouvintes = new Set<() => void>();
  const avisar = () => ouvintes.forEach((o) => o());
  return {
    ler: () => atual,
    publicar(grupo, valor, origem) {
      if (atual && atual.grupo === grupo && atual.valor === valor && atual.origem === origem) return;
      atual = { grupo, valor, origem };
      avisar();
    },
    limpar(origem) {
      if (!atual || atual.origem !== origem) return;
      atual = null;
      avisar();
    },
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
  };
}
