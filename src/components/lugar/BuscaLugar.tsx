"use client";

import { BuscaMunicipio } from "@/components/saneamento/BuscaMunicipio";
import { hrefLugar } from "@/lib/lugar/paginas";

/**
 * Busca do município da ficha do lugar: a mesma BuscaMunicipio do Saneamento, com o índice de nomes do IBGE
 * (/saneamento/gold/indice.json, o único arquivo que o navegador baixa). O destino é a ficha do lugar com ?ibge=.
 */
export function BuscaLugar({ rotulo }: Readonly<{ rotulo: string }>) {
  return <BuscaMunicipio grande rotulo={rotulo} destino={hrefLugar} />;
}
