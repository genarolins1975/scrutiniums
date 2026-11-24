/**
 * Rota da consulta "O meu município já teve desastre reconhecido?": a busca e,
 * abaixo dela, a ficha por código IBGE. Arquivo leve, importável no navegador
 * (a busca só precisa montar o endereço; os registros vêm prontos do servidor).
 * Rota fechada, como os painéis: não consta de src/lib/rotasPublicas.ts.
 */
export const ROTA_DESASTRES_MUNICIPIO = "/territorio/desastres/municipio";

export function rotaFichaDesastres(id: string): string {
  return `${ROTA_DESASTRES_MUNICIPIO}/${id}`;
}
