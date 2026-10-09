/**
 * Busca da página inicial: normalização sem acento e sem maiúscula e ordenação dos
 * resultados. Lógica pura, testável sem renderizar; o componente cliente só desenha.
 *
 * O que decide se um item aparece: todas as palavras do que foi digitado precisam começar alguma
 * palavra do item (título, sinônimos, detalhe e tipo), em qualquer ordem. Começo de palavra, e não
 * pedaço: "ear" acha a EAR e não a distribuidora do Ceará. Palavras de ligação ("o", "da", "em") e
 * de pergunta ("o que é", "qual", "como") não contam, para a frase de quem pergunta como fala
 * achar o mesmo que a palavra sozinha: "o que é PLD" é PLD.
 *
 * O que decide a ordem, da mais forte para a mais fraca:
 *  - a sigla digitada por inteiro (DEC leva ao verbete do DEC antes de qualquer item que só
 *    comece com as mesmas letras, como DECOMP ou "declarados") e o título igual ao digitado;
 *  - a palavra inteira no título, depois o começo de palavra no título;
 *  - os sinônimos do item (vocabulário de quem não conhece a sigla, como "preço da luz" ou
 *    "congestionamento"), logo abaixo do título, e por último o detalhe e o tipo.
 *
 * Se nenhum item tem todas as palavras, a busca devolve os que têm parte delas no título ou nos
 * sinônimos e diz que o resultado é parcial: quem escreve uma frase inteira não fica com a tela vazia.
 * Só frases de três palavras úteis ou mais entram nesse caso: com duas, a metade é uma palavra só
 * ("Belo Horizonte" trazia a cooperativa de Novo Horizonte), e o nome de lugar vai para Minha região.
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
 * ("compensações" e "compensação" são a mesma palavra para quem digita), e só eles: o resto do plural é tratado na busca.
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

/** Palavras de ligação: nunca decidem se um item casa. */
const LIGACAO = new Set(["a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas", "um", "uma", "para", "por", "pelo", "pela", "que", "com", "se", "ao", "aos", "sao"]);

/**
 * Palavras de quem pergunta ou pede: saem da busca quando sobra outra palavra ("o que é PLD", "qual a tarifa", "como funciona o PLD",
 * "quero saber o preço da luz").
 */
const PERGUNTA = new Set([
  "qual", "quais", "quanto", "quanta", "quantos", "quantas", "quem", "onde", "como", "quando",
  "significa", "significado", "funciona", "funcionam", "funcionamento", "explica", "explicar", "explique",
  "quero", "preciso", "procuro", "saber", "entender", "ver", "existe", "existem",
]);

const PONTOS = {
  /** O título é igual ao que se digitou, ou a sigla do item é igual a isso. */
  igual: 8,
  /** O que se digitou é, inteiro, um sinônimo do item. */
  frase: 8,
  palavraNoTitulo: 5,
  palavraNoSinonimo: 4,
  comecoNoTitulo: 3,
  comecoNoSinonimo: 3,
  palavraNoDetalhe: 2,
  comecoNoDetalhe: 1,
} as const;

/** A palavra digitada e, quando ela parece um plural, o singular: "perdas" acha "perda". */
function formasDe(p: string): string[] {
  return p.length > 3 && p.endsWith("s") ? [p, p.slice(0, -1)] : [p];
}

/** Quantas palavras úteis uma frase precisa ter para a busca devolver resultado parcial. */
const PALAVRAS_PARA_PARCIAL = 3;

/** Palavra de até três letras: quase sempre uma sigla (DEC, EAR, ONS, PLD). Casa como palavra inteira, para "dec" não achar "declarados". */
const CURTA = 3;

/** 2 quando alguma forma da palavra é uma palavra do texto, 1 quando começa uma, 0 quando nem isso. Palavra curta só casa inteira, salvo `prefixoCurto`. */
function casa(formas: readonly string[], palavrasDoTexto: readonly string[], prefixoCurto: boolean): 0 | 1 | 2 {
  if (formas.some((f) => palavrasDoTexto.includes(f))) return 2;
  if (formas.some((f) => (f.length > CURTA || prefixoCurto) && palavrasDoTexto.some((w) => w.startsWith(f)))) return 1;
  return 0;
}

type Achado = { item: ItemBusca; nota: number; ordem: number; via?: string; ausentes: number; fortes: number };

