"use client";

import { useEffect } from "react";

/**
 * No celular a lista de módulos rola na horizontal: traz o módulo atual
 * (aria-current="page") para o início da área visível. Centralizar cortava o rótulo vizinho
 * dos dois lados; alinhado ao início, só a borda direita termina cortada, o que sinaliza
 * que há mais itens. O alinhamento usa as posições medidas na tela e é refeito quando as
 * fontes terminam de carregar, porque a largura dos rótulos muda e deixava o módulo atual
 * com o começo cortado.
 */
export function AtivoVisivel({ alvo }: { alvo: string }) {
  useEffect(() => {
    const lista = document.getElementById(alvo);
    const ativo = lista?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!lista || !ativo) return;
    const alinha = () => {
      const folga = ativo.getBoundingClientRect().left - lista.getBoundingClientRect().left - 8;
      lista.scrollLeft = Math.max(0, lista.scrollLeft + folga);
    };
    alinha();
    let vivo = true;
    document.fonts?.ready.then(() => {
      if (vivo) alinha();
    });
    return () => {
      vivo = false;
    };
  }, [alvo]);
  return null;
}
