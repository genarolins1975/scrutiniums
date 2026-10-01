/**
 * Estado de consulta na URL: busca, filtros, ordem, página e entidades em
 * comparação ficam nos parâmetros de consulta, para que um link compartilhado
 * reabra o mesmo recorte e o voltar/avançar do navegador percorra as seleções
 * (especificação, seção 7.3: "URLs reproduzíveis e funcionamento do
 * voltar/avançar do navegador").
 *
 * Lógica pura, sem React e testável em node; o hook useEstadoUrl
 * (src/components/energia/useEstadoUrl.ts) só liga estas funções ao window.
 *
 * Regras:
 * - parâmetro ausente vale o padrão; valor inválido (número malformado ou fora
 *   da faixa, data que não existe no calendário, opção desconhecida) também
 *   volta ao padrão, em vez de derrubar a página ou mostrar um recorte vazio
 *   que ninguém pediu;
 * - o padrão não é escrito na URL: o link fica curto e cada estado tem uma
 *   única forma;
 * - parâmetros fora do esquema (o ?modo= do ModoProfundidade, utm_*, os de
 *   outro componente da mesma página) são preservados byte a byte e na mesma
 *   ordem; o fragmento (#âncora) também;
 * - listas usam vírgula, legível no link; vírgula e % dentro de um item são
 *   escapados, então nenhum item se parte em dois.
 */

export type ModoHistorico = "push" | "replace";

/** Conversor entre o texto de um parâmetro (já decodificado) e o valor tipado. */
export type Leitor<T> = {
  /** Texto decodificado da URL para o valor; undefined = inválido (vale o padrão). */
  ler: (bruto: string) => T | undefined;
  /** Valor para o texto decodificado a gravar (a codificação da URL é feita depois). */
  escrever: (v: T) => string;
  /** Igualdade de valores (padrão: comparação estrutural). */
  igual?: (a: T, b: T) => boolean;
};

export type Campo<T> = {
  tipo: Leitor<T>;
  padrao: T;
  /** Nome do parâmetro na URL (padrão: a chave do esquema). */
  param?: string;
  /**
   * push (padrão): cada mudança vira uma entrada no histórico, e o voltar a
   * desfaz. replace: substitui a entrada atual (digitação em campo de busca,
   * troca de página), sem encher o histórico.
   */
  historico?: ModoHistorico;
};

// Campo<any>: o esquema mistura tipos diferentes (texto, lista, número) e Leitor<T> é invariante em T
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Esquema = Record<string, Campo<any>>;
export type ValoresDe<E extends Esquema> = { [K in keyof E]: E[K]["padrao"] };

/**
 * Atalho que infere T só pelo leitor (NoInfer no padrão): lista(opcao(["SE", "S"])) com padrão ["SE"]
 * fica tipada como a união das opções, e a lista vazia não vira never[].
 */
export function campo<T>(tipo: Leitor<T>, padrao: NoInfer<T>, opcoes: { param?: string; historico?: ModoHistorico } = {}): Campo<T> {
  return { tipo, padrao, ...opcoes };
}

/* ---------- igualdade ---------- */

