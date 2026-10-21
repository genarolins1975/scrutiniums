"use client";

import { en } from "@/i18n/en";
import { useIdioma } from "@/lib/energia/useIdioma";

/**
 * Texto que só existe em português (frase publicada pela fonte, nota da base que ainda não tem
 * versão inglesa), dentro de uma página inglesa: o aviso "Portuguese only" vem logo antes, visível,
 * e o trecho leva lang="pt-BR". Em português devolve o texto puro. Para bloco, como=div.
 */
export function TrechoPortugues({ children, regiao, como = "span" }: { children: React.ReactNode; regiao: string; como?: "span" | "div" }) {
  const idioma = useIdioma();
  if (idioma !== "en") return <>{children}</>;
  const Aviso = como === "div" ? "p" : "span";
  const Trecho = como;
  return (
    <>
      <Aviso data-i18n-aviso="" lang="en" className="mr-1 text-xs uppercase tracking-wide text-mineral">
        {en["traducao.portugues_apenas"].texto}
      </Aviso>
      <Trecho data-i18n-estado="portugues_marcado" data-i18n-regiao={regiao} lang="pt-BR">
        {children}
      </Trecho>
    </>
  );
}
