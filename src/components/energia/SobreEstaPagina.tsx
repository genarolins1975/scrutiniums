"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Abertura do cabeçalho de um módulo, recolhida em Entender e aberta em Analisar e Auditar. As fontes e datas de referência ficam sempre à vista, fora deste bloco.
 *
 * Na r8, a resposta curta de cada página ficou curta (mediana de 36 palavras) e continuou abaixo da dobra: a 390 px o topo
 * mediano dela estava a 1.071 px, porque o parágrafo de abertura do módulo (50 palavras de mediana, até 108), a linha de
 * fontes e a legenda de siglas ocupavam mais de 400 px antes do primeiro painel. O texto não sai da página: continua no HTML
 * do servidor, abre por clique ou toque (e por teclado) e abre sozinho nos níveis mais fundos. Sem JavaScript fica recolhido
 * e abre com o clique, porque `<details>` é nativo.
 *
 * A legenda de siglas fica fora deste bloco e conta só o texto à vista: abrir o bloco acrescenta à legenda as siglas dele.
 */
export function SobreEstaPagina({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const raiz = document.querySelector(".modo-profundidade");
    const aplica = () => {
      const el = ref.current;
      if (!el) return;
      const modo = raiz?.getAttribute("data-modo");
      el.open = modo === "analisar" || modo === "auditar";
    };
    aplica();
    if (!raiz) return;
    const mo = new MutationObserver(aplica);
    mo.observe(raiz, { attributes: true, attributeFilter: ["data-modo"] });
    return () => mo.disconnect();
  }, []);
  return (
    <details ref={ref} className="cab-sobre mt-3 max-w-prose2" data-sobre-pagina="true">
      <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-energia-dark underline underline-offset-4">
        Ler a abertura da página
      </summary>
      {children}
    </details>
  );
}
