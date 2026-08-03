"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * "Já tenho cadastro" que preserva o destino pretendido.
 *
 * Quem chega por um link compartilhado — /observatorio/pix, por exemplo — é
 * trazido para esta vitrine com `?de=/observatorio/pix`. O href começa apontando
 * para a Visão geral (funciona sem JavaScript e mantém a página estática) e, na
 * hidratação, passa a levar de volta exatamente à página pedida.
 *
 * O destino é validado: só caminhos internos que comecem com /observatorio são
 * aceitos, para que o parâmetro não vire vetor de redirecionamento aberto.
 */
const PADRAO = "/entrar?de=%2Fobservatorio";

export function LinkEntrarComDestino({ className }: { className?: string }) {
  const [href, setHref] = useState(PADRAO);

  useEffect(() => {
    const de = new URLSearchParams(window.location.search).get("de");
    if (de && de.startsWith("/observatorio") && !de.startsWith("//")) {
      setHref(`/entrar?de=${encodeURIComponent(de)}`);
    }
  }, []);

  return (
    <Link href={href} className={className}>
      Já tenho cadastro
    </Link>
  );
}
