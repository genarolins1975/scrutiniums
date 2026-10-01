"use client";

import type { ReactNode } from "react";

/**
 * Link entre as páginas do módulo Perdas que leva junto a distribuidora escolhida (?d=):
 * quem escolheu a CEMIG-D no mapa chega à composição, ao percentual técnico e ao custo
 * com a mesma distribuidora acesa. Sem JavaScript, é um link comum para a página.
 */
export function PerdasLinkConsulta({ href, children, className, atual = false }: { href: string; children: ReactNode; className?: string; atual?: boolean }) {
  return (
    <a
      href={href}
      className={className}
      aria-current={atual ? "page" : undefined}
      onClick={(ev) => {
        try {
          const d = new URLSearchParams(window.location.search).get("d");
          if (!d || !/^\d{14}$/.test(d)) return;
          const alvo = new URL(href, window.location.href);
          if (!alvo.searchParams.has("d")) alvo.searchParams.set("d", d);
          ev.currentTarget.href = alvo.toString();
        } catch {
          // endereço inesperado: segue o link sem a escolha
        }
      }}
    >
      {children}
    </a>
  );
}
