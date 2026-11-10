/**
 * A forma de um conjunto de dados, para a figura da ficha (`FormaDoConjunto`): o período que as referências cobrem, as datas que dizem
 * se o dado está em dia e as etapas por que o conjunto passou até virar página. Tudo sai dos campos que o pipeline publica em
 * publicacao.json e catalogo.json; nada é recalculado (nem prazo, nem atraso, nem completude). Esta biblioteca só transforma datas em
 * posições numa régua e escolhe as marcas do eixo. Pura: sem idioma e sem leitura de arquivo.
 */
import { carimbo } from "./formato";
import type { ConjuntoIntegrado } from "./tipos-dados";

const DIA_MS = 86_400_000;

/** Dia civil (AAAA-MM-DD) como número de dias desde 1970; nulo quando o texto não começa por uma data válida. */
export function numeroDoDia(iso: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(t) ? null : Math.round(t / DIA_MS);
}

const isoDoDia = (n: number): string => new Date(n * DIA_MS).toISOString().slice(0, 10);

/** Dia (AAAA-MM-DD) no horário de Brasília de um instante em UTC; data sem hora fica como está. */
export function diaDeBrasilia(iso: string | null | undefined): string | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const texto = carimbo(iso, "pt").slice(0, 10);
  return /^\d{2}\/\d{2}\/\d{4}$/.test(texto) ? texto.split("/").reverse().join("-") : null;
}

/**
 * Primeiro e último dia de uma referência do conjunto: ano ("2026"), mês ("2026-08"), dia, hora ("2026-09-30T23:00"), intervalo de
 * anos de uma pesquisa ("2017-2018") ou vigência ("2025-09-30|2025-12-31|REH 3.537/2025", início e fim). Referência que não é data
 * (o código de um município, por exemplo) devolve nulo: o conjunto não tem período.
 */
export function diasDaReferencia(ref: string | null | undefined): { inicio: number; fim: number } | null {
  if (!ref) return null;
  if (ref.includes("|")) {
    const [a, b] = ref.split("|");
    const inicio = numeroDoDia(a);
    const fim = numeroDoDia(b) ?? inicio;
    return inicio === null || fim === null ? null : { inicio, fim: Math.max(inicio, fim) };
  }
  let m = /^(\d{4})$/.exec(ref);
  if (m) return { inicio: numeroDoDia(`${m[1]}-01-01`)!, fim: numeroDoDia(`${m[1]}-12-31`)! };
  m = /^(\d{4})-(\d{4})$/.exec(ref);
  if (m && Number(m[2]) >= Number(m[1])) return { inicio: numeroDoDia(`${m[1]}-01-01`)!, fim: numeroDoDia(`${m[2]}-12-31`)! };
  m = /^(\d{4})-(\d{2})$/.exec(ref);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    const inicio = numeroDoDia(`${ref}-01`)!;
    const fim = Math.round(Date.UTC(Number(m[1]), Number(m[2]), 0) / DIA_MS);
    return { inicio, fim };
  }
  const dia = numeroDoDia(ref);
  return dia === null ? null : { inicio: dia, fim: dia };
}

export type MarcaDoEixo = { x: number; ano: number; mes: number | null };

/**
 * Marcas do eixo do tempo: no máximo `maximo` anos (de 1 em 1, 2 em 2, 5 em 5…) ou, em períodos curtos, meses. Períodos de menos de
 * dois meses ficam sem marca: as datas das pontas já estão escritas ao lado da régua.
 */
export function marcasDoEixo(de: number, ate: number, maximo = 5): MarcaDoEixo[] {
  if (ate <= de) return [];
  const x = (n: number) => (n - de) / (ate - de);
  const a0 = new Date(de * DIA_MS).getUTCFullYear();
  const a1 = new Date(ate * DIA_MS).getUTCFullYear();
  for (const passo of [1, 2, 5, 10, 20, 50]) {
    const anos: number[] = [];
    for (let a = Math.ceil(a0 / passo) * passo; a <= a1; a += passo) if (numeroDoDia(`${a}-01-01`)! >= de) anos.push(a);
    if (anos.length >= 2 && anos.length <= maximo) return anos.map((a) => ({ x: x(numeroDoDia(`${a}-01-01`)!), ano: a, mes: null }));
    if (anos.length >= 2) continue;
    break;
  }
  if (ate - de < 60) return [];
  const meses: { n: number; ano: number; mes: number }[] = [];
  const inicio = new Date(de * DIA_MS);
  for (let a = inicio.getUTCFullYear(), m = inicio.getUTCMonth(); ; m++) {
    if (m > 11) {
      m = 0;
      a++;
    }
    const n = Math.round(Date.UTC(a, m, 1) / DIA_MS);
    if (n > ate) break;
    if (n >= de) meses.push({ n, ano: a, mes: m + 1 });
  }
  for (const passo of [1, 2, 3, 6]) {
    const escolhidos = meses.filter((q) => (q.mes - 1) % passo === 0);
    if (escolhidos.length >= 2 && escolhidos.length <= Math.min(maximo, 4)) return escolhidos.map((q) => ({ x: x(q.n), ano: q.ano, mes: q.mes }));
  }
  return [];
}

export type IdEvento = "fim_periodo" | "publicacao_fonte" | "captura" | "publicacao" | "prazo";

