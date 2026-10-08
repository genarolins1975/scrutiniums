"use client";

import { useEffect } from "react";
import { flushSync } from "react-dom";

/**
 * Impressão: o que fica recolhido na tela (trecho literal da fonte no verbete, dados do gráfico em tabela nos painéis)
 * o papel precisa. Antes de imprimir, abre os <details> da página; depois, devolve cada um ao estado em que estava.
 * O evento toggle é disparado na hora e dentro de flushSync: o do navegador chega só depois do layout da impressão, e o
 * React agenda a montagem das tabelas dos gráficos (feita ao abrir) para depois dele, o que as deixaria de fora do papel.
 */
export function AbreDetalhesAoImprimir() {
  useEffect(() => {
    let fechados: HTMLDetailsElement[] = [];
    const antes = () => {
      fechados = Array.from(document.querySelectorAll<HTMLDetailsElement>("main details:not([open])"));
      flushSync(() => {
        fechados.forEach((d) => {
          d.open = true;
          d.dispatchEvent(new Event("toggle"));
        });
      });
    };
    const depois = () => {
      fechados.forEach((d) => {
        d.open = false;
        d.dispatchEvent(new Event("toggle"));
      });
      fechados = [];
    };
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", depois);
    return () => {
      window.removeEventListener("beforeprint", antes);
      window.removeEventListener("afterprint", depois);
    };
  }, []);
  return null;
}
