"use client";

import { useEffect } from "react";

/**
 * Decisão do dono de 24/11/2026: os números de contexto da entrada ficam à vista enquanto o leitor não escolheu um recorte e se
 * recolhem quando a resposta específica aparece (antes, ficavam sempre recolhidos). Nas entradas em que a escolha acontece no
 * navegador (estado, área ou capital pela URL), a resposta marca `data-escolha="sim"` no `[data-resposta-especifica]`; esta ilha
 * acompanha essa marca e abre ou recolhe o <details> do contexto, só quando a escolha muda, sem disputar com o toque do leitor.
 */
export function ContextoAteEscolha({ alvo }: Readonly<{ alvo: string }>) {
  useEffect(() => {
    const contexto = document.getElementById(alvo);
    if (!(contexto instanceof HTMLDetailsElement)) return;
    let anterior: boolean | null = null;
    const aplicar = () => {
      const escolheu = document.querySelector('[data-resposta-especifica][data-escolha="sim"]') !== null;
      if (escolheu === anterior) return;
      anterior = escolheu;
      contexto.open = !escolheu;
    };
    aplicar();
    const observador = new MutationObserver(aplicar);
    observador.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-escolha"], childList: true });
    return () => observador.disconnect();
  }, [alvo]);
  return null;
}
