"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Monta o conteúdo só quando o bloco chega perto da janela (ou ao toque no botão): tabelas e
 * fichas lidas sob demanda não pesam no HTML nem disparam leitura para quem não chega até elas
 * (seção 5.1 do contrato dos módulos). Bloco escondido pelo modo de profundidade não intersecta
 * a janela e, portanto, não lê nada. Sem IntersectionObserver, só o botão.
 */
export function AoAparecer({ children, espera, botao }: { children: ReactNode; espera: string; botao: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    const el = caixa.current;
    if (!el || montado || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) {
          setMontado(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [montado]);
  return (
    <div ref={caixa}>
      {montado ? (
        children
      ) : (
        <div className="space-y-2 text-sm text-carvao-muted">
          <p>{espera}</p>
          <button type="button" onClick={() => setMontado(true)} className="inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-carvao hover:border-energia">
            {botao}
          </button>
        </div>
      )}
    </div>
  );
}
