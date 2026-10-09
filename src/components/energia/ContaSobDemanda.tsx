"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Bloco montado só quando o leitor pede (contrato dos módulos, seção 5.1: tabelas
 * grandes carregam sob demanda). O HTML do servidor leva o botão com o que há
 * dentro e quantas linhas; a tabela entra ao clicar e sai ao clicar de novo. Usado
 * nas tabelas de exploração e de auditoria da Conta de luz, nunca na tabela
 * equivalente de um gráfico, que já vem no próprio gráfico.
 *
 * `chaveUrl` é o prefixo da TabelaInterativa de dentro (busca, ordem, filtros e
 * página ficam em `?<chave>.q=`, `<chave>.ord=` e assim por diante): quem abre um
 * link com o estado da tabela, ou volta a ele pelo navegador, encontra a tabela
 * aberta naquele estado, em vez de um botão fechado que esconde o recorte
 * compartilhado.
 *
 * `abreEm` faz o bloco abrir sozinho a partir de um nível de profundidade (Analisar é o nível das tabelas) e fechar de volta em Entender,
 * como o `DetalheDoNivel`; escolhas feitas à mão duram até a próxima troca de nível. Em Entender, o bloco só abre por pedido: uma
 * escolha feita no gráfico (a distribuidora, por exemplo) não abre a tabela, que acrescentava milhares de pixels à leitura.
 */
export function ContaSobDemanda({
  rotulo,
  detalhe,
  chaveUrl,
  abreEm,
  children,
}: {
  rotulo: string;
  detalhe?: string;
  chaveUrl?: string;
  abreEm?: "analisar" | "auditar";
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  const atingiaAntes = useRef(false);
  useEffect(() => {
    if (!abreEm) return;
    const raiz = document.querySelector(".modo-profundidade");
    // abre ao chegar ao nível e fecha ao sair dele; em Entender desde o começo nada muda (quem chega por um link com o estado da tabela a vê aberta)
    const aplica = () => {
      const modo = raiz?.getAttribute("data-modo");
      const atinge = abreEm === "analisar" ? modo === "analisar" || modo === "auditar" : modo === "auditar";
      if (atinge) setAberto(true);
      else if (atingiaAntes.current) setAberto(false);
      atingiaAntes.current = atinge;
    };
    aplica();
    if (!raiz) return;
    const mo = new MutationObserver(aplica);
    mo.observe(raiz, { attributes: true, attributeFilter: ["data-modo"] });
    return () => mo.disconnect();
  }, [abreEm]);
  useEffect(() => {
    if (!chaveUrl) return;
    const conferir = () => {
      const chaves = Array.from(new URLSearchParams(window.location.search).keys());
      if (chaves.some((k) => k.startsWith(`${chaveUrl}.`))) setAberto(true);
    };
    conferir();
    window.addEventListener("popstate", conferir);
    return () => window.removeEventListener("popstate", conferir);
  }, [chaveUrl]);
  return (
    <div>
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
        className="inline-flex min-h-[44px] items-center gap-2 border border-linha bg-superficie px-3 text-left text-sm text-carvao hover:border-energia"
      >
        <span aria-hidden="true">{aberto ? "▾" : "▸"}</span>
        {aberto ? `Ocultar ${rotulo}` : `Mostrar ${rotulo}`}
        {detalhe && <span className="text-xs text-carvao-muted">({detalhe})</span>}
      </button>
      <div id={id} className={aberto ? "mt-3" : "hidden"}>
        {aberto ? children : null}
      </div>
    </div>
  );
}
