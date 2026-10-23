/**
 * Correspondência e ordem da busca da plataforma, sem biblioteca: o índice tem poucas centenas de entradas e um vocabulário de
 * cerca de 1.500 palavras, e tudo cabe em código próprio. O leitor escreve como fala (diagnóstico da busca de 23/10/2026, achado
 * A1), então cada palavra digitada é tratada antes de casar:
 *
 *  - saem as vazias ("a", "de") e as de pergunta ("como funciona o PLD" é "pld");
 *  - o plural provável também procura o singular ("hospitais" acha "hospital"), só do lado de quem digita;
 *  - a palavra casa inteira ou como começo de uma palavra do destino; a de até três letras, quase sempre sigla, casa só inteira
 *    ("dec" não acha "declarados"), e só se assim nada aparecer vale o começo ("ce" ainda acha a CEMIG).
 *
 * Ordem, do mais forte ao mais fraco: título igual ao termo, ou a sigla do destino digitada inteira (nível 0); todas as palavras
 * no título (1); nos termos e nas listas de lugares (2); no resumo e nos nomes da coleção e do observatório (3). Entre iguais, a
 * consulta pessoal vem primeiro, depois a página publicada, a parcial e a prevista, que aparece só como "ainda sem página".
 *
 * Quando nenhum destino tem todas as palavras, a busca devolve o resultado parcial (nível 4) com as palavras que casaram, e a
 * palavra de cinco letras ou mais que não existe no índice recebe a correção pelo vocabulário (um erro de digitação; dois a
 * partir de oito letras). O mesmo código roda no servidor (/buscar) e no navegador (BuscaPlataforma).
 */
import { formasDe, normalizar, nucleoDaBusca, palavrasUteis } from "./normalizar";
import type { EntradaBusca, IndiceBusca } from "./tipos";

export const LIMITE_RESULTADOS = 30;
/** O resultado parcial é uma aproximação: poucos itens, para não parecer resposta. */
export const LIMITE_PARCIAL = 10;

/** Nível da correspondência: quanto menor, mais forte. 4 é o resultado parcial. */
export type Nivel = 0 | 1 | 2 | 3 | 4;

export type Resultado = EntradaBusca & {
  nivel: Nivel;
  /** No resultado parcial, as palavras digitadas que casaram com este destino, como foram escritas. */
  casou?: string[];
  /** A expressão dos termos que trouxe o destino quando a palavra não está no título nem no resumo ("via botijão"). */
  via?: string;
};

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
  /** Nenhum destino tem todas as palavras: os resultados são os mais próximos, cada um com as palavras que casaram. */
  parcial?: true;
  /** A busca rodou com a palavra corrigida pelo vocabulário do índice. */
  correcao?: { de: string; para: string };
  /** Mais de uma correção possível com resultado: as buscas sugeridas, sem resultado mostrado. */
  sugestoes?: string[];
};

export type OpcoesBusca = {
  /** Restringe à coleção (as buscas de uma coleção, como a do Setor Elétrico). */
  colecao?: string;
  limite?: number;
  /** Busca o termo como foi escrito, sem correção ("Buscar 'saneamneto' mesmo assim"). */
  semCorrecao?: boolean;
};

/** Uma expressão dos termos ou das listas de lugares, com o texto original para o "via". */
type Expressao = { original: string; palavras: string[] };

type Preparada = {
  e: EntradaBusca;
  titulo: string[];
  tituloInteiro: string;
  /**
   * Siglas do próprio destino: o primeiro termo, quando é só a sigla ("ANEEL" no verbete da agência), a sigla entre parênteses no
   * título ("Preço de curto prazo (PLD)") ou o título que é a sigla. A sigla solta no meio do título não conta: em "Agenda
   * Regulatória da ANEEL" ela qualifica o assunto, que é a agenda.
   */
  siglas: Set<string>;
  termos: string[];
  lugares: string[];
  expressoes: Expressao[];
  resto: string[];
};

