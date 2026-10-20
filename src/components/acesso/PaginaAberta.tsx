"use client";

import type { ReactNode } from "react";
import { ContextoPaginaAberta } from "./sessao";

/** Marca a árvore como página aberta: as versões aperitivo, servidas no endereço público do tema (ver sessao.ts). */
export function PaginaAberta({ children }: { children: ReactNode }) {
  return <ContextoPaginaAberta.Provider value>{children}</ContextoPaginaAberta.Provider>;
}
