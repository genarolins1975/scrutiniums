/**
 * Rota da consulta "Teve fogo perto de mim?" (leva 2 da estratégia "aberto e com
 * conta", item teve-fogo-perto-de-mim de src/lib/rotasPublicas.ts): a busca e,
 * abaixo dela, a ficha por código IBGE. Arquivo leve, importável no navegador.
 */
export const ROTA_FOCOS_MUNICIPIO = "/territorio/queimadas/municipio";

export function rotaFichaFocos(id: string): string {
  return `${ROTA_FOCOS_MUNICIPIO}/${id}`;
}
