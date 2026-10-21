"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Contêiner de tabela larga que só ganha a sombra de rolagem (a classe `tabela-scroll` do sistema) quando o conteúdo de fato passa da
 * largura. A sombra do sistema pinta uma faixa branca em cada ponta do contêiner; sobre o fundo bege da página, num contêiner que não
 * rola (a memória de cálculo em 1440 px, a última coluna da grade de bandeiras), ela parecia uma mancha. Aqui o contêiner nasce sem a
 * sombra, mede a largura do conteúdo e liga a classe só enquanto há o que rolar (e desliga quando a janela cresce). A região continua
 * focável pelo teclado, com nome acessível, como a tabela rolável sempre foi.
 */
export function ContaRolavel({ rotulo, children, className = "" }: { rotulo: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [rola, setRola] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setRola(el.scrollWidth > el.clientWidth + 2);
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    const tabela = el.querySelector("table");
    if (tabela) ro.observe(tabela);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      tabIndex={0}
      role="region"
      aria-label={rotulo}
      data-rola={rola ? "sim" : "nao"}
      className={`${rola ? "tabela-scroll" : "relative overflow-x-auto"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-energia ${className}`}
    >
      {children}
    </div>
  );
}