type Pronto = {
  lista: Preparada[];
  /** Palavra do índice e em quantos destinos ela aparece (a correção prefere a mais frequente). */
  frequencia: Map<string, number>;
  palavras: string[];
  /**
   * As palavras que podem ser a correção de um erro de digitação: as de títulos e termos, sem siglas ("TFSEE" não é erro de
   * "TSEE") e sem as que só existem nas listas de lugares e nomes ("branca" não vira "Rio Branco").
   */
  corrigiveis: string[];
  /** A grafia com acento de cada palavra, para a correção ser mostrada como o índice a escreve ("saúde", não "saude"). */
  grafia: Map<string, string>;
};

const preparadas = new WeakMap<IndiceBusca, Pronto>();

const palavras = (s: string) => normalizar(s).split(" ").filter(Boolean);
const expressao = (original: string): Expressao => ({ original, palavras: palavras(original) });

/** Uma palavra como foi escrita: letras do português, com acento, e algarismos (o alvo do build não aceita a flag `u`). */
const PALAVRA = /[0-9A-Za-zÀ-ÖØ-öø-ÿ]+/g;

/** Sigla: só maiúsculas e algarismos, de duas a seis, com ao menos uma letra (ANEEL, PLD, 5G). */
const SIGLA = /^(?=.*[A-Z])[A-Z0-9]{2,6}$/;

function siglasDe(e: EntradaBusca): Set<string> {
  const s = new Set<string>();
  // só o primeiro termo: é onde o catálogo põe a sigla do destino (os verbetes do Aprenda); as siglas que vêm depois chegam
  // pelos grupos de sinônimos e são de outro destino ("PLD" nos termos do verbete Mercado de Curto Prazo, ou da coleção)
  const primeiro = e.termos[0]?.trim() ?? "";
  if (SIGLA.test(primeiro)) s.add(normalizar(primeiro));
  for (const m of e.titulo.matchAll(/\(([A-Z0-9]{2,6})\)/g)) if (SIGLA.test(m[1])) s.add(normalizar(m[1]));
  if (SIGLA.test(e.titulo.trim())) s.add(normalizar(e.titulo));
  return s;
}

function preparar(indice: IndiceBusca): Pronto {
  const pronto = preparadas.get(indice);
  if (pronto) return pronto;
  const nomeObs = new Map(indice.observatorios.map((o) => [o.id, o.nome]));
  const nomeCol = new Map(indice.colecoes.map((c) => [`${c.observatorio}/${c.id}`, c.nome]));
  const listas = new Map(Object.entries(indice.lugares ?? {}).map(([k, v]) => [k, v.map(expressao)]));
  const frequencia = new Map<string, number>();
  const grafia = new Map<string, string>();
  const corrigiveis = new Set<string>();
  /** Conta cada palavra uma vez por destino; as de `nomeiam` (título e termos) podem ser correção. */
  const contar = (nomeiam: string[], outros: string[] = []) => {
    const vistas = new Set<string>();
    for (const t of [...nomeiam, ...outros]) {
      const destino = nomeiam.includes(t);
      for (const bruta of t.match(PALAVRA) ?? []) {
        const n = normalizar(bruta);
        if (!n || n.includes(" ")) continue;
        if (!grafia.has(n)) grafia.set(n, SIGLA.test(bruta) ? bruta : bruta.toLowerCase());
        if (destino && !SIGLA.test(bruta) && n.length >= 4 && !/\d/.test(n)) corrigiveis.add(n);
        vistas.add(n);
      }
    }
    for (const n of vistas) frequencia.set(n, (frequencia.get(n) ?? 0) + 1);
  };
  const lista = indice.entradas.map((e) => {
    const resto = [e.resumo, nomeObs.get(e.observatorio) ?? "", e.colecao ? (nomeCol.get(`${e.observatorio}/${e.colecao}`) ?? "") : ""];
    // a correção aponta para palavra que nomeia destino (título e termos): o resumo tem flexões que confundem ("fiscalizada")
    contar([e.titulo, ...e.termos], resto);
    const lugares = (e.lugares ?? []).flatMap((l) => listas.get(l) ?? []);
    return {
      e,
      titulo: palavras(e.titulo),
      tituloInteiro: normalizar(e.titulo),
      siglas: siglasDe(e),
      termos: palavras(e.termos.join(" ")),
      lugares: lugares.flatMap((x) => x.palavras),
      expressoes: [...e.termos.map(expressao), ...lugares],
      resto: palavras(resto.join(" ")),
    };
  });
  for (const l of listas.values()) for (const x of l) contar([], [x.original]);
  for (const n of Array.from(corrigiveis)) if (SIGLA.test(grafia.get(n) ?? "")) corrigiveis.delete(n);
  const feito = { lista, frequencia, palavras: Array.from(frequencia.keys()), corrigiveis: Array.from(corrigiveis), grafia };
  preparadas.set(indice, feito);
  return feito;
}

