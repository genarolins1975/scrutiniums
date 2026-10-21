"use client";

import { BuscaMunicipio } from "@/components/saneamento/BuscaMunicipio";
import { rotaFichaFocos } from "@/lib/territorio/consultaFocos";

/**
 * Busca do município pelo nome que abre a ficha de focos de calor. Reaproveita a
 * busca do Saneamento: no navegador, só o índice de nomes do IBGE é baixado
 * (/saneamento/gold/indice.json); os focos vêm prontos na ficha, do servidor.
 */
export function BuscaFocos({ rotulo = "Digite o nome do município", grande = false }: Readonly<{ rotulo?: string; grande?: boolean }>) {
  return <BuscaMunicipio grande={grande} rotulo={rotulo} destino={rotaFichaFocos} />;
}
