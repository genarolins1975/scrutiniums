"use client";

import { useEffect } from "react";

/**
 * No celular a lista de módulos rola na horizontal: traz o módulo atual
 * (aria-current="page") para a área visível ao carregar a página.
 */
export function AtivoVisivel({ alvo }: { alvo: string }) {
  useEffect(() => {
    const lista = document.getElementById(alvo);
    const ativo = lista?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!lista || !ativo) return;
    const deslocamento = ativo.offsetLeft - (lista.clientWidth - ativo.offsetWidth) / 2;
    lista.scrollLeft = Math.max(0, deslocamento);
  }, [alvo]);
  return null;
}
