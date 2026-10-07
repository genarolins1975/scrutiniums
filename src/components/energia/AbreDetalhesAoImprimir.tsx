"use client";

import { useEffect } from "react";

/**
 * Impressão do verbete: o trecho literal de cada fonte fica recolhido na tela, mas o papel precisa
 * dele. Antes de imprimir, abre os <details> da página; depois, devolve cada um ao estado em que estava.
 */
export function AbreDetalhesAoImprimir() {
  useEffect(() => {
    let fechados: HTMLDetailsElement[] = [];
    const antes = () => {
      fechados = Array.from(document.querySelectorAll<HTMLDetailsElement>("main details:not([open])"));
      fechados.forEach((d) => (d.open = true));
    };
    const depois = () => {
      fechados.forEach((d) => (d.open = false));
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
