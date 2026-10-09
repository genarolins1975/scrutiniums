/**
 * Busca da página inicial: normalização sem acento e sem maiúscula e ordenação dos
 * resultados. Lógica pura, testável sem renderizar; o componente cliente só desenha.
 *
 * Três coisas decidem a ordem, da mais forte para a mais fraca:
 *  - a sigla digitada por inteiro (DEC leva ao verbete do DEC antes de qualquer item que só
 *    comece com as mesmas letras, como DECOMP ou "declarados") e o título igual ao digitado;
 *  - a palavra inteira no título, depois o começo de palavra no título, depois o meio da palavra;
 *  - os sinônimos do item (vocabulário de quem não conhece a sigla, como "preço da luz" ou
 *    "congestionamento"), logo abaixo do título, e por último o detalhe e o tipo.
 * Todas as palavras úteis digitadas precisam aparecer em algum lugar do item; "da", "de", "o" e
 * as demais palavras de ligação não contam, para a frase do leitor não excluir o resultado.
 */
export type ItemBusca = {
  tipo: "Página" | "Painel" | "Pergunta" | "Conceito" | "Distribuidora";
  titulo: string;
  detalhe?: string;
  href: string;
  /** Sigla do item (verbetes e distribuidoras): digitada por inteira, vale mais que qualquer outra coincidência. */
  sigla?: string;
  /** Outros nomes com que o leitor procura o item; contam um pouco abaixo do título e não aparecem no resultado, a não ser como o termo que casou. */
  sinonimos?: string[];
};

/** Um resultado: o item e, quando só o sinônimo o trouxe até aqui, o termo que casou (a tela o mostra, para a busca não parecer arbitrária). */
export type ResultadoBusca = ItemBusca & { viaSinonimo?: string };

export const LIMITE_BUSCA = 8;

/**
 * Sem acento, sem maiúscula, só letras e algarismos separados por um espaço. Os plurais em "ões" e "ães" voltam ao singular
 * ("compensações" e "compensação" são a mesma palavra para quem digita), e só eles: o resto do plural já casa por começo de palavra.
 */
export function normalizarBusca(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\b([a-z]{2,})(?:oes|aes)\b/g, "$1ao");
}

/** Palavras de ligação: contam na frase, mas não decidem se um item casa. */
const LIGACAO = new Set(["a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas", "um", "uma", "para", "por", "pelo", "pela", "que", "com", "se", "ao", "aos"]);

const PONTOS = {
  /** O título é igual ao que se digitou, ou a sigla do item é igual a isso. */
  igual: 8,
  /** Frase digitada igual a um sinônimo do item. */
  frase: 8,
  palavraNoTitulo: 5,
  palavraNoSinonimo: 4,
  comecoNoTitulo: 3,
  comecoNoSinonimo: 3,
  meioDoTitulo: 2,
  noDetalhe: 1,
} as const;

/** Itens em que todas as palavras úteis aparecem; sigla e título iguais primeiro, depois palavra inteira, começo de palavra, sinônimo e detalhe. */
export function buscar(itens: readonly ItemBusca[], consulta: string, limite = LIMITE_BUSCA): { itens: ResultadoBusca[]; total: number } {
  const frase = normalizarBusca(consulta);
  const todas = frase.split(" ").filter((p) => p.length > 0);
  if (!todas.length) return { itens: [], total: 0 };
  // sem nenhuma palavra útil (só "da", "de"), vale o que foi digitado
  const uteis = todas.filter((p) => !LIGACAO.has(p));
  const palavras = uteis.length ? uteis : todas;

  const achados: { item: ItemBusca; nota: number; ordem: number; via?: string }[] = [];
  itens.forEach((item, ordem) => {
    const titulo = normalizarBusca(item.titulo);
    const doTitulo = titulo.split(" ");
    const resto = normalizarBusca(`${item.detalhe ?? ""} ${item.tipo}`);
    const sinonimos = (item.sinonimos ?? []).map((original) => ({ original, palavras: normalizarBusca(original).split(" "), frase: normalizarBusca(original) }));

    let nota = 0;
    let via: string | undefined;
    for (const p of palavras) {
      let noTitulo = 0;
      if (doTitulo.includes(p)) noTitulo = PONTOS.palavraNoTitulo;
      else if (doTitulo.some((w) => w.startsWith(p))) noTitulo = PONTOS.comecoNoTitulo;
      else if (titulo.includes(p)) noTitulo = PONTOS.meioDoTitulo;

      let noSinonimo = 0;
      let qual: string | undefined;
      for (const s of sinonimos) {
        const n = s.palavras.includes(p) ? PONTOS.palavraNoSinonimo : s.palavras.some((w) => w.startsWith(p)) ? PONTOS.comecoNoSinonimo : 0;
        if (n > noSinonimo) {
          noSinonimo = n;
          qual = s.original;
        }
      }

      const noDetalhe = resto.includes(p) ? PONTOS.noDetalhe : 0;
      const n = Math.max(noTitulo, noSinonimo, noDetalhe);
      if (n === 0) return;
      // o termo só aparece na tela quando foi ele que trouxe a palavra: se o título ou o detalhe já a tinham, não há o que explicar
      if (noSinonimo > noTitulo && noSinonimo > noDetalhe && !via) via = qual;
      nota += n;
    }

    if (titulo === frase) nota += PONTOS.igual;
    if (item.sigla && normalizarBusca(item.sigla) === frase) nota += PONTOS.igual;
    for (const s of sinonimos) {
      if (s.frase === frase) {
        nota += PONTOS.frase;
        // a frase inteira é o sinônimo: é ele que explica o resultado, salvo se o título já dizia o mesmo
        if (titulo !== frase && !via) via = s.original;
      }
    }
    achados.push({ item, nota, ordem, via });
  });
  achados.sort((a, b) => b.nota - a.nota || a.ordem - b.ordem);
  return { itens: achados.slice(0, limite).map((a) => (a.via ? { ...a.item, viaSinonimo: a.via } : a.item)), total: achados.length };
}
