"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { urlComNivel } from "@/components/evidencia/ModoProfundidade";
import { destinoComEscolha } from "@/lib/energia/qualidade";

/** Roteador do app; null onde ele não está montado (renderização de teste), sem derrubar a página. */
function useRoteadorOuNulo() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

/**
 * Leva a distribuidora escolhida (?dist=, um ou mais CNPJs de 14 dígitos separados por vírgula) entre as duas páginas de Qualidade (a
 * entrada e Comparar distribuidoras): quem escolheu a RGE SUL na comparação, foi à entrada ver as compensações e voltou encontra a mesma
 * distribuidora no comparador. Mesmo desenho de PerdasLevaEscolha: a navegação local (faixa das duas páginas, capítulos e "Próxima
 * pergunta") é compartilhada e não conhece a escolha, então este componente observa o clique em link para a outra página e acrescenta o
 * ?dist= da página de origem, junto com o nível de profundidade (?modo=). Link que já traz ?dist= próprio, link para a mesma página,
 * link com modificador (nova aba), de download ou de outra origem seguem como estão. Sem JavaScript, o link vai sem a escolha.
 */
export function QualidadeLevaEscolha() {
  const router = useRoteadorOuNulo();
  useEffect(() => {
    if (!router) return;
    const rota = router;
    function aoClicar(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const destino = destinoComEscolha(a.href, window.location.href);
      if (!destino) return;
      const alvo = new URL(destino);
      e.preventDefault();
      rota.push(urlComNivel(destino, window.location) ?? `${alvo.pathname}${alvo.search}${alvo.hash}`);
    }
    window.addEventListener("click", aoClicar, true);
    return () => window.removeEventListener("click", aoClicar, true);
  }, [router]);
  return null;
}
