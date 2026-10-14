"use client";

import { useEffect, useMemo, useState } from "react";
import { resolverSelecaoGas } from "@/lib/gas/selecao";

/** Hidratação sem divergência do HTML; preserva outros filtros e acompanha voltar/avançar. */
export function useSelecaoGas(chave: string, opcoes: readonly string[], padrao: string) {
  const assinatura = JSON.stringify(opcoes);
  const validas = useMemo(() => JSON.parse(assinatura) as string[], [assinatura]);
  const [estado, setEstado] = useState({ valor: padrao, invalida: false });
  useEffect(() => {
    const ler = () => setEstado(resolverSelecaoGas(new URL(window.location.href).searchParams.get(chave), validas, padrao));
    ler();
    window.addEventListener("popstate", ler);
    return () => window.removeEventListener("popstate", ler);
  }, [chave, validas, padrao]);
  function selecionar(valor: string) {
    if (!validas.includes(valor)) return;
    const url = new URL(window.location.href);
    url.searchParams.set(chave, valor);
    window.history.pushState(null, "", url);
    setEstado({ valor, invalida: false });
  }
  return { ...estado, selecionar };
}
