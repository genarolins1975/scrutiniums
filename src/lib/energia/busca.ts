/**
 * Busca da página inicial: normalização sem acento e sem maiúscula e ordenação dos
 * resultados. Lógica pura, testável sem renderizar; o componente cliente só desenha.
 */
export type ItemBusca = { tipo: "Página" | "Painel" | "Pergunta" | "Conceito" | "Distribuidora"; titulo: string; detalhe?: string; href: string };

export const LIMITE_BUSCA = 8;

export function normalizarBusca(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Itens em que todas as palavras aparecem; título antes de detalhe, início de título antes de meio. */
export function buscar(itens: readonly ItemBusca[], consulta: string, limite = LIMITE_BUSCA): { itens: ItemBusca[]; total: number } {
  const palavras = normalizarBusca(consulta).split(" ").filter((p) => p.length > 0);
  if (!palavras.length) return { itens: [], total: 0 };
  const achados: { item: ItemBusca; nota: number; ordem: number }[] = [];
  itens.forEach((item, ordem) => {
    const titulo = normalizarBusca(item.titulo);
    const resto = normalizarBusca(`${item.detalhe ?? ""} ${item.tipo}`);
    let nota = 0;
    for (const p of palavras) {
      if (titulo.startsWith(p) || titulo.includes(` ${p}`)) nota += 3;
      else if (titulo.includes(p)) nota += 2;
      else if (resto.includes(p)) nota += 1;
      else return;
    }
    achados.push({ item, nota, ordem });
  });
  achados.sort((a, b) => b.nota - a.nota || a.ordem - b.ordem);
  return { itens: achados.slice(0, limite).map((a) => a.item), total: achados.length };
}

