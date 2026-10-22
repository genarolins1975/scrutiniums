/**
 * Correspondência e ordem da busca da plataforma, sem biblioteca: o índice tem poucas centenas de entradas e cada palavra
 * digitada casa pelo começo de uma palavra do destino, depois de normalizada (normalizar.ts). Ordem, do mais forte ao mais
 * fraco: título igual ao termo; todas as palavras no título; nos termos (sinônimos, lugares, nomes); no resumo e nos nomes da
 * coleção e do observatório. Entre iguais, a consulta pessoal vem primeiro, depois a página publicada, a parcial e a prevista,
 * que aparece só como "ainda sem página". O mesmo código roda no servidor (/buscar) e no navegador (BuscaPlataforma).
 */
import { normalizar, palavrasDaBusca } from "./normalizar";
import type { EntradaBusca, IndiceBusca } from "./tipos";

export const LIMITE_RESULTADOS = 30;

/** Nível da correspondência: quanto menor, mais forte. */
export type Nivel = 0 | 1 | 2 | 3;

export type Resultado = EntradaBusca & { nivel: Nivel };

export type GrupoColecao = { colecao: { id: string; nome: string; href: string } | null; resultados: Resultado[] };
export type GrupoObservatorio = { observatorio: { id: string; nome: string }; colecoes: GrupoColecao[] };

export type RespostaBusca = {
  termo: string;
  /** Os resultados na ordem de relevância (o primeiro é o que o Enter abre). */
  resultados: Resultado[];
  /** Os mesmos resultados agrupados por observatório e coleção, na ordem em que o grupo aparece pela primeira vez. */
  grupos: GrupoObservatorio[];
  /** Havia mais resultados que o limite. */
  cortado: boolean;
};

export type OpcoesBusca = {
  /** Restringe à coleção (as buscas de uma coleção, como a do Setor Elétrico). */
  colecao?: string;
  limite?: number;
};

type Preparada = { e: EntradaBusca; titulo: string[]; tituloInteiro: string; termos: string[]; resto: string[] };

const preparadas = new WeakMap<IndiceBusca, Preparada[]>();

const palavras = (s: string) => normalizar(s).split(" ").filter(Boolean);

function preparar(indice: IndiceBusca): Preparada[] {
  const pronta = preparadas.get(indice);
  if (pronta) return pronta;
  const nomeObs = new Map(indice.observatorios.map((o) => [o.id, o.nome]));
  const nomeCol = new Map(indice.colecoes.map((c) => [`${c.observatorio}/${c.id}`, c.nome]));
  const lugares = new Map(Object.entries(indice.lugares ?? {}).map(([k, v]) => [k, palavras(v.join(" "))]));
  const lista = indice.entradas.map((e) => ({
    e,
    titulo: palavras(e.titulo),
    tituloInteiro: normalizar(e.titulo),
    termos: [...palavras(e.termos.join(" ")), ...(e.lugares ?? []).flatMap((l) => lugares.get(l) ?? [])],
    resto: palavras([e.resumo, nomeObs.get(e.observatorio) ?? "", e.colecao ? (nomeCol.get(`${e.observatorio}/${e.colecao}`) ?? "") : ""].join(" ")),
  }));
  preparadas.set(indice, lista);
  return lista;
}

/** Cada palavra da busca começa alguma palavra do destino. */
const cobre = (busca: string[], destino: string[]) => busca.every((p) => destino.some((d) => d.startsWith(p)));

function nivel(p: Preparada, busca: string[], inteiro: string): Nivel | null {
  if (p.tituloInteiro === inteiro) return 0;
  if (cobre(busca, p.titulo)) return 1;
  if (cobre(busca, [...p.titulo, ...p.termos])) return 2;
  if (cobre(busca, [...p.titulo, ...p.termos, ...p.resto])) return 3;
  return null;
}

const PESO_TIPO: Record<EntradaBusca["tipo"], number> = { consulta: 0, colecao: 1, pagina: 2, pergunta: 3, observatorio: 4, metodo: 5, verbete: 6 };
const PESO_SITUACAO: Record<EntradaBusca["situacao"], number> = { publicado: 0, parcial: 1, previsto: 2 };

export function buscar(indice: IndiceBusca, termo: string, opcoes: OpcoesBusca = {}): RespostaBusca {
  const limite = opcoes.limite ?? LIMITE_RESULTADOS;
  const busca = palavrasDaBusca(termo);
  const inteiro = normalizar(termo);
  if (busca.length === 0) return { termo, resultados: [], grupos: [], cortado: false };
  const achados: Resultado[] = [];
  for (const p of preparar(indice)) {
    if (opcoes.colecao && p.e.colecao !== opcoes.colecao) continue;
    const n = nivel(p, busca, inteiro);
    if (n !== null) achados.push({ ...p.e, nivel: n });
  }
  achados.sort(
    (a, b) =>
      a.nivel - b.nivel ||
      PESO_SITUACAO[a.situacao] - PESO_SITUACAO[b.situacao] ||
      PESO_TIPO[a.tipo] - PESO_TIPO[b.tipo] ||
      a.titulo.length - b.titulo.length ||
      a.titulo.localeCompare(b.titulo, "pt-BR"),
  );
  const resultados = achados.slice(0, limite);
  return { termo, resultados, grupos: agrupar(indice, resultados), cortado: achados.length > limite };
}

/** Agrupa por observatório e coleção, preservando a ordem de relevância (o grupo entra quando o primeiro resultado dele aparece). */
export function agrupar(indice: IndiceBusca, resultados: Resultado[]): GrupoObservatorio[] {
  const obs = new Map(indice.observatorios.map((o) => [o.id, o]));
  const cols = new Map(indice.colecoes.map((c) => [`${c.observatorio}/${c.id}`, c]));
  const grupos: GrupoObservatorio[] = [];
  for (const r of resultados) {
    let g = grupos.find((x) => x.observatorio.id === r.observatorio);
    if (!g) {
      const o = obs.get(r.observatorio);
      g = { observatorio: { id: r.observatorio, nome: o?.nome ?? r.observatorio }, colecoes: [] };
      grupos.push(g);
    }
    const c = r.colecao ? cols.get(`${r.observatorio}/${r.colecao}`) : undefined;
    const idCol = c?.id ?? null;
    let gc = g.colecoes.find((x) => (x.colecao?.id ?? null) === idCol);
    if (!gc) {
      gc = { colecao: c ? { id: c.id, nome: c.nome, href: c.href } : null, resultados: [] };
      g.colecoes.push(gc);
    }
    gc.resultados.push(r);
  }
  return grupos;
}

/** Os resultados na ordem em que a lista os mostra (agrupados): é a ordem do teclado e do "Enter abre o primeiro". */
export function emOrdemDeTela(grupos: GrupoObservatorio[]): Resultado[] {
  return grupos.flatMap((g) => g.colecoes.flatMap((c) => c.resultados));
}
