"use client";

import { useId, useRef, useState } from "react";
import { useTx } from "@/lib/energia/useIdioma";

/** Compartilhamento pelo endereço, sem expor identificador da conta ou depender do clipboard. */
export function CopiarLinkRecorte({ caminho, classe, titulo }: { caminho: string | (() => string); classe: string; titulo?: string }) {
  const tx = useTx();
  const id = useId();
  const [estado, definir] = useState<"livre" | "copiado" | "manual">("livre");
  const [manual, definirManual] = useState("");
  const campo = useRef<HTMLTextAreaElement>(null);
  async function copiar() {
    const destino = typeof caminho === "function" ? caminho() : caminho;
    const url = `${window.location.origin}${destino}`;
    try {
      await navigator.clipboard.writeText(url);
      definir("copiado");
      definirManual("");
    } catch {
      definirManual(url);
      definir("manual");
      requestAnimationFrame(() => { campo.current?.focus(); campo.current?.select(); });
    }
  }
  return (
    <div className="min-w-0">
      <button type="button" className={classe} onClick={copiar} aria-label={titulo ? `${tx("Copiar link", "Copy link")}: ${titulo}` : undefined}>
        {tx("Copiar link", "Copy link")}
      </button>
      <p role="status" className="text-xs leading-relaxed text-carvao-muted">
        {estado === "copiado" ? tx("Link copiado.", "Link copied.") : estado === "manual" ? tx("A cópia automática não foi permitida. Selecione e copie o endereço abaixo.", "Automatic copying was not allowed. Select and copy the address below.") : ""}
      </p>
      {manual && <label htmlFor={id} className="mt-2 block text-xs leading-relaxed text-carvao-muted">
        {tx("Endereço para compartilhar", "Address to share")}
        <textarea ref={campo} id={id} readOnly value={manual} rows={3} onFocus={(e) => e.target.select()} className="mt-1 block w-full min-w-0 border border-linha bg-papel p-2 text-sm leading-relaxed text-carvao" />
      </label>}
    </div>
  );
}
