"use client";

import { useRef, useState } from "react";
import { MENSAGEM_COPIA, copiarComFallback, type ResultadoCopia } from "@/lib/energia/evidencia";

/**
 * Link compartilhável de um painel da Geração: copia o endereço atual com o recorte que
 * está na URL (região, janela, perímetro, categoria, combustível, usina, fonte,
 * intervalo do gráfico e o estado das tabelas) e a âncora do painel, para que
 * quem receber abra o mesmo recorte (seção 7.3). Sem área de transferência, o endereço
 * aparece num campo já selecionado para cópia manual. No servidor sai só o botão.
 */
export function GeracaoLinkPainel({ ancora, rotulo = "Copiar link deste painel" }: { ancora: string; rotulo?: string }) {
  const [estado, setEstado] = useState<ResultadoCopia | null>(null);
  const [url, setUrl] = useState("");
  const campo = useRef<HTMLInputElement>(null);

  const copiar = async () => {
    setEstado(null);
    const endereco = `${window.location.origin}${window.location.pathname}${window.location.search}#${ancora}`;
    setUrl(endereco);
    const r = await copiarComFallback(endereco, {
      clipboard: window.isSecureContext && navigator.clipboard ? navigator.clipboard : null,
      selecionar: () => {
        const el = campo.current;
        if (!el) return false;
        el.value = endereco;
        el.select();
        return true;
      },
      copiarSelecao: () => document.execCommand("copy"),
    });
    setEstado(r);
  };

  const manual = estado !== null && estado !== "copiado";
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <button type="button" onClick={copiar} className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
        {rotulo}
      </button>
      <input
        ref={campo}
        readOnly
        aria-label="Endereço deste painel com o recorte atual"
        value={url}
        className={manual ? "min-h-[44px] w-full max-w-md border border-linha bg-superficie px-2 text-xs text-carvao" : "sr-only"}
        tabIndex={manual ? 0 : -1}
      />
      <span role="status" aria-live="polite" className="text-xs text-carvao-muted">
        {estado ? MENSAGEM_COPIA[estado] : ""}
      </span>
    </span>
  );
}
