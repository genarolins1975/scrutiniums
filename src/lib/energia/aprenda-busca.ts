/**
 * Busca do índice do Aprenda, em função pura (o componente cliente e os testes usam a mesma): normalização do texto, nota de cada
 * verbete para o termo e a lista de resultados na ordem de relevância. Filtra a lista da própria página, com o link da busca e o
 * painel de cada verbete; as regras de palavra são as do motor da plataforma (src/lib/busca/normalizar.ts, ciclo 2 da busca, bloco
 * 5, decisão do dono de 23/10/2026): saem as palavras vazias e as de pergunta e o plural procura o singular. Só tipos vêm do acervo; nada daqui importa o conteúdo dos
 * verbetes, para o cliente receber a lista pronta e não o acervo inteiro.
 */
import type { ItemDoIndice } from "./conteudo/aprenda-indice";
import { formasDe, palavrasUteis } from "@/lib/busca/normalizar";

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
 * A palavra do termo começa uma palavra do texto, não é um pedaço do meio dela: "ons" acha ONS e não "consumo", "epe" acha EPE e não
 * "depende". Quem digita o começo de uma palavra ("reservat") continua achando; o texto já vem sem acento e em minúsculas.
 */
function comecaPalavra(texto: string, palavra: string): boolean {
  return new RegExp("(^|[^a-z0-9])" + palavra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(texto);
}

/**
 * Quanto o verbete combina com o termo, do melhor para o pior: 0 sigla igual ao termo; 1 sigla ou nome começa pelo termo; 2 termo no
 * nome ou na pergunta prática; 3 só no texto (definição). Sem o termo (ou com palavra do termo faltando), null: o verbete não entra.
 * Termo com várias palavras exige todas elas, em qualquer ordem, cada uma no começo de uma palavra do texto.
 */
export function notaDoVerbete(i: ItemDoIndice, termo: string): number | null {
  // as palavras que contam, como na busca da plataforma: "o que é PLD" é "pld", "reservatórios" também procura "reservatorio"
  const palavras = palavrasUteis(termo);
  const casa = (texto: string, p: string) => formasDe(p).some((f) => comecaPalavra(texto, f));
  if (palavras.length === 0 || !palavras.every((p) => casa(i.busca, p))) return null;
  const nucleo = palavras.join(" ");
  const titulo = normalizaBusca(i.titulo);
  const nome = i.subtitulo ? normalizaBusca(i.subtitulo) : "";
  if (titulo === nucleo) return 0;
  if (titulo.indexOf(nucleo) === 0 || nome.indexOf(nucleo) === 0) return 1;
  const nomes = `${titulo} ${nome}`;
  if (palavras.every((p) => casa(nomes, p)) || (i.pergunta !== null && palavras.every((p) => casa(normalizaBusca(i.pergunta as string), p)))) return 2;
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