/** Palavra de até três letras: quase sempre uma sigla (DEC, EAR, ONS). Casa inteira, salvo quando nada aparece assim. */
const CURTA = 3;

/** Alguma forma da palavra é uma palavra do destino, ou começa uma (a curta só começa quando `prefixoCurto`). */
function casa(formas: readonly string[], destino: readonly string[], prefixoCurto: boolean): boolean {
  return formas.some((f) => destino.includes(f) || ((f.length > CURTA || prefixoCurto) && destino.some((d) => d.startsWith(f))));
}

const PESO_TIPO: Record<EntradaBusca["tipo"], number> = { consulta: 0, colecao: 1, pagina: 2, pergunta: 3, observatorio: 4, metodo: 5, verbete: 6 };
const PESO_SITUACAO: Record<EntradaBusca["situacao"], number> = { publicado: 0, parcial: 1, previsto: 2 };

const ordem = (a: Resultado, b: Resultado) =>
  a.nivel - b.nivel ||
  PESO_SITUACAO[a.situacao] - PESO_SITUACAO[b.situacao] ||
  PESO_TIPO[a.tipo] - PESO_TIPO[b.tipo] ||
  a.titulo.length - b.titulo.length ||
  a.titulo.localeCompare(b.titulo, "pt-BR");

/** Uma palavra da busca: como foi escrita, normalizada e as suas formas. */
type Palavra = { escrita: string; norma: string; formas: string[] };

function palavrasDoTermo(termo: string): Palavra[] {
  const escritas = new Map<string, string>();
  for (const bruta of termo.match(PALAVRA) ?? []) {
    const n = normalizar(bruta);
    if (n && !escritas.has(n)) escritas.set(n, bruta);
  }
  return palavrasUteis(termo).map((norma) => ({ escrita: escritas.get(norma) ?? norma, norma, formas: formasDe(norma) }));
}

/** A expressão dos termos que melhor explica as palavras que só os termos tinham: a que casa mais delas e, entre iguais, a mais curta. */
function viaDe(p: Preparada, soNosTermos: Palavra[], prefixoCurto: boolean): string | undefined {
  let melhor: { original: string; n: number } | undefined;
  for (const x of p.expressoes) {
    const n = soNosTermos.filter((w) => casa(w.formas, x.palavras, prefixoCurto)).length;
    if (n > 0 && (!melhor || n > melhor.n || (n === melhor.n && x.original.length < melhor.original.length))) melhor = { original: x.original, n };
  }
  return melhor?.original;
}

/**
 * O parcial guarda, para a ordem, quais palavras casaram e a força de cada uma: sigla do destino 0, título 1, termos 2 (somadas).
 * `raridade` é preenchida depois: quantos destinos têm cada palavra casada, somados (a palavra rara diz mais que a comum).
 */
