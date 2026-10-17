/**
 * Cronograma de expansão (usinas, linhas de transmissão): lógica pura,
 * testável em node, do componente Cronograma.
 *
 * A especificação (seções 8.2 e 9.9) pede datas previstas e realizadas
 * separadas e snapshots preservados para comparar o que era previsto com o
 * que aconteceu. Daí o modelo:
 *
 * - cada marco (ex.: "operação comercial da UG1") guarda a sequência de
 *   previsões, cada uma com a data em que foi informada (o snapshot do
 *   relatório de fiscalização, por exemplo); nenhuma previsão antiga é
 *   sobrescrita pela nova;
 * - o realizado é outra coisa: uma data observada, não a última previsão;
 * - atraso só existe contra uma data-base declarada pela página (ex.:
 *   "cronograma vigente na outorga"). Sem data-base, o componente não calcula
 *   atraso nenhum: comparar com a primeira previsão encontrada seria escolher
 *   a régua em silêncio. Com data-base, a régua é a previsão vigente naquela
 *   data (a última informada até ela). Marco sem previsão vigente na
 *   data-base fica "sem previsão na data-base", nunca atraso zero;
 * - atraso realizado (realizado − base) e deslocamento previsto (previsão
 *   mais recente − base) são estados distintos, com textos distintos.
 */
import { diferencaDatas, precisaoData, textoDiferencaComSinal, textoDuracao, type Diferenca } from "@/lib/energia/calendario";
import type { Idioma } from "@/lib/idioma";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";

/** Duração no idioma: em português a de calendario.ts ("120 dias", "3 meses"); em inglês "120 days", "3 months". */
function duracao(d: Diferenca, idioma: Idioma): string {
  if (idioma !== "en") return textoDuracao(d);
  const v = Math.abs(d.valor);
  const n = v.toLocaleString("en-US");
  // i18n: dado (unidade da diferença)
  if (d.unidade === "dias") return `${n} ${v === 1 ? "day" : "days"}`;
  return `${n} ${v === 1 ? "month" : "months"}`;
}
function diferencaComSinal(d: Diferenca, idioma: Idioma): string {
  if (idioma !== "en") return textoDiferencaComSinal(d);
  const s = d.valor > 0 ? "+" : d.valor < 0 ? "\u2212" : "";
  return `${s}${duracao(d, idioma)}`;
}

export type PrevisaoMarco = {
  /** Data prevista para o marco ("AAAA-MM-DD" ou "AAAA-MM"). */
  data: string;
  /** Quando a previsão foi informada: data do snapshot ou do relatório ("AAAA-MM-DD"). */
  informadaEm: string;
  /** Identificação do documento ou snapshot (ex.: "RALIE mar/2026"). */
  snapshot?: string;
};

export type MarcoCronograma = {
  id: string;
  rotulo: string;
  previsoes: PrevisaoMarco[];
  /** Data realizada; null ou ausente enquanto não houver registro. */
  realizado?: string | null;
  /** Documento que registra o realizado (ex.: despacho de liberação para operação). */
  fonteRealizado?: string;
};

export type ItemCronograma = {
  id: string;
  rotulo: string;
  /** Estado usado no filtro (ex.: estágio "Em construção" ou UF, conforme o rótulo do filtro). */
  estado: string;
  /** Linha complementar (ex.: "UHE · 1.200 MW · PA"). */
  detalhe?: string;
  marcos: MarcoCronograma[];
};

/** Data-base declarada: a régua do atraso. */
export type DataBaseCronograma = { data: string; rotulo: string };

/** Previsões válidas em ordem de informação (a mais antiga primeiro); empate mantém a ordem recebida. */
export function previsoesOrdenadas(previsoes: readonly PrevisaoMarco[]): PrevisaoMarco[] {
  return previsoes
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => precisaoData(p.data) !== null && precisaoData(p.informadaEm) !== null)
    .sort((a, b) => (a.p.informadaEm < b.p.informadaEm ? -1 : a.p.informadaEm > b.p.informadaEm ? 1 : a.i - b.i))
    .map(({ p }) => p);
}

/** Previsão vigente numa data: a última informada até ela (inclusive). */
export function previsaoVigenteEm(previsoes: readonly PrevisaoMarco[], data: string): PrevisaoMarco | null {
  let vigente: PrevisaoMarco | null = null;
  for (const p of previsoesOrdenadas(previsoes)) {
    if (p.informadaEm.slice(0, 10) <= data.slice(0, 10)) vigente = p;
    else break;
  }
  return vigente;
}

/** Previsão mais recente (a última informada). */
export function previsaoMaisRecente(previsoes: readonly PrevisaoMarco[]): PrevisaoMarco | null {
  const o = previsoesOrdenadas(previsoes);
  return o.length ? o[o.length - 1] : null;
}

export type Atraso =
  | { estado: "sem-data-base" }
  | { estado: "sem-previsao-na-base" }
  | { estado: "realizado"; base: PrevisaoMarco; comparada: string; diferenca: Diferenca }
  | { estado: "previsto"; base: PrevisaoMarco; comparada: PrevisaoMarco; diferenca: Diferenca }
  | { estado: "sem-comparacao"; base: PrevisaoMarco };

