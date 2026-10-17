import type { ReactNode } from "react";
import type { Idioma } from "@/lib/idioma";
import { Nome } from "./Nome";

/**
 * Texto montado com nomes próprios dentro (título de gráfico "Water balance of Serra da Mesa"): na página inglesa, cada nome da lista
 * sai marcado com <Nome>; em português, o texto volta como veio. Nomes mais longos primeiro, para "São Francisco" não ser cortado por
 * um nome contido nele.
 */
export function comNomes(texto: string, nomes: readonly (string | null | undefined)[] | undefined, idioma: Idioma): ReactNode {
  if (idioma !== "en" || !texto || !nomes?.length) return texto;
  const lista = [...new Set(nomes.filter((n): n is string => !!n && n.length > 1 && texto.includes(n)))].sort((a, b) => b.length - a.length);
  if (!lista.length) return texto;
  const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const partes = texto.split(new RegExp(`(${lista.map(escapar).join("|")})`, "g"));
  return partes.map((p, i) => (lista.includes(p) ? <Nome key={i}>{p}</Nome> : p));
}
