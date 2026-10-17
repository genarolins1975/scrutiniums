"use client";

import { useIdioma } from "@/lib/energia/useIdioma";

/**
 * Nome próprio em português (empresa, usina, município, programa, órgão, base) dentro de uma
 * página inglesa: fica como está, com lang="pt-BR" para o leitor de tela pronunciar certo e
 * translate="no" para o tradutor do navegador não reescrever. Em português devolve o texto puro,
 * sem elemento: a página portuguesa não muda.
 */
export function Nome({ children }: { children: React.ReactNode }) {
  const idioma = useIdioma();
  if (idioma !== "en") return <>{children}</>;
  return (
    <span lang="pt-BR" translate="no" data-i18n-nome="">
      {children}
    </span>
  );
}
