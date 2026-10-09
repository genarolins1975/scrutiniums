"use client";

import { useEffect, useState } from "react";

/**
 * "Restaurar padrão": volta a página de Água e clima ao estado de abertura. Recorte, entidade, unidade, ordem, comparação, intervalos e
 * tabela (busca, filtros, página) saem da URL de uma vez; só o nível de profundidade (?modo=) e a âncora ficam. Cada componente que lê a URL
 * (useEstadoUrl) a relê sozinho ao receber o aviso de voltar do navegador, e o botão Voltar desfaz a restauração, porque ela entra no
 * histórico como qualquer escolha.
 *
 * Aparece só quando há o que restaurar: quem não mudou nada não vê um botão que não faz nada. Ele acompanha a URL (a escolha de qualquer
 * controle da página, inclusive os da tabela e dos gráficos) e não a de um componente só.
 */

/** O aviso que useEstadoUrl dispara depois de gravar a URL (o mesmo nome; ele não é exportado de lá). */
const EVENTO_ESTADO_URL = "scrutiniums:estado-url";

function haEscolhaNaUrl(): boolean {
  try {
    return Array.from(new URLSearchParams(window.location.search).keys()).some((k) => k !== "modo");
  } catch {
    return false;
  }
}

function restaurar() {
  const url = new URL(window.location.href);
  const modo = url.searchParams.get("modo");
  url.search = modo ? `?modo=${encodeURIComponent(modo)}` : "";
  window.history.pushState(null, "", url.toString());
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function AguaRestaurar() {
  const [ha, setHa] = useState(false);
  useEffect(() => {
    const ler = () => setHa(haEscolhaNaUrl());
    ler();
    window.addEventListener("popstate", ler);
    window.addEventListener(EVENTO_ESTADO_URL, ler);
    return () => {
      window.removeEventListener("popstate", ler);
      window.removeEventListener(EVENTO_ESTADO_URL, ler);
    };
  }, []);
  if (!ha) return null;
  return (
    <button
      type="button"
      onClick={restaurar}
      data-restaurar=""
      className="inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-sm text-carvao hover:border-energia hover:text-carvao focus-visible:outline focus-visible:outline-2 focus-visible:outline-energia"
    >
      Restaurar padrão
    </button>
  );
}
