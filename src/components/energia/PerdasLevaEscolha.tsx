"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { urlComNivel } from "@/components/evidencia/ModoProfundidade";

/**
 * Leva a distribuidora escolhida (?d=, o CNPJ de 14 dígitos) de uma página do módulo Perdas para as outras: quem escolheu a CEMIG-D no
 * mapa chega à composição, ao percentual técnico e ao custo com a mesma distribuidora acesa.
 *
 * A navegação local do observatório (faixa de páginas irmãs, capítulos e "Próxima pergunta") é compartilhada e não conhece a escolha
 * de cada módulo: este componente observa o clique em link para outra página de Perdas e acrescenta o ?d= da página de origem ao
 * destino, junto com o nível de profundidade (?modo=) que o ModoProfundidade levaria. Link que já traz ?d= próprio, link para a mesma
 * página (âncora), link com modificador (nova aba), de download ou de outra origem seguem como estão. Sem JavaScript, o link vai
 * para a página sem a escolha.
 *
 * O ouvinte fica na janela, na fase de captura: roda antes do ouvinte do ModoProfundidade (que respeita `defaultPrevented`) e antes do
 * `Link` do Next, qualquer que seja a ordem em que os componentes montaram.
 */
const PAGINA_PERDAS = /^\/setor-eletrico\/perdas(\/|$)/;

/** Roteador do app; null onde ele não está montado (renderização de teste), sem derrubar a página. */
function useRoteadorOuNulo() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

export function PerdasLevaEscolha() {
  const router = useRoteadorOuNulo();
  useEffect(() => {
    if (!router) return;
    const rota = router;
    function aoClicar(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const d = new URLSearchParams(window.location.search).get("d");
      if (!d || !/^\d{14}$/.test(d)) return;
      let alvo: URL;
      try {
        alvo = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (alvo.origin !== window.location.origin || !PAGINA_PERDAS.test(alvo.pathname)) return;
      if (alvo.pathname === window.location.pathname || alvo.searchParams.has("d")) return;
      alvo.searchParams.set("d", d);
      e.preventDefault();
      rota.push(urlComNivel(alvo.toString(), window.location) ?? `${alvo.pathname}${alvo.search}${alvo.hash}`);
    }
    window.addEventListener("click", aoClicar, true);
    return () => window.removeEventListener("click", aoClicar, true);
  }, [router]);
  return null;
}