type Parcial = { r: Resultado; forca: number; indices: number[]; raridade: number };
type Rodada = { completos: Resultado[]; parciais: Parcial[] };

/**
 * No mesmo nível, o destino que só as listas de lugares e nomes trouxeram vem depois do que os termos trouxeram: "Amazônia" é o
 * Desmatamento antes do Banco da Amazônia, "safra" é o Agronegócio antes do Banco Safra (diagnóstico de 23/10/2026, achado A3).
 */
type Completo = { r: Resultado; soPorLugar: boolean };

function rodar(pronto: Pronto, busca: Palavra[], termo: string, opcoes: OpcoesBusca, prefixoCurto: boolean): Rodada {
  const inteiro = normalizar(termo);
  const nucleo = nucleoDaBusca(termo);
  const completos: Completo[] = [];
  const parciais: Parcial[] = [];
  const destinosDaPalavra = busca.map(() => 0);
  for (const p of pronto.lista) {
    if (opcoes.colecao && p.e.colecao !== opcoes.colecao) continue;
    const noTitulo = busca.map((w) => casa(w.formas, p.titulo, prefixoCurto));
    const nosTermos = busca.map((w) => casa(w.formas, p.termos, prefixoCurto));
    const nosLugares = busca.map((w) => casa(w.formas, p.lugares, prefixoCurto));
    const noResto = busca.map((w) => casa(w.formas, p.resto, prefixoCurto));
    const igual = p.tituloInteiro === inteiro || p.tituloInteiro === nucleo;
    const sigla = busca.length === 1 && p.siglas.has(busca[0].norma);
    let nivel: Nivel | null = null;
    if (igual || sigla) nivel = 0;
    else if (noTitulo.every(Boolean)) nivel = 1;
    else if (busca.every((_, k) => noTitulo[k] || nosTermos[k] || nosLugares[k])) nivel = 2;
    else if (busca.every((_, k) => noTitulo[k] || nosTermos[k] || nosLugares[k] || noResto[k])) nivel = 3;
    busca.forEach((_, k) => {
      if (noTitulo[k] || nosTermos[k]) destinosDaPalavra[k] += 1;
    });
    const soNosTermos = busca.filter((_, k) => !noTitulo[k] && !noResto[k] && (nosTermos[k] || nosLugares[k]));
    // o título igual e a sigla do próprio destino já explicam o resultado
    const via = igual || sigla ? undefined : viaDe(p, soNosTermos, prefixoCurto);
    if (nivel !== null) {
      const soPorLugar = nivel >= 2 && busca.some((_, k) => nosLugares[k] && !noTitulo[k] && !nosTermos[k] && !noResto[k]);
      completos.push({ r: { ...p.e, nivel, ...(via ? { via } : {}) }, soPorLugar });
      continue;
    }
    // parcial: só título e termos contam; as listas de lugares ficam fora ("Belo Horizonte" não traz "Novo Horizonte")
    const casou = busca.filter((_, k) => noTitulo[k] || nosTermos[k]);
    if (casou.length > 0 && casou.length >= Math.ceil(busca.length / 2)) {
      const viaParcial = viaDe(p, busca.filter((_, k) => !noTitulo[k] && !noResto[k] && nosTermos[k]), prefixoCurto);
      const r: Resultado = { ...p.e, nivel: 4, casou: casou.map((w) => w.escrita), ...(viaParcial ? { via: viaParcial } : {}) };
      const forca = busca.reduce((t, w, k) => t + (!(noTitulo[k] || nosTermos[k]) ? 0 : p.siglas.has(w.norma) ? 0 : noTitulo[k] ? 1 : 2), 0);
      const indices = busca.map((_, k) => k).filter((k) => noTitulo[k] || nosTermos[k]);
      parciais.push({ r, forca, indices, raridade: 0 });
    }
  }
  for (const x of parciais) x.raridade = x.indices.reduce((t, k) => t + destinosDaPalavra[k], 0);
  completos.sort((a, b) => a.r.nivel - b.r.nivel || Number(a.soPorLugar) - Number(b.soPorLugar) || ordem(a.r, b.r));
  return { completos: completos.map((x) => x.r), parciais };
}

