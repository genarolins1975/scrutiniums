/**
 * Lógica pura do mapa coroplético (src/components/energia/MapaCoropletico.tsx),
 * testável em node: cores das classes, os três estados de uma região,
 * descrição textual (dica, lista, tabela e leitor de tela dizem o mesmo),
 * resumo da cobertura, busca de regiões e navegação da lista por teclado.
 *
 * As classes vêm de src/lib/energia/escalas.ts (quantis, intervalos iguais ou
 * quebras fixas). Três estados nunca se confundem: número (zero inclusive, que
 * recebe a cor da sua classe), ausência ("sem dado", hachura) e "não se
 * aplica" (cinza liso, com rótulo). Um valor informado para um id que não tem
 * polígono na malha não some calado: entra no resumo como fora da malha.
 */
import { NAO_SE_APLICA, classeDe, formatarValor, valido, type Classificacao, type ValorClassificavel } from "@/lib/energia/escalas";

/* ---------- cores ---------- */

/** Mesma regra do mapa de calor: cor só por variável CSS do design system (ou color-mix dela). */
export const COR_TOKEN = /^(var\(--[a-z0-9-]+\)|color-mix\(.*var\(--[a-z0-9-]+\).*\))$/i;

/**
 * Cinza claro liso de "não se aplica" (a região existe, mas a medida não faz
 * sentido nela). Bege acinzentado, e não o teal claro de energia-fundo, para
 * não se confundir com a primeira classe das paletas sequenciais do domínio.
 */
export const COR_NAO_SE_APLICA_PADRAO = "var(--cor-linha)";

/** Problemas da paleta; lista vazia quando está consistente. */
export function validaCores(cores: readonly string[], classes: number): string[] {
  const erros: string[] = [];
  const soltas = cores.filter((c) => !COR_TOKEN.test(c.trim()));
  if (soltas.length) erros.push(`cor fora dos tokens (use var(--...)): ${soltas.join(", ")}`);
  if (classes > cores.length) erros.push(`são ${classes} classes e só ${cores.length} cores`);
  return erros;
}

/**
 * Cor de cada classe. Quando a classificação tem menos classes que a paleta
 * (quantis com empates descartam cortes repetidos), as cores são espalhadas
 * pela paleta inteira, das pontas para dentro: com 3 classes numa paleta de 5,
 * usam-se a 1ª, a 3ª e a 5ª, e o mapa continua indo do claro ao escuro em vez
 * de parar no meio da escala.
 */
export function coresParaClasses(cores: readonly string[], classes: number): string[] {
  if (classes <= 0) return [];
  if (classes >= cores.length) return cores.slice(0, classes);
  if (classes === 1) return [cores[Math.floor((cores.length - 1) / 2)]];
  return Array.from({ length: classes }, (_, i) => cores[Math.round((i * (cores.length - 1)) / (classes - 1))]);
}

/* ---------- estados e texto ---------- */

export type EstadoRegiao = "valor" | "sem-dado" | "nao-se-aplica";

export function estadoRegiao(v: ValorClassificavel): EstadoRegiao {
  if (v === NAO_SE_APLICA) return "nao-se-aplica";
  return valido(v) ? "valor" : "sem-dado";
}

export type Fundos = { classes: readonly string[]; semDado: string; naoSeAplica: string };

/** Preenchimento de uma região: cor da classe, hachura (sem dado) ou cinza liso (não se aplica). */
export function preenchimento(v: ValorClassificavel, c: Pick<Classificacao, "cortes" | "classes">, f: Fundos): string {
  const k = classeDe(v, c);
  if (k === NAO_SE_APLICA) return f.naoSeAplica;
  if (typeof k !== "number") return f.semDado;
  return f.classes[k] ?? f.semDado;
}

export type Descricao = { estado: EstadoRegiao; valor: string; classe: string | null; indice: number | null };

/**
 * Texto de uma região. "sem dado" e "não se aplica" nunca levam classe; zero
 * leva a classe que o contém, como qualquer número.
 */
export function descreveRegiao(v: ValorClassificavel, c: Pick<Classificacao, "cortes" | "classes">, casas: number, unidade: string): Descricao {
  const estado = estadoRegiao(v);
  if (estado === "nao-se-aplica") return { estado, valor: "não se aplica", classe: null, indice: null };
  const k = classeDe(v, c);
  if (estado === "sem-dado" || typeof k !== "number") return { estado: "sem-dado", valor: "sem dado", classe: null, indice: null };
  return { estado, valor: formatarValor(v as number, casas, unidade), classe: c.classes[k].rotulo, indice: k };
}

/** Frase completa para leitor de tela e dica: "Campinas (SP): 12,3% (classe 10,0 a menos de 15,0)". */
export function fraseRegiao(r: { nome: string; uf: string }, d: Descricao): string {
  const onde = r.uf && r.uf !== r.nome ? `${r.nome} (${r.uf})` : r.nome;
  return `${onde}: ${d.valor}${d.classe ? ` (classe ${d.classe})` : ""}`;
}

