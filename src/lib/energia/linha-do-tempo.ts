/**
 * Linha do tempo de eventos datados (atos regulatórios, revisões tarifárias,
 * mudanças de metodologia): lógica pura, testável em node, do componente
 * LinhaDoTempo.
 *
 * A especificação (seções 9.10 e 11.4) separa data de publicação e entrada
 * em vigor, e proíbe usar uma no lugar da outra. Daí:
 *
 * - o filtro de período escolhe explicitamente a data que filtra
 *   (publicação ou vigência); evento sem aquela data não entra no recorte,
 *   e o número de eventos deixados de fora por falta da data é devolvido
 *   para a interface dizer, em vez de sumirem em silêncio;
 * - a ordenação usa a mesma data escolhida, com eventos sem data no fim nas
 *   duas direções;
 * - a defasagem entre publicação e vigência é calculada só com as duas datas
 *   (e na precisão da menos precisa), e vigência anterior à publicação é
 *   dita "retroativa", não um número negativo solto;
 * - link de fonte primária só com http(s): um endereço "javascript:" vindo
 *   de uma planilha nunca vira link clicável.
 *
 * Datas só com mês ("2024-03") são comparadas pelo primeiro dia do mês no
 * filtro de período.
 */
import { diaSerial, diferencaDatas, precisaoData, textoDuracao } from "@/lib/energia/calendario";
import { ordenarComNulos } from "@/lib/energia/escalas";
import { dataBR } from "@/lib/energia/formato";

export type EventoDatado = {
  id: string;
  titulo: string;
  /** Id da categoria (ver `categorias` do componente). */
  categoria: string;
  /** Data de publicação ("AAAA-MM-DD"); null quando a fonte não informa. */
  publicacao: string | null;
  /** Início de vigência; null quando não informado. */
  vigencia: string | null;
  /** Fim de vigência, quando o ato é temporário ou foi revogado. */
  fimVigencia?: string | null;
  /** Resumo em linguagem simples (conferido; nunca substitui o ato). */
  resumo?: string;
  /** Dispositivo que sustenta a mudança (ex.: "art. 3º, § 1º"). */
  dispositivo?: string;
  /** Órgão emissor (ex.: "ANEEL"). */
  orgao?: string;
  /** Fonte primária: o próprio ato. Null quando ainda não localizada. */
  fonte: { rotulo: string; url: string } | null;
};

export type BaseData = "publicacao" | "vigencia";

export type FiltroLinhaDoTempo = {
  /** Categorias visíveis; null é "todas" e lista vazia é "nenhuma". */
  categorias: string[] | null;
  inicio: string | null;
  fim: string | null;
  /** Data usada no recorte de período e na ordenação. */
  base: BaseData;
};

export const FILTRO_PADRAO: FiltroLinhaDoTempo = { categorias: null, inicio: null, fim: null, base: "publicacao" };

export const ROTULO_BASE: Record<BaseData, string> = { publicacao: "publicação", vigencia: "vigência" };

/** Data comparável no recorte ("AAAA-MM" vira "AAAA-MM-01"); null quando inválida. */
function comparavel(iso: string | null | undefined): string | null {
  const p = precisaoData(iso);
  if (!p || !iso) return null;
  return p === "mes" ? `${iso}-01` : iso.slice(0, 10);
}

/** Período normalizado: pontas inválidas viram null; pontas trocadas são desinvertidas. */
export function normalizarPeriodo(inicio: string | null, fim: string | null): { inicio: string | null; fim: string | null } {
  let a = comparavel(inicio);
  let b = comparavel(fim);
  if (a && b && a > b) [a, b] = [b, a];
  return { inicio: a, fim: b };
}

export function filtroAtivo(f: FiltroLinhaDoTempo): boolean {
  const p = normalizarPeriodo(f.inicio, f.fim);
  return f.categorias !== null || p.inicio !== null || p.fim !== null;
}

