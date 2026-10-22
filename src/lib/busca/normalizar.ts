/**
 * Normalização única da busca da plataforma (Iniciativa 3 do parecer de UX de 21/10/2026): minúsculas, sem acento e sem
 * pontuação, com os espaços colapsados. É a mesma regra do filtro "Encontre o painel" (DiretorioPaineis), agora num só lugar,
 * para o índice gerado no build e o que o leitor digita casarem do mesmo jeito no servidor e no navegador.
 */
export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Palavras curtas que não distinguem nada numa pergunta ("quanto pesa a dívida"): ficam fora da correspondência. */
const VAZIAS = new Set(["a", "o", "e", "as", "os", "de", "da", "do", "das", "dos", "em", "na", "no", "nas", "nos", "um", "uma", "para", "por", "com", "que", "se"]);

/** As palavras que contam numa busca: normalizadas, sem as vazias (se só houver vazias, ficam elas). */
export function palavrasDaBusca(termo: string): string[] {
  const todas = normalizar(termo).split(" ").filter(Boolean);
  const cheias = todas.filter((p) => !VAZIAS.has(p));
  return cheias.length ? cheias : todas;
}