/**
 * Ordem do parcial: mais palavras casadas primeiro; entre iguais, a palavra mais rara antes ("judiciário" diz mais que "custa"),
 * e o melhor destino de cada combinação de palavras antes dos demais, para "juros do cartão" mostrar o mais próximo por "cartão"
 * e o mais próximo por "juros", e não dez por "juros".
 */
function ordenarParcial(parciais: Parcial[]): Resultado[] {
  const base = [...parciais]
    .sort((a, b) => b.r.casou!.length - a.r.casou!.length || a.raridade - b.raridade || a.forca - b.forca || ordem(a.r, b.r))
    .map((x) => x.r);
  const saida: Resultado[] = [];
  const porQuantas = new Map<number, Resultado[]>();
  for (const r of base) porQuantas.set(r.casou!.length, [...(porQuantas.get(r.casou!.length) ?? []), r]);
  for (const grupo of porQuantas.values()) {
    const vistas = new Set<string>();
    const primeiros = grupo.filter((r) => {
      const k = r.casou!.join(" ");
      if (vistas.has(k)) return false;
      vistas.add(k);
      return true;
    });
    saida.push(...primeiros, ...grupo.filter((r) => !primeiros.includes(r)));
  }
  return saida;
}

/** Alguma forma da palavra é palavra do índice ou começa uma. */
const existe = (pronto: Pronto, w: Palavra, prefixoCurto: boolean) => casa(w.formas, pronto.palavras, prefixoCurto);

/** Uma rodada completa: palavra curta inteira e, se nada aparece, pelo começo; o parcial quando nenhum destino tem todas. */
function procurar(pronto: Pronto, busca: Palavra[], termo: string, opcoes: OpcoesBusca): { resultados: Resultado[]; parcial: boolean; total: number } {
  const temCurta = busca.some((w) => w.norma.length <= CURTA);
  let rodada: Rodada | null = null;
  let prefixoCurto = !temCurta;
  for (const pc of temCurta ? [false, true] : [true]) {
    prefixoCurto = pc;
    rodada = rodar(pronto, busca, termo, opcoes, pc);
    if (rodada.completos.length) break;
  }
  const { completos, parciais } = rodada!;
  if (completos.length) return { resultados: completos, parcial: false, total: completos.length };
  // parcial: três palavras úteis ou mais, ou duas que o índice conhece (com uma desconhecida, a metade seria uma palavra só)
  const podeParcial = busca.length >= 3 || (busca.length === 2 && busca.every((w) => existe(pronto, w, prefixoCurto)));
  if (!podeParcial || !parciais.length) return { resultados: [], parcial: false, total: 0 };
  const ordenados = ordenarParcial(parciais);
  return { resultados: ordenados, parcial: true, total: ordenados.length };
}

/** Distância de Damerau e Levenshtein (transposição de vizinhas conta um), com saída antecipada acima de `max`. */
export function distancia(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let antes = new Array<number>(b.length + 1).fill(0);
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const atual = new Array<number>(b.length + 1).fill(0);
    atual[0] = i;
    let menor = i;
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, antes[j - 2] + 1);
      atual[j] = v;
      if (v < menor) menor = v;
    }
    if (menor > max) return max + 1;
    antes = anterior;
    anterior = atual;
  }
  return anterior[b.length];
}

/**
 * As palavras do índice a um erro de digitação (dois a partir de oito letras), com a mesma primeira letra, só as mais próximas e,
 * entre elas, das mais para as menos frequentes. O corte em três vem depois de cada uma ser buscada (com o filtro de coleção),
 * para a candidata certa da busca local não ficar de fora por ser menos frequente no índice inteiro.
 */
