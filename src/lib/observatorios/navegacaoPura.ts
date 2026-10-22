/**
 * Navegação de uma coleção como o navegador a recebe (NavegacaoColecao): os destinos de primeiro nível, as subpáginas de
 * cada um e os três atalhos fixos. Sem catálogo: o servidor monta a lista (navegacaoColecao.ts) e o navegador só decide,
 * a cada navegação, qual destino é o atual. Iniciativa 2 do parecer de UX de 21/10/2026.
 */
import type { Dominio } from "@/lib/dominios";
import { caminhoPublico } from "./contextoPuro";

/** Página da navegação. `publicado: false` aparece como texto "em preparação", nunca como link. */
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
  /** Estado da coleção inteira que o leitor precisa saber antes do clique (ex.: "Piloto"), escrito à direita da linha 1. */
  estado?: string;
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

export type Atual = { item: number; sub: number | null; atalho: keyof AtalhosNav | null };

/**
 * Destino atual para um endereço: o item (ou a subpágina de um item) cujo caminho mais longo casa com ele. Empate fica com o
 * primeiro da lista, então a consulta pessoal (segundo item) ganha da mesma página repetida num grupo. Um atalho que é o
 * próprio endereço marca o atalho e nenhum item.
 */
export function destinoAtual(nav: Pick<NavegacaoDaColecao, "itens" | "atalhos">, endereco: string | null): Atual {
  const nenhum: Atual = { item: -1, sub: null, atalho: null };
  if (!endereco) return nenhum;
  const caminho = semConsulta(caminhoPublico(endereco));
  for (const k of ["dados", "metodo", "glossario"] as const) {
    const h = nav.atalhos[k];
    if (h && semConsulta(h) === caminho && !h.includes("#")) return { ...nenhum, atalho: k };
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
      if (m > nota) {
        nota = m;
        melhor = { item: i, sub: j, atalho: null };
      }
    });
  });
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
