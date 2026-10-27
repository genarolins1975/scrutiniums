/**
 * 27/10/2026 — frente 3 do conselho: salvar/copiar precisa capturar também a
 * digitação ainda pendente e os padrões da consulta atual. Cada ilha contribui
 * só com seu esquema; nenhuma leitura genérica de formulário coleta dados pessoais.
 */
export const PREPARAR_ANALISE = "scrutiniums:preparar-analise";
export const ANALISE_ALTERADA = "scrutiniums:analise-alterada";
export type PreparacaoAnalise = { busca: string; prioridades: Map<string, number> };
let revisao = 0;
/** Ordem das alterações no navegador, independente da ordem de montagem das ilhas. */
export const proximaRevisaoAnalise = () => ++revisao;

export function prepararEnderecoAnalise(janela: Window = window): string {
  const detalhe: PreparacaoAnalise = { busca: janela.location.search, prioridades: new Map() };
  janela.dispatchEvent(new CustomEvent<PreparacaoAnalise>(PREPARAR_ANALISE, { detail: detalhe }));
  return `${janela.location.pathname}${detalhe.busca}${janela.location.hash}`;
}
