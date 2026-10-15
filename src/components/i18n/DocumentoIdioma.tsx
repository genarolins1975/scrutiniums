"use client";

import { usePathname } from "next/navigation";
import { PortuguesApenas } from "./PortuguesApenas";

function caminhoIngles(pathname: string | null): boolean {
  return pathname === "/en" || pathname?.startsWith("/en/") === true;
}

/** usePathname participa do SSR e da navegação; não depende de efeito no navegador. */
export function DocumentoIdioma({ children, className, bodyClassName }: Readonly<{
  children: React.ReactNode;
  className: string;
  bodyClassName: string;
}>) {
  const pathname = usePathname();
  return (
    <html lang={caminhoIngles(pathname) ? "en" : "pt-BR"} className={className}>
      <body className={bodyClassName}>{children}</body>
    </html>
  );
}

/** Boundaries compartilhadas conservam a saída portuguesa sem elemento adicional. */
export function MolduraIdioma({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  return caminhoIngles(pathname) ? <PortuguesApenas>{children}</PortuguesApenas> : <>{children}</>;
}
