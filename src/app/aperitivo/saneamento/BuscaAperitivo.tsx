"use client";

import { BuscaMunicipio } from "@/components/saneamento/BuscaMunicipio";

/**
 * Busca da versão aperitivo do Saneamento: a mesma BuscaMunicipio (índice público /saneamento/gold/indice.json), com o
 * destino no endereço público da consulta, /saneamento/municipio?ibge={código}. Quem não tem sessão recebe ali esta
 * página (rewrite do middleware); a ficha /saneamento/municipio/{código} fica com a conta.
 */
export function BuscaAperitivo({ rotulo }: { rotulo: string }) {
  return <BuscaMunicipio grande rotulo={rotulo} destino={(id) => `/saneamento/municipio?ibge=${id}`} />;
}
