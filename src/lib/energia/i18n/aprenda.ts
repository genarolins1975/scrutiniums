/**
 * Apoio bilíngue do Aprenda (verbetes, trilhas, siglas, perguntas práticas, provas e exemplos).
 *
 * O acervo é feito de constantes de módulo, onde tx() não sabe o idioma (fora de render não há
 * página). Cada arquivo de conteúdo monta então o seu acervo duas vezes, uma por idioma, com uma
 * função que recebe o seu próprio `tx` já preso ao idioma: o português sai idêntico ao que era (a
 * constante antiga continua exportada com ele) e o inglês fica lado a lado no mesmo arquivo, com
 * os mesmos slugs, ids, endereços e fontes. Quem renderiza escolhe o acervo pelo idioma da página.
 *
 * Citação literal de norma ou documento (o "trecho") não é traduzida: fica em português e a tela a
 * mostra dentro de <TrechoPortugues>; a paráfrase em linguagem simples é que ganha a forma inglesa.
 */
import type { Idioma } from "@/lib/idioma";
import type { GrupoConceito } from "@/lib/energia/conteudo/conceitos";

/** `tx` preso a um idioma: devolve a primeira forma em português e a segunda em inglês. */
export type TxIdioma = <T>(pt: T, en: T) => T;

/** Monta um acervo nos dois idiomas com a mesma função; a forma portuguesa é exatamente a de antes. */
export function montarNosDoisIdiomas<T>(montar: (tx: TxIdioma, idioma: Idioma) => T): Record<Idioma, T> {
  const pt: TxIdioma = (p) => p;
  const en: TxIdioma = (_p, e) => e;
  return { pt: montar(pt, "pt"), en: montar(en, "en") };
}

/** Nome do tema do verbete. O tema português continua sendo a chave (âncora #g-..., filtro, teste). */
const GRUPO_EN: Record<GrupoConceito, string> = {
  Preço: "Price",
  Água: "Water",
  Operação: "Operation",
  Modelos: "Models",
  Mercado: "Market",
  Rede: "Grid",
  Consumidor: "Consumer",
  "Qualidade e perdas": "Quality and losses",
  Inclusão: "Inclusion",
  Empresas: "Companies",
  Expansão: "Expansion",
  Regulação: "Regulation",
  Transição: "Transition",
  "Fontes de dados": "Data sources",
};

export function rotuloGrupoConceito(g: GrupoConceito, idioma: Idioma): string {
  return idioma === "en" ? GRUPO_EN[g] : g;
}
