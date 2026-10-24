"use client";

import { useEffect } from "react";

/** Estado de leitura na URL, sem cookies novos nem armazenamento de perfil. */
export function EstadoMapa() {
  useEffect(() => {
    const mapa = document.querySelector("[data-mapa-conta]");
    if (!mapa) return;
    const detalhes = Array.from(mapa.querySelectorAll<HTMLDetailsElement>("details[id]"));
    const restaurar = () => {
      const abertos = new Set((new URLSearchParams(window.location.search).get("abertos") ?? "").split(","));
      for (const d of detalhes) d.open = abertos.has(d.id);
    };
    const guardar = () => {
      const url = new URL(window.location.href);
      const ids = detalhes.filter(d => d.open).map(d => d.id);
      if (ids.length) url.searchParams.set("abertos", ids.join(",")); else url.searchParams.delete("abertos");
      if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
    };
    restaurar();
    mapa.addEventListener("toggle", guardar, true);
    window.addEventListener("popstate", restaurar);
    return () => {
      mapa.removeEventListener("toggle", guardar, true);
      window.removeEventListener("popstate", restaurar);
    };
  }, []);
  return null;
}