function candidatas(pronto: Pronto, w: Palavra): string[] {
  const max = w.norma.length >= 8 ? 2 : 1;
  const achadas: { p: string; d: number; f: number }[] = [];
  for (const p of pronto.corrigiveis) {
    // a primeira letra fica: o erro de digitação raramente está nela, e a troca dela muda de nome ("dólar" não é "solar")
    if (p[0] !== w.norma[0]) continue;
    const d = distancia(w.norma, p, max);
    if (d <= max) achadas.push({ p, d, f: pronto.frequencia.get(p) ?? 0 });
  }
  achadas.sort((a, b) => a.d - b.d || b.f - a.f || a.p.localeCompare(b.p));
  const menor = achadas[0]?.d;
  return achadas.filter((x) => x.d === menor).slice(0, LIMITE_CANDIDATAS).map((x) => x.p);
}

/** Teto de candidatas buscadas por palavra: limita o trabalho a cada tecla, muito acima das que aparecem na prática. */
const LIMITE_CANDIDATAS = 12;

/** O termo com as palavras trocadas, preservando o resto do que se escreveu. */
function trocar(termo: string, trocas: Map<string, string>): string {
  return termo.replace(PALAVRA, (bruta) => trocas.get(normalizar(bruta)) ?? bruta).trim();
}

export function buscar(indice: IndiceBusca, termo: string, opcoes: OpcoesBusca = {}): RespostaBusca {
  const limite = opcoes.limite ?? LIMITE_RESULTADOS;
  const busca = palavrasDoTermo(termo);
  if (busca.length === 0) return { termo, resultados: [], grupos: [], cortado: false };
  const pronto = preparar(indice);
  const resposta = (r: { resultados: Resultado[]; parcial: boolean; total: number }, extra: Partial<RespostaBusca> = {}): RespostaBusca => {
    const teto = r.parcial ? Math.min(limite, LIMITE_PARCIAL) : limite;
    const resultados = r.resultados.slice(0, teto);
    return { termo, resultados, grupos: agrupar(indice, resultados), cortado: r.total > teto, ...(r.parcial ? { parcial: true as const } : {}), ...extra };
  };

  const direto = procurar(pronto, busca, termo, opcoes);
  // a correção só entra quando a busca como foi escrita não completa nada e alguma palavra não existe no índice
  if ((direto.resultados.length && !direto.parcial) || opcoes.semCorrecao) return resposta(direto);
  const erradas = busca.filter((w) => w.norma.length >= 5 && !/\d/.test(w.norma) && !existe(pronto, w, true));
  if (!erradas.length) return resposta(direto);
  const opcoesPorPalavra = erradas.map((w) => candidatas(pronto, w).map((c) => [w.norma, c] as const));
  if (opcoesPorPalavra.some((o) => o.length === 0)) return resposta(direto);
  // as combinações das trocas (na prática, uma palavra errada e até três candidatas)
  let combinacoes: (readonly [string, string])[][] = [[]];
  for (const o of opcoesPorPalavra) combinacoes = combinacoes.flatMap((c) => o.map((x) => [...c, x])).slice(0, LIMITE_CANDIDATAS);
  const comResultado = combinacoes
    .map((c) => {
      const para = trocar(termo, new Map(c.map(([de, por]) => [de, pronto.grafia.get(por) ?? por])));
      return { para, r: procurar(pronto, palavrasDoTermo(para), para, opcoes) };
    })
    .filter((x) => x.r.resultados.length > 0);
  if (comResultado.length === 1) return resposta(comResultado[0].r, { correcao: { de: termo.trim(), para: comResultado[0].para } });
  if (comResultado.length > 1) return { termo, resultados: [], grupos: [], cortado: false, sugestoes: comResultado.slice(0, 3).map((x) => x.para) };
  return resposta(direto);
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
