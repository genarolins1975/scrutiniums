"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Estado de um filtro refletido na URL (?chave=valor), para que uma análise seja
 * compartilhável e reproduzível. A página é estática: o estado nasce com o
 * padrão, lê a URL depois de montar e grava com replaceState (sem nova carga,
 * sem entrada no histórico). O valor igual ao padrão sai da URL.
 */
export function useEstadoUrl<T extends string>(chave: string, padrao: T, aceita: (v: string) => v is T): [T, (v: T) => void] {
  const [valor, setValor] = useState<T>(padrao);
  useEffect(() => {
    try {
      const v = new URLSearchParams(window.location.search).get(chave);
      if (v !== null && aceita(v)) setValor(v);
    } catch {
      // URL ilegível: fica o padrão
    }
    // só na montagem: a URL é lida uma vez, e o estado passa a mandar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  const definir = useCallback(
    (v: T) => {
      setValor(v);
      try {
        const url = new URL(window.location.href);
        if (v === padrao) url.searchParams.delete(chave);
        else url.searchParams.set(chave, v);
        window.history.replaceState(null, "", url.toString());
      } catch {
        // URL inalterada não impede a troca de estado
      }
    },
    [chave, padrao],
  );
  return [valor, definir];
}

/** Aceita qualquer valor de uma lista fixa. */
export function umDe<T extends string>(lista: readonly T[]): (v: string) => v is T {
  return (v: string): v is T => (lista as readonly string[]).includes(v);
}
