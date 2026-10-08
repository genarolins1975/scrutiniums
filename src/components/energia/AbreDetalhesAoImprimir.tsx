"use client";

import { useEffect } from "react";

/**
 * Impressão: o que fica recolhido na tela (trecho literal da fonte no verbete, dados do gráfico em tabela nos painéis)
 * o papel precisa. Antes de imprimir, abre os <details> da página; depois, devolve cada um ao estado em que estava.
 * Conteúdo que o componente só monta ao abrir (a tabela dos gráficos de linha) não depende deste evento: o próprio
 * componente se prepara no beforeprint, porque o toggle do navegador chega depois do layout da impressão.
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
