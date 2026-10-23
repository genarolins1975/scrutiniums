import { indiceCasca } from "@/lib/observatorios/barraSpa";

/**
 * Rótulo de uma página da aplicação do Crédito na navegação da coleção dona dela (a primeira linha ou a segunda, do grupo),
 * ou null se ela não está em nenhuma. Desde a Iniciativa 2 do parecer de UX de 23/10/2026 (o Crédito na mesma casca) a
 * aplicação não tem barra lateral: os testes de cada painel, que conferiam o botão dela (data-view), conferem aqui que a
 * página está na navegação da coleção, com o mesmo rótulo do catálogo.
 */
export function rotuloNaNavegacao(href: string): string | null {
  for (const nav of Object.values(indiceCasca().navs)) {
    for (const item of nav.itens) {
      if (item.href === href && !item.subpaginas) return item.rotulo;
      const sub = item.subpaginas?.find((s) => s.href === href);
      if (sub) return sub.rotulo;
    }
  }
  return null;
}
