"use client";

import { useEffect } from "react";

/**
 * Abre os blocos recolhidos (details) que contêm o destino do endereço (#âncora) e leva o foco até ele. O navegador já faz isso em parte dos casos;
 * aqui o comportamento é garantido na carga e a cada mudança de âncora, sem alterar o conteúdo da página.
 */
export function AbreAncora() {
  useEffect(() => {
    const vai = () => {
      let id = "";
      try {
        id = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      const alvo = id ? document.getElementById(id) : null;
      if (!alvo) return;
      for (let p: HTMLElement | null = alvo; p; p = p.parentElement) {
        if (p instanceof HTMLDetailsElement) p.open = true;
      }
      if (!alvo.hasAttribute("tabindex")) alvo.setAttribute("tabindex", "-1");
      alvo.scrollIntoView({ block: "start" });
      alvo.focus({ preventScroll: true });
    };
    vai();
    window.addEventListener("hashchange", vai);
    return () => window.removeEventListener("hashchange", vai);
  }, []);
  return null;
}
