"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * <details> que fecha com Esc (devolvendo o foco ao resumo), com clique fora e
 * quando o foco sai dele. Sem JavaScript continua um <details> comum.
 */
export function DetalhesFechaveis({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fora = (e: PointerEvent) => {
      if (el.open && !el.contains(e.target as Node)) el.open = false;
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" && el.open) {
        el.open = false;
        el.querySelector("summary")?.focus();
      }
    };
    const saiu = (e: FocusEvent) => {
      if (el.open && !el.contains(e.relatedTarget as Node | null)) el.open = false;
    };
    document.addEventListener("pointerdown", fora);
    el.addEventListener("keydown", tecla);
    el.addEventListener("focusout", saiu);
    return () => {
      document.removeEventListener("pointerdown", fora);
      el.removeEventListener("keydown", tecla);
      el.removeEventListener("focusout", saiu);
    };
  }, []);
  return (
    <details ref={ref} className={className}>
      {children}
    </details>
  );
}