/** Itens em que todas as palavras úteis começam alguma palavra do item; sigla e título iguais primeiro, depois palavra inteira, começo de palavra, sinônimo e detalhe. */
export function buscar(itens: readonly ItemBusca[], consulta: string, limite = LIMITE_BUSCA): { itens: ResultadoBusca[]; total: number; parcial: boolean } {
  const frase = normalizarBusca(consulta);
  const todas = frase.split(" ").filter((p) => p.length > 0);
  const semLigacao = todas.filter((p) => !LIGACAO.has(p));
  const semPergunta = semLigacao.filter((p) => !PERGUNTA.has(p));
  // só palavras de ligação ("o que é"): ainda não há o que procurar
  const palavras = semPergunta.length ? semPergunta : semLigacao;
  if (!palavras.length) return { itens: [], total: 0, parcial: false };
  const nucleo = palavras.join(" ");
  const formas = palavras.map(formasDe);

  const rodar = (prefixoCurto: boolean) => {
    const achados: Achado[] = [];
    itens.forEach((item, ordem) => {
      const titulo = normalizarBusca(item.titulo);
      const doTitulo = titulo.split(" ");
      const doResto = normalizarBusca(`${item.detalhe ?? ""} ${item.tipo}`).split(" ");
      const sinonimos = (item.sinonimos ?? []).map((original) => {
        const f = normalizarBusca(original);
        return { original, frase: f, palavras: f.split(" ") };
      });

      let nota = 0;
      let viaPalavra: string | undefined;
      // palavras que não começam nenhuma palavra do item, e palavras que casam no título ou nos sinônimos (as que só o detalhe tem não contam como fortes)
      let ausentes = 0;
      let fortes = 0;
      palavras.forEach((_, i) => {
        const f = formas[i];
        const t = casa(f, doTitulo, prefixoCurto);
        const noTitulo = t === 2 ? PONTOS.palavraNoTitulo : t === 1 ? PONTOS.comecoNoTitulo : 0;

        let noSinonimo = 0;
        let qual: string | undefined;
        for (const s of sinonimos) {
          const c = casa(f, s.palavras, prefixoCurto);
          const n = c === 2 ? PONTOS.palavraNoSinonimo : c === 1 ? PONTOS.comecoNoSinonimo : 0;
          if (n > noSinonimo) {
            noSinonimo = n;
            qual = s.original;
          }
        }

        const r = casa(f, doResto, prefixoCurto);
        const noDetalhe = r === 2 ? PONTOS.palavraNoDetalhe : r === 1 ? PONTOS.comecoNoDetalhe : 0;
        const n = Math.max(noTitulo, noSinonimo, noDetalhe);
        if (n === 0) {
          ausentes += 1;
          return;
        }
        // o termo só aparece na tela quando foi ele que trouxe a palavra: se o título ou o detalhe já a tinham, não há o que explicar
        if (noSinonimo > noTitulo && noSinonimo > noDetalhe && !viaPalavra) viaPalavra = qual;
        nota += n;
        if (Math.max(noTitulo, noSinonimo) > 0) fortes += 1;
      });

      if (titulo === nucleo) nota += PONTOS.igual;
      if (item.sigla && normalizarBusca(item.sigla) === nucleo) nota += PONTOS.igual;
      // a frase inteira é um sinônimo: é ele que explica o resultado (salvo se o título já dizia o mesmo), e vale mais que o de uma palavra só
      let viaFrase: string | undefined;
      for (const s of sinonimos) {
        if (s.frase === frase || s.frase === nucleo) {
          nota += PONTOS.frase;
          if (titulo !== nucleo) viaFrase = s.original;
        }
      }
      achados.push({ item, nota, ordem, via: viaFrase ?? viaPalavra, ausentes, fortes });
    });
    return achados;
  };

  const ordena = (a: Achado, b: Achado) => b.nota - a.nota || a.ordem - b.ordem;
  const temCurta = palavras.some((p) => p.length <= CURTA);
  // palavra curta casa inteira; se assim nada aparece, vale o começo de palavra (quem digita "ce" ainda acha a CEMIG)
  for (const prefixoCurto of temCurta ? [false, true] : [true]) {
    const achados = rodar(prefixoCurto);
    const completos = achados.filter((a) => a.ausentes === 0).sort(ordena);
    if (completos.length) return { itens: completos.slice(0, limite).map(paraResultado), total: completos.length, parcial: false };
    // nenhum item tem todas as palavras: ficam os que têm ao menos metade delas no título ou nos sinônimos, e só para frases de três palavras ou mais
    if (palavras.length >= PALAVRAS_PARA_PARCIAL) {
      const parciais = achados.filter((a) => a.fortes >= Math.ceil(palavras.length / 2)).sort((a, b) => b.fortes - a.fortes || ordena(a, b));
      if (parciais.length) return { itens: parciais.slice(0, limite).map(paraResultado), total: parciais.length, parcial: true };
    }
  }
  return { itens: [], total: 0, parcial: false };
}

function paraResultado(a: Achado): ResultadoBusca {
  return a.via ? { ...a.item, viaSinonimo: a.via } : a.item;
}

/**
 * Item ativo da lista de resultados depois de uma seta (padrão combobox): sem item ativo, a seta para baixo vai ao primeiro e a para cima ao
 * último; nos extremos a lista para, sem dar a volta. Null para tecla que não move ou lista vazia.
 */
export function moverAtivo(atual: number, tecla: string, n: number): number | null {
  if (n <= 0) return null;
  if (tecla === "ArrowDown") return atual < 0 ? 0 : Math.min(n - 1, atual + 1);
  if (tecla === "ArrowUp") return atual < 0 ? n - 1 : Math.max(0, atual - 1);
  return null;
}
