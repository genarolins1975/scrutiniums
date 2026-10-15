/**
 * Textos de página nos dois idiomas. A forma inglesa é derivada da portuguesa:
 * chave ausente ou função com outra assinatura reprova o tsc. Termos técnicos
 * seguem config/glossario-en.json; nomes de produtos e órgãos ficam em português.
 */
export type TextosPagina<T> = {
  readonly [K in keyof T]: T[K] extends (...args: infer A) => string ? (...args: A) => string : string;
};
