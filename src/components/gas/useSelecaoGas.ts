"use client";

import { useEffect, useMemo, useState } from "react";
import { resolverSelecaoGas } from "@/lib/gas/selecao";

/** Evento que avisa as outras ilhas da página que a escolha de uma chave mudou (pushState não dispara popstate). */
const EVENTO = "selecao-gas";

/**
 * Hidratação sem divergência do HTML; preserva outros filtros e acompanha voltar/avançar. Ilhas diferentes da mesma página
 * que usam a mesma chave (a UF no painel de combustíveis) andam juntas: a escolha numa avisa as outras.
 */
export function useSelecaoGas(chave: string, opcoes: readonly string[], padrao: string) {
  const assinatura = JSON.stringify(opcoes);
  const validas = useMemo(() => JSON.parse(assinatura) as string[], [assinatura]);
  const [estado, setEstado] = useState({ valor: padrao, invalida: false });
  useEffect(() => {
    const ler = () => setEstado(resolverSelecaoGas(new URL(window.location.href).searchParams.get(chave), validas, padrao));
    const doEvento = (e: Event) => {
      if ((e as CustomEvent<string>).detail === chave) ler();
    };
    ler();
    window.addEventListener("popstate", ler);
    window.addEventListener(EVENTO, doEvento);
    return () => {
      window.removeEventListener("popstate", ler);
      window.removeEventListener(EVENTO, doEvento);
    };
  }, [chave, validas, padrao]);
  function selecionar(valor: string) {
    if (!validas.includes(valor)) return;
    const url = new URL(window.location.href);
    url.searchParams.set(chave, valor);
    window.history.pushState(null, "", url);
    setEstado({ valor, invalida: false });
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: chave }));
  }
  return { ...estado, selecionar };
}
