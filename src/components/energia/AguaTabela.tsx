"use client";

import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";

/**
 * A tabela equivalente de uma figura de Água e clima, sem abrir sozinha.
 *
 * A `TabelaInterativa` recolhida em Entender abre quando a linha selecionada muda por fora (mapa, gráfico, lista): leva o leitor à linha,
 * mas muda a altura da página sem pedido dele. Aqui a seleção só chega à tabela enquanto ela está à vista, aberta pelo leitor ou em Analisar
 * e Auditar (onde nunca é recolhida), e a linha escolhida segue marcada. Fechada, escolher outra entidade não a abre.
 *
 * A tabela é remontada quando o nível de profundidade muda: o que ela abriu por dentro em Analisar não a deixa aberta ao voltar a Entender.
 * Busca, filtros, ordem e página ficam na URL (chaveUrl) e voltam sozinhos.
 */
export function AguaTabela(props: ComponentProps<typeof TabelaInterativa>) {
  const raiz = useRef<HTMLDivElement>(null);
  const [aVista, setAVista] = useState(false);
  const [modo, setModo] = useState("");

  const medir = useCallback(() => {
    const r = raiz.current;
    if (!r) return;
    const conteudo = r.querySelector("[data-recolhivel]");
    // sem recolhimento (tabela curta) ela está sempre à vista; recolhida, só quando o conteúdo ocupa espaço
    setAVista(conteudo ? conteudo.getClientRects().length > 0 : true);
  }, []);

  useEffect(() => {
    medir();
    const nivel = raiz.current?.closest(".modo-profundidade") ?? null;
    if (!nivel) return;
    setModo(nivel.getAttribute("data-modo") ?? "");
    if (typeof MutationObserver === "undefined") return;
    const mo = new MutationObserver(() => {
      setModo(nivel.getAttribute("data-modo") ?? "");
      requestAnimationFrame(medir);
    });
    mo.observe(nivel, { attributes: true, attributeFilter: ["data-modo"] });
    return () => mo.disconnect();
  }, [medir]);

  return (
    <div ref={raiz} onClickCapture={() => requestAnimationFrame(medir)} data-tabela-agua="">
      <TabelaInterativa key={modo} {...props} selecionado={aVista ? props.selecionado : null} />
    </div>
  );
}
