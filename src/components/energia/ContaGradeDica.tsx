"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type SyntheticEvent } from "react";

/**
 * Dica de cada mês da grade de bandeiras. A grade (servidor) traz em cada célula a sigla da bandeira e, em texto para leitor de tela, o
 * nome e o adicional do mês; quem enxerga só via a sigla e a cor, sem o valor, e as 141 células não eram focáveis. Aqui a grade ganha:
 * - uma parada de tabulação só (o mês mais recente) e as setas para percorrer as células (141 paradas seriam um labirinto para o teclado);
 * - a dica do mês ao passar o mouse, ao focar ou ao tocar: o texto aparece numa linha fixa abaixo da grade (região viva, que o leitor de
 *   tela também anuncia) e no `title` da célula, junto do ponteiro.
 * O texto sai da própria célula e dos cabeçalhos (mês, ano, bandeira e adicional em R$/MWh, mais o valor por kWh); nada é recalculado nem
 * enviado de novo pelo servidor.
 */
const kwhDe = (sr: string): string | null => {
  const m = /([\d.]+,\d+)\s*R\$\/MWh/.exec(sr);
  if (!m) return null;
  const mwh = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(mwh) ? (mwh / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 5, maximumFractionDigits: 5 }) : null;
};

export function ContaGradeDica({ children, instrucao }: { children: ReactNode; instrucao: string }) {
  const raiz = useRef<HTMLDivElement>(null);
  const [texto, setTexto] = useState("");

  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const celulas = Array.from(el.querySelectorAll<HTMLElement>("td.cb-cel"));
    celulas.forEach((c, i) => c.setAttribute("tabindex", i === celulas.length - 1 ? "0" : "-1"));
  }, []);

  const dicaDe = (td: HTMLElement): string => {
    const el = raiz.current;
    const ano = td.parentElement?.querySelector("th")?.textContent?.trim() ?? "";
    const coluna = (td as HTMLTableCellElement).cellIndex;
    const mes = el?.querySelectorAll("thead th")[coluna]?.querySelector(".sr-only")?.textContent?.trim() ?? "";
    const sr = td.querySelector(".sr-only")?.textContent?.trim() ?? "";
    const kwh = kwhDe(sr);
    return `${mes} de ${ano}: ${sr}${kwh ? ` (${kwh} R$/kWh)` : ""}`;
  };

  const celulaDe = (e: SyntheticEvent): HTMLElement | null => {
    const td = (e.target as HTMLElement).closest<HTMLElement>("td.cb-cel");
    return td && raiz.current?.contains(td) ? td : null;
  };

  const mostrar = (e: SyntheticEvent) => {
    const td = celulaDe(e);
    if (!td) return;
    const t = dicaDe(td);
    setTexto(t);
    td.title = t;
  };

  const teclar = (e: KeyboardEvent) => {
    const td = celulaDe(e);
    const passo = (({ ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }) as Record<string, number[] | undefined>)[e.key];
    if (!td || !passo || !raiz.current) return;
    e.preventDefault();
    const linhas = Array.from(raiz.current.querySelectorAll("tbody tr"));
    let l = linhas.indexOf(td.parentElement as Element);
    let c = (td as HTMLTableCellElement).cellIndex;
    for (;;) {
      l += passo[0];
      c += passo[1];
      const linha = linhas[l];
      if (!linha || c < 1 || c >= linha.children.length) return;
      const alvo = linha.children[c] as HTMLElement;
      if (alvo.classList.contains("cb-cel")) {
        td.setAttribute("tabindex", "-1");
        alvo.setAttribute("tabindex", "0");
        alvo.focus();
        return;
      }
    }
  };

  return (
    <div ref={raiz} onMouseOver={mostrar} onFocus={mostrar} onClick={mostrar} onKeyDown={teclar} className="[&_td.cb-cel:focus-visible]:outline [&_td.cb-cel:focus-visible]:outline-2 [&_td.cb-cel:focus-visible]:outline-energia">
      {children}
      <p role="status" aria-live="polite" className="mt-2 min-h-[1.5rem] text-sm leading-relaxed text-carvao" data-dica-bandeira="">
        {texto || instrucao}
      </p>
    </div>
  );
}