/* ---------- resumo ---------- */

export type ResumoMapa = {
  regioes: number;
  comValor: number;
  semDado: number;
  naoSeAplica: number;
  /** Regiões com valor exatamente zero (recebem a cor da sua classe). */
  zeros: number;
  minimo: number | null;
  maximo: number | null;
  /** Ids com valor informado e sem polígono na malha: não aparecem no desenho. */
  foraDaMalha: string[];
};

export function resumoMapa(ids: readonly string[], valores: Readonly<Record<string, ValorClassificavel>>): ResumoMapa {
  const r: ResumoMapa = { regioes: ids.length, comValor: 0, semDado: 0, naoSeAplica: 0, zeros: 0, minimo: null, maximo: null, foraDaMalha: [] };
  const presentes = new Set(ids);
  for (const id of ids) {
    const v = valores[id];
    const e = estadoRegiao(v);
    if (e === "nao-se-aplica") r.naoSeAplica++;
    else if (e === "sem-dado") r.semDado++;
    else {
      const n = v as number;
      r.comValor++;
      if (n === 0) r.zeros++;
      if (r.minimo === null || n < r.minimo) r.minimo = n;
      if (r.maximo === null || n > r.maximo) r.maximo = n;
    }
  }
  for (const id of Object.keys(valores)) {
    // só conta como fora da malha o que foi de fato informado (ausência explícita não é valor)
    if (!presentes.has(id) && valores[id] !== undefined) r.foraDaMalha.push(id);
  }
  r.foraDaMalha.sort();
  return r;
}

/* ---------- busca ---------- */

/** Minúsculas e sem acento: "São José" e "sao jose" são a mesma busca. */
export function normalizaBusca(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const COLLATOR = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

type Regiao = { id: string; nome: string; uf: string };

/**
 * Regiões que casam com a consulta, das mais prováveis para as menos: nome
 * exato, nome que começa pela consulta, palavra do nome que começa por ela,
 * nome que a contém e, por fim, código IBGE. Cada termo precisa casar com o
 * nome, com a sigla da UF ou com o código ("santa maria rs" acha a do Rio
 * Grande do Sul). Consulta vazia devolve todas em ordem alfabética. `total` é o
 * número de regiões encontradas antes do limite.
 */
export function buscarRegioes<T extends Regiao>(itens: readonly T[], consulta: string, limite = 50): { itens: T[]; total: number } {
  const q = normalizaBusca(consulta);
  if (!q) {
    const todos = [...itens].sort((a, b) => COLLATOR.compare(a.nome, b.nome) || COLLATOR.compare(a.uf, b.uf));
    return { itens: todos.slice(0, limite), total: todos.length };
  }
  const termos = q.split(" ");
  const achados: { t: T; rank: number }[] = [];
  for (const t of itens) {
    const nome = normalizaBusca(t.nome);
    const uf = normalizaBusca(t.uf);
    const palavras = nome.split(/[\s'-]+/);
    // termos que são a sigla da UF filtram por UF; os demais precisam casar com o nome ou o código
    const termosNome = termos.filter((w) => !(w.length === 2 && w === uf && termos.length > 1));
    const ok = termos.every((w) => nome.includes(w) || w === uf || t.id.startsWith(w));
    if (!ok) continue;
    const qn = termosNome.join(" ");
    let rank = 4;
    if (nome === qn) rank = 0;
    else if (nome.startsWith(qn)) rank = 1;
    else if (palavras.some((p) => p.startsWith(termosNome[0] ?? ""))) rank = 2;
    else if (nome.includes(qn)) rank = 3;
    achados.push({ t, rank });
  }
  achados.sort((a, b) => a.rank - b.rank || COLLATOR.compare(a.t.nome, b.t.nome) || COLLATOR.compare(a.t.uf, b.t.uf));
  return { itens: achados.slice(0, limite).map((a) => a.t), total: achados.length };
}

/* ---------- teclado na lista ---------- */

/**
 * Próximo índice ativo da lista de regiões (padrão combobox do WAI-ARIA):
 * setas andam um, Page Up e Page Down andam uma página, Home e End vão às
 * pontas (só quando a lista está aberta; fechada, o campo de texto usa essas
 * teclas). Sem item ativo, a seta para baixo vai ao primeiro e a para cima ao
 * último. Null para tecla que não move.
 */
export function moverNaLista(atual: number, tecla: string, n: number, pagina = 10): number | null {
  if (n <= 0) return null;
  const lim = (i: number) => Math.min(n - 1, Math.max(0, i));
  switch (tecla) {
    case "ArrowDown":
      return atual < 0 ? 0 : lim(atual + 1);
    case "ArrowUp":
      return atual < 0 ? n - 1 : lim(atual - 1);
    case "PageDown":
      return lim((atual < 0 ? 0 : atual) + pagina);
    case "PageUp":
      return lim((atual < 0 ? 0 : atual) - pagina);
    case "Home":
      return 0;
    case "End":
      return n - 1;
    default:
      return null;
  }
}
