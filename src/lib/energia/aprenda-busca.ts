/**
 * Busca do índice do Aprenda, em função pura (o componente cliente e os testes usam a mesma): normalização do texto, nota de cada
 * verbete para o termo e a lista de resultados na ordem de relevância. Só tipos vêm do acervo; nada daqui importa o conteúdo dos
 * verbetes, para o cliente receber a lista pronta e não o acervo inteiro.
 */
import type { ItemDoIndice } from "./conteudo/aprenda-indice";

/** Menor termo que filtra a lista: com uma letra só o índice continua mostrando todos os verbetes por tema. */
export const MINIMO_DA_BUSCA = 2;

/** Texto sem acento e em minúsculas, para a busca não depender de como o leitor digita. */
export function normalizaBusca(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Quanto o verbete combina com o termo, do melhor para o pior: 0 sigla igual ao termo; 1 sigla ou nome começa pelo termo; 2 termo no
 * nome ou na pergunta prática; 3 só no texto (definição). Sem o termo (ou com palavra do termo faltando), null: o verbete não entra.
 * Termo com várias palavras exige todas elas, em qualquer ordem.
 */
export function notaDoVerbete(i: ItemDoIndice, termo: string): number | null {
  const palavras = termo.split(/\s+/).filter(Boolean);
  if (palavras.length === 0 || !palavras.every((p) => i.busca.indexOf(p) >= 0)) return null;
  const titulo = normalizaBusca(i.titulo);
  const nome = i.subtitulo ? normalizaBusca(i.subtitulo) : "";
  if (titulo === termo) return 0;
  if (titulo.indexOf(termo) === 0 || nome.indexOf(termo) === 0) return 1;
  if (titulo.indexOf(termo) >= 0 || nome.indexOf(termo) >= 0 || (i.pergunta !== null && normalizaBusca(i.pergunta).indexOf(termo) >= 0)) return 2;
  return 3;
}

/**
 * Resultados da busca: null quando o termo é curto demais para filtrar (a página mostra a lista inteira por tema); senão os verbetes que
 * contêm o termo, na ordem da nota e, na mesma nota, na ordem do acervo.
 */
export function buscarVerbetes(itens: readonly ItemDoIndice[], texto: string): ItemDoIndice[] | null {
  const termo = normalizaBusca(texto).trim();
  if (termo.length < MINIMO_DA_BUSCA) return null;
  return itens
    .map((i, ordem) => ({ i, ordem, nota: notaDoVerbete(i, termo) }))
    .filter((x): x is { i: ItemDoIndice; ordem: number; nota: number } => x.nota !== null)
    .sort((a, b) => a.nota - b.nota || a.ordem - b.ordem)
    .map((x) => x.i);
}
