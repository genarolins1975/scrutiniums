"use client";

import { useEffect } from "react";

/**
 * As portas por pergunta e os números da entrada apontam para seções dentro de blocos recolhidos (<details>). Nem todo navegador
 * abre o bloco ao seguir a âncora; este componente abre o <details> que contém o alvo e rola até ele, na carga, a cada troca de
 * hash e a cada clique repetido no mesmo link (que não dispara hashchange). Sem script, a âncora continua levando ao bloco.
 */
export function AbreAncora() {
  useEffect(() => {
    const abrir = (hash: string) => {
      const alvo = hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
      if (!alvo) return;
      let bloco = alvo.closest("details");
      let abriu = false;
      while (bloco) {
        if (!bloco.open) {
          bloco.open = true;
          abriu = true;
        }
        bloco = bloco.parentElement?.closest("details") ?? null;
      }
      if (abriu) alvo.scrollIntoView({ block: "start" });
    };
    const aoMudar = () => abrir(window.location.hash);
    const aoClicar = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href^='#']");
      if (a) abrir(a.getAttribute("href") ?? "");
    };
    aoMudar();
    window.addEventListener("hashchange", aoMudar);
    document.addEventListener("click", aoClicar);
    return () => {
      window.removeEventListener("hashchange", aoMudar);
      document.removeEventListener("click", aoClicar);
    };
  }, []);
  return null;
}