/**
 * Atraso de um marco contra a data-base. Positivo é atraso; negativo é
 * antecipação. Realizado tem prioridade sobre previsão: depois que o marco
 * aconteceu, o que importa é quando aconteceu.
 */
export function atrasoDoMarco(marco: MarcoCronograma, dataBase: DataBaseCronograma | null | undefined): Atraso {
  if (!dataBase || precisaoData(dataBase.data) === null) return { estado: "sem-data-base" };
  const base = previsaoVigenteEm(marco.previsoes, dataBase.data);
  if (!base) return { estado: "sem-previsao-na-base" };
  if (marco.realizado && precisaoData(marco.realizado)) {
    const d = diferencaDatas(base.data, marco.realizado);
    if (d) return { estado: "realizado", base, comparada: marco.realizado, diferenca: d };
  }
  const recente = previsaoMaisRecente(marco.previsoes);
  const d = recente ? diferencaDatas(base.data, recente.data) : null;
  if (recente && d) return { estado: "previsto", base, comparada: recente, diferenca: d };
  return { estado: "sem-comparacao", base };
}

/** Texto curto da coluna de atraso ("+120 dias", "−3 meses (prev.)"); vazio sem data-base. */
export function rotuloAtraso(a: Atraso, idioma: Idioma = idiomaEnergia()): string {
  switch (a.estado) {
    case "sem-data-base":
      return "";
    case "sem-previsao-na-base":
      return tx("sem base", "no baseline", idioma);
    case "sem-comparacao":
      return tx("sem dado", "no data", idioma);
    case "realizado":
      return diferencaComSinal(a.diferenca, idioma);
    case "previsto":
      return `${diferencaComSinal(a.diferenca, idioma)} ${tx("(prev.)", "(fcst.)", idioma)}`;
  }
}

/** Frase completa do atraso, para dica, leitor de tela e tabela. */
export function textoAtraso(a: Atraso, idioma: Idioma = idiomaEnergia()): string {
  switch (a.estado) {
    case "sem-data-base":
      return tx("atraso não calculado: nenhuma data-base declarada", "delay not calculated: no baseline date declared", idioma);
    case "sem-previsao-na-base":
      return tx("atraso não calculado: não havia previsão vigente na data-base", "delay not calculated: there was no forecast in force on the baseline date", idioma);
    case "sem-comparacao":
      return tx("atraso não calculado: sem data realizada nem previsão atual", "delay not calculated: no actual date and no current forecast", idioma);
    case "realizado": {
      const v = a.diferenca.valor;
      if (v === 0) return tx("realizado na data prevista na data-base", "completed on the date forecast on the baseline date", idioma);
      const t = duracao(a.diferenca, idioma);
      return v > 0
        ? tx(`realizado com atraso de ${t} sobre a data-base`, `completed ${t} later than the baseline date`, idioma)
        : tx(`realizado ${t} antes da data-base`, `completed ${t} before the baseline date`, idioma);
    }
    case "previsto": {
      const v = a.diferenca.valor;
      if (v === 0) return tx("ainda não realizado; previsão atual igual à da data-base", "not yet completed; current forecast equal to the baseline date's", idioma);
      const t = duracao(a.diferenca, idioma);
      return v > 0
        ? tx(`ainda não realizado; previsão atual ${t} depois da data-base`, `not yet completed; current forecast ${t} after the baseline date`, idioma)
        : tx(`ainda não realizado; previsão atual ${t} antes da data-base`, `not yet completed; current forecast ${t} before the baseline date`, idioma);
    }
  }
}

export type ContagemEstado = { estado: string; total: number };

const COLLATOR = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/** Estados presentes, em ordem alfabética pt-BR, com o número de itens de cada um. */
export function estadosDisponiveis(itens: readonly ItemCronograma[]): ContagemEstado[] {
  const m = new Map<string, number>();
  for (const it of itens) m.set(it.estado, (m.get(it.estado) ?? 0) + 1);
  return Array.from(m, ([estado, total]) => ({ estado, total })).sort((a, b) => COLLATOR.compare(a.estado, b.estado));
}

/** Itens dos estados pedidos; null é "todos"; lista vazia é "nenhum". */
export function filtrarPorEstado<T extends { estado: string }>(itens: readonly T[], estados: readonly string[] | null): T[] {
  if (estados === null) return [...itens];
  const s = new Set(estados);
  return itens.filter((i) => s.has(i.estado));
}

/**
 * Alterna um estado no filtro. Voltar a marcar todos devolve null ("todos"),
 * para que o filtro completo tenha uma só forma (e uma URL limpa).
 */
export function alternarEstado(atual: readonly string[] | null, estado: string, todos: readonly string[]): string[] | null {
  const base = new Set(atual ?? todos);
  if (base.has(estado)) base.delete(estado);
  else base.add(estado);
  const lista = todos.filter((e) => base.has(e));
  return lista.length === todos.length ? null : lista;
}

/** Todas as datas desenhadas (previstas e realizadas), para o domínio do eixo de tempo. */
export function datasDoCronograma(itens: readonly ItemCronograma[]): string[] {
  const out: string[] = [];
  for (const it of itens)
    for (const m of it.marcos) {
      for (const p of m.previsoes) if (precisaoData(p.data)) out.push(p.data);
      if (m.realizado && precisaoData(m.realizado)) out.push(m.realizado);
    }
  return out;
}