export type EventoDeAtualidade = { id: IdEvento; dia: string; x: number };

export type PeriodoCoberto = {
  /** Referências como o pipeline as publica (dado.ref_min e dado.ref_max). */
  refMin: string;
  refMax: string;
  /** Posições de 0 a 1 no eixo: começo da barra, fim da parte até a data da publicação e fim das referências futuras. */
  x0: number;
  x1: number;
  /** Fim das referências posteriores à data da publicação (planejamento, previsão, vigência futura); nulo quando não há. */
  xFuturo: number | null;
  /** A primeira e a última referência são a mesma. */
  unico: boolean;
};

export type FormaDoConjunto = {
  /** Data de referência da publicação (publicacao.json, referencia.hoje). */
  hoje: string;
  periodo: PeriodoCoberto | null;
  /** Eixo da régua do período: posição da data da publicação e marcas de ano ou de mês. */
  eixo: { xHoje: number; marcas: MarcaDoEixo[] } | null;
  /** Mudanças metodológicas do catálogo com data dentro do eixo, na ordem do tempo. */
  quebras: { data: string; x: number }[];
  /** Datas que dizem se o dado está em dia, na ordem do tempo, numa régua própria (a do fim do período, ampliada). */
  eventos: EventoDeAtualidade[];
  /** Trecho além do prazo, só quando o pipeline publica atraso: do prazo à data da publicação. */
  atraso: { dias: number; x0: number; x1: number } | null;
};

const ORDEM: readonly IdEvento[] = ["fim_periodo", "publicacao_fonte", "captura", "publicacao", "prazo"];

/**
 * Monta a forma do conjunto a partir da integração publicada (a primeira da ficha, a mesma que a página usa para a situação), da
 * data de referência da publicação e das mudanças metodológicas do catálogo.
 */
export function formaDoConjunto(c: Pick<ConjuntoIntegrado, "atualidade" | "capturas" | "dado"> | null | undefined, hoje: string, quebras: readonly { data: string }[] = []): FormaDoConjunto {
  const nHoje = numeroDoDia(hoje);
  const forma: FormaDoConjunto = { hoje, periodo: null, eixo: null, quebras: [], eventos: [], atraso: null };
  if (!c || nHoje === null) return forma;

  const min = diasDaReferencia(c.dado?.ref_min);
  const max = diasDaReferencia(c.dado?.ref_max);
  if (c.dado?.formato !== "nao_temporal" && min && max && c.dado?.ref_min && c.dado?.ref_max) {
    const inicio = min.inicio;
    const fim = Math.max(max.fim, inicio);
    let de = Math.min(inicio, nHoje);
    let ate = Math.max(fim, nHoje);
    if (ate === de) {
      de -= 1;
      ate += 1;
    }
    const x = (n: number) => (n - de) / (ate - de);
    // referência cujo período ainda não terminou (o ano corrente) vai só até a data da publicação; o que começa depois dela é futuro
    const fimSolido = Math.max(inicio, Math.min(fim, nHoje));
    forma.periodo = {
      refMin: c.dado.ref_min,
      refMax: c.dado.ref_max,
      x0: x(Math.min(inicio, fimSolido)),
      x1: x(fimSolido),
      xFuturo: max.inicio > nHoje && fim > nHoje ? x(fim) : null,
      unico: c.dado.ref_min === c.dado.ref_max,
    };
    forma.eixo = { xHoje: x(nHoje), marcas: marcasDoEixo(de, ate) };
    forma.quebras = quebras
      .map((q) => ({ data: q.data, n: numeroDoDia(q.data) }))
      .filter((q): q is { data: string; n: number } => q.n !== null && q.n >= de && q.n <= ate)
      .sort((a, b) => a.n - b.n)
      .map((q) => ({ data: q.data, x: x(q.n) }));
  }

  const a = c.atualidade;
  const brutos: { id: IdEvento; dia: string | null }[] = [
    { id: "fim_periodo", dia: a.fim_ultimo_periodo ?? null },
    { id: "publicacao_fonte", dia: diaDeBrasilia(c.capturas.ultima_publicacao_fonte) },
    { id: "captura", dia: diaDeBrasilia(c.capturas.ultima) },
    { id: "publicacao", dia: hoje },
    { id: "prazo", dia: a.prazo_proximo ?? null },
  ];
  const datados = brutos
    .map((e) => ({ id: e.id, dia: e.dia, n: numeroDoDia(e.dia) }))
    .filter((e): e is { id: IdEvento; dia: string; n: number } => e.dia !== null && e.n !== null);
  if (datados.length >= 2) {
    let de = Math.min(...datados.map((e) => e.n));
    let ate = Math.max(...datados.map((e) => e.n));
    if (ate === de) {
      de -= 1;
      ate += 1;
    }
    const x = (n: number) => (n - de) / (ate - de);
    forma.eventos = datados
      .sort((p, q) => p.n - q.n || ORDEM.indexOf(p.id) - ORDEM.indexOf(q.id))
      .map((e) => ({ id: e.id, dia: isoDoDia(e.n), x: x(e.n) }));
    const prazo = datados.find((e) => e.id === "prazo");
    if (a.situacao === "ATRASADO" && a.dias_atraso && prazo && prazo.n < nHoje) forma.atraso = { dias: a.dias_atraso, x0: x(prazo.n), x1: x(nHoje) };
  }
  return forma;
}
