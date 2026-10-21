"use client";

import { useRef, useState } from "react";
import { MENSAGEM_COPIA, copiarComFallback, type ResultadoCopia } from "@/lib/energia/evidencia";
import { useTx } from "@/lib/energia/useIdioma";

/** As mensagens de cópia no idioma da página (o português é o da biblioteca de evidência). */
function mensagemCopia(estado: ResultadoCopia, tx: (pt: string, en: string) => string): string {
  const en: Record<ResultadoCopia, string> = {
    copiado: tx(MENSAGEM_COPIA.copiado, "Copied to the clipboard."),
    selecionado: tx(MENSAGEM_COPIA.selecionado, "Text selected: press Ctrl+C (or Copy, in the menu) to copy."),
    falhou: tx(MENSAGEM_COPIA.falhou, "Could not copy: select the text in the block and copy it."),
  };
  return en[estado];
}

/**
 * Link compartilhável de um painel da Inclusão energética: copia o endereço
 * atual com os filtros que estão na URL (medida, UF escolhidas, denominador,
 * territórios, situação) e a âncora do painel, para que quem receber abra o
 * mesmo recorte (seção 7.3: "URLs reproduzíveis"). Sem área de transferência, o
 * endereço aparece num campo já selecionado para cópia manual. No servidor sai
 * só o botão.
 */
export function InclusaoLinkPainel({ ancora, rotulo }: { ancora: string; rotulo?: string }) {
  const tx = useTx();
  const rotuloTela = rotulo ?? tx("Copiar link deste painel", "Copy link to this panel");
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
        {rotuloTela}
      </button>
      <input
        ref={campo}
        readOnly
        aria-label={tx("Endereço deste painel com os filtros atuais", "Address of this panel with the current filters")}
        value={url}
        className={manual ? "min-h-[44px] w-full max-w-md border border-linha bg-superficie px-2 text-xs text-carvao" : "sr-only"}
        tabIndex={manual ? 0 : -1}
      />
      <span role="status" aria-live="polite" className="text-xs text-carvao-muted">
        {estado ? mensagemCopia(estado, tx) : ""}
      </span>
    </span>
  );
}
