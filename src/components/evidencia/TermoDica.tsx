"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

/**
 * Parte interativa do Termo: id único por ocorrência (a mesma sigla pode
 * aparecer várias vezes na página) e Esc fecha a dica sem mover o foco
 * (WCAG 1.4.13). Hover e foco continuam controlados por CSS.
 */
export function TermoDica({ href, rotulo, dica, children }: { href: string; rotulo: string; dica: string; children: ReactNode }) {
  const id = useId();
  const [fechada, setFechada] = useState(false);
  return (
    <span
      className={`termo relative inline ${fechada ? "termo-fechada" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") setFechada(true);
      }}
      onMouseLeave={() => setFechada(false)}
      onBlur={() => setFechada(false)}
    >
      <Link
        href={href}
        aria-describedby={id}
        className="underline decoration-energia/50 decoration-dotted underline-offset-4 hover:decoration-energia"
      >
        {children}
      </Link>
      <span
        id={id}
        role="tooltip"
        className="termo-dica pointer-events-none absolute bottom-full left-0 z-40 mb-2 w-[min(18rem,80vw)] border border-linha bg-superficie p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-carvao shadow-[0_6px_20px_rgba(26,29,33,0.12)]"
      >
        <span className="rotulo block text-mineral">{rotulo}</span>
        <span className="mt-1 block">{dica}</span>
      </span>
    </span>
  );
}
