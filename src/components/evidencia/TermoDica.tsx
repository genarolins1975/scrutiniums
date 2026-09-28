"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Parte interativa do Termo e da Unidade (WCAG 1.4.13): id único por
 * ocorrência; a dica abre com hover ou foco, pode receber o ponteiro sem sumir
 * (a faixa entre o termo e a caixa faz parte da área) e fecha com Esc, com o
 * foco no termo ou só com o ponteiro sobre ele. Hover e foco seguem por CSS.
 * Ao abrir, a caixa é deslocada para caber na largura da tela (WCAG 1.4.10):
 * um termo perto da margem direita não empurra a página para o lado.
 */
const MARGEM = 16;
/** `alvo`: fora de texto corrido (listas de termos), o termo ganha altura de toque de 44 px. */
export function TermoDica({ href, rotulo, dica, children, alvo = false }: { href: string; rotulo: string; dica: string; children: ReactNode; alvo?: boolean }) {
  const id = useId();
  const [fechada, setFechada] = useState(false);
  const [sobre, setSobre] = useState(false);
  const [desloc, setDesloc] = useState(0);
  const raiz = useRef<HTMLSpanElement>(null);
  const posiciona = () => {
    const el = raiz.current;
    if (!el) return;
    const vw = document.documentElement.clientWidth;
    const largura = Math.min(288, vw * 0.8, vw - 2 * MARGEM);
    // termo quebrado em duas linhas: a caixa se ancora no início da primeira linha, não na união das linhas
    const esquerda = (el.getClientRects()[0] ?? el.getBoundingClientRect()).left;
    // desloca para a esquerda o quanto for preciso para a borda direita caber, sem passar da margem esquerda
    setDesloc(Math.max(MARGEM - esquerda, Math.min(0, vw - MARGEM - (esquerda + largura))));
  };
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
      ref={raiz}
      className={`termo relative ${alvo ? "inline-flex min-h-[44px] items-center" : "inline"} ${fechada ? "termo-fechada" : ""}`}
      onFocus={posiciona}
      onKeyDown={(e) => {
        if (e.key === "Escape") setFechada(true);
      }}
      onMouseEnter={() => {
        posiciona();
        setSobre(true);
      }}
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
      <span
        id={id}
        role="tooltip"
        style={{ left: desloc }}
        className="termo-dica absolute bottom-full left-0 z-40 w-[min(18rem,80vw,calc(100vw-2rem))] pb-2 text-left"
      >
        <span className="block border border-linha bg-superficie p-3 text-xs font-normal normal-case leading-relaxed tracking-normal text-carvao shadow-[0_6px_20px_rgba(26,29,33,0.12)]">
          <span className="rotulo block text-mineral">{rotulo}</span>
          <span className="mt-1 block">{dica}</span>
        </span>
      </span>
    </span>
  );
}
