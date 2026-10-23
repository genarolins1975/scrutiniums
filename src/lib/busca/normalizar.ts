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

/**
 * Palavras de quem pergunta ou pede (portadas da busca antiga do Setor Elétrico, src/lib/energia/busca.ts, só as portuguesas):
 * saem da busca quando sobra outra palavra. "como funciona o PLD" é "pld"; "qual a tarifa social" é "tarifa social". Diagnóstico
 * da busca de 23/10/2026, achado A1: "o que é PLD" achava 8 destinos e "como funciona o PLD", nenhum.
 */
export const PERGUNTA = new Set([
  "qual", "quais", "quanto", "quanta", "quantos", "quantas", "quem", "onde", "como", "quando", // i18n: dado
  "significa", "significado", "funciona", "funcionam", "funcionamento", "explica", "explicar", "explique",
  "quero", "preciso", "procuro", "saber", "entender", "ver", "existe", "existem", // i18n: dado
]);

/** As palavras que decidem a busca: as de palavrasDaBusca sem as de pergunta, quando sobra outra. */
export function palavrasUteis(termo: string): string[] {
  const busca = palavrasDaBusca(termo);
  const semPergunta = busca.filter((p) => !PERGUNTA.has(p));
  return semPergunta.length ? semPergunta : busca;
}

/**
 * O termo inteiro sem as palavras de pergunta e sem as vazias das pontas: "qual a tarifa social" é "tarifa social", "o que é
 * conta de luz" é "conta de luz". Serve para reconhecer o título igual ao que se pergunta.
 */
export function nucleoDaBusca(termo: string): string {
  const todas = normalizar(termo).split(" ").filter(Boolean);
  const semPergunta = todas.filter((p) => !PERGUNTA.has(p));
  const lista = semPergunta.some((p) => !VAZIAS.has(p)) ? semPergunta : todas;
  let i = 0;
  let f = lista.length;
  while (i < f && VAZIAS.has(lista[i])) i++;
  while (f > i && VAZIAS.has(lista[f - 1])) f--;
  return lista.slice(i, f).join(" ");
}

/**
 * A palavra digitada e o singular provável, só do lado de quem digita (o índice fica como está): "hospitais" também procura
 * "hospital", "enchentes" procura "enchente", "agências" procura "agência". Regras do português, sem biblioteca: "ões" e "ães"
 * para "ão"; "ais", "eis", "ois" para "al", "el", "ol"; "ns" para "m"; e o "s" final em palavra de quatro letras ou mais.
 */
export function formasDe(p: string): string[] {
  const formas = [p];
  // palavra de até três letras é quase sempre sigla ("ANS", "ONS"): não tem plural
  if (p.length < 4) return formas;
  const troca = (fim: string, por: string) => {
    if (p.length > fim.length && p.endsWith(fim)) formas.push(p.slice(0, -fim.length) + por);
  };
  troca("oes", "ao");
  troca("aes", "ao");
  troca("ais", "al");
  troca("eis", "el");
  troca("ois", "ol");
  troca("ns", "m");
  if (p.endsWith("s")) formas.push(p.slice(0, -1));
  return Array.from(new Set(formas));
}