/** Igualdade estrutural de valores de URL (primitivos, listas e objetos simples). */
export function mesmoValor(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => mesmoValor(x, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => mesmoValor((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function igualCampo(c: Campo<any>, a: unknown, b: unknown): boolean {
  return (c.tipo.igual ?? mesmoValor)(a, b);
}

/* ---------- leitores ---------- */

function texto({ max = 200 }: { max?: number } = {}): Leitor<string> {
  return {
    // o texto é guardado como veio (a busca normaliza depois); só espaço em branco conta como vazio
    ler: (b) => (b.trim() ? b.slice(0, max) : undefined),
    escrever: (v) => v,
  };
}

function opcao<const T extends string>(valores: readonly T[]): Leitor<T> {
  const validos = new Set<string>(valores);
  return { ler: (b) => (validos.has(b) ? (b as T) : undefined), escrever: (v) => v };
}

const RE_NUMERO = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const RE_INTEIRO = /^-?\d+$/;

/**
 * Número com ponto decimal ("12.5"). Vírgula decimal, hexadecimal ("0x10"),
 * "Infinity", vazio e valor fora de [min, max] são inválidos: Number() aceitaria
 * parte deles e abriria a página num recorte que ninguém escreveu.
 */
function numero({ min = -Infinity, max = Infinity, inteiro = false }: { min?: number; max?: number; inteiro?: boolean } = {}): Leitor<number> {
  return {
    ler: (b) => {
      const t = b.trim();
      if (!(inteiro ? RE_INTEIRO : RE_NUMERO).test(t)) return undefined;
      const v = Number(t);
      if (!Number.isFinite(v) || v < min || v > max) return undefined;
      return v === 0 ? 0 : v; // sem zero negativo
    },
    escrever: (v) => String(v),
  };
}

function inteiro(op: { min?: number; max?: number } = {}): Leitor<number> {
  return numero({ ...op, inteiro: true });
}

function booleano(): Leitor<boolean> {
  return {
    ler: (b) => (/^(1|true|sim)$/i.test(b) ? true : /^(0|false|nao|não)$/i.test(b) ? false : undefined),
    escrever: (v) => (v ? "1" : "0"),
  };
}

/** AAAA-MM-DD que existe no calendário (2023-02-29 e 2024-13-01 são inválidos). */
export function dataValida(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mes < 1 || mes > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(2000, mes, 0));
  dt.setUTCFullYear(a, mes, 0); // último dia do mês, inclusive em anos antes de 100
  return d <= dt.getUTCDate();
}

/** Data AAAA-MM-DD, opcionalmente limitada a [min, max] (mesmo formato). */
function data({ min, max }: { min?: string; max?: string } = {}): Leitor<string> {
  return {
    ler: (b) => (dataValida(b) && (!min || b >= min) && (!max || b <= max) ? b : undefined),
    escrever: (v) => v,
  };
}

/** Mês AAAA-MM. */
function mes({ min, max }: { min?: string; max?: string } = {}): Leitor<string> {
  return {
    ler: (b) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(b) && (!min || b >= min) && (!max || b <= max) ? b : undefined),
    escrever: (v) => v,
  };
}

function escaparItem(s: string): string {
  return s.replace(/%/g, "%25").replace(/,/g, "%2C");
}
function desescaparItem(s: string): string {
  return s.replace(/%(25|2C)/gi, (_, c: string) => (c === "25" ? "%" : ","));
}

/**
 * Lista separada por vírgula. Itens inválidos são descartados e os válidos
 * ficam (um código desconhecido não apaga a comparação inteira); se nenhum
 * item for válido, vale o padrão. Parâmetro presente e vazio (?ent=) é a lista
 * vazia explícita, distinta do padrão. Repetidos saem (unicos) e o excesso
 * além de max é cortado, preservando a ordem de escolha.
 */
function lista<T>(item: Leitor<T>, { max = Infinity, unicos = true }: { max?: number; unicos?: boolean } = {}): Leitor<T[]> {
  const igualItem = item.igual ?? mesmoValor;
  return {
    ler: (b) => {
      if (b === "") return [];
      const out: T[] = [];
      for (const parte of b.split(",")) {
        if (out.length >= max) break;
        let v: T | undefined;
        try {
          v = item.ler(desescaparItem(parte));
        } catch {
          v = undefined;
        }
        if (v === undefined) continue;
        if (unicos && out.some((o) => igualItem(o, v as T))) continue;
        out.push(v);
      }
      return out.length ? out : undefined;
    },
    escrever: (v) => v.map((x) => escaparItem(item.escrever(x))).join(","),
    igual: (a, b) => a.length === b.length && a.every((x, i) => igualItem(x, b[i])),
  };
}

export type OrdemUrl = { coluna: string; direcao: "asc" | "desc" } | null;

/**
 * Ordenação de tabela: "coluna" (crescente) ou "-coluna" (decrescente); só
 * colunas conhecidas. Vazio (?ord=) é "sem ordenação", distinto do padrão
 * quando a tabela tem uma ordem inicial.
 */
function ordem(colunas: readonly string[]): Leitor<OrdemUrl> {
  const validas = new Set(colunas);
  return {
    ler: (b) => {
      if (b === "") return null;
      const desc = b.startsWith("-");
      const c = desc ? b.slice(1) : b;
      return validas.has(c) ? { coluna: c, direcao: desc ? "desc" : "asc" } : undefined;
    },
    escrever: (v) => (v ? `${v.direcao === "desc" ? "-" : ""}${v.coluna}` : ""),
  };
}

export const tiposUrl = { texto, opcao, numero, inteiro, booleano, data, mes, lista, ordem };

/* ---------- leitura e escrita da busca ---------- */

/** Codifica um valor para a URL mantendo legíveis vírgula, dois-pontos e barra (permitidos na consulta). */
export function codificar(v: string): string {
  return encodeURIComponent(v).replace(/%2C/g, ",").replace(/%3A/g, ":").replace(/%2F/g, "/");
}

function decodificar(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s; // % malformado: usa o texto cru em vez de derrubar a página
  }
}

/** Valores do esquema lidos de uma busca ("?a=1&b=2" ou "a=1&b=2"). */
export function lerEstado<E extends Esquema>(esquema: E, busca: string): ValoresDe<E> {
  const sp = new URLSearchParams(busca.startsWith("?") ? busca.slice(1) : busca);
  const out: Record<string, unknown> = {};
  for (const [k, c] of Object.entries(esquema)) {
    const bruto = sp.get(c.param ?? k);
    let v: unknown;
    if (bruto !== null) {
      try {
        v = c.tipo.ler(bruto);
      } catch {
        v = undefined;
      }
    }
    out[k] = v === undefined ? c.padrao : v;
  }
  return out as ValoresDe<E>;
}

/**
 * Nova busca ("?..." ou "") com os valores do esquema aplicados sobre a busca
 * atual. Parâmetros alheios ficam exatamente como estavam (mesma codificação,
 * mesma ordem); parâmetro gerenciado já presente é trocado no lugar; valor
 * igual ao padrão é removido; repetições de um parâmetro gerenciado somem.
 */
export function escreverEstado<E extends Esquema>(esquema: E, valores: Partial<ValoresDe<E>>, buscaAtual: string): string {
  const gerenciados = new Map<string, string | null>();
  for (const [k, c] of Object.entries(esquema)) {
    const v = (valores as Record<string, unknown>)[k];
    gerenciados.set(c.param ?? k, v === undefined || igualCampo(c, v, c.padrao) ? null : c.tipo.escrever(v));
  }
  const saida: string[] = [];
  const usados = new Set<string>();
  const cru = buscaAtual.startsWith("?") ? buscaAtual.slice(1) : buscaAtual;
  for (const par of cru.split("&")) {
    if (!par) continue;
    const i = par.indexOf("=");
    const chave = decodificar(i < 0 ? par : par.slice(0, i));
    if (!gerenciados.has(chave)) {
      saida.push(par);
      continue;
    }
    if (usados.has(chave)) continue;
    usados.add(chave);
    const v = gerenciados.get(chave);
    if (v !== null && v !== undefined) saida.push(`${codificar(chave)}=${codificar(v)}`);
  }
  gerenciados.forEach((v, chave) => {
    if (!usados.has(chave) && v !== null) saida.push(`${codificar(chave)}=${codificar(v)}`);
  });
  return saida.length ? `?${saida.join("&")}` : "";
}

/** Reaproveita os valores anteriores iguais (mesma referência): listas não mudam de identidade à toa. */
export function estabilizar<E extends Esquema>(esquema: E, anterior: ValoresDe<E>, novo: ValoresDe<E>): ValoresDe<E> {
  let mudou = false;
  const out: Record<string, unknown> = {};
  for (const [k, c] of Object.entries(esquema)) {
    const a = (anterior as Record<string, unknown>)[k];
    const b = (novo as Record<string, unknown>)[k];
    if (igualCampo(c, a, b)) out[k] = a;
    else {
      out[k] = b;
      mudou = true;
    }
  }
  return mudou ? (out as ValoresDe<E>) : anterior;
}

/** Chaves do esquema cujo valor muda com a alteração proposta. */
export function chavesAlteradas<E extends Esquema>(esquema: E, atual: ValoresDe<E>, parcial: Partial<ValoresDe<E>>): string[] {
  return Object.keys(parcial).filter(
    (k) => k in esquema && !igualCampo(esquema[k], (atual as Record<string, unknown>)[k], (parcial as Record<string, unknown>)[k]),
  );
}

/**
 * Modo de gravação no histórico: o explícito vence; senão, basta uma chave
 * alterada em modo push (seleção, filtro, ordem) para a mudança virar entrada
 * nova; só mudanças inteiramente em modo replace (digitação, página) substituem.
 */
export function modoHistorico(esquema: Esquema, chaves: readonly string[], explicito?: ModoHistorico): ModoHistorico {
  if (explicito) return explicito;
  return chaves.some((k) => (esquema[k]?.historico ?? "push") === "push") ? "push" : "replace";
}

/** O mínimo de window que a gravação usa (permite testar com um histórico falso). */
export type JanelaUrl = {
  location: { pathname: string; search: string; hash: string };
  history: {
    pushState: (data: unknown, unused: string, url?: string | null) => void;
    replaceState: (data: unknown, unused: string, url?: string | null) => void;
  };
};

/**
 * Grava os valores na URL da janela com pushState ou replaceState, sobre a
 * busca atual (outros parâmetros e #âncora preservados). Não grava nada quando
 * a busca não muda: clicar de novo na mesma opção não cria entrada repetida no
 * histórico. O estado passado é null: o App Router do Next (14.2) intercepta
 * pushState/replaceState, copia o próprio estado interno para a entrada e
 * restaura a rota no voltar. Devolve o endereço gravado ou null.
 */
export function gravarNaUrl<E extends Esquema>(janela: JanelaUrl, esquema: E, valores: ValoresDe<E>, modo: ModoHistorico): string | null {
  const atual = janela.location.search;
  const busca = escreverEstado(esquema, valores, atual);
  if (busca === atual || (busca === "" && atual === "?")) return null;
  const href = `${janela.location.pathname}${busca}${janela.location.hash}`;
  try {
    if (modo === "push") janela.history.pushState(null, "", href);
    else janela.history.replaceState(null, "", href);
  } catch {
    // navegadores limitam a frequência de replaceState (Safari lança erro): o estado local segue valendo
    return null;
  }
  return href;
}

/** searchParams de uma página do App Router como busca ("?a=1&b=2"), para o HTML do servidor já refletir o recorte. */
export function buscaDeParametros(sp: Record<string, string | string[] | undefined> | null | undefined): string {
  if (!sp) return "";
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) u.append(k, x);
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}
