"use client";

import { BuscaMunicipio } from "@/components/saneamento/BuscaMunicipio";
import { rotaFichaDesastres } from "@/lib/territorio/consultaDesastres";

/**
 * Busca do município pelo nome que abre a ficha de desastres reconhecidos. Reaproveita a
 * busca do Saneamento, como a de focos de calor: no navegador, só o índice de nomes do
 * IBGE é baixado (/saneamento/gold/indice.json); os registros vêm prontos na ficha, do servidor.
 */
export function BuscaDesastres({ rotulo = "Digite o nome do município", grande = false }: Readonly<{ rotulo?: string; grande?: boolean }>) {
  return <BuscaMunicipio grande={grande} rotulo={rotulo} destino={rotaFichaDesastres} />;
}
