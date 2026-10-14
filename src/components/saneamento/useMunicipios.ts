"use client";

import { useEffect, useState } from "react";
import { paraMunicipios } from "@/lib/saneamento/municipios";
import type { Municipio, TabelaMunicipios } from "@/lib/saneamento/tipos";

/**
 * Tabela municipal compacta (public/saneamento/gold/municipios.json), buscada
 * uma vez por página e compartilhada entre componentes. Falha não fica em
 * cache: "Tentar de novo" refaz a busca.
 */
export const URL_MUNICIPIOS = "/saneamento/gold/municipios.json";

let promessa: Promise<Municipio[]> | null = null;

function carregar(): Promise<Municipio[]> {
  if (!promessa) {
    promessa = fetch(URL_MUNICIPIOS)
      .then(async (r) => {
        if (!r.ok) throw new Error(`resposta ${r.status}`);
        return paraMunicipios((await r.json()) as TabelaMunicipios);
      })
      .catch((e: unknown) => {
        promessa = null;
        throw e;
      });
  }
  return promessa;
}

export type CargaMunicipios = { estado: "carregando" } | { estado: "pronto"; lista: Municipio[] } | { estado: "erro"; erro: string; tentar: () => void };

export function useMunicipios(): CargaMunicipios {
  const [carga, setCarga] = useState<CargaMunicipios>({ estado: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let vivo = true;
    setCarga({ estado: "carregando" });
    carregar().then(
      (lista) => vivo && setCarga({ estado: "pronto", lista }),
      (e: unknown) =>
        vivo &&
        setCarga({ estado: "erro", erro: e instanceof Error ? e.message : String(e), tentar: () => setTentativa((t) => t + 1) }),
    );
    return () => {
      vivo = false;
    };
  }, [tentativa]);
  return carga;
}
