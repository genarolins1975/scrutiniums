/**
 * Navegação de uma coleção como o navegador a recebe (NavegacaoColecao): os destinos de primeiro nível, as subpáginas de
 * cada um e os três atalhos fixos. Sem catálogo: o servidor monta a lista (navegacaoColecao.ts) e o navegador só decide,
 * a cada navegação, qual destino é o atual. Iniciativa 2 do parecer de UX de 21/10/2026.
 */
import type { Prontidao } from "@/components/observatorios/SeloProntidao";
import type { Dominio } from "@/lib/dominios";
import { caminhoPublico } from "./contextoPuro";

/** Página da navegação. `publicado: false` aparece como texto com o selo "em preparação" (SeloProntidao), nunca como link. */
export type PaginaNav = { rotulo: string; href: string; publicado: boolean };

export type ItemNav = PaginaNav & {
  /** Subpáginas do destino, mostradas na segunda linha quando ele é o atual. */
  subpaginas?: PaginaNav[];
};

export type AtalhosNav = { dados?: string; metodo?: string; glossario?: string };

export type NavegacaoDaColecao = {
  /** Id da coleção no registro (lista.ts) ou do observatório, quando ele mesmo mantém os painéis (Território e Clima). */
  id: string;
  /** Nome que vai no aria-label: "Navegação da coleção X" (ou "do observatório X"). */
  nome: string;
  tipo: "colecao" | "observatorio" | "conta";
  acento: Dominio["acento"];
  itens: ItemNav[];
  atalhos: AtalhosNav;
  /** A consulta pessoal da coleção (o destino mais procurado), quando existe: sempre o segundo item. */
  consulta?: string;
  /** Estado da coleção inteira que o leitor precisa saber antes do clique, com o SeloProntidao à direita da linha 1. */
  estado?: Prontidao;
  /** Parâmetros do endereço que acompanham o leitor de uma página a outra da coleção (o recorte: capital, UF, nível). */
  levar?: string[];
};

/** Destinos de primeiro nível à vista; o que passar vai para o menu "Mais", nunca para uma terceira linha. */
export const MAX_A_VISTA = 8;

function semConsulta(href: string): string {
  const s = href.split(/[?#]/)[0] || "/";
  return s.length > 1 && s.endsWith("/") ? s.slice(0, -1) : s;
}

/** Quanto um destino casa com o endereço: o comprimento do caminho dele quando é o próprio endereço ou está acima dele; -1 se não casa. */
function casamento(href: string, caminho: string): number {
  const h = semConsulta(href);
  if (href.includes("#") && h === caminho) return h.length - 0.5; // âncora na própria página: casa, mas perde para o destino sem âncora
  if (h === caminho) return h.length + 0.25; // o próprio endereço ganha do destino acima dele
  return caminho.startsWith(`${h}/`) ? h.length : -1;
}

/** `abaixoDoAtalho`: o endereço está abaixo do atalho, não é ele (o atalho fica destacado, sem aria-current). */
export type Atual = { item: number; sub: number | null; atalho: keyof AtalhosNav | null; abaixoDoAtalho?: true };

/**
 * Destino atual para um endereço: o item (ou a subpágina de um item) cujo caminho mais longo casa com ele. Empate entre itens
 * fica com o primeiro da lista, então a consulta pessoal (segundo item) ganha da mesma página repetida num grupo; dentro de um
 * grupo, a subpágina ganha do próprio grupo, que leva a ela. Um atalho que é o
 * próprio endereço marca o atalho e nenhum item; nas páginas abaixo de um atalho (o catálogo de um conjunto sob Dados), o
 * atalho continua marcado, a menos que um destino mais próximo do endereço case.
 */
export function destinoAtual(nav: Pick<NavegacaoDaColecao, "itens" | "atalhos">, endereco: string | null): Atual {
  const nenhum: Atual = { item: -1, sub: null, atalho: null };
  if (!endereco) return nenhum;
  const caminho = semConsulta(caminhoPublico(endereco));
  // o atalho que é o próprio endereço ganha de tudo; o que está acima dele (ex.: /dados/reproducao sob Dados) só ganha do item
  // que casa menos (a entrada), nunca de um destino mais próximo
  let atalho: { k: keyof AtalhosNav; nota: number } | null = null;
  for (const k of ["dados", "metodo", "glossario"] as const) {
    const h = nav.atalhos[k];
    if (!h || h.includes("#")) continue;
    if (semConsulta(h) === caminho) return { ...nenhum, atalho: k };
    const n = casamento(h, caminho);
    if (n >= 0 && (!atalho || n > atalho.nota)) atalho = { k, nota: n };
  }
  let melhor = nenhum;
  let nota = -1;
  nav.itens.forEach((it, i) => {
    if (!it.publicado) return;
    const n = casamento(it.href, caminho);
    if (n > nota) {
      nota = n;
      melhor = { item: i, sub: null, atalho: null };
    }
    (it.subpaginas ?? []).forEach((s, j) => {
      if (!s.publicado) return;
      const m = casamento(s.href, caminho);
      // o grupo leva à primeira página dele (mesmo endereço): no empate dentro do próprio item, ganha a subpágina, que é a página
      // aberta; o empate com outro item continua do primeiro da lista (a consulta pessoal antes do grupo que a repete)
      if (m > nota || (m === nota && melhor.item === i && melhor.sub === null)) {
        nota = m;
        melhor = { item: i, sub: j, atalho: null };
      }
    });
  });
  if (atalho && atalho.nota > nota) return { ...nenhum, atalho: atalho.k, abaixoDoAtalho: true };
  return melhor;
}

/**
 * Divide a linha 1 entre o que fica à vista e o que vai para "Mais". O destino atual nunca se esconde: se ele cair no "Mais",
 * troca de lugar com o último à vista.
 */
export function dividirItens<T>(itens: T[], atual: number): { aVista: { item: T; i: number }[]; mais: { item: T; i: number }[] } {
  const todos = itens.map((item, i) => ({ item, i }));
  if (todos.length <= MAX_A_VISTA) return { aVista: todos, mais: [] };
  const aVista = todos.slice(0, MAX_A_VISTA);
  const mais = todos.slice(MAX_A_VISTA);
  const k = mais.findIndex((x) => x.i === atual);
  if (k >= 0) {
    const [esc] = mais.splice(k, 1, aVista[MAX_A_VISTA - 1]);
    aVista[MAX_A_VISTA - 1] = esc;
    mais.sort((a, b) => a.i - b.i);
  }
  return { aVista, mais };
}
