"use client";

import { useEffect } from "react";

/**
 * A página inicial do domínio passou a ser o Mapa do Observatório; o painel de
 * dados foi para /setor-eletrico/visao-geral. Um link antigo com âncora da
 * visão geral (por exemplo /setor-eletrico#observar) segue para a seção certa.
 */
export function RedirecionaAncoraAntiga({ ancoras, destino }: { ancoras: string[]; destino: string }) {
  useEffect(() => {
    const confere = () => {
      const h = decodeURIComponent(window.location.hash.slice(1));
      if (h && ancoras.includes(h)) window.location.replace(`${destino}${window.location.search}#${h}`);
    };
    confere();
    // link antigo clicado já dentro do mapa: só o hash muda, sem nova carga
    window.addEventListener("hashchange", confere);
    return () => window.removeEventListener("hashchange", confere);
  }, [ancoras, destino]);
  return null;
}
