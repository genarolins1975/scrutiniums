"use client";

import { useState, type ReactNode } from "react";

/**
 * Link para outra página da Conta de luz que leva junto a escolha de distribuidoras (?dist=) feita nesta: quem escolheu a CEMIG-D no
 * ranking chega à página de reajustes com a CEMIG-D em destaque. O endereço é montado na hora do toque, do foco ou do ponteiro, porque
 * a escolha muda sem recarregar a página; sem JavaScript, o link vale como está. `atual` marca a página em que o leitor já está
 * (aria-current), para a faixa de páginas irmãs.
 *
 * O link compartilhável de cada painel (copiar o endereço com os filtros e a âncora) é o `LinkDoPainel` do sistema, usado pelo
 * `SeguirPainel` no rodapé de cada painel.
 */
export function ContaLinkFiltros({
  href,
  children,
  className,
  manter = ["dist"],
  atual = false,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  manter?: string[];
  atual?: boolean;
}) {
  const [alvo, setAlvo] = useState(href);
  const atualizar = () => {
    const corrente = new URLSearchParams(window.location.search);
    const [base, ancora] = href.split("#");
    const q = new URLSearchParams();
    for (const k of manter) {
      const v = corrente.get(k);
      if (v) q.set(k, v);
    }
    const busca = q.toString();
    setAlvo(`${base}${busca ? `?${busca}` : ""}${ancora ? `#${ancora}` : ""}`);
  };
  return (
    <a href={alvo} aria-current={atual ? "page" : undefined} className={className} onPointerEnter={atualizar} onPointerDown={atualizar} onFocus={atualizar}>
      {children}
    </a>
  );
}
