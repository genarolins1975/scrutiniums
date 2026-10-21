import type { ReactNode } from "react";
import { PaginaAberta } from "@/components/acesso/PaginaAberta";

/**
 * Versões aperitivo (princípio do aperitivo, 20/10/2026): servidas por rewrite no endereço público do tema a
 * quem não tem sessão. A marca de página aberta vem daqui, porque o mesmo endereço serve o painel completo a
 * quem tem conta.
 */
export default function LayoutAperitivo({ children }: { children: ReactNode }) {
  return <PaginaAberta>{children}</PaginaAberta>;
}
