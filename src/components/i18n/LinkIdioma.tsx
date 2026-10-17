"use client";

import NextLink from "next/link";
import { forwardRef, type ComponentProps } from "react";
import { hrefNoIdioma } from "@/lib/i18n-href";
import { useIdioma } from "@/lib/energia/useIdioma";

type Props = ComponentProps<typeof NextLink>;

/**
 * next/link que conserva o idioma da página: em /en, um destino interno vai para a irmã inglesa
 * quando ela tem tradução publicada; o resto fica no endereço português. Em português nada muda.
 * Mesmas props do next/link, para trocar só o import.
 */
const LinkIdioma = forwardRef<HTMLAnchorElement, Props>(function LinkIdioma({ href, ...resto }, ref) {
  const idioma = useIdioma();
  let destino: Props["href"] = href;
  if (idioma === "en") {
    if (typeof href === "string") destino = hrefNoIdioma(href, "en");
    else if (href && typeof href === "object" && typeof href.pathname === "string") {
      destino = { ...href, pathname: hrefNoIdioma(href.pathname, "en") };
    }
  }
  return <NextLink ref={ref} href={destino} {...resto} />;
});

export default LinkIdioma;