export type ResultadoFiltro = {
  eventos: EventoDatado[];
  total: number;
  /** Eventos da categoria que ficaram fora do recorte de período por não terem a data escolhida. */
  semDataNaBase: number;
};

/** Aplica categoria e período (na data escolhida) e ordena ("recentes" primeiro ou cronológica). */
export function filtrarEventos(eventos: readonly EventoDatado[], f: FiltroLinhaDoTempo, ordem: "recentes" | "cronologica" = "recentes"): ResultadoFiltro {
  const cats = f.categorias === null ? null : new Set(f.categorias);
  const { inicio, fim } = normalizarPeriodo(f.inicio, f.fim);
  const comPeriodo = inicio !== null || fim !== null;
  let semDataNaBase = 0;
  const out: EventoDatado[] = [];
  for (const e of eventos) {
    if (cats && !cats.has(e.categoria)) continue;
    if (comPeriodo) {
      const d = comparavel(e[f.base]);
      if (d === null) {
        semDataNaBase++;
        continue;
      }
      if ((inicio && d < inicio) || (fim && d > fim)) continue;
    }
    out.push(e);
  }
  return { eventos: ordenarEventos(out, f.base, ordem), total: eventos.length, semDataNaBase };
}

/**
 * Ordena pela data escolhida; sem essa data, no fim, nas duas direções.
 * Empate: a outra data, depois o título (collation pt-BR).
 */
export function ordenarEventos(eventos: readonly EventoDatado[], base: BaseData, ordem: "recentes" | "cronologica" = "recentes"): EventoDatado[] {
  const outra: BaseData = base === "publicacao" ? "vigencia" : "publicacao";
  // chave numérica composta: dia da data principal e, no empate, dia da outra data;
  // sem a outra data, o evento fica por último entre os empatados na direção pedida
  const DESLOCA = 1e6;
  const semOutra = ordem === "recentes" ? 0 : 2 * DESLOCA;
  return ordenarComNulos(
    eventos,
    (e) => {
      const d = diaSerial(e[base]);
      if (d === null) return null;
      const o = diaSerial(e[outra]);
      return (d + DESLOCA) * 1e7 + (o === null ? semOutra : o + DESLOCA);
    },
    ordem === "recentes" ? "desc" : "asc",
    (e) => e.titulo,
  );
}

/** Defasagem entre publicação e vigência, em texto; null sem as duas datas. */
export function textoDefasagem(publicacao: string | null | undefined, vigencia: string | null | undefined): string | null {
  const d = diferencaDatas(publicacao, vigencia);
  if (!d) return null;
  if (d.valor === 0) return d.unidade === "dias" ? "vigência na data da publicação" : "vigência no mês da publicação";
  return d.valor > 0 ? `vigência ${textoDuracao(d)} após a publicação` : `vigência retroativa: ${textoDuracao(d)} antes da publicação`;
}

/** URL segura para link externo (http ou https); null nos demais casos. */
export function urlSegura(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Resumo legível do filtro ("categorias: Tarifa, PLD; vigência de 01/01/2023 a 31/12/2024"). */
export function resumoFiltro(f: FiltroLinhaDoTempo, categorias: readonly { id: string; rotulo: string }[]): string {
  const partes: string[] = [];
  if (f.categorias !== null) {
    const nomes = f.categorias.map((c) => categorias.find((k) => k.id === c)?.rotulo ?? c);
    partes.push(nomes.length ? `${nomes.length === 1 ? "categoria" : "categorias"}: ${nomes.join(", ")}` : "nenhuma categoria");
  }
  const { inicio, fim } = normalizarPeriodo(f.inicio, f.fim);
  const b = ROTULO_BASE[f.base];
  if (inicio && fim) partes.push(`${b} de ${dataBR(inicio)} a ${dataBR(fim)}`);
  else if (inicio) partes.push(`${b} a partir de ${dataBR(inicio)}`);
  else if (fim) partes.push(`${b} até ${dataBR(fim)}`);
  return partes.join("; ");
}
