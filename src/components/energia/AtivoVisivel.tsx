"use client";

import { useEffect } from "react";

/**
 * No celular a lista de módulos rola na horizontal: traz o módulo atual
 * (aria-current="page") para o início da área visível. Centralizar cortava o rótulo vizinho
 * dos dois lados; alinhado ao início, só a borda direita termina cortada, o que sinaliza
 * que há mais itens. O alinhamento usa as posições medidas na tela e é refeito quando as
 * fontes terminam de carregar, porque a largura dos rótulos muda e deixava o módulo atual
 * com o começo cortado. Se o módulo atual já cabe inteiro, a lista não rola; se não cabe, ele fica
 * rente à borda esquerda e o anterior sai inteiro da vista (uma lasca de rótulo, como "LAÇÃO" no
 * lugar de "REGULAÇÃO", parecia erro). Nas bordas em que ainda há itens fora da vista, um
 * esmaecimento mostra que o corte é rolagem.
 */
export function AtivoVisivel({ alvo }: { alvo: string }) {
  useEffect(() => {
    const lista = document.getElementById(alvo);
    return lista ? acompanhaFaixa(lista, 0) : undefined;
  }, [alvo]);
  return null;
}

/**
 * Faixas de seções da página (`.nav-faixa`): no celular as abas ficam numa linha que rola, e a aba atual
 * só é trazida à vista quando está cortada ou escondida; a que já cabe não se mexe.
 */
export function FaixasDeSecao() {
  useEffect(() => {
    const limpezas = Array.from(document.querySelectorAll<HTMLElement>(".nav-faixa")).map((lista) => acompanhaFaixa(lista, 24));
    return () => limpezas.forEach((l) => l());
  }, []);
  return null;
}

function acompanhaFaixa(lista: HTMLElement, folga: number): () => void {
  const ativo = lista.querySelector<HTMLElement>('[aria-current="page"]');
  const alinha = () => {
    if (!ativo) return;
    const a = ativo.getBoundingClientRect();
    const l = lista.getBoundingClientRect();
    // o item atual já cabe inteiro: não se rola, e nenhum rótulo vizinho fica cortado à esquerda
    if (a.left >= l.left && a.right <= l.right - 8) return;
    // senão, alinha rente à borda (com a folga da faixa), de modo que o anterior saia inteiro da vista
    lista.scrollLeft = Math.max(0, lista.scrollLeft + (a.left - l.left - folga));
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
}
