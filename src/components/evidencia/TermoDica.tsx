"use client";

import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";

/**
 * Parte interativa do Termo e da Unidade (WCAG 1.4.13): id único por
 * ocorrência; a dica abre com hover ou foco, pode receber o ponteiro sem sumir
 * (a faixa entre o termo e a caixa faz parte da área) e fecha com Esc, com o
 * foco no termo ou só com o ponteiro sobre ele. Hover e foco seguem por CSS.
 */
export function TermoDica({ href, rotulo, dica, children }: { href: string; rotulo: string; dica: string; children: ReactNode }) {
  const id = useId();
  const [fechada, setFechada] = useState(false);
  const [sobre, setSobre] = useState(false);
  useEffect(() => {
    if (!sobre || fechada) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFechada(true);
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [sobre, fechada]);
  return (
    <span
      className={`termo relative inline ${fechada ? "termo-fechada" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") setFechada(true);
      }}
      onMouseEnter={() => setSobre(true)}
      onMouseLeave={() => {
        setSobre(false);
        setFechada(false);
      }}
      onBlur={() => setFechada(false)}
    >
      <Link
        href={href}
        aria-describedby={id}
        className="underline decoration-energia/50 decoration-dotted underline-offset-4 hover:decoration-energia"
      >
        {children}
      </Link>
      <span id={id} role="tooltip" className="termo-dica absolute bottom-full left-0 z-40 w-[min(18rem,80vw)] pb-2 text-left">
        <span className="block border border-linha bg-superficie p-3 text-xs font-normal normal-case leading-relaxed tracking-normal text-carvao shadow-[0_6px_20px_rgba(26,29,33,0.12)]">
          <span className="rotulo block text-mineral">{rotulo}</span>
          <span className="mt-1 block">{dica}</span>
        </span>
      </span>
    </span>
  );
}
