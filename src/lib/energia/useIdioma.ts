import { usePathname } from "next/navigation";
import type { Idioma } from "@/lib/idioma";
import { idiomaDoCaminho } from "./idioma";

/* Sem "use client": é módulo de hooks, importado por componentes de cliente. */

/**
 * Idioma para componentes de cliente. Lê o endereço pelo roteador, que é o mesmo no SSR e no
 * navegador (a hidratação não diverge) e já traz o destino durante uma navegação. Fora do App
 * Router (teste que renderiza o componente isolado) vale português.
 */
export function useIdioma(): Idioma {
  return idiomaDoCaminho(usePathname());
}

/** Versão de cliente de tx(): devolve a função já presa ao idioma da página. */
export function useTx(): <T>(pt: T, en: T) => T {
  const idioma = useIdioma();
  return <T,>(pt: T, en: T): T => (idioma === "en" ? en : pt);
}
