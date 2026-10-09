"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Bloco recolhível (<details>) que abre sozinho a partir de um nível de profundidade.
 *
 * Generaliza o comportamento que a abertura do módulo já tinha (SobreEstaPagina): o texto não sai da página, continua no HTML do
 * servidor e abre por clique, toque ou teclado. Em `abreEm="analisar"` fica aberto em Analisar e Auditar; em `abreEm="auditar"`,
 * só em Auditar; em `abreEm="nunca"` o nível não mexe, e o leitor decide. Sem JavaScript fica recolhido e abre com o clique, porque
 * `<details>` é nativo. Quando o leitor abre ou fecha o bloco à mão, a escolha dura até a próxima troca de nível.
 */
export function DetalheDoNivel({
  resumo,
  children,
  abreEm = "analisar",
  className = "",
  classeResumo = "",
  dados,
}: {
  resumo: ReactNode;
  children: ReactNode;
  abreEm?: "analisar" | "auditar" | "nunca";
  className?: string;
  classeResumo?: string;
  /** Atributo data-* de identificação para testes e coleta (ex.: { "data-detalhe": "como-ler" }). */
  dados?: Record<string, string>;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (abreEm === "nunca") return;
    const raiz = document.querySelector(".modo-profundidade");
    const aplica = () => {
      const el = ref.current;
      if (!el) return;
      const modo = raiz?.getAttribute("data-modo");
      el.open = abreEm === "analisar" ? modo === "analisar" || modo === "auditar" : modo === "auditar";
    };
    aplica();
    if (!raiz) return;
    const mo = new MutationObserver(aplica);
    mo.observe(raiz, { attributes: true, attributeFilter: ["data-modo"] });
    return () => mo.disconnect();
  }, [abreEm]);
  return (
    <details ref={ref} className={className} {...dados}>
      <summary
        className={`inline-flex min-h-[44px] cursor-pointer items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao ${classeResumo}`}
      >
        {resumo}
      </summary>
      {children}
    </details>
  );
}
