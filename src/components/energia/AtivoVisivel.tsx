"use client";

import { useEffect } from "react";

/**
 * No celular a lista de módulos rola na horizontal: traz o módulo atual
 * (aria-current="page") para o início da área visível ao carregar a página. Centralizar
 * cortava o rótulo vizinho dos dois lados ("LIDADE DO SERVIÇO"); alinhado ao início, só a
 * borda direita termina cortada, o que sinaliza que há mais itens.
 */
export function AtivoVisivel({ alvo }: { alvo: string }) {
  useEffect(() => {
    const lista = document.getElementById(alvo);
    const ativo = lista?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!lista || !ativo) return;
    lista.scrollLeft = Math.max(0, ativo.offsetLeft - 8);
  }, [alvo]);
  return null;
}
