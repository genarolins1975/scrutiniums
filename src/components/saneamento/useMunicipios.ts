"use client";

import { useEffect, useState } from "react";
import { juntarComplemento, paraMunicipios } from "@/lib/saneamento/municipios";
import type { Municipio, TabelaMunicipios } from "@/lib/saneamento/tipos";

/**
 * Tabela municipal compacta (public/saneamento/gold/municipios.json), buscada
 * uma vez por página e compartilhada entre componentes. Falha não fica em
 * cache: "Tentar de novo" refaz a busca.
 */
export const URL_MUNICIPIOS = "/saneamento/gold/municipios.json";

const promessas = new Map<string, Promise<Municipio[]>>();

async function tabela(url: string): Promise<TabelaMunicipios> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`resposta ${r.status}`);
  return (await r.json()) as TabelaMunicipios;
}

/** Tabela municipal, opcionalmente unida (pelo código IBGE) a uma tabela complementar de outro capítulo. */
function carregar(complemento?: string): Promise<Municipio[]> {
  const chave = complemento ?? "";
  let p = promessas.get(chave);
  if (!p) {
    p = Promise.all([tabela(URL_MUNICIPIOS), complemento ? tabela(complemento) : null])
      .then(([base, extra]) => juntarComplemento(paraMunicipios(base), extra))
      .catch((e: unknown) => {
        promessas.delete(chave);
        throw e;
      });
    promessas.set(chave, p);
  }
  return p;
}

export type CargaMunicipios = { estado: "carregando" } | { estado: "pronto"; lista: Municipio[] } | { estado: "erro"; erro: string; tentar: () => void };

export function useMunicipios(complemento?: string): CargaMunicipios {
  const [carga, setCarga] = useState<CargaMunicipios>({ estado: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let vivo = true;
    setCarga({ estado: "carregando" });
    carregar(complemento).then(
      (lista) => vivo && setCarga({ estado: "pronto", lista }),
      (e: unknown) =>
        vivo &&
        setCarga({ estado: "erro", erro: e instanceof Error ? e.message : String(e), tentar: () => setTentativa((t) => t + 1) }),
    );
    return () => {
      vivo = false;
    };
  }, [tentativa, complemento]);
  return carga;
}
