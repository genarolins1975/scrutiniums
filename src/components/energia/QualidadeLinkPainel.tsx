"use client";

import { useRef, useState } from "react";
import { MENSAGEM_COPIA, copiarComFallback, type ResultadoCopia } from "@/lib/energia/evidencia";
import { useTx } from "@/lib/energia/useIdioma";

/** Mensagens da cópia em inglês (as portuguesas são as de MENSAGEM_COPIA). */
const MENSAGEM_COPIA_EN: Record<ResultadoCopia, string> = {
  copiado: "Copied to the clipboard.",
  selecionado: "Text selected: use Ctrl+C (or Copy, in the menu) to copy.",
  falhou: "Could not copy: select the text of the block and copy it.",
};

/**
 * Link compartilhável de um painel da Qualidade do serviço: copia o endereço atual com
 * os recortes que estão na URL (distribuidoras escolhidas, município do mapa, medida,
 * DEC ou FEC, filtros e ordem das tabelas, nível de profundidade) e a âncora do painel,
 * para que quem receber abra o mesmo recorte (seção 7.3, "URLs reproduzíveis"). Sem
 * área de transferência, o endereço aparece num campo já selecionado para cópia manual.
 * No servidor sai só o botão.
 */
export function QualidadeLinkPainel({ ancora, rotulo }: { ancora: string; rotulo?: string }) {
  const tx = useTx();
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
        {rotulo ?? tx("Copiar link deste painel", "Copy link to this panel")}
      </button>
      <input
        ref={campo}
        readOnly
        aria-label={tx("Endereço deste painel com os recortes atuais", "Address of this panel with the current selections")}
        value={url}
        className={manual ? "min-h-[44px] w-full max-w-md border border-linha bg-superficie px-2 text-xs text-carvao" : "sr-only"}
        tabIndex={manual ? 0 : -1}
      />
      <span role="status" aria-live="polite" className="text-xs text-carvao-muted">
        {estado ? tx(MENSAGEM_COPIA[estado], MENSAGEM_COPIA_EN[estado]) : ""}
      </span>
    </span>
  );
}
