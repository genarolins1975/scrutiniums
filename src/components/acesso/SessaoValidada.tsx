"use client";
import type { ReactNode } from "react";
import { ContextoSessaoValidada } from "./sessao";

/** Recebe apenas o resultado da autorização RSC; nenhuma informação pessoal vai ao cliente. */
export function SessaoValidada({ children }: { children: ReactNode }) {
  return <ContextoSessaoValidada.Provider value={true}>{children}</ContextoSessaoValidada.Provider>;
}
