"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Aviso de rolagem para a tabela estática do kit (TabelaDados à vista), o mesmo recurso que a tabela ordenável já tem
 * (TabelaInterativa: a frase acima da tabela e a borda direita esmaecida por `data-mais-direita`, de globals.css). Auditoria de
 * 10/11/2026, achado 13: no celular, tabelas do Consignado saíam cortadas sem nada que dissesse que rolam para o lado.
 *
 * Vai dentro do `lead` da TabelaDados: acha a região rolável do próprio bloco (`[data-bloco-tabela] .tabela-scroll`), mede se a tabela é
 * de fato mais larga que a área visível e só então mostra a frase. Sem JavaScript nada aparece e a tabela segue rolável, como antes.
 * O lugar certo deste recurso é o kit (TabelaDados); enquanto ele não o tem, as páginas das Famílias usam este componente.
 */
export function DicaRolagem() {
  const ancora = useRef<HTMLSpanElement>(null);
  const [maisColunas, setMaisColunas] = useState(false);

  useEffect(() => {
    const bloco = ancora.current?.closest("[data-bloco-tabela], [data-tabela-a-vista]");
    const rolagem = bloco?.querySelector<HTMLElement>(".tabela-scroll");
    if (!rolagem) return;
    const medir = () => {
      const larga = rolagem.scrollWidth > rolagem.clientWidth + 2;
      setMaisColunas(larga);
      // a borda direita esmaece enquanto ainda há coluna escondida à direita
      if (larga && rolagem.scrollLeft + rolagem.clientWidth < rolagem.scrollWidth - 2) rolagem.setAttribute("data-mais-direita", "sim");
      else rolagem.removeAttribute("data-mais-direita");
    };
    medir();
    rolagem.addEventListener("scroll", medir, { passive: true });
    const observador = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(medir);
    observador?.observe(rolagem);
    return () => {
      rolagem.removeEventListener("scroll", medir);
      observador?.disconnect();
      rolagem.removeAttribute("data-mais-direita");
    };
  }, []);

  return (
    <span ref={ancora} data-dica-rolagem-ancora="">
      {maisColunas && (
        <span className="mt-2 block text-xs text-mineral" data-dica-rolagem="true">
          A tabela é mais larga que a tela: role para o lado para ver todas as colunas.
        </span>
      )}
    </span>
  );
}
