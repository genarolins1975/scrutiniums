"use client";

import { useEffect } from "react";

/**
 * No celular a lista de módulos rola na horizontal: traz o módulo atual
 * (aria-current="page") para o início da área visível. Centralizar cortava o rótulo vizinho
 * dos dois lados; alinhado ao início, só a borda direita termina cortada, o que sinaliza
 * que há mais itens. O alinhamento usa as posições medidas na tela e é refeito quando as
 * fontes terminam de carregar, porque a largura dos rótulos muda e deixava o módulo atual
 * com o começo cortado. Nas bordas em que ainda há itens fora da vista, um esmaecimento
 * mostra que o corte é rolagem, e não um rótulo quebrado.
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
    const bordas = () => {
      const maximo = lista.scrollWidth - lista.clientWidth;
      lista.style.setProperty("--fade-esq", lista.scrollLeft > 1 ? "1" : "0");
      lista.style.setProperty("--fade-dir", lista.scrollLeft < maximo - 1 ? "1" : "0");
    };
    alinha();
    bordas();
    lista.addEventListener("scroll", bordas, { passive: true });
    window.addEventListener("resize", bordas);
    let vivo = true;
    document.fonts?.ready.then(() => {
      if (vivo) {
        alinha();
        bordas();
      }
    });
    return () => {
      vivo = false;
      lista.removeEventListener("scroll", bordas);
      window.removeEventListener("resize", bordas);
    };
  }, [alvo]);
  return null;
}
