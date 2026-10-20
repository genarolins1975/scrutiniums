"use client";

import { BuscaMunicipio } from "@/components/saneamento/BuscaMunicipio";
import { hrefMunicipio } from "@/lib/educacao/paginas";

/**
 * Busca do município do painel Educação nos municípios e da sua versão aperitivo: a mesma BuscaMunicipio do Saneamento,
 * com o índice de nomes do IBGE que já é aberto (/saneamento/gold/indice.json, o único arquivo que o navegador baixa). O
 * destino é sempre o endereço público /educacao-municipal?ibge={código}: sem sessão, o middleware serve ali o aperitivo;
 * com sessão, o painel completo, que lê o mesmo parâmetro. `ancora` leva direto à seção do município.
 */
export function BuscaEducacao({ rotulo, ancora = "" }: { rotulo: string; ancora?: string }) {
  return <BuscaMunicipio grande rotulo={rotulo} destino={(id) => `${hrefMunicipio(id)}${ancora ? `#${ancora}` : ""}`} />;
}
