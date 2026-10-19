"use client";

import { useEffect } from "react";

/**
 * Abre os <details> recolhidos que contêm o destino de uma âncora (#obs-credito,
 * por exemplo), na chegada à página e a cada troca de âncora, para que o índice
 * recolhido da home nunca esconda o destino de um link. Não desenha nada.
 */
export function AbrirDestinoDaAncora() {
  useEffect(() => {
    const abrir = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const alvo = id ? document.getElementById(id) : null;
      if (!alvo) return;
      let abriu = false;
      for (let e = alvo.parentElement; e; e = e.parentElement) {
        if (e instanceof HTMLDetailsElement && !e.open) {
          e.open = true;
          abriu = true;
        }
      }
      if (abriu) alvo.scrollIntoView();
    };
    abrir();
    window.addEventListener("hashchange", abrir);
    return () => window.removeEventListener("hashchange", abrir);
  }, []);
  return null;
}
